# 14 — RPA Implementation Guide

Caveman markdown. Snippets normales. Audiencia: senior eng PropOS (FastAPI + Cloud Run + Supabase).

Mapa fuentes en `endpoints_publicos.csv`, capacidades CBR en `cbr_capabilities.csv`. Esta guía traduce eso a stack ejecutable.

---

## 1. Stack RPA recomendado

### Por qué Playwright Python

- Async nativo. Encaja con FastAPI sin glue threadpool.
- API estable (Microsoft). Mantenido. `playwright-stealth` v2.0.2 (abr 2026) activo.
- Multi-engine: chromium/firefox/webkit. Si CBR detecta Chrome → cambiar webkit línea.
- `BrowserContext` per-job → cookies/storage aislados por solicitud sin reiniciar proceso.
- Network interception nativa (`page.route`) → bloquear analytics/ads, ahorrar 40% bandwidth.

Selenium descartado: sync, ecosystem stealth débil, mayor footprint. Puppeteer Node descartado: stack PropOS Python, doble runtime overhead.

Versiones target:
- `playwright==1.50.x`
- `playwright-stealth==2.0.2`
- `pdfplumber==0.11.x`, `pymupdf==1.24.x`
- `pgmq-py==0.7.x`

### Browser pool — dónde corre

Tres opciones evaluadas:

1. **Cloud Run (sidecar pattern)** — chromium en mismo container que worker FastAPI. Memoria 2GB / 2 vCPU mínimo. Cold start ~3-4s. Bueno para volumen bajo (<200 scrapes/hora). Cloud Run docs oficial soportan browser automation desde 2024.
2. **GCE managed instance group** — VM dedicada `e2-standard-2` (2 vCPU 8GB), autoscale 1-5 nodos por CPU. Persistent. Mejor cuando scrapes promedian >30s (CBR Santiago, DOM en Línea). Costo base ~$50/mes idle.
3. **Browserless.io / Browserbase managed** — tercero. $50-200/mes plan starter. Vale la pena para MVP, no producción (latencia + privacidad RUT).

**Recomendación**: arrancar Cloud Run sidecar (Sprint 1-3). Migrar adaptadores pesados a GCE pool cuando p95 latency > 60s o memoria por job > 1.5GB. Ver issue conocido: GCP file size constraints — montar `/tmp` como `tmpfs` 512MB para PDFs intermedios.

Dockerfile base:

```dockerfile
FROM mcr.microsoft.com/playwright/python:v1.50.0-jammy
WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry install --no-root --only main
COPY . .
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "app.workers.scraper"]
```

### Captcha solving

Tres providers:

| Provider | reCAPTCHA v2 | reCAPTCHA v3 | hCaptcha | Cloudflare Turnstile | Notes |
|---|---|---|---|---|---|
| 2captcha | $1.00–2.99 / 1k | $1.45–2.99 / 1k | ~$2.99 / 1k | sí | Mayor cobertura |
| anticaptcha | similar | similar | sí | sí | API más limpia |
| capsolver | $0.80–1.50 / 1k | $0.80–1.50 / 1k | sí | sí | Más barato, menor SLA |

Costo bajo. PropOS estimado: 1000 estudios/mes × 10 captchas avg × $0.002 = **$20/mes**. Ruido.

Patrón integración Playwright:

```python
from twocaptcha import TwoCaptcha

solver = TwoCaptcha(settings.TWOCAPTCHA_KEY)

async def solve_recaptcha_v2(page, sitekey: str, url: str) -> str:
    result = await asyncio.to_thread(
        solver.recaptcha, sitekey=sitekey, url=url
    )
    token = result["code"]
    await page.evaluate(
        f'document.getElementById("g-recaptcha-response").innerHTML="{token}"'
    )
    return token
```

**Estrategia híbrida** (recomendada):
- Default: solver automático.
- Si solver falla 2x consecutive en una source → escala a `human-in-loop`. Frontend muestra `<CaptchaGate>` modal: broker resuelve captcha visible (browser via WebRTC stream o screenshot+iframe injection). Job pausado en `pending_proposals` table con TTL 10min. Anita-style flow.

Para Cloudflare loaders (CBR Puente Alto, Talagante, Talca, Rengo, Buin) **FlareSolverr** es alternativa gratuita: corre en sidecar Docker port 8191, recibe URL via REST, devuelve cookies + UA. Si falla → fallback solver pago.

```python
import httpx

async def cf_bypass(url: str) -> dict:
    r = await httpx.AsyncClient().post(
        "http://flaresolverr:8191/v1",
        json={"cmd": "request.get", "url": url, "maxTimeout": 60000},
    )
    return r.json()["solution"]  # cookies, userAgent
```

### Cookie / session management

Persistir `storage_state` por (CBR, broker_account) en Supabase Storage encrypted bucket:

