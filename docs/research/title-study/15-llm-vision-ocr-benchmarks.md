# 15 — LLM Vision/OCR Benchmarks para Estudio de Títulos Chileno

Audiencia: engineer senior PropOS. Objetivo: decidir stack de modelos vision-language para extracción de escrituras públicas, FNA del CBR, certificados SII/DOM, y flags de cláusulas. Fecha de corte: 2026-05-07.

---

## TL;DR (decisiones)

- **MVP (v1)**: Claude Sonnet 4.6 + prompt caching agresivo + Pydantic/instructor schemas estrictos. Single-model, single-pass por documento.
- **Producción (v2)**: split por complejidad — Haiku 4.5 para clasificación y OCR de páginas planas; Sonnet 4.6 para extracción estructurada; Opus 4.7 (1M) sólo para razonamiento de cadena de títulos > 10 transferencias.
- **Validación cruzada**: Gemini 2.5 Pro como segundo dictamen en producción (2nd opinion sobre `parties` y `rol_sii`); tasa de discrepancia gating manual.
- **Nunca solos para mutaciones**: todo output AI pasa por `pending_proposals` con cross-check determinístico (regex RUT, Σ cuotas = 100%, comparación FNA vs escrituras).
- **Cerebras Llama 3.3 70B**: NO sirve — text-only, sin vision. Reservar sólo para tareas de razonamiento sobre texto ya extraído (resumen cadena, redacción explicación broker).

Alertas:

1. **Hallucination floor en legal**: Stanford "Large Legal Fictions" (academic.oup.com/jla/article/16/1/64) reporta ChatGPT-4 con 58% hallucination rate y Llama 2 con 88% en queries verificables sobre case law federal. No es benchmark chileno ni notarial, pero el orden de magnitud manda — cualquier flujo que dependa del LLM como "fuente de verdad" sin verificación determinística es indefendible.
2. **Tokenizer Opus 4.7**: hasta +35% tokens vs 4.6 para el mismo texto (platform.claude.com/docs/en/about-claude/pricing). Estimaciones de costo basadas en benchmarks 4.6 subestiman 4.7 por márgen importante.
3. **Vision token math**: `tokens ≈ (width × height) / 750`. Una página A4 escaneada a 200 DPI (~1654×2339) ≈ 5159 tokens por página. 10 páginas color = ~52k input tokens *antes* del system prompt. Sin caching, esto come márgen rápido.

---

## 1. Modelos candidatos — tabla maestra

Precios USD / 1M tokens (MTok). Vista mayo 2026.

| Modelo | Input | Output | Cache 5m write | Cache hit | Contexto | Vision | Notas |
|---|---|---|---|---|---|---|---|
| Claude Opus 4.7 | $5 | $25 | $6.25 | $0.50 | 1M flat | 3.75 MP, 2576 px long edge, 98.5% visual acuity | Tokenizer +35% vs 4.6 |
| Claude Opus 4.6 | $5 | $25 | $6.25 | $0.50 | 1M flat | 1.25 MP, 1568 px | Fast mode disponible 6x ($30/$150) |
| Claude Sonnet 4.6 | $3 | $15 | $3.75 | $0.30 | 1M flat | 1.25 MP | **Sweet spot legal extraction** |
| Claude Haiku 4.5 | $1 | $5 | $1.25 | $0.10 | 200k | full multimodal, near-Sonnet | MMMU 73.2%, 90% de Sonnet en agentic |
| GPT-5 | $1.25 | $10 | — | — | 400k | sí | Legacy gen, aún disponible |
| GPT-5 mini | $0.25 | $2 | — | — | 400k | sí | Tier económico OpenAI |
| GPT-5.4 mini | $0.75 | $4.50 | — | — | 400k | sí | 2x más rápido que GPT-5 mini |
| GPT-5.5 | $5 | $30 | — | — | — | sí | Frontier OpenAI 2026-04-24 |
| Gemini 2.5 Pro | $1.25 (≤200k) / $2.50 (>200k) | $10 / $15 | $0.125 / $0.25 | — | 1M (2M imminent) | sí, doc understanding fuerte | Mejor recall a 1M (99.7%) |
| Gemini 2.5 Flash | $0.30 | $2.50 | $0.03 | — | 1M | sí | Costo más bajo del tier multimodal |
| Cerebras Llama 3.3 70B | gratis dev | gratis dev | — | — | 128k | **NO** (text-only) | 2500 tok/s, sólo razonamiento texto |
| Qwen2.5-VL 7B/72B | self-host | self-host | — | — | 32k | sí, 29 idiomas, video | OmniDocBench competitivo |
| InternVL2.5-4B | self-host | self-host | — | — | — | sí, OCR-tuned | Compacto, 300M ViT + 3B Qwen2.5 |
| MolmoE / OlmOCR-2-7B | self-host | self-host | — | — | — | sí | OlmOCR-2 82.4 en olmOCR-Bench |

