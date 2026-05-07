# `docs/research/title-study/` — índice

> Fecha consolidación: **2026-05-07**. Repo investigación que sostiene el feature **safeguard pre-listing PropOS**: detectar problemas de título en propiedades chilenas antes de aceptarlas para corretaje, devolver semáforo + flags + plan remediación al broker. NO sustituye estudio formal de cierre. Scope geográfico core: **RM Santiago + O'Higgins (Rancagua, Machalí, Rengo, Graneros, San Fernando) + Maule (Talca, Curicó, Linares, Constitución)**.

Cada archivo es autocontenido y denso (sin redundancia entre archivos). Definiciones aparecen primera vez con glosario; ver §Glosario consolidado abajo.

---

## Archivos

### `01-cbr-y-cadena-de-titulos.md` (~5.000 palabras, 25 min)
Fundamentos del Conservador de Bienes Raíces (CBR), Reglamento DS 1857, sistema FNA (Foja-Número-Año), tracto sucesivo, calificación CBR art 13 Reglamento, FEA, patologías estructurales (doble inscripción, cancelación irregular, DL 2.695, posesión efectiva trunca). Mapeo `comuna → CBR` para RM/O'Higgins/Maule.
**Audiencia**: ingeniero senior + founder. Punto de partida obligatorio para entender por qué Chile es complicado.

### `02-documentos-y-flujo-formal.md` (~3.500 palabras, 18 min)
Cinco documentos núcleo (dominio vigente, GP, carpeta 10 años, copia sin vigencia, certificado extendido) con costos verbatim CBR Santiago + plazo + vigencia + formato. Flujo cronológico venta inmueble 8–10 semanas. Alzamiento hipoteca (Ley 20.855). Alzamiento prohibición SERVIU (Ley 20.868). Tabla comparativa CBR del scope (la mayoría con costos `unknown` por bloqueo Cloudflare — ver `cbr_capabilities.csv`).
**Audiencia**: PM + ingeniero implementando RPA.

### `03-fiscal-municipal-urbanistico.md` (~5.000 palabras, 25 min)
SII (rol/subrol/avalúo, certificados, contribuciones), TGR (cobro), DOM (CIP, recepción definitiva LGUC arts 144/145, certificados expropiación tripartito municipal/MINVU/MOP), DOM en Línea MINVU (~190 comunas). PRC y jerarquía IPT (PRDU/PRMS/PRC/Plan Seccional). Loteos urbanos cesión 44%. Permisos sectoriales (SEIA/RCA, SEC, SEREMI Salud, SISS). Tabla DOMs scope con disponibilidad y costos referenciales CIP.
**Audiencia**: ingeniero + founder. Capa fiscal-municipal, ortogonal al título registral.

### `04-suelo-rural-y-parcelaciones.md` (~5.000 palabras, 25 min)
Línea urbano vs rural (PRC/PRMS). DL 3.516 parcela de agrado, cronología regulatoria 2021–2026, Proyecto Ley Parcelaciones estado mayo 2026 con presunción "Conjunto Residencial Rural" 6+ lotes ≤3 ha colindantes. Loteos brujos (4 modalidades + geografía hot). Cambio uso suelo art 55 LGUC + IFC SAG. Ley 20.234 + 21.477 saneamiento loteos hasta 2030. DL 2.695 saneamiento pequeña propiedad. Ley 21.442 copropiedad + reglamento ene-2025. CONADI Ley 19.253. Vitivinícola DO (Decreto 464/1994). Ley 21.435 derechos agua + 21.727 prórroga 6-abr-2027. Tabla 16 patrones detección parcela problemática.
**Audiencia**: ingeniero + founder + abogado externo. Donde más valor agrega el safeguard.

### `06-casos-tipicos-y-flags.md` (~4.500 palabras, 22 min)
13 casos típicos pre-listing (T01–T13) cada uno con: qué es / detección / remedio / tiempo y costo / flag color / nivel automatización. Hipoteca sin alzar, prohibición SERVIU, sociedad conyugal art 1749, sucesión incompleta art 688 CC, comuneros sin acuerdo, recepción DOM, ampliaciones Ley Mono, deuda contribuciones/gastos comunes 21.442, embargo, cláusula resolutoria 1491, promesa anterior viva.
**Audiencia**: ingeniero diseñando rule engine.