```python
ctx = await browser.new_context(storage_state=load_state(cbr, account_id))
# work...
await ctx.storage_state(path=f"/tmp/{cbr}_{account_id}.json")
upload_to_supabase_storage(...)  # encrypt at rest, ttl 7d
```

CBRs invalidan sesión 24-72h. Worker chequea `last_login_at`, refresh si > 12h.

### Rate limit + UA

- Concurrency cap por host: 2-3 requests paralelos. `asyncio.Semaphore` por dominio.
- Backoff exponencial 2^n jitter ±20%.
- User-Agent: real Chrome 120+ desde fingerprint pool. Rotar por sesión, no por request.
- robots.txt: respetar `Disallow`. CBR Santiago no expone robots → tratamos como permisivo + identificamos como `PropOS/1.0 (+contact@propos.cl)` en UA secundario para auditoría.

---

## 2. Patrón adaptador por fuente

### Base class

```python
# backend/app/features/rpa/scrapers/base.py
from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel
from playwright.async_api import BrowserContext, Page

class ScrapeRequest(BaseModel):
    source: str
    params: dict[str, Any]
    broker_account_id: str | None = None

class ParsedDocument(BaseModel):
    source: str
    document_type: str
    pdf_sha256: str
    pdf_url: str  # Supabase Storage signed URL
    extracted: dict[str, Any]  # Pydantic-validated payload
    fea_valid: bool | None = None
    raw_text: str

class ScraperBase(ABC):
    source: str
    base_url: str

    def __init__(self, ctx: BrowserContext):
        self.ctx = ctx

    @abstractmethod
    async def request_certificate(self, params: dict) -> str: ...
    """Submits form, returns provider tracking token."""

    @abstractmethod
    async def poll_status(self, token: str) -> str: ...
    """Returns: pending | ready | failed."""

    @abstractmethod
    async def download(self, token: str) -> bytes: ...

    @abstractmethod
    async def parse(self, pdf_bytes: bytes) -> ParsedDocument: ...

    async def run(self, params: dict) -> ParsedDocument:
        token = await self.request_certificate(params)
        for delay in (5, 15, 30, 60, 120, 300):
            status = await self.poll_status(token)
            if status == "ready":
                pdf = await self.download(token)
                return await self.parse(pdf)
            if status == "failed":
                raise ScrapeFailed(self.source, token)
            await asyncio.sleep(delay)
        raise ScrapeTimeout(self.source, token)
```

### Adaptadores concretos

#### CBR Santiago (FEA, sin captcha visible, JS app)

Form fields verificados: comuna, foja, número, año, qty, observación. Login `clave_unica` o cuenta CBR propia.

```python
class CBRSantiagoScraper(ScraperBase):
    source = "cbr_santiago"
    base_url = "https://conservador.cl"

    async def request_certificate(self, params: dict) -> str:
        page = await self.ctx.new_page()
        await page.goto(f"{self.base_url}/portal/copia_dominio_vigente")
        await page.fill('input[name="foja"]', params["foja"])
        await page.fill('input[name="numero"]', params["numero"])
        await page.fill('input[name="anio"]', str(params["anio"]))
        await page.select_option('select[name="comuna"]', params["comuna"])
        await page.click('button:has-text("Agregar al Carro")')
        await page.wait_for_url("**/carro_compras**")
        await page.click('button:has-text("Pagar")')
        # Webpay redirect → handled by separate payment scraper
        token = await page.locator('[data-track-id]').get_attribute("data-track-id")
        return token

    async def poll_status(self, token: str) -> str:
        page = await self.ctx.new_page()
        await page.goto(f"{self.base_url}/portal/estado?id={token}")
        text = (await page.locator('.estado-tramite').inner_text()).lower()
        if "listo" in text or "disponible" in text: return "ready"
        if "rechaz" in text: return "failed"
        return "pending"
```

#### CBR Rancagua (`solicitud.php`, Cloudflare loader)

Pre-procesar con FlareSolverr, inyectar cookies en context.

```python
class CBRRancaguaScraper(ScraperBase):
    source = "cbr_rancagua"
    base_url = "https://www.cbrrancagua.cl"

    async def request_certificate(self, params):
        sol = await cf_bypass(f"{self.base_url}/html2/solicitud.php")
        await self.ctx.add_cookies(sol["cookies"])
        page = await self.ctx.new_page()
        await page.goto(f"{self.base_url}/html2/solicitud.php")
        await page.select_option('select[name="tipo_doc"]', "dominio_vigente")
        await page.fill('input[name="fojas"]', params["foja"])
        await page.fill('input[name="numero"]', params["numero"])
        await page.fill('input[name="agno"]', str(params["anio"]))
        await page.click('input[type="submit"][value*="Solicitar"]')
        return await page.locator('span.numero-solicitud').inner_text()
```

#### CBR Talca (Cloudflare, formulario PHP legacy)

