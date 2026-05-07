"""Single-shot intent + entity extraction.

The whole point: one cheap LLM call, no tool definitions, no tenant
snapshot, key=value output. The expensive resolution work lives in
``resolver.py`` (rapidfuzz) and ``dispatcher.py`` (deterministic
domain ops).

KV format chosen over JSON for token density (~40% less). Parser is
lenient: ignores unknown keys, accepts missing optional fields.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.core.config.settings import settings
from app.core.logging.logger import get_logger

logger = get_logger("ANITA_CLASSIFY")

# Intents the classifier may emit. Keep tight — every entry costs prompt tokens.
# The PER-INTENT schema lives in `intent_registry.py`, NOT here.
INTENTS = (
    "log_interaction",
    "create_person",
    "create_task",
    "log_transaction",
    "create_organization",
    "create_property",
    "create_campaign",
    "add_note",
    "attach_photos_to_property",
    "create_document_from_photos",
    "query_count",
    "query_freeform",
    "ambiguous",
    "out_of_scope",
)

SYSTEM_PROMPT = """\
Clasificador de intents para CRM inmobiliario chileno.
Input: un turno del usuario (texto o audio es-CL informal).
Output: UNA línea por acción con `key=value` separados por espacios.
Si hay varias acciones, una por línea (sin bullets ni numeración).

Intents válidos (campo `intent`):
  log_interaction, create_person, create_task, log_transaction,
  create_organization, create_property, create_campaign, add_note,
  attach_photos_to_property, create_document_from_photos,
  query_count, query_freeform, ambiguous, out_of_scope

Vocabulario universal (usa los que apliquen):
  kind=...           sub-tipo (VISIT/BUYER/TODO/IN/OUT/NOTARY/casa/etc.)
  person="..."       nombre persona            full_name="..."  alias de person
  property="..."     título/dirección          title="..."      alias de property
  org="..."          nombre organización       name="..."       alias name
  project="..."      proyecto
  amount=N           pesos enteros ("50 lucas"=50000, "2 palos"=2000000)
  duration_min=N     minutos
  due="..."          fecha relativa o ISO
  summary="..."      resumen 1 línea
  body="..."         texto libre (solo add_note)
  rut="..."          RUT chileno formato 12.345.678-9
  phone="..."        teléfono formato +56...
  email="..."
  view=...           tasks_open_count | interactions_count | etc.
  direction=IN|OUT   category=AD_SPEND|COMMISSION|RENT|UTILITY|...
  channel=META|GOOGLE|PORTAL|EMAIL|OFFLINE|OTHER

Reglas:
1. NO inventes datos. Falta info → intent=ambiguous reason="...".
2. Slang: lucas/palos para montos. Ignora "po/weón/cachái".
3. Auto-correcciones: usa la última versión ("visita... no, llamada" → kind=CALL).
4. Si suena vago ("algo importante / después te cuento") → ambiguous.
5. Aclaración explícita ("X, no Y") NO es ambiguous: usa X.
6. Multi-acción: una línea por acción.
7. NO emitas atributos de detalle (m², dormitorios, RUT, etc.) — solo el
   vocabulario universal. Un segundo paso recoge esos detalles si los necesita.
8. "anótate / anota / registra" son verbos genéricos: NO los traduzcas a
   add_note si ya hay un intent más específico (log_interaction, create_*).
   add_note SOLO cuando el usuario quiere guardar texto libre sin estructura.
9. NUNCA emitas add_note como complemento de otro intent. Si capturaste
   create_person/create_property/log_*, los detalles asociados (teléfono,
   RUT, atributos) van en ese intent — no como nota suelta.
10. Si el contenido es ambiguo o sin acción concreta → solo `intent=ambiguous`
    (NO mezcles con add_note ni otros intents).
11. Valores numéricos: OMITE el campo si el usuario no dijo un número concreto.
    NUNCA uses 0 como default. NO inventes amounts ni precios.
12. RUT chileno: formato `12.345.678-9` o `12345678-9`. Si el usuario lo
    dicta hablado ("18 millones 573 mil 892 guion K"), reconstruye el
    número y emítelo como `rut="18.573.892-K"` dentro del intent
    create_person. Phone va como `phone="+56..."`.

Ejemplos:
  in:  registra gasto 50 lucas / 50 mil pesos en publicidad de Meta
  out: intent=log_transaction direction=OUT category=AD_SPEND amount=50000 channel=META

  in:  loguea visita con Juan en Apoquindo, 30 min
  out: intent=log_interaction kind=VISIT person="Juan" property="Apoquindo" duration_min=30

  in:  agrega depto en Las Condes, 80m2, 3 dormitorios, 250 millones
  out: intent=create_property title="depto Las Condes" amount=250000000

  in:  cuántas tareas abiertas tengo
  out: intent=query_count view=tasks_open_count

  in:  agrega comprador Pedro Soto y loguéame visita con Juan
  out: intent=create_person kind=BUYER person="Pedro Soto"
       intent=log_interaction kind=VISIT person="Juan"

  in:  agrega comprador Tomás Vergara, RUT 18 millones 573 mil 892 K,
       teléfono +56 9 8743 2110
  out: intent=create_person kind=BUYER full_name="Tomás Vergara" rut="18.573.892-K" phone="+56987432110"

  in:  agrega esas fotos a la casa de Av. Providencia 1711
  out: intent=attach_photos_to_property property="Av. Providencia 1711"

  in:  esas fotos son del depto de Las Condes
  out: intent=attach_photos_to_property property="depto Las Condes"

  in:  hazme un documento con esas fotos llamado tasación Apoquindo
  out: intent=create_document_from_photos title="tasación Apoquindo"
