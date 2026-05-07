# 12 — Resumen Ejecutivo (founder no técnico, no abogado)

> Fecha: **2026-05-07**. Lector: founder PropOS. Estilo caveman, denso. Cero halucinación. Toda afirmación sostenida por archivos `01`–`09` + `11` + CSVs de este directorio. Si dato falta o es estimado, lo digo. No se repite contenido — se apunta.

---

## 1. El problema en 3 párrafos

Chile no tiene **title insurance** ni catastro unificado. Cada propiedad vive en **uno de ~280 CBRs** (Conservador de Bienes Raíces) territoriales, cada uno con monopolio sobre su zona, sin servidor central, sin folio real, sin API estándar, identificada por **(CBR, registro, foja, número, año)** — el FNA (ver `01-cbr-y-cadena-de-titulos.md` §2.3). El derecho de dominio se prueba reconstruyendo "tracto sucesivo" mínimo 10 años hacia atrás, eslabón por eslabón, abriendo escrituras en notarías distintas, cruzando con SII (rol fiscal), TGR (deuda contribuciones), DOM (recepción de obras), Registro Civil (matrimonio/defunción), DGA (agua), CONADI (tierras indígenas), CMN (patrimonio), MOP (vialidad), MMA/SBAP (áreas protegidas), SAG (subdivisión rural). Hoy un abogado boutique cobra **$50.000–150.000 CLP** por estudio (`competition_landscape.csv` filas Misabogados / Abogados Propiedades), demora **5–15 días**, y la calidad varía con el abogado.