### `07-casos-raros-y-extremos.md` (~5.000 palabras, 25 min)
15 casos raros catastróficos (R01–R15): doble inscripción CS rol 19261-2018, tierra indígena Ley 19.253, bien fiscal con reversión, DL 2.695 reciente, servidumbres prescripción art 882 CC, alta tensión, derechos agua Ley 21.435/21.740, loteo brujo DL 3.516, DUP/expropiación, zonas típicas CMN, concesión marítima 80m, reglamento copropiedad obsoleto, usufructo/nuda, áreas riesgo, SBAP sitio prioritario.
**Audiencia**: ingeniero + abogado.

### `08-errores-faciles-vs-dificiles.md` (~3.500 palabras, 18 min)
Bifurcación pragmática: **A1–A10 fáciles** (1–30 días, $50–150k, en oficina del corredor) vs **B1–B10 difíciles** (meses a años, $1MM–500MM, requieren tribunal). Reglas pre-listing: caso A → broker avanza; caso B → descalificar listing temprano o aceptar bajo descuento + plazo extendido.
**Audiencia**: founder + PM. Decisión comercial qué casos atacar primero.

### `09-jurisprudencia-y-normativa-2024-2026.md` (~4.500 palabras, 22 min)
Parte 1 — jurisprudencia clave: CS 19261-2018 (DL 2.695 vs título inscrito), CS 62.948-2020 (parcelas de agrado ilegales), CS 2024-2025 sociedad conyugal art 1749 + pacto 1723, CS jun-2025 tierra indígena criterio funcional urbana, CdA Santiago feb-2025 invalidación recepción DOM. Parte 2 — normativa 2022-2026: Leyes 21.435, 21.442, 21.477, 21.600, 21.725, 21.740, Proyecto Ley Parcelaciones, Ley 21.078, Leyes 19.939/20.791 DUP, Ley 19.253. Tabla resumen severidad safeguard.
**Audiencia**: founder + PM + abogado externo. Mantener vivo trimestralmente.

### `11-ai-feasibility-y-arquitectura.md` (~7.000 palabras, 35 min)
TL;DR: 17 casos Tier 1 + 11 Tier 2 + 10 Tier 3 sobre 38 taxonomía. Stack: Claude Sonnet 4.6 vision (Tier 2), Opus 4.7 1M ctx (Tier 3), Cerebras Llama dev. Pipeline mermaid. Componentes: ingesta, identificación CBR FNA, orquestador pgmq, adaptadores RPA Playwright stealth, scrapers paralelos, parser CBR, rule engine, LLM Tier 2/3. Modelo datos `borrador_migration_title_study.sql`. Mitigación halucinación 8 capas (citas, RAG estricto, CoVe, Pydantic strict, cross-check, golden cases, disclaimer, métricas). Cobertura realista MVP/v2/v3. Costo unitario $32–42k. Compliance Ley 19.628. Métricas éxito. Riesgos técnicos. Decisiones técnicas clave. Incógnitas que validar.
**Audiencia**: ingeniero senior implementador.

### `12-resumen-ejecutivo.md` (~3.000 palabras, 15 min)
Para founder no técnico no abogado: problema en 3 párrafos, 5 automatizables alta confianza, 3 que siempre humano, top 10 frecuencia/severidad, especificidad O'Higgins/Maule, timeline normativo 2024-2026, gap competitivo, costo unitario y ROI, roadmap MVP→v3, decisiones founder accionables, tabla maestra checks por etapa, riesgos a vigilar.
**Audiencia**: founder PropOS. Lectura única para decidir go/no-go y prioridades.

### `borrador_migration_title_study.sql` (~600 líneas, 12 min)
Migration SQL Postgres/Supabase. Tablas: `title_studies`, `cbr_documents`, `title_chain_links`, `title_flags`, `title_flag_catalog` (seedeable), `external_data_pulls`, `study_decisions`. Trigger `tg_title_studies_refresh_severity`. RLS por `organization_id`. Índices clave para detección doble inscripción cross-study `(jurisdiction, fna_foja, fna_numero, fna_anio)`.
**Audiencia**: ingeniero backend. Borrador, NO ejecutar sin revisión.

### CSVs