"""


@dataclass
class Action:
    """One action emitted by the classifier (one line of KV output)."""

    intent: str
    fields: dict[str, Any] = field(default_factory=dict)
    raw: str = ""


@dataclass
class ClassifierResult:
    actions: list[Action]
    raw: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    headers: dict[str, str] = field(default_factory=dict)

    @property
    def primary(self) -> Action:
        """First action — convenient for single-action callers."""
        return self.actions[0] if self.actions else Action(intent="out_of_scope")

    # Back-compat shims so existing single-action consumers keep working.
    @property
    def intent(self) -> str:
        return self.primary.intent

    @property
    def fields(self) -> dict[str, Any]:
        return self.primary.fields


_KV_RE = re.compile(r'(\w+)=(?:"([^"]*)"|(\S+))')


def parse_kv(line: str) -> dict[str, Any]:
    """`a=1 b="x y" c=foo` → {a:'1', b:'x y', c:'foo'}. Lenient, no errors."""
    out: dict[str, Any] = {}
    for m in _KV_RE.finditer(line):
        key = m.group(1)
        value = m.group(2) if m.group(2) is not None else m.group(3)
        # Numeric coerce when it looks like an int (duration_min, amount_clp).
        if value.isdigit():
            out[key] = int(value)
        else:
            out[key] = value
    return out


async def classify(user_text: str) -> ClassifierResult:
    """Single LLM call. No tools, no snapshot, KV output.

    Returns the parsed intent + fields plus the exact token usage for
    profiling. The caller is responsible for resolution and dispatch.
    """
    from openai import AsyncOpenAI

    from app.features.anita.rate_limiter import get_rate_limiter

    # Rough token estimate before send → limiter blocks if budget tight.
    est_tokens = (len(SYSTEM_PROMPT) + len(user_text)) // 4
    await get_rate_limiter().acquire(settings.anita_provider, settings.anita_model, est_tokens)

    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    raw_response = await client.chat.completions.with_raw_response.create(
        model=settings.anita_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_text.strip()},
        ],
        temperature=0,
        # Up to ~6 actions per turn before truncating. Single-action turns use ~30.
        max_tokens=300,
    )
    completion = raw_response.parse()
    headers = dict(raw_response.headers)

    raw_text = (completion.choices[0].message.content or "").strip() if completion.choices else ""
    actions: list[Action] = []
    for ln in raw_text.splitlines():
        ln = ln.strip().lstrip("-* ").strip()
        if not ln or "intent=" not in ln:
            continue
        f = parse_kv(ln)
        intent = str(f.pop("intent", "out_of_scope"))
        if intent not in INTENTS:
            intent = "out_of_scope"
        actions.append(Action(intent=intent, fields=f, raw=ln))
    if not actions:
        actions = [Action(intent="out_of_scope", raw=raw_text)]

    usage = completion.usage
    actual = (usage.prompt_tokens if usage else 0) + (usage.completion_tokens if usage else 0)
    if actual:
        get_rate_limiter().record_response(settings.anita_provider, settings.anita_model, actual, headers=headers)
    return ClassifierResult(
        actions=actions,
        raw=raw_text,
        tokens_in=usage.prompt_tokens if usage else 0,
        tokens_out=usage.completion_tokens if usage else 0,
        headers=headers,
    )


_PASS2_TEMPLATE = """\
Extrae estos campos del input del usuario para una intención `{intent}`.
Devuelve UNA línea KV (key=value separados por espacios).

Reglas:
- Omite campos que no aparezcan en el input. NUNCA uses null/none/0 como default.
- Valores con espacios van entre comillas: `owner_name="Alberto Hernández"`.
- Valores numéricos sin comillas: `area_m2=5000`.
- Booleanos: `has_storage=true` o `has_storage=false`.

Campos:
{fields}

Ya capturados (no los repitas): {captured}
"""


async def extract_details(
    intent: str,
    user_text: str,
    captured: dict[str, Any],
    detailed: list[tuple[str, str]],
) -> tuple[dict[str, Any], int, int]:
    """Pass-2 schema-targeted extraction.

    Only called when ``intent_registry.needs_pass_two`` says yes. Prompt
    is tiny (one intent, one field list). Returns (new_fields, tokens_in,
    tokens_out).
    """
    from openai import AsyncOpenAI

    from app.features.anita.rate_limiter import get_rate_limiter

    fields_block = "\n".join(f"  {n}: {desc}" for n, desc in detailed)
    captured_str = ", ".join(f"{k}={v}" for k, v in captured.items()) or "(ninguno)"
    system = _PASS2_TEMPLATE.format(intent=intent, fields=fields_block, captured=captured_str)

    est_tokens = (len(system) + len(user_text)) // 4
    await get_rate_limiter().acquire(settings.anita_provider, settings.anita_model, est_tokens)

    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )
    raw_response = await client.chat.completions.with_raw_response.create(
        model=settings.anita_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_text.strip()},
        ],
        temperature=0,
        max_tokens=200,
    )
    completion = raw_response.parse()
    headers = dict(raw_response.headers)

    line = (completion.choices[0].message.content or "").strip().splitlines()
    line = next((ln.strip().lstrip("-* ").strip() for ln in line if "=" in ln), "")
    new_fields = parse_kv(line)
    new_fields.pop("intent", None)

    usage = completion.usage
    tin = usage.prompt_tokens if usage else 0
    tout = usage.completion_tokens if usage else 0
    if tin + tout > 0:
        get_rate_limiter().record_response(settings.anita_provider, settings.anita_model, tin + tout, headers=headers)
    return new_fields, tin, tout