```python
class CBRTalcaScraper(ScraperBase):
    source = "cbr_talca"
    base_url = "https://www.conservadortalca.cl"
    # mismo patrón Rancagua: FlareSolverr + form submit clásico
    # selectores: input[name="foja"], input[name="num"], input[name="ano"]
```

#### SII (avalúo fiscal — gratis, sin auth)

Endpoint legacy CGI. POST directo sin browser cuando posible.

```python
class SIIScraper(ScraperBase):
    source = "sii"
    base_url = "https://zeus.sii.cl/avalu_cgi/br/brc110.sh"

    async def request_certificate(self, params):
        # Try direct POST first (faster, no browser)
        async with httpx.AsyncClient(timeout=30) as cli:
            r = await cli.post(self.base_url, data={
                "comuna": params["comuna_sii_code"],
                "rol": params["rol"],
                "subrol": params.get("subrol", "0"),
            })
            if r.headers.get("content-type", "").startswith("application/pdf"):
                self._cached_pdf = r.content
                return "direct"
        # Fallback browser (when SII shows captcha o JS challenge)
        page = await self.ctx.new_page()
        await page.goto("https://www4.sii.cl/mapasui/internet/")
        # ...
        return "browser"

    async def download(self, token):
        if token == "direct":
            return self._cached_pdf
        # ...
```

Avalúo detallado (`ConsultarAntecedentesSC`) requiere clave tributaria del dueño. No scrapeable salvo el broker tenga delegación. Marcar `auth_required=true`, gating UI.

#### TGR (certificado deuda — gratis, captcha probable)

URL CSV reportada da 404. Endpoint real actual: `https://www.tesoreria.cl/web/Inicio/SecBienesRaices/Index.html`. Verificar con WebFetch al implementar.

```python
class TGRScraper(ScraperBase):
    source = "tgr"
    base_url = "https://www.tesoreria.cl"

    async def request_certificate(self, params):
        page = await self.ctx.new_page()
        await page.goto(f"{self.base_url}/.../certificado-deuda")
        await page.select_option('#comuna', params["comuna_sii_code"])
        await page.fill('#rol', params["rol"])
        await page.fill('#subrol', params.get("subrol", "0"))
        # reCAPTCHA v2 esperado
        sitekey = await page.locator('.g-recaptcha').get_attribute("data-sitekey")
        token = await solve_recaptcha_v2(page, sitekey, page.url)
        await page.click('button:has-text("Generar")')
        async with page.expect_download() as dl_info:
            await page.click('a:has-text("Descargar PDF")')
        download = await dl_info.value
        self._pdf_path = await download.path()
        return "ready"
```

#### DGA (derechos de agua registrados)

CSV catastral mensual disponible — descargar bulk una vez/mes y consultar local. Para queries puntuales:

```python
class DGAScraper(ScraperBase):
    source = "dga"
    base_url = "https://snia.mop.gob.cl/dgalibre"

    async def request_certificate(self, params):
        # Buscar derechos por comuna o rol
        page = await self.ctx.new_page()
        await page.goto(f"{self.base_url}/derechos.aspx")
        await page.fill('#txtRegion', params["region"])
        await page.fill('#txtComuna', params["comuna"])
        await page.click('#btnBuscar')
        rows = await page.locator('table.resultados tr').all_text_contents()
        return json.dumps(rows)  # token = inline result blob
```

Mejor: descargar Excel regional consolidado (`/wp-content/uploads/derechos_xxxx.xlsx`) cron nocturno → Postgres table `dga_derechos`. Queries SQL, no scraping per-request.

#### DOM en Línea (ClaveÚnica required)

```python
class DOMEnLineaScraper(ScraperBase):
    source = "dom_minvu"
    base_url = "https://domenlinea.minvu.cl"

    async def login_clave_unica(self, params):
        page = await self.ctx.new_page()
        await page.goto(f"{self.base_url}/login")
        await page.click('a:has-text("ClaveÚnica")')
        await page.fill('#uname', params["broker_rut"])
        await page.fill('#pword', params["broker_clave_unica"])
        await page.click('button[type="submit"]')
        # MFA: SMS code → broker resuelve via UI
        if await page.locator('#mfa_code').is_visible():
            code = await wait_broker_mfa(params["broker_account_id"])  # poll DB
            await page.fill('#mfa_code', code)
            await page.click('#mfa_submit')
        await page.wait_for_url("**/dashboard**")
```

ClaveÚnica MFA bloquea automation 100%. Pattern: UI broker pega código SMS, worker desbloquea via Supabase realtime channel.

#### Registro Civil (certificados PDF — endpoints REST informales)

```python
class RegistroCivilScraper(ScraperBase):
    source = "registro_civil"
    base_url = "https://www.registrocivil.cl/OficinaInternet"

    async def request_certificate(self, params):
        # Algunos certificados (matrimonio, nacimiento) tienen endpoints PDF directos
        # con RUT como param. Otros requieren ClaveÚnica.
        async with httpx.AsyncClient() as cli:
            r = await cli.post(
                f"{self.base_url}/MatrimonioInscripciones/...",
                data={"rut": params["rut"], "tipo": params["tipo"]},
            )
            self._pdf = r.content
            return "direct"
```