**Latencia observada (artificialanalysis.ai, web sources)**:

- Cerebras Llama 3.3: ~2500 tok/s (record). Por turno <500ms para 1k output.
- Haiku 4.5: ~150 tok/s, TTFT ~300ms.
- Sonnet 4.6: ~80 tok/s, TTFT ~500ms.
- Opus 4.7: ~50 tok/s, TTFT ~800ms.
- Gemini 2.5 Flash: ~200 tok/s.
- Gemini 2.5 Pro: ~80 tok/s.

Para un estudio de 5 páginas × ~3.5k tokens vision + 2k system + 5k output, latencia E2E:

- Sonnet 4.6: ~25-35s.
- Opus 4.7: ~40-60s.
- Gemini Flash: ~15-25s.

Aceptable para flujo broker async (review later). No aceptable para chat sincronico.

---

## 2. Benchmarks legales (¿qué tan mal alucina?)

### Stanford "Large Legal Fictions" (Dahl et al., arxiv 2401.01301, JLA 16(1):64)

Único estudio académico riguroso del dominio. Probó ChatGPT-3.5/4, PaLM 2, Llama 2 sobre queries verificables a case law federal US (District + Circuit + Supreme).

Resultados clave:

- **ChatGPT-4: 58% hallucination rate** en queries directas.
- **Llama 2: 88%** (peor del lote).
- **Por complejidad**: hallucinations escalan de bajas en metadata tasks a 59-92% en doctrinal synthesis.
- **Por jerarquía**: Supreme Court < Circuit < District. Modelos saben más de Roe v Wade que del 9° District de Idaho.
- **Por prominencia**: casos más citados → menos errores.
- **Recencia**: peor para casos muy nuevos (no train data) y muy viejos.
- **Counterfactual bias**: LLMs aceptan premisas legales falsas del usuario en lugar de corregirlas.

**Tipología (importa para diseño de prompt)**:

1. Closed-domain (output infiel al input prompt) — *este* es el que más nos pega en extracción de escrituras: el modelo "limpia" o sintetiza datos del PDF.
2. Open-domain training corpus (creative pero sin soporte).
3. Open-domain factuality (contradice el mundo).

### LegalBench (HazyResearch/Stanford, 162 tasks)

GPT-4 lidera. En CUAD (38 contract clause tasks) GPT-4/3.5/Claude-1 con balanced accuracy ≥88%. **No reporta hallucination rate canónico** — mide accuracy clasificación. Para nosotros sirve como prior: clausula clasificación es donde los LLMs SON buenos. Extracción cuantitativa estructurada (cuotas, %, RUT) NO está cubierta.

### LLM Hallucination Index 2026 (BullshitBench v2, AnyAPI)

Claude Sonnet 4.6 lidera consistencia factual en QA largo. Modelos "reasoning" (o1, GPT-5 reasoning) sufren más hallucinations que sus contrapartes non-reasoning en factual QA — el reasoning amplifica fabricación si el contexto no tiene la respuesta.

**Implicancia para PropOS**: usar reasoning mode (extended thinking) sólo cuando hay razonamiento *real* requerido (cadena de transferencias, coherencia parties multi-doc). Para extracción simple "qué dice esta foja", reasoning empeora.

---

## 3. Prompt patterns para extracción de escritura compraventa

### 3.1 System prompt vision (estampillas/timbre CBR/FNA)