- **`cases_taxonomy.csv`** (38 filas) — taxonomía completa casos T01-T17 + R01-R15 + D01-D06 con `case_id, case_name, category, frequency_estimate, severity, detection_automation, fix_time_days, fix_cost_clp, sources_to_check, notes`. Source-of-truth para rule engine.
- **`cbr_capabilities.csv`** (28 filas) — CBRs del scope + nacional referencia con jurisdicción comunas, URL, online/FEA, precios verbatim donde verificados (mayoría `unknown` por Cloudflare loaders), checked_date.
- **`competition_landscape.csv`** (38 filas) — actores legaltech IA + estudios boutique + proptech + infra pública oficial + privada aggregator + referencias internacionales. Único competidor lateral peligroso identificado: **DataInmobiliaria (BAM)**.
- **`endpoints_publicos.csv`** (53 filas) — catálogo endpoints integrables (SII, TGR, DOM, MINVU, MOP, SISS, SEC, SAG, DGA, SEA/SEIA, CMN, SBAP, MMA, SSFFAA, CBR Santiago, CONADI, Registro Civil, BCN, etc) con auth, formato output, plazo, dificultad RPA 1-5, si tiene API oficial.

---

## Glosario consolidado

Términos técnicos que aparecen cruzados entre archivos. Cada uno con archivo de definición primaria.

- **ADI** — Áreas de Desarrollo Indígena (Ley 19.253 art 26). `04` §8.
- **AVP / AIA** — Área de Valor Productivo Agrícola / Área de Interés Silvoagropecuario (PRMS). `04` §9.4.
- **BCN** — Biblioteca del Congreso Nacional (`bcn.cl/leychile`). Fuente normativa autoritativa.
- **Cabida** — superficie del predio según título. `06` glosario.
- **CBR** — Conservador de Bienes Raíces. Oficina territorial monopólica del registro inmobiliario. ~280 en Chile. `01` §1.
- **CC** — Código Civil chileno.
- **CdA** — Corte de Apelaciones.
- **CGP / GP** — Certificado de Hipotecas, Gravámenes y Prohibiciones. `02` §1.2.
- **CIP** — Certificado de Informaciones Previas (DOM, OGUC art 1.4.4). `03` §3.1.
- **CMN** — Consejo de Monumentos Nacionales (Ley 17.288). `03` §9, `07` #10.
- **CONADI** — Corporación Nacional de Desarrollo Indígena (Ley 19.253). `03` §9, `07` #2.
- **CoVe** — Chain-of-Verification (técnica anti-halucinación LLM). `11` §4.3.
- **CPA** — Catastro Público de Aguas (DGA). `04` §9.1.
- **CS** — Corte Suprema.
- **DGA** — Dirección General de Aguas (MOP). `03` §9, `04` §9.1.
- **DGTM** — Dirección General Territorio Marítimo (Armada). `07` #11.
- **DL** — Decreto Ley.
- **DL 2.695** — saneamiento pequeña propiedad raíz (1979). `04` §6, `07` #4.
- **DL 3.516** — subdivisión predios rústicos (1980). `04` §2.
- **DOM** — Dirección de Obras Municipales. `03` §3.
- **DO** — (a) Diario Oficial; (b) Denominación de Origen vinos (Decreto 464/1994). `04` §9.2.
- **DUP** — Declaración de Utilidad Pública (precursor expropiación). `06` glosario, `07` #9.
- **EBN** — Estrategia Nacional de Biodiversidad. `09` glosario.
- **EIA / DIA** — Estudio / Declaración de Impacto Ambiental (SEIA). `03` §8.1.
- **FEA** — Firma Electrónica Avanzada (Ley 19.799). `01` §4.
- **FNA** — Foja, Número, Año (PK inscripción CBR). `01` §2.3.
- **HITL** — Human-In-The-Loop. `11` §1.
- **IFC** — Informe de Factibilidad para Construcciones ajenas a la agricultura en área rural (SAG, art 55 LGUC). `04` §4.2.
- **IPT** — Instrumento de Planificación Territorial. `03` §5.
- **LGUC** — Ley General de Urbanismo y Construcciones (DFL 458/1975). `03` §3.
- **MBN** — Ministerio de Bienes Nacionales. `04` §6, `07` #3.
- **MMA** — Ministerio del Medio Ambiente. `09` glosario.
- **MOP** — Ministerio de Obras Públicas.
- **OGUC** — Ordenanza General de Urbanismo y Construcciones (reglamento LGUC).
- **Pjud** — Poder Judicial.
- **PRC** — Plan Regulador Comunal. `03` §5.
- **PRDU** — Plan Regional de Desarrollo Urbano.
- **PRMS / PRI** — Plan Regulador Metropolitano de Santiago / Intercomunal. `03` §5.
- **RCA** — Resolución de Calificación Ambiental (SEIA). `03` §8.1.
- **Repertorio** — libro diario CBR donde se anota todo título presentado, fija prioridad temporal. `01` §2.2.
- **Rol / subrol** — identificador catastral SII por comuna (predio matriz / unidad copropiedad). `03` §1.1.
- **SAG** — Servicio Agrícola y Ganadero. `04` §2.
- **SBAP** — Servicio de Biodiversidad y Áreas Protegidas (Ley 21.600, sept-2023). `03` §9, `09` §2.4.
- **SEA / SEIA** — Servicio / Sistema de Evaluación de Impacto Ambiental. `03` §8.1.
- **SEC** — Superintendencia de Electricidad y Combustibles. `03` §8.3.
- **SERVIU** — Servicio de Vivienda y Urbanización (subsidios habitacionales con prohibición Ley 20.868).
- **SII** — Servicio de Impuestos Internos. `03` §1.
- **SISS** — Superintendencia de Servicios Sanitarios. `03` §8.5.
- **SNASPE** — Sistema Nacional de Áreas Silvestres Protegidas del Estado.
- **Subinscripción** — nota marginal en inscripción registral con datos posteriores (cancelación, alzamiento, rectificación). `01` §2.3.
- **TGR** — Tesorería General de la República. `03` §2.
- **Tracto sucesivo** — cadena ininterrumpida de inscripciones, cada eslabón derivado del anterior. `01` §2.4.
- **ZT / MH / SN / MA** — Zona Típica / Monumento Histórico / Santuario de la Naturaleza / Monumento Arqueológico (Ley 17.288 CMN).