#### MOP Vialidad

```python
class MOPVialidadScraper(ScraperBase):
    source = "mop_vialidad"
    base_url = "https://vialidad.mop.gob.cl"
    # Login ClaveÚnica → form rol+coords → PDF informe no expropiación
    # Selectores: #rol_propiedad, #comuna_select, #btn_solicitar
```

#### MMA Áreas Protegidas (geo intersección — usar WMS si posible)

Migró a `simbio.mma.gob.cl`. Probable WMS/WFS. Antes de scraping browser, intentar:

```python
class MMAAreasProtegidasScraper(ScraperBase):
    async def request_certificate(self, params):
        bbox = params["bbox"]  # [minx,miny,maxx,maxy]
        async with httpx.AsyncClient() as cli:
            r = await cli.get(
                "https://simbio.mma.gob.cl/geoserver/wfs",
                params={
                    "service": "WFS", "version": "2.0.0",
                    "request": "GetFeature",
                    "typeNames": "areas_protegidas",
                    "bbox": ",".join(map(str, bbox)),
                    "outputFormat": "application/json",
                },
            )
            return r.json()
```

WMS/WFS evita browser. Si SIMBIO no expone OGC público → fallback geomap scraping.

#### CMN (consulta MH / ZT por dirección o coords)

Scraping HTML simple. Catálogo monumentos descargable como CSV/JSON oficial → mejor cachear local.

#### SubsecFFAA Concesiones Marítimas

```python
class SubsecFFAAConcesionesScraper(ScraperBase):
    source = "ssffaa_ccmm"
    base_url = "https://portalconcesiones.ssffaa.cl/CCMM"
    # Form polígono o RUT titular → tabla resultados
    # selectores: #txtRutTitular, #ddlRegion, #btnBuscar
    # No login para consulta pública
```

### Registry pattern

```python
# backend/app/features/rpa/registry.py
SCRAPERS: dict[str, type[ScraperBase]] = {
    "cbr_santiago": CBRSantiagoScraper,
    "cbr_rancagua": CBRRancaguaScraper,
    "cbr_talca": CBRTalcaScraper,
    "sii": SIIScraper,
    "tgr": TGRScraper,
    "dga": DGAScraper,
    "dom_minvu": DOMEnLineaScraper,
    "registro_civil": RegistroCivilScraper,
    "mop_vialidad": MOPVialidadScraper,
    "mma_ap": MMAAreasProtegidasScraper,
    "cmn": CMNScraper,
    "ssffaa_ccmm": SubsecFFAAConcesionesScraper,
}

def get_scraper(source: str, ctx: BrowserContext) -> ScraperBase:
    cls = SCRAPERS.get(source)
    if not cls: raise UnknownSource(source)
    return cls(ctx)
```

---

## 3. Orquestación asíncrona

### Cola: pgmq

PropOS ya en Supabase Postgres. Extension `pgmq` instalable (Supabase soporta nativamente). Razones contra Celery:
- Otro broker (Redis/RabbitMQ) → infra extra.
- Visibilidad cero desde SQL (Anita audit trail no la ve).
- pgmq mantiene mensajes en tabla → easy join con `cbr_documents`, `pending_proposals`.

Razones contra Temporal: overkill para flow lineal. Útil si llegamos a workflows >5 steps cross-source con compensaciones complejas. Reevaluar Sprint 6+.

```sql
-- supabase/migrations/2026xxxx_pgmq.sql
create extension if not exists pgmq;
select pgmq.create('rpa_jobs');
select pgmq.create('rpa_dlq');
```

```python
# backend/app/features/rpa/queue.py
from tembo_pgmq_python import PGMQueue

q = PGMQueue(host=..., database=..., username=..., password=...)

async def enqueue(req: ScrapeRequest) -> int:
    return await q.send("rpa_jobs", req.model_dump(), delay=0)

async def worker_loop():
    while True:
        msg = await q.read("rpa_jobs", vt=300)  # 5min visibility
        if not msg:
            await asyncio.sleep(2); continue
        try:
            await process(msg.message)
            await q.delete("rpa_jobs", msg.msg_id)
        except RetriableError:
            if msg.read_ct >= 5:
                await q.archive("rpa_jobs", msg.msg_id)
                await q.send("rpa_dlq", msg.message)
            # else: deja que reaparezca tras vt
```

### Estado machine

```
requested → in_queue → in_progress → polling → delivered → parsed → completed
                                                      ↘ failed
                                                      ↘ retry → in_queue
```

Tabla `rpa_jobs_state` (separada de pgmq table — pgmq es transport, no state of record):