```text
Eres un extractor de datos notariales chilenos. Tu única función es transcribir
literalmente lo que aparece en la imagen de un documento legal chileno. Reglas
no negociables:

1. NO inventes datos. Si un campo no aparece legible, devuelve null y agrega un
   item a `extraction_warnings` con el field_path y el motivo (occluded,
   illegible, missing, ambiguous).
2. NO normalices, NO traduzcas, NO completes. Mantén la grafía exacta del
   documento (mayúsculas, tildes, abreviaturas).
3. NO razones sobre legalidad ni implicancias. Sólo transcribe.
4. Si ves un timbre seco, sello CBR, foja/número/año, transcribelo a
   `cbr.timbre`.
5. Si ves "Fojas N° XXX vta. del año YYYY", emite cbr.foja=XXX,
   cbr.tipo_foja="vuelta", cbr.anio=YYYY.
6. Para cada campo extraído, agrega `field_evidence[<path>]` con la cita literal
   (substring textual del documento) que justifica el valor. Sin evidencia,
   el campo es null.
7. RUTs: extrae con DV. Si dudas del DV, marca warning. NO calcules el DV.

El output debe validar contra el schema JSON adjunto. Cualquier desviación
genera retry automático.
```

### 3.2 User prompt + JSON schema (Pydantic v2)

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal
from decimal import Decimal

RUT_RE = r"^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$"

class FieldEvidence(BaseModel):
    field_path: str
    quote: str = Field(..., min_length=1, max_length=500)
    page: int

class Party(BaseModel):
    nombre_completo: str
    rut: str = Field(..., pattern=RUT_RE)
    estado_civil: Literal[
        "soltero", "casado", "viudo", "divorciado", "conviviente_civil", "desconocido"
    ]
    regimen_patrimonial: Literal[
        "sociedad_conyugal", "separacion_total_bienes",
        "participacion_gananciales", "no_aplica", "desconocido"
    ] | None = None
    cuota_derechos: Decimal | None = Field(None, ge=0, le=1)
    rol: Literal["vendedor", "comprador", "compareciente", "representante"]

class Inmueble(BaseModel):
    rol_sii: str = Field(..., pattern=r"^\d{1,5}-\d{1,5}$")
    direccion: str
    comuna: str
    region: str
    deslindes: dict[Literal["norte","sur","oriente","poniente"], str]
    superficie_m2: Decimal | None = None
    inscripcion_anterior: str | None = Field(
        None, description="Foja-Número-Año del título previo, formato 'F1234N567A2019'"
    )

class Compraventa(BaseModel):
    notaria: str
    notario: str
    fecha_escritura: str  # ISO 8601, no parsear inferido
    repertorio: str
    parties: list[Party] = Field(..., min_length=2)
    inmueble: Inmueble
    precio_clp: Decimal | None = None
    precio_uf: Decimal | None = None
    forma_pago: str | None = None
    clausulas_relevantes: list[Literal[
        "prohibicion_enajenar", "hipoteca", "usufructo",
        "servidumbre", "fideicomiso", "condicion_resolutoria",
        "pacto_retroventa", "ninguna_detectada"
    ]]
    field_evidence: list[FieldEvidence]
    extraction_warnings: list[str] = []

    @field_validator("parties")
    @classmethod
    def cuotas_suman_100(cls, v: list[Party]) -> list[Party]:
        compradores = [p for p in v if p.rol == "comprador"]
        cuotas = [p.cuota_derechos for p in compradores if p.cuota_derechos is not None]
        if cuotas and sum(cuotas) != Decimal("1"):
            raise ValueError(f"Σ cuotas compradores = {sum(cuotas)}, debe ser 1.0")
        return v