El resultado en mercado: el broker recibe encargo, publica el listing, gasta marketing, encuentra comprador, **y recién ahí** el banco o el abogado del comprador hace estudio formal. Cuando aparece la podredumbre — hipoteca sin alzar, herencia incompleta art 688 CC, ampliación sin recepción DOM, parcela DL 3.516 con destino habitacional, derechos de agua caducados al 6-abr-2025, cláusula resolutoria art 1491 CC viva — el deal se cae a las 8 semanas, el broker pierde tiempo y reputación, el vendedor entra en pánico, el comprador busca otra propiedad. La asimetría de información es máxima en zona rural (parcelas O'Higgins/Maule) y especialmente catastrófica para compradores migrantes desde Santiago que no distinguen "subdivisión SAG bajo DL 3.516" de "loteo brujo" (`04-suelo-rural-y-parcelaciones.md` §3, `07-casos-raros-y-extremos.md` #8).

PropOS apunta al **safeguard pre-listing**: detectar las patologías mecanizables ANTES de aceptar la propiedad para corretaje, devolver al broker un semáforo verde/amarillo/rojo + flags + plan de remediación + costo y plazo. NO sustituye el estudio formal de cierre. SÍ evita que el broker pierda 8 semanas en un listing podrido. La tesis comercial: cobrarle al broker $32–60k por estudio (vs $50–150k abogado), entregárselo en <5 días async (vs 5–15 días humano), con cobertura uniforme sobre 28 de los ~38 casos taxonomizados sin necesidad de abogado externo (`11-ai-feasibility-y-arquitectura.md` §6).

---

## 2. Cinco cosas automatizables alta confianza (Tier 1 puro)

Reglas booleanas sobre datos estructurados scrapeables. Sin LLM. Sin abogado. Falsos negativos solo si la fuente no responde. Detalle por caso en `06-casos-tipicos-y-flags.md`, `07-casos-raros-y-extremos.md`, taxonomía completa en `cases_taxonomy.csv`, mapeo a tier en `11-ai-feasibility-y-arquitectura.md` §1.

1. **Hipoteca vigente sin alzar** (T01). Parsear Certificado de Gravámenes y Prohibiciones (CGP) del CBR; si hay inscripción de hipoteca sin nota marginal de cancelación → flag amarillo. ~75% del mercado residencial RM tuvo crédito hipotecario; muchos viejos no se alzaron. Costo fix $30–300k, 7–30 días (`02-documentos-y-flujo-formal.md` §4 + Ley 20.855 que obliga al banco a alzar en 45 días).
2. **Prohibición SERVIU vencida** (T02). Inscripción de subsidio + plazo (5/10/15 años) + fecha actual = cálculo aritmético. Ley 20.868 alza de pleno derecho — solo falta inscribir cancelación. Caso green automático.
3. **Embargo / medida precautoria viva** (T15). CGP boolean. Tribunal + rol + fecha. Bloquea venta hasta alzamiento. Detección 100%.
4. **Deuda contribuciones** (T13). Endpoint TGR `tgr.cl/certificado-deuda-contribuciones/` (gratis, instantáneo, vigencia 1 mes). Persigue al inmueble — comprador hereda. Ver `endpoints_publicos.csv` fila TGR.
5. **DL 2.695 saneamiento reciente** (R04). Si la inscripción de dominio actual cita "DL 2.695" + fecha < 1 año → bandera roja (acción reivindicatoria abierta). 1–5 años → amarilla. >5 años → green. Pura aritmética (`04-suelo-rural-y-parcelaciones.md` §6).

Adicionales también puro Tier 1 (resumen, 12 más): R02 tierra indígena cruce CONADI, R06 servidumbre alta tensión cruce capa SEC, R07 derechos agua DGA + fecha 6-abr-2025, R09 DUP en CIP DOM, R10 zona típica CMN cruce capa, R11 concesión marítima 80m fiscal cruce georef costa, R13 usufructo/nuda propiedad/fideicomiso CGP boolean, R14 área riesgo cruce capas SHOA/MOP/CIP, R15 SBAP sitio prioritario cruce capa MMA, T03 prohib SERVIU vigente, T06 sucesión sin posesión efectiva (cruce CBR vs Registro Civil defunciones), T07 sin inscripción especial herencia (`11-ai-feasibility-y-arquitectura.md` §1 tabla). Total **17 casos Tier 1 = ~45% taxonomía**.

---

## 3. Tres cosas que SIEMPRE requieren humano (Tier 3 + abogado obligatorio)

Razonamiento sobre cadenas largas + jurisprudencia + interpretación. LLM halucina 58–88% sin RAG (Stanford "Large Legal Fictions" 2024, citado en `11` §4). PropOS detecta y dispara HITL — nunca decide solo.

1. **Cadena rota — eslabón nulo o herencia 30 años sin inscribir** (D01, ver `08-errores-faciles-vs-dificiles.md` B1). Vicio en compraventa intermedia (incapaz sin autorización, partición que omitió heredero, posesión efectiva nunca tramitada por 30 años). Saneamiento via judicial: 2–7 años, $5–30MM. Si herencias se ramificaron 3 generaciones, propiedad prácticamente invendible al precio de mercado.
2. **Doble inscripción / superposición con vecino** (R01 + D03). Dos cadenas paralelas vivas. CS rol 19261-2018 (Forestal Mininco c/ Follador, 22-abr-2021, ver `09-jurisprudencia-y-normativa-2024-2026.md` §1.1) favorece al primer inscrito legítimo, pero cada caso depende de antecedentes de 30+ años, planos y posesión material. Juicio 2–6 años, $5–30MM honorarios + peritajes. Mientras litigio, propiedad invendible.
3. **CONADI calificación retroactiva tierra indígena** (D05). CS junio 2025 (Panguipulli urbano, `09` §1.6) confirmó **criterio funcional**: predio puede calificar tierra indígena por antecedente comunitario aunque sea urbano, sin distinguir ubicación. Nulidad absoluta, restitución sin indemnización si CONADI tenía registro. Casi siempre pierde el no-indígena. Detección requiere análisis título origen + contexto histórico — abogado obligatorio.

(Adicionales Tier 3 que también requieren humano: T12 ampliaciones sin permiso para juicio sobre regularización; T16 cláusula resolutoria art 1491 CC activa; T17 promesa anterior viva; R05 servidumbre adquirida por prescripción art 882 CC; D02 discrepancia deslindes; D06 loteo brujo no saneable. Total **~10 casos Tier 3 = ~26% taxonomía**.)

---

## 4. Top 10 casos por frecuencia × severidad

Cruce derivado de `cases_taxonomy.csv` columnas `frequency_estimate` y `severity`. Orden = impacto en pipeline real broker RM + O'Higgins/Maule.

| # | Caso | Freq | Sev | Tier | Tiempo fix | Costo fix CLP |
|---|------|------|-----|------|-----------|---------------|
| 1 | T01 Hipoteca sin alzar | high | yellow | 1 | 7–30d | 30–300k |
| 2 | T11 Recepción final DOM faltante | high | yellow | 2 | 30–180d | 500k–3MM |
| 3 | T12 Ampliaciones sin permiso (Ley Mono hasta dic-2027) | high | yellow | 3 | 60–180d | 500k–3MM |
| 4 | T13 Deuda contribuciones | high | green | 1 | 1–15d | =deuda |
| 5 | T07 Sin inscripción especial herencia (art 688 CC paso b) | high | green | 1 | 7–30d | 30–100k |
| 6 | T04 Sociedad conyugal sin autorización art 1749 | high | yellow | 2 | 1–30d | 50–150k |
| 7 | T06 Sucesión sin posesión efectiva | high | yellow | 1 | 30–540d | 50k–3MM |
| 8 | T14 Deuda gastos comunes Ley 21.442 | high | yellow | 2 | 1–30d | =deuda |
| 9 | T02 Prohibición SERVIU vencida | high | green | 1 | 5–15d | 20–50k |
| 10 | R07 Derechos agua caducados Ley 21.435 | high (rural) | red | 1 | 30–120d o N/A | 200k–1MM |

Lectura: la mayoría del top-10 es **Tier 1 + 2** (mecanizable) y **fixable con plazos razonables**. Es justo el sweet-spot del safeguard. Casos red de baja frecuencia (R02 indígena, R11 playa fiscal) son catastróficos pero raros — alto valor preventivo aunque tasa fired sea < 1%.

---

## 5. Especificidad O'Higgins / Maule (combo único)

Las dos regiones concentran el cóctel inmobiliario más complejo del país. Tres factores se cruzan en el mismo predio:

**(a) Parcelaciones DL 3.516 + parcelas de agrado** (`04-suelo-rural-y-parcelaciones.md` §2). Decreto Ley 1980 permite subdividir predios rústicos hasta 0,5 ha mínimo con destino agrícola/ganadero/forestal. En la práctica 40 años se usaron como vivienda secundaria/permanente sin urbanización formal. Solicitudes SAG cayeron 61% entre 2022 y 2025 tras endurecimiento. **Geografía hot**: Machalí precordillera, Rengo, San Fernando, Codegua, Coltauco (O'Higgins); Pencahue, San Clemente, Maule rural, Curicó valle Tinguiririca-Teno, Linares precordillera (Maule). CS rol 62.948-2020 declaró ilegal loteo Bahía Panguipulli (228 parcelas) — subdivisión SAG NO habilita uso residencial sin cambio uso suelo + permiso urbanización (`09` §1.2). Proyecto Ley Parcelaciones (ingresado 30-jul-2024, en Comisión Agricultura Cámara, sin promulgar) introduciría figura "Conjunto Residencial Rural" con presunción legal de **6+ lotes ≤3 ha colindantes**.

**(b) Vitivinícola con denominación de origen** (`04` §9.2, Decreto 464/1994 SAG). Para etiquetar "Cachapoal", "Colchagua", "Maule", "Curicó" se requiere ≥75% uva del lugar declarado. Cambio de uso dentro de zona DO afecta padrón viñedos colindantes — la mancha vinífera. Vender una parcela DL 3.516 cortada de un campo viñero impacta vecinos comerciales. Esto NO está en el título inscrito; surge solo cruzando capas SAG + reglamentos DO.

**(c) Derechos de agua post Ley 21.435** (`04` §9.1, `09` §2.1, `09` §2.6). Reforma 2022 separó perpetuidad: nuevos derechos = concesión 30 años. **Caducidad por no inscripción al 6-abr-2025** (extendida a 6-abr-2027 solo pequeños productores). Caducidad por no uso efectivo. Ley 21.740 (23-abr-2025) endureció fiscalización DGA. Predio agrícola sin derecho inscrito hoy en O'Higgins/Maule = sin valor productivo. Se transan independientes del suelo desde Código Aguas 1981.

**El combo único**: una parcela DL 3.516 de 5.000 m² en Machalí precordillera puede ser simultáneamente (1) loteo brujo encubierto si está en conjunto de 6+ lotes con calles internas, (2) dentro de zona DO Cachapoal afectando vecinos viñateros, (3) sin derechos de agua inscritos al 6-abr-2025, (4) con construcción habitacional sin IFC SEREMI Agricultura ni recepción DOM, (5) en SBAP sitio prioritario cordillera (Ley 21.600), (6) con afectación PRMS AVP/AIA. Cinco a seis flags rojos en una sola parcela. Ningún competidor del mapa (`competition_landscape.csv`) los detecta integradamente — DataInmobiliaria scrapea CBR + SII + TGR pero solo lectura masiva, sin reglas legales por propiedad.

Implicación PropOS: el módulo rural O'Higgins/Maule (planificado v2 mes 6–9 según `11` §5) es donde el moat es más profundo y el ROI más alto.

---

## 6. Timeline normativo 2024–2026 (qué entró en vigor, qué viene)

Detalle completo `09-jurisprudencia-y-normativa-2024-2026.md` Parte 2.

- **Ley 21.435** (DO 6-abr-2022, reforma Código Aguas). Caducidad por no inscripción al 6-abr-2025 ya operó. Pequeños productores agrícolas plazo extendido 6-abr-2027. Impacto safeguard: **alto, ya activo** todo predio agrícola RM/O'Higgins/Maule.
- **Ley 21.442** (DO 13-abr-2022, copropiedad inmobiliaria). Reglamento publicado **9-ene-2025** (3 años atraso). Plazo adecuar reglamento condominio: **9-ene-2026** (un año desde reglamento). Registro Nacional Administradores obligatorio desde **sept 2025**. Impacto: medio, listings condominio.
- **Ley 21.477** (DO 10-ago-2022). Modifica Ley 20.234 saneamiento loteos. **Vigencia hasta 31-dic-2030** — ruta abierta.
- **Ley 21.600** (DO sept-2023, SBAP). 99 sitios prioritarios preliminares. Reglamento pendiente. Enero 2026 proyecto ley para suspender nuevas declaraciones hasta reglamento (incertidumbre regulatoria). Impacto: medio, predios cordillera/precordillera.
- **Ley 21.725** (DO 1-mar-2025, "Ley del Mono" extendida). Regularización ampliaciones autoconstruidas hasta **31-dic-2027**. Ruta abierta.
- **Ley 21.740** (DO 23-abr-2025, reforma fiscalización Código Aguas). Allanamiento del infractor antes de plazo descargos = descuento 25% multa. Endurece sanciones. Impacto: medio.
- **Proyecto Ley Parcelaciones** (ingresado 30-jul-2024). Estado mayo 2026: primer trámite Comisión Agricultura Cámara, sin promulgar, sin urgencia formal. Reanudado marzo 2026. Si pasa, exige conservación + acceso real + servicios + caución póliza/boleta. Presunción legal "Conjunto Residencial Rural" con 6+ lotes ≤3 ha colindantes.

Adicional jurisprudencia clave (`09` Parte 1): CS rol 19261-2018 (Forestal Mininco, 22-abr-2021) prevalencia título inscrito sobre saneamiento DL 2.695. CS rol 62.948-2020 (Panguipulli) loteo brujo ilegal. CS jun-2025 tierra indígena criterio funcional incluso urbana. CS dic-2025 pacto art 1723 no extingue gravámenes anteriores. CdA Santiago feb-2025 invalidación recepción DOM ilegal sin procedimiento.

---

## 7. Gap competitivo

Análisis completo `competition_landscape.csv` (38 actores). Tres clusters:

- **Legaltech generalista IA** (Spektr, Leyer, Lexius, Justiciano, Tirant Sof-IA): IA jurídica chilena para abogados, sin flujo vertical inmobiliario, sin scrapers CBR, sin reglas. **No competidores directos.**
- **Estudios jurídicos boutique** (Misabogados $75–150k/estudio, Abogados Propiedades desde $75k, Schneider, Wolfenson, Abogaley, Vercetti corretaje gratis): venden horas humanas. Sin SaaS, sin API, sin scale.
- **Proptech generalista** (Dataprop CRM + multipublicador, KiteProp CRM, Propiteq AVM tasación, TocToc portal, Houm corretaje digital): cero layer legal preventivo. Houm hace verificación superficial documentos.

**Único competidor lateral peligroso**: **DataInmobiliaria (BAM)** — 9.5M propiedades + transacciones CBR + avalúos SII + deudas TGR + 15 años historia + GIS, gratis. Ya scrapea CBR + SII + TGR a escala nacional. Pero solo data lake de consulta, sin UI broker, sin reglas legales por propiedad, sin flow pre-listing. Si pivotea a producto B2B safeguard antes que PropOS, problema. Mitigación: velocidad MVP + integración profunda flujo broker + alianzas inmobiliarias.

**Referencias internacionales** (no operan Chile, modelo no replicable): First American Title (US, title insurance market que estructuralmente no existe acá). LandGate (US, data marketplace inspirador).

**Conclusión**: **no hay producto integrado para safeguard pre-listing automatizado en el mercado chileno**. Categoría abierta.

---

## 8. Costo unitario y ROI vs $50–150k abogado manual

Detalle `11-ai-feasibility-y-arquitectura.md` §6.

| Item | Costo CLP por estudio MVP |
|---|---|
| CBR carpeta 10 años | 13.500 |
| CBR dominio vigente | 4.600 |
| CBR CGP | 6.600 |
| LLM Tier 2 extracción (Sonnet 4.6) | ~750 |
| LLM identificación timbre + chain | ~450 |
| Scrapers públicos | ~150 |
| RPA browser pool amortizado | ~600 |
| Storage PDFs | ~12 |
| Infra basal | ~300 |
| **Subtotal sin HITL** | **~26.500** |
| HITL abogado amortizado (10% Tier 2 + 100% Tier 3 fired) | 5.000–15.000 |
| **Total** | **~32–42k** |

Con Tier 3 fired (cadena 30 años, ~100 págs Opus 4.7 1M ctx): +$3.500–6.500 LLM.

Comparativa: **abogado boutique $50–150k, 5–15 días** vs **PropOS $32–42k, <5 días async**. Margen para SaaS B2B mínimo 30–50% al precio sugerido $60k/estudio.

---

## 9. Roadmap MVP → v3

`11-ai-feasibility-y-arquitectura.md` §5.

- **MVP (mes 0–4)**. RM Santiago. CBR Santiago cubre 26 comunas (~30–40% transacciones país). Urbano residencial (depto + casa). Tiers 1+2 activos = 28 casos = 74% taxonomía. Tier 3 detrás de feature flag, dispara HITL siempre. Volumen target 100→500 estudios/mes.
- **v2 (mes 6–9)**. Suma CBR Rancagua + CBR Talca. Activa rural DL 3.516 (alta prevalencia O'Higgins/Maule). Tier 3 GA con HITL routing. Sucesiones complejas T08/T09/T17 partial.
- **v3 (mes 12+)**. Top 30 comunas nacional. Comercial + industrial. Detección doble inscripción (R01) cross-study mediante índice global `(jurisdiction, fna)`. Sucesiones con preteridos / interdictos T09 full.

Constraint hard MVP: la cobertura CBR. `cbr_capabilities.csv` muestra que solo CBR Santiago tiene tarifas y endpoints verbatim verificados; CBR Puente Alto, Talagante, Talca, Rengo bloquean scraping con Cloudflare-loaders. Esto fuerza arquitectura RPA con browser pool persistente Playwright stealth (`11` §2.2 + §9 riesgo 1).

---

## 10. Decisiones founder accionables

Cada una desbloquea ejecución. Orden recomendado:

1. **CBR cobertura MVP**. Decisión: **CBR Santiago only para MVP** (26 comunas RM, ~30–40% transacciones país, tier digital alto, FEA + QR validable, tarifas verbatim). Posterga Puente Alto/Talagante/Buin/Rancagua/Talca a v2 hasta tener volumen que justifique RPA por CBR. Pregunta abierta `11` §11: ¿CBR Santiago acepta cuenta API B2B con SLA, o solo formulario web? Llamada comercial directa requerida antes de comprometerse al SLA <5 días.
2. **LLM provider**. Default prod: **Claude Sonnet 4.6** Tier 2 ($3 in / $15 out por MTok, 97.6% extracción, 0.09% halucinación documental — TokenMix benchmark). Tier 3: **Claude Opus 4.7 1M context** ($5/$25 por MTok, sin premium long-context, soporta cadena 30 años en una pasada). Dev: **Cerebras Llama 3.3 70B free tier** (mismo patrón que Anita, ver `CLAUDE.md`). Provider abstracto `LLMClient` Protocol — swap por env var. Anthropic OAuth tokens NO sirven para Messages API en producción (ToS).
3. **RPA in-house vs proveedor**. Decisión: **in-house Playwright stealth + browser pool persistente en GCE VM** (Cloud Run no tolera headed browsers). Cloudflare loaders detectados en 4 CBRs del scope rural (Puente Alto, Talca, Talagante, Rengo). 2captcha como fallback si CBR levanta captcha ($1–3 USD per 1000). Outsourcing RPA (tipo Browse AI, Browserless) descartado por costo recurrente y dependencia. Single-source-of-truth en repo PropOS.
4. **Integración abogados**. HITL queue dedicada para Tier 3 fired + casos red. Modelo inicial: **uno o dos estudios boutique partner con SLA <24h, fee fijo por revisión** (~$30–50k). Consideración: NO contratar abogados en planta hasta validar volumen. Mantener disclaimer dura UI: "safeguard NO sustituye estudio formal — abogado obligatorio para cierre" (`11` §4.7 + §7).
5. **Modelo de cobro**. Tres opciones (`11` §6): (a) **per-study $60k CLP** (margen 30–50%, simple, broker entiende), (b) per-listing-active $20k/mes con estudios incluidos (sticky, mejor LTV), (c) tier+volumen $300k/mes flat hasta 50 estudios + $50k extra. **Recomendación**: lanzar per-study con descuento early-adopter (~$40k primeros 3 meses), migrar a tier cuando volumen estabiliza.
6. **Branding**. No abordado explícitamente en research files. Evitar nombre legal-heavy ("title check", "estudio jurídico digital") que invite expectativa de responsabilidad de abogado. Preferir nombre operacional ("PropOS Safeguard", "Pre-listing Check") con disclaimer permanente.
7. **Quién compra**. Cliente target: corredora mediana 5–50 brokers RM. Champion: gerente operaciones / fundador. Pitch: "evitamos que pierdas 8 semanas en listings podridos, te entregamos semáforo en 5 días por menos del costo abogado, free trial primeros 3 estudios".

---

## 11. Tabla maestra — checks por etapa de listing

Pipeline mínimo PropOS por etapa, derivado de `03-fiscal-municipal-urbanistico.md` §10 + `04-suelo-rural-y-parcelaciones.md` §11 + `11-ai-feasibility-y-arquitectura.md` §2.

| Etapa | Input broker | Sources consultadas | Outputs | Tier | Plazo |
|-------|-------------|--------------------|---------|------|-------|
| **0. Onboarding** | foto carrera 1° escritura + RUT propietario + dirección libre | n/a | rol/comuna confirmados, CBR jurisdicción identificado | identificación Vision LLM + cruce `comuna→cbr_id` tabla maestra | <2 min |
| **1. Identificación catastral** | rol/comuna | SII Mapas + SII certificado avalúo simple | rol matriz + subroles + avalúo fiscal vigente | 1 | <5 min |
| **2. Estado fiscal** | rol+subrol | SII detallado (si hay clave dueño) + TGR cert deuda | divergencia m² SII vs DOM, deuda contribuciones | 1 | <5 min |
| **3. Cadena registral** | comuna + dirección | CBR carpeta 10 años + GP + dominio vigente | FNA cadena, hipotecas, prohibiciones, embargos | 1 + 2 (LLM extrae partes/fechas) | 1–5 días async (límite CBR) |
| **4. Estado urbanístico** | dirección | DOM en Línea (CIP + recepción definitiva + permiso) o portal comuna directa | uso suelo, área riesgo, DUP, recepción m² | 1 + 2 | <30 min si comuna integrada DOM en Línea |
| **5. Triple expropiación** | coordenadas + rol | MINVU CNE + MOP-Vialidad + DOM (PRC) | flag DUP por nivel | 1 | <30 min |
| **6. Cargas geo cruzadas** | polígono predio | CMN + SBAP/MMA + SEC líneas + capa SHOA + 80m playa fiscal SSFFAA + IDE MINVU PRMS | flag patrimonio, biodiversidad, alta tensión, riesgo, fiscal costero | 1 (todo geo boolean) | <10 min |
| **7. Sucesión / régimen patrimonial** | cédula(s) vendedor(es) | Registro Civil matrimonio + defunciones | sociedad conyugal autorización 1749, posesión efectiva, art 688 CC | 1 + 2 | <30 min |
| **8. Rural específico** (si fuera límite urbano) | polígono | SAG cerofilas + DGA CPA + SAG IFC | DL 3.516 conformidad, derechos agua, IFC para construcción | 1 + 2 | 1–3 días |
| **9. Indígena** | rol + RUT + comuna | CONADI Registro Público Tierras + capa ADIs | flag tierra indígena (criterio funcional CS jun-2025) | 1 | <30 min |
| **10. Razonamiento Tier 3** | si flag dispara D01/D02/D05/D06/R01/R05 | RAG estricto sobre docs cargados + catálogo legal interno | análisis cadena + citas FNA+URL obligatorias | 3 + HITL abogado | 1–3 días |
| **11. Aggregator + decisión** | flags + evidencias | rule engine threshold (red≥1 / yellow≥2 / yellow≥1 con T11/T12) | semáforo + plan remediación + costo + plazo | engine | <1 min |
| **12. Disclaimer + entrega broker** | resultado | UI broker | aceptación disclaimer registrada + reporte PDF | n/a | <1 min |

End-to-end target: **<10 min hot path** (extracción + scrapers rápidos), **<5 días completo** (limitado por CBR async). Ver métricas éxito `11` §8.

---

## 12. Riesgos a vigilar

1. **DataInmobiliaria pivotea a B2B safeguard**. Ya tienen scrape CBR + SII + TGR escala nacional. Mitigación: velocidad MVP, integración flow broker más profunda, alianza inmobiliaria estratégica.
2. **Cloudflare adversarial en CBRs**. Detectado en 4 del scope. Si escalan, RPA puede romper sin aviso. Mitigación: contract tests nightly por adapter, fallback manual operator humano disparando requests, modelo `degraded`.
3. **Halucinación LLM en cadena larga** (Tier 3). Stanford 58–88% sin RAG. Mitigaciones layered (citas obligatorias, RAG estricto, CoVe, Pydantic strict, cross-check Tier1↔Tier2, golden cases CI). Worst case: deshabilitar Tier 3 auto, forzar HITL siempre para D01–D06.
4. **Ley Parcelaciones promulga repentinamente**. Si pasa con presunción "6+ lotes ≤3 ha colindantes" como Conjunto Residencial Rural exigiendo servicios + caución, todo el universo parcelas DL 3.516 listadas mayo-2026 entra en transición. Mitigación: monitor BCN proyecto Boletín mensual, prompts Tier 2/3 con `legal_sources` en catálogo versionado por migration.
5. **Reglamento 21.442 plazo 9-ene-2026**. Toda copropiedad sin reglamento adaptado entra zona de cobros disputables. Mitigación: flag amarillo automático para todo listing condominio sin verificación reglamento adecuado.
6. **Tokenizer Opus 4.7 ~35% más tokens** vs Opus 4.6 mismo input. Re-medir budget tokens trimestralmente.
7. **CBR Santiago no acepta API B2B con SLA**. Llamada comercial requerida pre-launch. Si solo formulario web → costo operacional RPA escala mal.
8. **PDFs CBR pierden FEA en download programático**. Algunos portales re-firman por sesión. Si sí, workaround legal (cert acompañamiento) para preservar autoridad probatoria — abogado externo opina.
9. **Responsabilidad legal por falso green**. E&O insurance $2–5MM USD limit, disclaimer dura UI con timestamp, abogado obligatorio cierre. Auditoría externa Ley 19.628 protección datos año 1.
10. **Reforma registral CBR uniforme nacional**. Asociación Nacional CBR Chile empuja modernización digital progresiva. Si llega API estándar (improbable corto plazo), nuestro diferencial RPA pierde valor — mitigación: capa de abstracción adapter, swap a API trivial.

---

## Fuentes

Todo este resumen consolida `01-cbr-y-cadena-de-titulos.md`, `02-documentos-y-flujo-formal.md`, `03-fiscal-municipal-urbanistico.md`, `04-suelo-rural-y-parcelaciones.md`, `06-casos-tipicos-y-flags.md`, `07-casos-raros-y-extremos.md`, `08-errores-faciles-vs-dificiles.md`, `09-jurisprudencia-y-normativa-2024-2026.md`, `11-ai-feasibility-y-arquitectura.md`, `cases_taxonomy.csv`, `cbr_capabilities.csv`, `competition_landscape.csv`, `endpoints_publicos.csv`. Migration borrador del schema datos en `borrador_migration_title_study.sql`. Cero halucinación: si un dato no está en esos archivos, lo digo explícito o lo omito.