```sql
create table rpa_jobs_state (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  params jsonb not null,
  status text not null check (status in (
    'requested','in_queue','in_progress','polling','delivered',
    'parsed','completed','failed','retry'
  )),
  attempts int not null default 0,
  last_error text,
  pdf_storage_key text,
  parsed_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on rpa_jobs_state (status, source);
```

### Retry + backoff

```python
RETRY_DELAYS = [30, 120, 600, 1800, 7200]  # s
async def schedule_retry(job_id, attempt):
    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS)-1)]
    delay += random.uniform(-0.2, 0.2) * delay  # jitter
    await q.send("rpa_jobs", payload, delay=int(delay))
```

DLQ: revisión humana semanal. Anita worker chequea DLQ size → alerta Slack si > 50.

### TTL + cache

```sql
create table rpa_cache (
  source text, params_hash text, payload jsonb,
  fetched_at timestamptz, expires_at timestamptz,
  primary key (source, params_hash)
);
```

TTLs por source:
- SII avalúo: 7d (semestral en realidad).
- TGR deuda: 24h.
- CBR dominio vigente: 30d (banks usually require fresh).
- DGA: 30d.
- DOM certificados: 60d.

Pre-fetch flow: `service.fetch(source, params)` → check cache → if miss enqueue → block on result via Postgres `LISTEN/NOTIFY` (max 30s) o devolver `pending` + webhook.

### Webhook hooks

Cuando `status → parsed` trigger Postgres notifica `rules_engine`:

```sql
create or replace function notify_parsed() returns trigger as $$
begin
  perform pg_notify('rpa_parsed', new.id::text);
  return new;
end$$ language plpgsql;

create trigger rpa_parsed_trg after update on rpa_jobs_state
  for each row when (new.status = 'parsed')
  execute function notify_parsed();
```

Worker `rules_engine` escucha → corre flag generation (Sección 5 doc 06-casos-tipicos-y-flags).

---

## 4. Parsers PDF CBR

### Capa 1 — text-based PDFs (post-2010, FEA)

```python
import pdfplumber, fitz

def extract_text(pdf_bytes: bytes) -> tuple[str, dict]:
    text_parts = []
    metadata = {}
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
        metadata["pages"] = len(pdf.pages)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    metadata["has_qr"] = any(
        a.get("kind") == fitz.LINK_URI for p in doc for a in p.get_links()
    )
    return "\n".join(text_parts), metadata
```

### Capa 2 — Pydantic schemas por tipo

```python
class DominioVigente(BaseModel):
    cbr: str
    foja: str
    numero: str
    anio: int
    rol_sii: str | None
    direccion: str
    titulares: list[Titular]
    deslindes: dict[str, str]  # norte/sur/oriente/poniente
    fecha_inscripcion: date
    cvu: str  # código verificación

class GP(BaseModel):
    cbr: str
    foja: str; numero: str; anio: int
    hipotecas: list[Hipoteca]
    gravamenes: list[Gravamen]
    prohibiciones: list[Prohibicion]
    litigios: list[Litigio]
    fecha_emision: date
    cvu: str
```

### Capa 3 — extracción regex + templates por CBR

Cada CBR tiene layout distinto. Templates en `backend/app/features/rpa/parsers/templates/`:

```python
# parsers/templates/cbr_santiago_dv.py
PATTERNS = {
    "foja_numero_anio": re.compile(
        r"foja[s]?\s+(?P<foja>\d+)\s+(?:N°|número|numero)\s+(?P<numero>\d+)\s+(?:del año|año)\s+(?P<anio>\d{4})",
        re.IGNORECASE,
    ),
    "rol_sii": re.compile(r"rol\s+(?:de\s+)?aval[uú]o\s+(?:N°|número)\s*(?P<rol>\d{3,5}-\d{1,4})", re.I),
    "cvu": re.compile(r"código\s+(?:de\s+)?verificaci[oó]n\s+([A-Z0-9-]{8,20})", re.I),
    "deslindes": re.compile(
        r"NORTE\s*:\s*(?P<n>.+?)\s*SUR\s*:\s*(?P<s>.+?)\s*ORIENTE\s*:\s*(?P<o>.+?)\s*PONIENTE\s*:\s*(?P<p>.+?)(?:\.|$)",
        re.I | re.DOTALL,
    ),
}
```

### Capa 4 — fallback Claude vision (OCR + structured output)

Cuando regex falla (manuscritos pre-1980, escaneos torcidos, fojas rotuladas a mano):

```python
from anthropic import AsyncAnthropic

async def claude_vision_parse(pdf_bytes: bytes, schema: type[BaseModel]) -> BaseModel:
    images = pdf_to_pngs(pdf_bytes)  # pymupdf render @300dpi
    msg = await anthropic.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=f"Extract data matching this Pydantic schema:\n{schema.model_json_schema()}\nReturn ONLY valid JSON.",
        messages=[{
            "role": "user",
            "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64(img)}} for img in images]
                       + [{"type": "text", "text": "Extraer todos los campos. null si no presente."}],
        }],
    )
    return schema.model_validate_json(msg.content[0].text)
```