```

### 3.3 Few-shot (1-shot suficiente con Sonnet/Opus)

Adjuntar 1 caso golden completo con (a) imagen real anonimizada, (b) JSON output esperado, (c) explicación corta de 2-3 puntos sutiles ("rol SII viene en margen superior derecho", "deslindes en orden N-S-O-P pero el documento puede usar otro orden"). Few-shot vision es caro (consume tokens de imagen × cada shot) — 1 shot es el sweet spot. 3+ shots no mejora medible y multiplica costo.

### 3.4 Validación cuotas hereditarias (caso post-mortem)

Cuando hay posesión efectiva en la cadena, el modelo debe emitir cuotas según testamento o sucesión intestada. La validación `Σ = 100%` es no-negociable. Si el modelo emite cuotas que no suman, **no enviar al usuario** — instructor reintenta (max 3) con el error de Pydantic en el prompt; si tras 3 falla, escalation manual con flag `inheritance_quota_inconsistency`.

---

## 4. Mitigación de hallucination (capas)

Defense-in-depth. Ninguna capa por sí sola alcanza producción legal.

**Capa 1 — JSON schema estricto (Pydantic + instructor)**

Usar `instructor.from_provider("anthropic/claude-sonnet-4-6")` con `response_model=Compraventa`. Auto-retry con error de validación inyectado al prompt. Bloquea outputs malformados; NO bloquea hallucinations semánticas.

**Capa 2 — Citation enforcement**

Cada field requiere `field_evidence` con `quote` ≥1 char. Post-procesar: para cada evidence, verificar que `quote` existe substring (fuzzy match Levenshtein ≤2 por carácter de OCR noise) en el texto OCR de la página citada. Si no matchea → field se setea a null y se logea hallucination_event.

**Capa 3 — Chain-of-Verification (CoVe, arxiv 2309.11495)**

Aplicable a campos críticos (parties, rol_sii, precio):

1. Draft (modelo extrae normal).
2. Plan: modelo genera lista de preguntas verificables sobre su propio draft ("¿el RUT 12.345.678-9 aparece textualmente en la página 2?", "¿la palabra 'vendedor' aparece junto al nombre Pérez?").
3. Execute: cada pregunta se responde **en una llamada separada** (sin draft en contexto) con prompt minimal + imagen.
4. Final: si ≥1 verification falla, regenerar draft con failures como constraints.

CoVe es caro (≈3x tokens), úsese sólo si la confianza inicial es baja o si el documento está marcado como "alta criticidad".

**Capa 4 — Cross-validation Tier1 vs Tier2**

Tier1 = Sonnet 4.6 (extracción primaria). Tier2 = Gemini 2.5 Pro (segundo dictamen, mismo prompt + schema). Comparar campos críticos: `parties[].rut`, `inmueble.rol_sii`, `precio_uf`. Discrepancia ≥1 campo crítico → flag para review manual; nunca auto-resolución.

**Capa 5 — Cross-doc coherence**

FNA del CBR list parties; escritura más reciente list parties. Si parties no overlap (hash por RUT), flag `cadena_incoherente`. Esto es lógica determinística sobre outputs LLM; no LLM-on-LLM.

**Capa 6 — Golden cases + continuous eval**

20+ escrituras chilenas reales (anonimizadas), con ground truth manual verificada por abogado. Ejecutar en CI tras cada cambio de prompt o modelo. Threshold: 0 hallucinations en parties/RUT/rol_sii; ≤5% mismatch en deslindes (texto largo, OCR noise tolerable).

**Capa 7 — temperature 0**

Siempre. Para todo. La creatividad es el enemigo en este flujo.

---

## 5. Cost estimation

### 5.1 Por estudio (5-10 páginas)

Asumiendo escaneos a 200 DPI, A4 (1654×2339 px): cada página ≈ 5159 tokens vision. Promedio 7 pgs → 36k vision input.

Adicional: system prompt (~2k) + 1-shot (~6k incluyendo imagen ejemplo) + tool definitions Pydantic (~1k) = ~9k. Total input ~45k. Output JSON estructurado ~5k.

| Modelo | Input cost | Output cost | Total/estudio | Con 90% cache hit en system+shot |
|---|---|---|---|---|
| Sonnet 4.6 | 45k × $3/M = $0.135 | 5k × $15/M = $0.075 | **$0.21** | ~$0.13 |
| Opus 4.7 | 45k × $5/M = $0.225 (+35% tokenizer ≈ $0.30) | 5k × $25/M = $0.125 (×1.35 ≈ $0.169) | **$0.47** | ~$0.30 |
| Haiku 4.5 | 45k × $1/M = $0.045 | 5k × $5/M = $0.025 | **$0.07** | ~$0.04 |
| Gemini 2.5 Pro | 45k × $1.25/M = $0.056 | 5k × $10/M = $0.05 | **$0.11** | ~$0.07 (caching $0.125/M) |
| Gemini 2.5 Flash | 45k × $0.30/M = $0.014 | 5k × $2.50/M = $0.0125 | **$0.026** | ~$0.018 |
| GPT-5 | 45k × $1.25/M = $0.056 | 5k × $10/M = $0.05 | **$0.11** | n/a |

### 5.2 1000 estudios/mes

Sin caching (sólo Sonnet 4.6): $210/mes. Con caching agresivo (system+1-shot reusados → ~22k cacheable de 45k): cache write 1× × $3.75/M × 22k = $0.083 (one-time amortizado), cache read 999× × $0.30/M × 22k = $6.59. Input non-cached 1000 × 23k × $3/M = $69. Output 1000 × 5k × $15/M = $75. **Total con cache ≈ $151/mes**. Ahorro ~30% vs no-cache (porque sólo system+shot son cacheables; el documento per se NO se reutiliza entre estudios).

Con split Sonnet+Haiku (Haiku para clasificación, Sonnet para extracción de las páginas core, ~3 págs out de 7): ~$0.10/estudio → **~$100/mes**.

Tier reasoning Opus para 5% de estudios complejos (cadena >10 transferencias): 50 × $0.30 = $15 adicional.

**Presupuesto realista 1000 estudios/mes: $100-150 LLM directo**, sin contar OCR pre-procesamiento (PaddleOCR-VL self-hosted o Gemini Flash) ni segundo dictamen Tier2. Con segundo dictamen Gemini Pro en 100% de estudios: +$110/mes. Total stack producción: **~$260/mes para 1000 estudios** = $0.26/estudio en LLM costs.

A escala (10k/mes), batch API con 50% off → ~$1300/mes. Sigue marginal vs ingreso por estudio.

### 5.3 Caveats

- Tokenizer Opus 4.7 +35%: si v2 usa Opus en cualquier path crítico, los números arriba están subestimados.
- Long context surcharge Gemini Pro: prompts >200k saltan a $2.50/$15. Una FNA larga + cadena 20 escrituras puede pasarlo. Sonnet/Opus 1M flat NO tienen surcharge — ventaja real.
- Vision tokens en imágenes color a 300 DPI ≈ 2.25× más que 200 DPI. Downscale a 200 DPI antes de mandar.
- Prompt cache Anthropic TTL 5min: en flujo broker async, si el job tarda >5min entre páginas, se pierde el cache. Usar 1h cache write (2x cost) cuando jobs son largos.

---

## 6. Stack recomendado

```python
# backend/app/features/title_study/llm_extractor.py
import instructor
from anthropic import Anthropic
from pydantic import BaseModel
from .schemas import Compraventa, FNA, CertificadoSII

