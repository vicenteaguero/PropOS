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
INTENTS = (
    "log_interaction",   # visit, call, email, meeting, whatsapp, note
    "create_person",
    "create_task",
    "log_transaction",
    "create_organization",
    "add_note",
    "query_count",       # "cuántas tareas abiertas tengo"
    "query_freeform",    # arbitrary read needing SQL
    "ambiguous",         # need user clarification
    "out_of_scope",      # intent is unclear / not actionable
)

SYSTEM_PROMPT = """\
Eres un clasificador de intents para un CRM inmobiliario chileno.
Recibes UN turno del usuario (texto o transcripción de audio en es-CL informal).
Devuelves UNA sola línea con formato `key=value` separados por espacios.

Intents válidos (campo `intent`):
  log_interaction      kind=VISIT|CALL|EMAIL|MEETING|WHATSAPP_LOG|NOTE
  create_person        kind=BUYER|SELLER|LANDOWNER|INVESTOR|OTHER
  create_task          kind=TODO|PENDING|GOAL
  log_transaction      direction=IN|OUT category=AD_SPEND|COMMISSION|...
  create_organization  kind=NOTARY|PORTAL|BANK|...
  add_note
  query_count          view=tasks_open_count|interactions_count|...
  query_freeform       (analítica que no calza con view enum)
  ambiguous            reason="<por qué>"
  out_of_scope

Campos posibles (úsalos solo si están en el input):
  person="<nombre tal cual>"   property="<título o dirección>"
  org="<nombre>"               project="<nombre>"
  duration_min=N               amount_clp=N (en pesos enteros, "50 lucas"=50000)
  due="<texto fecha>"          summary="<1 línea>"
  task_title="<texto>"

Reglas:
1. NO inventes datos. Si falta info → intent=ambiguous reason="...".
2. Slang: "lucas"=mil, "palos"=millón, "po/weón/cachái" ignóralos.
3. Auto-correcciones: usa la última versión ("anota visita... no, llamada" → kind=CALL).
4. Output: UNA línea, sin comillas innecesarias, sin explicaciones extra.
5. Si el usuario dice "anota algo importante / después te cuento / déjalo así"
   sin contenido concreto → intent=ambiguous reason="sin contenido accionable".
6. Cuando el usuario aclara entre dos opciones ("X, no Y") usa X y NO marques
   ambiguous: el usuario ya disambiguó.

Ejemplos:
  in:  "loguea visita con Juan Pérez en Apoquindo, 30 min"
  out: intent=log_interaction kind=VISIT person="Juan Pérez" property="Apoquindo" duration_min=30 summary="visita"

  in:  "cuántas tareas abiertas tengo"
  out: intent=query_count view=tasks_open_count

  in:  "agéndame algo con la María mañana"
  out: intent=ambiguous reason="varias María, falta apellido"
"""


@dataclass
class ClassifierResult:
    intent: str
    fields: dict[str, Any] = field(default_factory=dict)
    raw: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    headers: dict[str, str] = field(default_factory=dict)


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
        max_tokens=120,  # one line is enough; cap so the model doesn't ramble
    )
    completion = raw_response.parse()
    headers = dict(raw_response.headers)

    line = (completion.choices[0].message.content or "").strip().splitlines()[0] if completion.choices else ""
    fields = parse_kv(line)
    intent = str(fields.pop("intent", "out_of_scope"))
    if intent not in INTENTS:
        intent = "out_of_scope"

    usage = completion.usage
    actual = (usage.prompt_tokens if usage else 0) + (usage.completion_tokens if usage else 0)
    if actual:
        get_rate_limiter().record_response(
            settings.anita_provider, settings.anita_model, actual, headers=headers
        )
    return ClassifierResult(
        intent=intent,
        fields=fields,
        raw=line,
        tokens_in=usage.prompt_tokens if usage else 0,
        tokens_out=usage.completion_tokens if usage else 0,
        headers=headers,
    )