Costo: ~$0.05 por DV con vision (3 páginas). Solo cuando Capa 3 falla. Trackear ratio fallback en métricas — si > 20% un CBR, mejorar templates.

### Test suite — golden files

Por CBR, 5+ docs reales sanitizados (RUT/nombre tachado):

```
backend/tests/fixtures/parsers/
  cbr_santiago/
    dv_001.pdf  dv_001.expected.json
    gp_001.pdf  gp_001.expected.json
    ...
  cbr_rancagua/...
```

```python
@pytest.mark.parametrize("pdf_path", glob("fixtures/parsers/cbr_*/dv_*.pdf"))
def test_dv_parser(pdf_path):
    expected = json.load(open(pdf_path.replace(".pdf", ".expected.json")))
    parsed = parse_dominio_vigente(open(pdf_path, "rb").read())
    assert parsed.model_dump(mode="json") == expected
```

CI ejecuta test suite. Cobertura: Sprint 2 mínimo CBR Santiago. Sprint 5 expandir Rancagua/Talca.

---

## 5. Validación FEA

Marco legal: **Decreto Supremo 73/2022** Min Justicia. Formato XML + PDF/A-3, certificado natural type A3, **CVU** estampado obligatorio. **Circular Interna 19-CBR (2023)** obliga a CBRs a mantener REST web service para validar firmas + CVU.

CBR Santiago expone `https://conservador.cl/portal/verificacion_documentos` (HTML form, code input). Endpoint REST documentado **no público** — solicitar via convenio B2B (banks ya tienen JWT API, hasta 100 powers/min).

Flow validación:

```python
async def validate_fea(pdf_bytes: bytes) -> FeaValidation:
    # 1) Extraer QR
    images = pdf_to_pngs(pdf_bytes, pages=[0, -1])
    qr_data = decode_qr(images)  # pyzbar
    # qr_data tipico: "https://conservador.cl/v?cvu=ABCD-2025-1234"
    parsed = urlparse(qr_data)
    cvu = parse_qs(parsed.query)["cvu"][0]

    # 2) Hash PDF
    sha = hashlib.sha256(pdf_bytes).hexdigest()

    # 3) GET endpoint validación (scraping form si no hay REST público)
    page = await ctx.new_page()
    await page.goto("https://conservador.cl/portal/verificacion_documentos")
    await page.fill('input[name="codigo"]', cvu)
    await page.click('button:has-text("Verificar")')
    body = (await page.locator(".resultado").inner_text()).lower()
    valid = "válido" in body or "vigente" in body

    # 4) Persist evidence
    return FeaValidation(
        cvu=cvu, pdf_sha256=sha, valid=valid,
        verification_url=qr_data, checked_at=datetime.utcnow(),
        evidence_html=await page.content(),
    )
```

Persistir en `cbr_documents.fea_validation_json`. Re-validar al usar doc en cierre.

CBRs con endpoint validación distinto: `cbrcoquimbo.cl/validar`, `conservadorcurico.cl/frm-validar`, `cbrvinadelmar.cl/validar`. Mapear en `validation_url` per-CBR.

---

## 6. Anti-detección / robustez

### Stealth

```python
from playwright_stealth import stealth_async

ctx = await browser.new_context(
    user_agent=random_real_chrome_ua(),
    viewport={"width": 1920, "height": 1080},
    locale="es-CL", timezone_id="America/Santiago",
    geolocation={"latitude": -33.45, "longitude": -70.66},
    permissions=["geolocation"],
)
await stealth_async(ctx)
```

`playwright-stealth` v2 parchea ~12 propiedades (`navigator.webdriver`, `chrome.runtime`, plugins, WebGL). Anti-bot serio chequea 40+. Para CBRs/Cloudflare a veces no basta → añadir `browserforge` fingerprints o `camoufox` (Firefox patcheado nivel binario).

### Proxies residenciales Chile

GCP us-east IPs **bloqueadas** o degradadas por varios CBRs. Geo Chile mandatorio.

| Provider | Pool CL | Nota |
|---|---|---|
| Bright Data | grande | $8.40/GB residential, top SLA |
| LumiProxy | 171k IPs CL | barato, calidad media |
| IPRoyal | 50M global | sticky session 30min |
| ProxyEmpire | mediana | mobile + residential mix |

Recomendación: Bright Data sticky session 10min para sesiones CBR (cookies survive). LumiProxy datacenter para SII/TGR (no detectan, más barato).

```python
ctx = await browser.new_context(proxy={
    "server": "http://proxy.brightdata.com:22225",
    "username": f"brd-customer-{cust}-zone-residential-country-cl-session-{session_id}",
    "password": settings.BRD_PASSWORD,
})
```