CLIENT = instructor.from_anthropic(
    Anthropic(),
    mode=instructor.Mode.ANTHROPIC_TOOLS,
)

SYSTEM_PROMPT = open("prompts/extractor_v1.txt").read()
ONE_SHOT = json.loads(open("prompts/golden_1shot.json").read())

def extract_compraventa(images: list[bytes], doc_id: str) -> Compraventa:
    return CLIENT.chat.completions.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        temperature=0,
        system=[
            {"type": "text", "text": SYSTEM_PROMPT,
             "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": json.dumps(ONE_SHOT),
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{
            "role": "user",
            "content": [
                *[{"type": "image", "source": {...}} for img in images],
                {"type": "text", "text": f"Extrae compraventa. doc_id={doc_id}"},
            ],
        }],
        response_model=Compraventa,
        max_retries=3,
    )
```

Stack:

- **Anthropic SDK** primary (anthropic-python 0.40+).
- **Pydantic v2** schemas in `backend/app/features/title_study/schemas/`.
- **instructor** for retry+validation loop.
- **Fallback chain**: Anthropic 5xx/timeout → Gemini 2.5 Pro (`google-genai` SDK) con el mismo Pydantic schema (instructor soporta both providers); Gemini fail → Cerebras Llama 3.3 70B sólo si la tarea es text-only post-OCR.
- **OCR pre-stage** opcional: PaddleOCR-VL (self-host) emite texto + bounding boxes; el texto va al system prompt como hint, las imágenes siguen al modelo. Reduce hallucinations en RUT/números (modelo cita texto OCR en `field_evidence.quote`).

---

## 7. ¿Cuándo SÍ usar LLM, cuándo NO?

**SÍ — el LLM aporta valor real**:

- **Extracción de FNA del CBR**: PDF con timbres y firma, layout variable; LLM vision es radicalmente mejor que OCR clásico aquí.
- **Resumen de cadena de títulos**: dado N escrituras ya extraídas a JSON, el LLM redacta narrativa coherente para el broker. Es trabajo de redacción, low-stakes factual.
- **Detección de cláusulas no-estándar**: "este caso tiene una servidumbre minera atípica con condición resolutoria" — clasificación + razonamiento, donde GPT-4/Claude lideran (LegalBench CUAD 88%+).
- **Coherencia parties multi-doc**: razonar sobre conjuntos de RUTs y detectar mismatches semánticos (alias, cambio de apellido por matrimonio).
- **Explicación al broker en lenguaje natural**: traducir flags técnicos a recomendaciones accionables.

**NO — usar código determinístico**:

- **Cálculo de cuotas hereditarias**: aritmética exacta; cualquier LLM puede equivocarse en aritmética con denominadores extraños. Calcular en Python con `Decimal`.
- **Validación de RUT (DV)**: algoritmo módulo 11 conocido. Hardcoded.
- **Comparación FNA vs escrituras**: matching estructurado por (foja, número, año); bag-of-RUTs intersección. SQL/Python.
- **Detección de keywords prohibición**: regex sobre texto OCR. "prohibic[ií]ón de enajenar" no necesita LLM; sí necesita LLM detectar si la prohibición está vigente o caducada.
- **Decisión final flag rojo/amarillo/verde**: rule engine determinística sobre los outputs estructurados. El LLM puede *sugerir* el flag pero NUNCA decidirlo. Auditoría requiere reglas trazables.

Regla de oro: **LLM es para extracción y explicación, no para decisión ni cálculo**.

---

## 8. Test harness

### 8.1 Golden suite

Estructura: `backend/tests/title_study/goldens/<case_id>/`:

- `inputs/` — PDFs originales (anonimizados con redacción manual de PII).
- `expected.json` — ground truth completo, validado por abogado.
- `metadata.yaml` — `case_type` (compraventa simple, herencia, parcela rural, prohibición vigente, etc.), `criticality` (high/medium/low), `expected_flags`.

Mínimo 20 cases, distribuidos:

- 8 compraventas simples (varios deslindes, regiones).
- 3 con herencia/posesión efectiva.
- 2 con sociedad conyugal (cuotas implícitas).
- 2 prohibiciones de enajenar vigentes.
- 2 servidumbres / usufructos.
- 1 parcela rural con deslindes naturales.
- 1 cadena >10 transferencias.
- 1 documento con OCR malo (escaneo de baja calidad).

### 8.2 Métricas

```python
def evaluate(predicted: Compraventa, expected: dict) -> EvalResult:
    return EvalResult(
        rut_exact_match=all_ruts_match(predicted, expected),
        rol_sii_match=predicted.inmueble.rol_sii == expected["inmueble"]["rol_sii"],
        cuotas_consistent=sum_cuotas_eq_100(predicted),
        deslindes_token_f1=token_f1(predicted.deslindes, expected["deslindes"]),
        clausulas_recall=recall(predicted.clausulas_relevantes, expected["clausulas"]),
        hallucination_count=count_unsupported_quotes(predicted, ocr_text),
    )