---

## Ruta de lectura sugerida según rol

| Rol | Orden recomendado | Tiempo total |
|-----|-------------------|--------------|
| **Founder PropOS** (decisión go/no-go) | `12` → `08` → `09` (Parte 2) → `04` §10 + `cases_taxonomy.csv` skim → `competition_landscape.csv` skim | ~1.5 hr |
| **PM / producto** | `12` → `06` → `07` → `08` → `cases_taxonomy.csv` full → `11` §1+§5+§8 | ~3 hr |
| **Ingeniero backend / RPA** | `01` → `02` → `endpoints_publicos.csv` → `cbr_capabilities.csv` → `11` (full) → `borrador_migration_title_study.sql` | ~3 hr |
| **Ingeniero AI / LLM** | `01` §2 + §5 → `11` (full, énfasis §1, §4, §10) → `06` + `07` skim → golden cases pendientes | ~2.5 hr |
| **Abogado externo / partner HITL** | `01` → `02` → `06` → `07` → `08` → `09` (full) → `04` (si parcelaciones rural) | ~3.5 hr |
| **Comercial / sales** | `12` → `competition_landscape.csv` → `08` (perspectiva broker) → `11` §6 (pricing) | ~1 hr |
| **Compliance / legal interno** | `09` → `11` §7 → `04` §7 (Ley 21.442) → Ley 19.628 docs externos | ~2 hr |

---

## Estado de cobertura research (al 2026-05-07)

- **Cubierto**: derecho registral CBR, documentación formal, fiscal-municipal-urbanístico, suelo rural + parcelaciones, casos típicos + raros + difíciles, jurisprudencia 2024-2026, normativa 2022-2026, AI feasibility + arquitectura, taxonomía 38 casos, capabilities CBR scope, mapa competitivo 38 actores, 53 endpoints públicos integrables.
- **Gaps conocidos**: archivos `05` y `10` saltados intencionalmente en numeración (no faltan). Costos verbatim CBR fuera de Santiago (Cloudflare loaders bloquean fetch, requiere call directo). Precision/recall LLM real sobre escrituras chilenas (necesita golden set 50 escrituras sanitizadas — `11` §11). Validación API B2B CBR Santiago (llamada comercial pendiente). Branding feature no abordado.
- **Mantener vivo trimestralmente**: `09` (jurisprudencia + normativa cambia rápido), `cbr_capabilities.csv` (digitalización progresiva), `endpoints_publicos.csv` (nuevos trámites en línea), `competition_landscape.csv` (DataInmobiliaria especialmente).