### Cloudflare loaders

CSV reporta loaders en CBR Puente Alto, Talagante, Talca, Rengo, Buin, Curicó. Estrategia escalonada:

1. FlareSolverr (gratis, self-host) → prueba primero.
2. Si falla 3x → 2captcha Turnstile/CF challenge solver.
3. Si falla → headed mode + proxy residencial CL.
4. Manual fallback: broker descarga doc, sube via UI, parser corre igual.

---

## 7. Observabilidad

### Logs estructurados

```python
import structlog
log = structlog.get_logger()

log.info("scrape_started", source=source, job_id=str(jid),
         params_hash=hash_params(params))
log.info("scrape_succeeded", source=source, job_id=str(jid),
         duration_ms=int((time.time()-t0)*1000),
         pdf_sha256=sha, captchas_solved=cnt)
```

GCP Cloud Logging auto-captura JSON. Crear log-based metric `rpa_scrape_duration` y alert en p95 > 90s.

### Métricas Prometheus

```python
from prometheus_client import Counter, Histogram, Gauge

scrape_total = Counter("rpa_scrape_total", "", ["source", "outcome"])
scrape_duration = Histogram("rpa_scrape_duration_seconds", "", ["source"])
captcha_cost = Counter("rpa_captcha_cost_usd", "", ["provider", "type"])
queue_depth = Gauge("rpa_queue_depth", "", ["queue"])
```

Scrape + push a Cloud Monitoring via `prometheus-to-stackdriver` sidecar.

### Sentry

```python
import sentry_sdk
sentry_sdk.init(dsn=..., traces_sample_rate=0.1, environment=env)
```

Tag por `source`. Alertas: error rate > 5% en ventana 1h por source → Slack `#rpa-alerts`.

### Dashboard mínimo

Looker Studio sobre BigQuery sink:
- Scrapes/hora por source.
- Success rate 24h por source (target ≥ 95%).
- Captcha cost mes acumulado.
- Top errores (últimas 50).
- p50/p95/p99 latency.

### Audit trail

Tabla `rpa_audit`:

```sql
create table rpa_audit (
  id bigserial primary key,
  job_id uuid references rpa_jobs_state(id),
  event text, -- "request_submitted","pdf_downloaded","fea_validated"
  pdf_sha256 text, source_url text,
  http_status int, duration_ms int,
  user_agent text, proxy_session text,
  created_at timestamptz default now()
);
```

Cada PDF descargado: hash + timestamp + URL + UA + proxy session. Compliance + reproducibilidad.

---

## 8. Cost management

Estimación 1000 estudios/mes (~10 sources avg por estudio = 10k scrapes):

| Concepto | Calculo | USD/mes |
|---|---|---|
| Captcha solving | 10k scrapes × 0.5 captcha avg × $0.0025 | $13 |
| Proxies residencial CL | 10k scrapes × 5MB avg × $8.40/GB | $420 |
| Proxies datacenter (SII/TGR) | flat | $30 |
| Cloud Run worker (2 vCPU 2GB, 8h/d active) | $0.05/h × 8h × 30d × 3 inst | $36 |
| GCE pool (CBR pesados, e2-std-2 × 2, 50% util) | $50 × 2 | $100 |
| Anthropic vision fallback (10% docs × $0.05) | 1000 × 0.05 | $50 |
| FlareSolverr (self-host Cloud Run) | flat | $10 |
| **Subtotal infra/scraping** |  | **~$660** |
| CBR fees (passthrough, broker paga) | 1000 × $4600 × 1.2 USD ≈ | n/a |

Por estudio: **~$0.66 infra**. Costo CBR fees passthrough $5-10 USD broker bill.

Optimizaciones: caching agresivo TTL 30d puede bajar 30-40% scrapes repetidos, → ~$400/mes.

---

## 9. Compliance + términos

### Términos uso CBR

**Pendiente verificar**: muchos CBRs incluyen TOS prohibiendo scraping automatizado. CBR Santiago expone API REST B2B con JWT (banks la usan) — preferir convenio formal. Mientras tanto:
- Rate limit conservador (2 req/s max).
- UA identificable + email contacto.
- No bypass paywall — pagar tarifas via Webpay scraping flow (broker paga upfront, PropOS pasa el cobro).
- Logs auditables.

Riesgo legal: si CBR detecta y manda cease-and-desist → adaptador off, escalada legal. Mitigación: convenio B2B con CBR Santiago Sprint 2, replicar otros CBRs grandes.

### Ley 19.628 + Ley 21.719 (vigente 1-dic-2026)

PropOS combina + organiza datos públicos (RUT, dominio, gravámenes). Eso → **datos protegidos por deber de secreto** según Ley 21.719 art combinado. Implicaciones:
- Consentimiento titular cuando se trate de propiedad de tercero (compraventa: vendedor consiente al firmar mandato; tercero involucrado en historial = base legítima si necesario para due diligence transacción).
- Mandatory breach notification.
- ARCO completo.
- Hasta 20.000 UTM (4% revenue) sancion grave.