```

Pass criteria:

- `rut_exact_match`: 100% (sin tolerancia).
- `rol_sii_match`: 100%.
- `cuotas_consistent`: 100%.
- `deslindes_token_f1`: ≥0.85.
- `clausulas_recall`: ≥0.95 (false negatives = riesgo legal).
- `hallucination_count`: 0.

### 8.3 Continuous eval

Cron diario corre golden suite contra prod model + canary model. Diff > threshold dispara alerta. Cualquier cambio de prompt v1 → v2 debe pasar suite + diff review humano antes de promote.

### 8.4 Hallucination detector

Servicio independiente que toma `(prediction, ocr_text)` y emite `hallucination_score`:

- Para cada `field_evidence.quote`, fuzzy-match contra `ocr_text`. Si no matchea → +1 hallucination.
- Para cada `Party.rut`, verificar DV módulo 11 → +1 si inválido.
- Para cada string field, detectar entidades nombradas que no aparecen en ocr_text.

Score >0 → bloquea autoaccept del proposal en `pending_proposals`; broker debe revisar manualmente.

---

## 9. Roadmap de modelo

**MVP (v1, 0-3 meses)** — Sonnet 4.6 single-model

- Un modelo, un prompt, un schema. KISS.
- Prompt caching para system+1-shot.
- Pydantic+instructor con max_retries=3.
- Hallucination detector básico (fuzzy quote match).
- Golden suite 20 cases en CI.
- Target: 95% extraction accuracy en compraventas simples; manual review forzado en 100% de casos.

**v2 (3-9 meses)** — Split Sonnet + Opus 1M + cross-validation

- Router determinístico por complejidad: Haiku para clasificación de página (FNA vs escritura vs certificado vs irrelevante), Sonnet para extracción, Opus 4.7 1M sólo para razonamiento de cadena cuando >10 transferencias.
- Gemini 2.5 Pro como segundo dictamen sobre `parties` + `rol_sii` + `precio`.
- CoVe sobre campos críticos cuando confianza baja.
- Manual review opcional cuando ambos modelos coinciden y hallucination_score=0.
- Target: 99% en simples, 90% en complejos; manual review reducido a 30%.

**v3 (9-18 meses)** — Distillation propia

- Recopilar dataset propio (~10k estudios reales con corrección humana validada por abogado).
- Fine-tune Qwen2.5-VL 72B o sucesor (open weights, self-host) sobre el dataset.
- Beneficio: latencia, costo cero marginal post-hardware, datos no salen de PropOS, control total de comportamiento.
- Mantener Anthropic como fallback para edge cases.
- Target: 99% en todos los tipos; manual review sólo para flags rojos.

Este v3 es opcional — depende del volumen real. <500 estudios/mes el costo Anthropic no justifica el esfuerzo de fine-tuning + GPU ops. >5000 estudios/mes sí.

---

## 10. Riesgos y open questions

- **Tokenizer drift Opus 4.7 → 4.8/5.0**: cada bump de Anthropic puede mover costo ±35%. Lock al modelo hasta validar el siguiente.
- **Gemini 2.5 Pro 2M context**: cuando salga (imminent según Google), revaluar para casos cadena gigante en lugar de Opus.
- **Regulación AI Act / MinJusticia Chile**: si entra ley que exige trazabilidad de extracción legal, `field_evidence` quotes son nuestro mejor seguro. Documentar prompts versionados + model versions en `pending_proposals.metadata`.
- **Dataset golden bias**: 20 cases de Santiago Centro no generaliza a Aysén. Ampliar geográficamente antes de v2.
- **Cerebras free tier dev**: gratis hoy, no garantizado mañana. No build path crítico sobre él. Fallback es Anthropic, costo ya presupuestado.

---

## Sources

- [Anthropic Pricing — platform.claude.com](https://platform.claude.com/docs/en/about-claude/pricing)
- [Claude Opus 4.7 page](https://www.anthropic.com/claude/opus)
- [Claude Haiku 4.5 announcement](https://www.anthropic.com/news/claude-haiku-4-5)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI API Pricing](https://openai.com/api/pricing/)
- [Large Legal Fictions — Oxford JLA](https://academic.oup.com/jla/article/16/1/64/7699227)
- [Large Legal Fictions — arxiv 2401.01301](https://arxiv.org/abs/2401.01301)
- [Stanford HAI — Hallucinating Law](https://hai.stanford.edu/news/hallucinating-law-legal-mistakes-large-language-models-are-pervasive)
- [LegalBench — HazyResearch](https://hazyresearch.stanford.edu/legalbench/)
- [Chain-of-Verification — arxiv 2309.11495](https://arxiv.org/abs/2309.11495)
- [Instructor library docs](https://python.useinstructor.com/)
- [Instructor + Anthropic integration](https://python.useinstructor.com/integrations/anthropic/)
- [OmniDocBench — opendatalab](https://github.com/opendatalab/OmniDocBench)
- [Qwen2.5-VL blog](https://qwen.ai/blog?id=qwen2.5-vl)
- [Cerebras Llama 3.3 70B](https://artificialanalysis.ai/providers/cerebras)
- [Anthropic Vision pricing/calculation](https://platform.claude.com/docs/en/build-with-claude/vision)