PropOS ya tiene `client_consents`. Extender a `title_study_consents` con scope (qué fuentes, qué datos, retention).

### Lecturas no destructivas

Solo GET / consultas. Nunca mutaciones (e.g., no usar el flow CBR para "iniciar inscripción" desde scraper). Si broker quiere inscribir → UI manual con scraper como autocompletador.

### Cache agresivo

Reduce hits → menor riesgo detección + cumplimiento minimización datos.

---

## 10. Plan ejecución MVP

| Sprint | Entregable | DoD |
|---|---|---|
| 1 (2sem) | Playwright base + Docker + browser pool Cloud Run + CBR Santiago DV/GP + SII avalúo + TGR deuda | 3 adapters parsean PDF, e2e en staging, golden tests pass |
| 2 (2sem) | Parsers Pydantic + FEA validación CBR Santiago + 5 golden files por tipo + convenio B2B kickoff | FEA validation endpoint funcional, ratio fallback Claude < 15% |
| 3 (2sem) | pgmq + state machine + retry/DLQ + LISTEN/NOTIFY hooks rules engine | Job survival rate 99% incluyendo restarts, DLQ < 2% |
| 4 (2sem) | DGA (catastro local + scraper puntual) + Registro Civil + DOM en Línea (ClaveÚnica MFA flow + UI broker handoff) | 3 nuevos sources prod, MFA UX validado con beta brokers |
| 5 (2sem) | CBR Rancagua + Talca (FlareSolverr) + parsers regionales + golden files | Cobertura región Maule + O'Higgins, success rate ≥ 90% |
| 6 (2sem) | Sentry + Prometheus dashboards + cost dashboard + alertas + load test 100 estudios/h | SLO definidos, alertas en producción, runbook |

Sprint 7+: MOP Vialidad, MMA Áreas Protegidas WMS, CMN, SubsecFFAA, CBRs Tier 2.

---

## Recomendaciones técnicas top 5

1. **Empezar con sidecar Cloud Run + FlareSolverr docker-compose**, NO contratar Browserless ni Browserbase aún. Costo cero infraestructura compleja en MVP.
2. **pgmq sobre Celery**: encaja con Supabase ya en stack, audit trail SQL, integración trivial Anita.
3. **Capa 4 Claude vision como safety net**, no default. Trackear ratio fallback como métrica de salud parser. Si > 20% un CBR → invertir en mejor template antes que aceptar el costo.
4. **Convenio B2B CBR Santiago Sprint 2 paralelo al desarrollo**. JWT REST API existente para banks → PropOS encaja como user. Elimina fragilidad scraping y riesgo TOS.
5. **Browser pool en GCE solo para CBRs pesados** (Rancagua, Talca, Talagante con loader CF). Resto en Cloud Run sidecar. Evitar over-engineering pool global desde día 1.

## Incógnitas a resolver antes de empezar

1. **¿Términos de uso CBR Santiago prohíben scraping automatizado?** Leer TOS oficial + consultar legal externo. Si prohibe + no logramos convenio B2B → diseño cambia (presencial/manual fallback obligatorio en Tier 1).
2. **¿Proxy residencial Chile cuál SLA real bajo carga sostenida?** Bright Data sticky 10min, IPRoyal 30min, LumiProxy. Hacer benchmark 1 semana cada uno con 100 scrapes CBR Santiago + medir bloqueos. Decidir antes de Sprint 1.
3. **¿CBR Santiago acepta convenio B2B PropOS sin volumen banca?** El JWT REST API hoy lo usan bancos por escala. PropOS arranca <500 docs/mes. Negociar tier intermedio con tarifa por volumen real, no flat enterprise. Si CBR rechaza → lock-in scraping con riesgo, costear plan B (manual broker + automation parsing).

## Sources

- [Playwright Python](https://playwright.dev/python/docs/intro)
- [playwright-stealth 2026 patches](https://dicloak.com/blog-detail/playwright-stealth-what-works-in-2026-and-where-it-falls-short)
- [2captcha pricing](https://2captcha.com/pricing)
- [pgmq](https://github.com/tembo-io/pgmq)
- [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr)
- [GCP Cloud Run browser automation](https://docs.cloud.google.com/run/docs/browser-automation)
- [CBR Santiago verificación](https://conservador.cl/portal/verificacion_documentos)
- [Ley 21.719 vigencia 2026](https://preyproject.com/es/blog/ley-de-proteccion-de-datos-en-chile)
- [Bright Data Chile](https://brightdata.com/locations/cl)
- [DS 73/2022 + CVU CBR](https://www.carey.cl/firma-electronica-cuando-puede-utilizarse-y-cuando-no)
