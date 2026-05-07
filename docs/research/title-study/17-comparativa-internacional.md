# 17 — Comparativa Internacional: Sistemas de Título y Proptech

> Research note. Audiencia: founder PropOS. Foco: qué replicar, qué evitar, dónde está la ventana competitiva.

## 0. TL;DR (caveman)

- USA = `title insurance` industria $18B/año, 4 oligopolios, 73% market share. Tech layer (Qualia, Endpoint) cierra transacciones, NO underwrite.
- Doma intentó disrumpir underwriting con ML → IPO SPAC 2021 $3B → vendida $85M 2024. Lección: **no atacar el incumbent en su capa**.
- UK / AUS / NZ / España / Chile / LatAm = sistema registral con **fe pública estatal**, NO hay title insurance masivo. Stack distinto.
- Brasil = el más cercano a Chile. Loft fue unicornio, perdió 65% valor 2022, breakeven 2023. Modelo iBuyer + closing en mismo stack.
- Qualia ($2.2B val, 2025) = modelo más afín a PropOS: SaaS de closing para profesionales, NO aseguradora.
- **Riesgo competidor**: si Loft/Habi/La Haus traen su stack a Chile con due-diligence integrado, ventana se cierra en 12-24 meses.

---

## 1. USA — Title Insurance industry

### 1.1 Estructura del mercado

| Carrier | Q1 2025 share | Modelo |
|---|---|---|
| First American Title | 22.9% | Underwriter + tech (Endpoint) |
| Fidelity National | 14.1% | Underwriter + Chicago Title |
| Old Republic | 14.0% | Underwriter conservador |
| Chicago Title (Fidelity) | 12.9% | Mismo grupo Fidelity |
| Stewart Title | 9.2% | Underwriter |
| **Top 4 combinado** | **73.4%** | Oligopolio histórico |

Premium volume Q1 2025 = $3.9B; Q2 2025 = $4.5B (+13.2% YoY). Industria total ≈ $18B/año en años buenos, $15B en años de tasas altas. Margen operativo histórico 50-55% en períodos refi-heavy, 20-30% en down cycle 2023-2024.

### 1.2 Cómo cobra

- Premium = 0.5% – 1.0% del precio de venta, **one-time** al closing.
- Dos pólizas: owner's policy (paga buyer) + lender's policy (paga buyer pero requerida por banco).
- En refinance, lender's policy se reemite (≈70% rebate en algunos estados).
- ALTA Forms estandarizan cobertura nacional.

### 1.3 Por qué existe el seguro y no la fe pública

USA tiene **recording system**, NO `Torrens`. Cada condado registra deeds pero NO valida cadena. El abstract of title + opinión de un abogado o examiner determina marketability. Riesgo residual cubierto por seguro. Esto es **opuesto** al sistema chileno (CBR otorga fe pública con efecto erga omnes vía art. 686 CC).

### 1.4 Capa tecnológica (NO underwriting)

| Player | Fundada | Modelo | Status 2026 |
|---|---|---|---|
| **Qualia** | 2015 | SaaS closing platform (settlement OS) para title agents, lenders, brokers | $1B → $2.2B val 2025; $153M raised; adquirió RamQuest 2025; revenue ≈ $64.5M, 586 empleados |
| **Endpoint** | 2018 | Digital closing operado por First American ($220M invertidos) | Operativo, Tech100 2024; sigue activo como brazo digital de FA |
| **Doma (ex-States Title)** | 2016 | Instant underwriting con ML para refis | IPO SPAC 2021 $3B; **vendida a Title Resources Group por $85M en sep 2024** (down 97%); Doma TechCo escindida |
| **Notarize / Proof** | 2015 | RON (remote online notarization) | Pivotó a identity proofing 2023, dejó de ser pure-play closing |
| **Snapdocs** | 2013 | Mortgage closing coordination | Privada, $720M raised, ~$1.5B val última ronda |

**Qualia** es el modelo más relevante para PropOS: vende SaaS a profesionales (title agents, brokers, lenders), NO compite con underwriters. Crece por workflow, no por capital intensivo.

**Doma** es la lección negativa: intentó comerse el underwriting con ML y volumen residencial. Cuando subieron tasas en 2022 y refis colapsaron, modelo no resistió.

### 1.5 E&O insurance

Brokers en USA contratan E&O insurance individual:
- Average $665-907/año por agente.
- $500-1,000/empleado en agencias.
- Agencias grandes hasta $50K/año.
- Cobertura típica $1M per-occurrence / $1M aggregate.

E&O cubre errores del broker (mala disclosure, omisiones), NO defectos de título (eso es title insurance separado). **Chile no tiene equivalente masivo** — corredores trabajan sin E&O y absorben riesgo personal.

---

## 2. UK — Land Registry centralizado + solicitor

| Dimensión | UK |
|---|---|
| Registro | HM Land Registry (centralizado, estatal, no condados) |
| Cobertura digital | ~90% de propiedades registradas digitalmente; meta 100% para 2030 |
| Garantía | Indemnidad estatal (state-backed) si error registral |
| Profesional clave | Solicitor o licensed conveyancer (no notario al estilo civilista) |
| Documentos | Property Information Form (TA6), Fittings & Contents (TA10), Leasehold (TA7) |
| Title insurance | Existe pero **complementario** (defectos específicos: missing deed, restrictive covenant), no obligatorio |
| Firma digital | QES (Qualified Electronic Signature) aceptada desde 2025 |

### 2.1 Flujo conveyancing

1. Buyer's solicitor solicita **Local Authority Search** (planning, charges).
2. Environmental + drainage searches.
3. Property Information Forms del seller.
4. Solicitor revisa Land Registry official copy + title plan.
5. Exchange of contracts → completion → AP1 form al Registry.

### 2.2 Lecciones para Chile

- Sistema centralizado vs Chile fragmentado por CBR (≈ 90 conservadores). Chile más cerca de UK que de USA en lógica registral.
- TA6/TA7/TA10 = forms estandarizados que el seller llena. **Chile no tiene equivalente formal** — disclosure es ad-hoc en escritura. **Oportunidad PropOS**: forzar form estandarizado pre-listing.
- QES es viable post-Ley 19.799; Chile permite firma electrónica avanzada en escrituras desde 2002 pero adopción notarial sigue baja.

---

## 3. Australia / NZ — Torrens

| Dimensión | AUS / NZ |
|---|---|
| Sistema | Torrens (registro = título; estado garantiza dominio) |
| Indefeasibility | Sí — el registro derrota cualquier reclamo previo no anotado (con excepciones: fraude, in personam) |
| Assurance Fund | Fondo estatal compensa pérdidas por error registral o fraude |
| Digital | NSW, VIC ≈ 99% e-conveyancing vía PEXA desde 2019 |
| Title insurance | Existe (Stewart Title AU, First Title) pero penetración baja, **complementario** al registro |
| Profesional | Solicitor/conveyancer + Land Registry Office estatal |

PEXA (Property Exchange Australia) procesa ~80% de las transacciones. Settlement digital end-to-end. Fundada 2010 como joint venture estado+banca.

### 3.1 Lecciones para Chile

- **Chile NO tiene Torrens**: sistema chileno es de inscripción registral causal (no constitutiva en el sentido fuerte), pero CBR sí da fe pública. Reformas tipo Torrens han sido propuestas (Mensaje N° 318-360 etc.) y **están pendientes hace décadas**. Asumir que NO habrá reforma en 5-10 años.
- Assurance Fund chileno NO existe. CBR responde solo por culpa/dolo del conservador, no por errores sistémicos.
- PEXA es el modelo aspiracional: monopolio público-privado de settlement digital. PropOS NO puede ser PEXA, pero puede ser la capa de **diligencia previa** que alimenta a notarías y CBR.

---

## 4. España — Registro + Notario

| Dimensión | España |
|---|---|
| Registro | Registro de la Propiedad (87 distritos hipotecarios, ~1080 oficinas), Corpme |
| Profesionales | Notario (autoriza escritura, controla legalidad) + Registrador (califica + inscribe) |
| Coste registrar | 2025: ~0.4-1% del valor (notaría + registro + ITP + gestoría) |
| Title insurance | Marginal; banca exige tasación, no seguro de título |
| Legaltech | Tirant lo Blanch (DB jurídica), vLex (DB jurídica + IA Vincent), Cuatrecasas (despacho top, papers) |

España es **el clon más cercano de Chile** en lógica registral: notario + registrador, fe pública, ITP fiscal. Diferencia: España tiene FLOTI (índices únicos electrónicos) y conexión notario↔registro vía SIGNO desde 2003. Chile aún tramita en papel + escaneo.

### 4.1 Legaltech inmobiliario español

- **vLex Vincent AI** (2024): asistente legal que cita jurisprudencia, busca en BORME, RM, Catastro. Vendido a despachos.
- **Cuatrecasas Knowledge** (2025): publicaciones sobre Decreto-ley 2/2025 grandes tenedores (registros obligatorios, derecho tanteo Catalunya).
- **Tirant Online**: base de jurisprudencia + formularios. No es title-study propiamente.
- **Idealista Hipotecas / Housfy**: capa de comparador + closing assist, no due diligence.

**No existe un "Qualia español"** — el closing lo absorbe el notario por mandato legal. La oportunidad legaltech está en **pre-due diligence** y en gestión post-firma, no en reemplazar al notario.

---

## 5. Brasil — el más comparable a Chile

| Dimensión | Brasil |
|---|---|
| Registro | Cartórios de Registro de Imóveis (≈3300 cartórios; uno por circunscripción) |
| Sistema | Causal-romanista; matrícula única por inmueble (similar a foja chilena) |
| Impuesto transferencia | ITBI municipal (2-5% según ciudad) |
| Notarial | Tabelionato de Notas (escritura pública) + Cartório de Imóveis (registro) |
| Digital | e-CRI / ONR (Operador Nacional do Sistema de Registro de Imóveis); Central Registradores BR; portal único en construcción |
| Financiamiento | Caixa Econômica Federal (~70% del crédito habitacional) |

### 5.1 Proptech brasileño

| Player | Fundada | Modelo | Status 2026 |
|---|---|---|---|
| **Loft** | 2018 | iBuyer + marketplace + closing in-house | Val peak $2.9B (2021) → down round a $1B (2022, a16z); 543 layoffs 2022; breakeven operativo 2023; aún privada, $800M+ raised |
| **QuintoAndar** | 2012 | Marketplace de arriendo + venta + serviços financeiros | Val ~$5B; entró a México 2022; lider Brasil |
| **Imóveis.com / Grupo ZAP** | 2010s | Portal listings | Adquirida por OLX 2020 |
| **Tegra / EmCasa** | 2018 | Marketplace + closing assist | Privadas, escala media |

Loft es el **caso de estudio crítico** para PropOS: integró iBuyer + closing en mismo stack, captó $700M+, llegó a unicornio, y la subida de tasas Selic (13.75% en 2022) lo destrozó. Sobrevivió cortando 30% headcount y declarando breakeven 2023.

**Lección**: integrar closing puede dar moat, PERO el iBuyer balance-sheet te mata en ciclo de tasas. PropOS debe ser **asset-light** (SaaS + servicios), nunca tomar inventario.

### 5.2 Tecnología registral brasileña

ONR (Operador Nacional, ley 11.977/2009) opera plataforma única e-CRI. Central Registradores BR permite consulta de matrícula, certidão digital, busca por CPF/CNPJ con respuesta ≤5 días. **Brasil va 5 años adelante de Chile** en infra registral digital.

---

## 6. México — registro estatal + notario concesionado

| Dimensión | México |
|---|---|
| Registro | Registro Público de la Propiedad (RPP) — uno por entidad federativa, 32 sistemas no interoperables |
| Notario | Concesionado por el estado (función pública delegada), monopolio territorial |
| Costo escritura+registro | ~5-8% del valor (notario + ISAI + RPP + avalúo) |
| Fragmentación | Alta; cada estado tiene su sistema, calidad heterogénea (CDMX digital ok, otros estados papel) |

### 6.1 Proptech mexicano

| Player | Modelo | Status |
|---|---|---|
| Lamudi | Portal listings + contenido educativo | Activa, parte de Frontier Digital Ventures |
| Inmuebles24 | Portal + clasificados (Adevinta) | Activa, líder en tráfico |
| Vivanuncios | Clasificados (eBay → Adevinta) | Activa |
| TrueHome → Loft México | iBuyer | Adquirida por Loft 2021; rebranding |
| Tuhabi (Habi MX) | iBuyer + closing | Operación reducida 2024 |
| La Haus | Marketplace nuevo desarrollo | Layoffs 2022 (54 personas / 6.7%); operativa pero contraída |

México tiene **fragmentación registral peor que Chile** — 32 sistemas vs ~90 CBR pero con normas estaduales distintas. Esto frena due diligence interestatal y abre espacio para SaaS que normalice. Sin embargo, **complejidad notarial** (notario concesionado, fees altos) es barrera mayor que en Chile.

---

## 7. Argentina — registros provinciales

| Dimensión | Argentina |
|---|---|
| Registro | Registro de la Propiedad Inmueble por jurisdicción (CABA, Bs As, Córdoba, etc.); declarativo no convalidante |
| Profesional clave | Escribano (notario) hace estudio de títulos por mandato |
| Estudio de títulos | Tradicional 30 años hacia atrás (prescripción veinteñal + margen) |
| Crisis | Inflación 100%+ anual 2022-2024; mercado inmobiliario se mueve en USD cash |

127 proptechs activas en Argentina (Nov 2025), USD 284M invertidos en últimos 18 meses según Develop Argentina. Algunas startups automatizan consultas a registros provinciales (CABA, BsAs, Córdoba tienen APIs), generan reportes en 48h, ofrecen API a inmobiliarias y escribanías.

**El paralelismo con Chile es directísimo**: estudio de títulos de 30 años por escribano = lo que hacen abogados chilenos en 10 años. La crisis macro complica monetización pero **la tesis técnica es idéntica**. PropOS debería estudiar 2-3 startups argentinas (SuiteSocial, ZonaProp closing assist, RealtyHub) como benchmarks de RPA registral.

---

## 8. Tabla comparativa maestra

| País | Sistema registral | Title insurance? | Tiempo dominio típico | Coste % | Tech madurez | Lección Chile |
|---|---|---|---|---|---|---|
| **USA** | Recording (condado) | **Sí, masivo (0.5-1%)** | N/A (seguro cubre) | 0.5-1% premium + closing fees | Alta (Qualia, PEXA-like APIs) | NO replicable; modelo seguro es 100% extranjero al sistema chileno |
| **UK** | Land Registry centralizado | Marginal (gap-filler) | 90% digital, completion ≤6 sem | 1-3% (solicitor+stamp duty) | Alta, meta 100% digital 2030 | Forms TA6/TA7 estandarizados — replicable como standard PropOS |
| **AUS/NZ** | Torrens (registro = título) | Marginal | e-conveyancing PEXA same-day | 4-6% (stamp duty domina) | Muy alta | PEXA es aspiracional pero requiere joint-venture con estado+banca |
| **España** | Notario + Registrador | No relevante | 1-3 sem post-firma (FLOTI) | 8-12% (ITP+notaría+registro) | Media-alta (SIGNO desde 2003) | Modelo más cercano; closing absorbido por notario, oportunidad en pre-DD |
| **Brasil** | Cartórios + ONR | No | 1-4 sem matrícula | 4-6% (ITBI+cartório) | Alta (e-CRI, Central Registradores) | Loft = warning iBuyer; e-CRI es target infra |
| **México** | RPP estatal (32 sistemas) | No | 30-90 días | 5-8% | Heterogénea | Fragmentación peor que Chile; espacio SaaS normalizador |
| **Argentina** | Registros provinciales | No | 30-60 días | 4-6% | Media (APIs CABA/BsAs/Cba) | Paralelismo directo; benchmark proptechs locales |
| **Chile** | CBR (~90 conservadores) | **No existe** | 30-90 días promedio | 1.5-3% (notaría+CBR+ITP impl.) | Baja (CBR escaneado, no datos) | **Aquí estamos** |

---

## 9. Startups internacionales — qué replicar

### 9.1 Qualia (USA, 2015) — el modelo más afín a PropOS

- **Modelo**: SaaS settlement OS para title agents, brokers, lenders. No underwrite, no toma riesgo balance-sheet.
- **Numbers**: $2.2B val 2025, $153M raised, $64.5M revenue, 586 empleados, >500K profesionales en plataforma.
- **Moat**: integraciones con todos los underwriters + lenders + e-recording counties. Network effect. Adquirió RamQuest (legacy competitor) ene 2025.
- **Replicar para Chile**: SaaS para corredores+abogados+notarías que centralice DD, generación documental, coordinación closing. **Es la tesis PropOS exacta**, ajustada al sistema CBR.

### 9.2 Doma / States Title (USA, 2016) — el anti-modelo

- **Modelo**: instant title underwriting con ML; vender pólizas más baratas que incumbents.
- **Numbers**: SPAC IPO 2021 a $3B; **vendida $85M en sep 2024** (down 97%); Doma TechCo escindida.
- **Por qué fracasó**: dependía de volumen refi (margen ML solo cierra a escala); cuando Fed subió tasas 2022, refis colapsaron 70%. Costos fijos altos, ingresos variables.
- **Lección**: NO competir con incumbents en su capa core. NO tomar riesgo de underwriting. NO depender de un solo segmento de ciclo (refi).

### 9.3 Endpoint (USA, 2018, First American)

- **Modelo**: closing digital orquestado, propiedad de FA. $220M invertidos.
- **Lección**: incumbents construyen su propia tech-layer interna. En Chile no hay equivalente de FA (no hay aseguradoras de título), pero notarías grandes (Iñiguez, Reyes Barros) podrían lanzar su propio stack si esperan demasiado.

### 9.4 Opendoor (USA, 2014) — iBuyer

- **Status 2025**: revenue $4.37B (down de $5.15B); pérdida neta $1.3B; pivot a "Opendoor 2.0" con AI; Rabois+Wu volvieron al board sept 2025; Kaz Nejatian (ex-Shopify COO) es CEO; meme stock rally jul 2025 → drop 50% a fin 2025; riesgo delisting NASDAQ.
- **Lección**: iBuyer es brutal en ciclo. PropOS NO debe tomar inventario.

### 9.5 Loft (Brasil, 2018)

- **Status**: $2.9B → $1B (down round a16z 2022); 543 layoffs; breakeven 2023.
- **Lección**: iBuyer + closing integrado puede funcionar PERO solo si capital es paciente y macro estable. Brasil mostró que con Selic 13% el modelo se rompe. Chile con TPM 5-7% está en zona de riesgo similar.

### 9.6 Habi (Colombia, 2019)

- **Status 2025**: unicornio (val $1B desde may 2022); $521-541M raised; $30M debt round abr 2024; ~1000 empleados; $1.5B en transacciones acumuladas; IDB Invest credit line $25M.
- **Modelo**: iBuyer + financing originator + closing assist en estratos medio-bajo.
- **Lección**: nicho underserved (estrato medio-bajo, papeleo informal) = moat. **¿Pueden venir a Chile?** Sí — Bogotá → Lima/Santiago es expansión natural. Chile tiene mercado más formal pero menos volumen → menos atractivo para ellos hoy.

### 9.7 La Haus (Colombia/México, 2017)

- **Status**: 54 layoffs (6.7%) nov 2022; pivot a obra nueva (primary market) 2023; sin nuevas rondas grandes desde Series C $62M (2021); operativa pero contraída.
- **Lección**: especialización en obra nueva los aisló del shock secondary 2022. Pero crecimiento limitado.

### 9.8 PEXA (Australia, 2010)

- **Modelo**: monopolio settlement digital, JV estado+4 grandes bancos.
- **Lección**: la única forma de capturar el closing es con bendición regulatoria. PropOS NO puede ser PEXA (Chile no concesiona settlement), pero puede ser **insumo** de PEXA-like si Chile algún día lo crea.

---

## 10. Lecciones consolidadas para PropOS

### 10.1 Title insurance NO es replicable inmediato

- Sistema chileno tiene fe pública estatal vía CBR + responsabilidad notarial → seguro de título no tiene demanda natural.
- Cultura aseguradora chilena en bienes raíces es **incipiente** (solo seguros hipoteca y desgravamen, exigidos por banca).
- Crear producto seguro requiere: regulador (CMF), reaseguro, base actuarial de claims (no existe), 5-10 años de data.
- **Veredicto**: descartar. Si algún día Chile reforma a Torrens light + assurance fund estatal, abre puerta, pero es 10+ años.

### 10.2 "Due diligence as a service" SÍ es transversal

- En todos los sistemas (USA recording, UK Land Registry, Brasil cartório, España registro), alguien tiene que **levantar y validar la cadena de hechos**.
- USA: title examiner / abstractor.
- UK: solicitor.
- Brasil/España/Chile: abogado o escribano.
- **Esta capa es automatizable en todos lados**. Qualia lo hace para USA; ARISP (Brasil) lo hace en parte; en Chile no hay incumbente. Ventana abierta.

### 10.3 Qualia es el modelo norte

- SaaS para profesionales (no consumidor final).
- Vender workflow + integraciones, no underwriting.
- Network effect vía conexiones a CBR + notarías + bancos.
- Capital eficiente: $153M raised → $2.2B val (15x) vs Doma $645M raised → $85M sale.
- **Replicable Chile**: PropOS = Qualia adaptado a CBR + notario chileno + corredor.

### 10.4 Brokers NO son abogados

- USA: title agent es figura intermedia (ni abogado ni puro vendedor); Qualia los empodera.
- UK: solicitor es abogado regulado.
- Chile: corredor de propiedades NO está colegiado, NO firma escritura, **no tiene autoridad legal sobre due diligence**. Pero es el único que ve la transacción end-to-end.
- **Tesis PropOS**: dar al corredor herramientas que tradicionalmente solo tenía el abogado, sin sustituir al abogado en lo que requiere mandato legal.

### 10.5 Riesgo competidor regional

- Loft (Brasil) tiene infra closing + iBuyer; status frágil pero si vuelve a expandir, Chile es siguiente lógico.
- Habi (Colombia) está mejor capitalizada en 2025 que Loft; foco estrato medio podría escalar a Chile (Lima primero).
- QuintoAndar (Brasil) ya está en México; Chile es ruta natural.
- Houm (Chile-nativo) compite en arriendo, no DD venta.
- **Ventana estimada antes de que un regional traiga su stack**: 12-24 meses.

---

## 11. Alerta competidor potencial (P1)

> **Habi (Colombia) es la amenaza más concreta a 12-18 meses.**

Razones:
1. Capital fresco 2024 ($30M debt + IDB Invest line $25M).
2. Modelo iBuyer + closing + financing origination en stack único, ya probado en Bogotá+Medellín+CDMX.
3. Foco en estrato medio-bajo con papeleo subóptimo = exactamente el dolor chileno (50%+ propiedades con flags menores en cadena).
4. Founders (Brynne McNulty Rojas, Sebastián Noguera) tienen tesis pan-LatAm explícita.
5. Lima ya está en roadmap; Santiago es el siguiente puerto natural por PIB per cápita y formalización.

Si Habi entra a Chile en 2026-2027 trayendo su stack DD+closing integrado, PropOS deja de ser "el primer mover" y pasa a ser "el local frente a un regional capitalizado". Mitigación: cerrar partnership con 2-3 corredoras top y 1 notaría top en H1 2026 para crear lock-in antes de su llegada.

---

## Sources

- [ALTA Q1 2025 Title Premium Volume](https://www.alta.org/news-and-publications/news/20250626-ALTA-Reports-Q1-2025-Title-Premium-Volume-and-Market-Share-Data)
- [HousingWire — Title premium volume Q1 2025](https://www.housingwire.com/articles/title-premium-volume-q1-2025-alta-first-american-fidelity-old-republic/)
- [Qualia $2.2B val 2025 — Latka](https://getlatka.com/companies/qualia.com)
- [Qualia Series C $55M](https://www.qualia.com/press-releases/qualia-raises-series-c/)
- [Doma SPAC $3B 2021 — TechCrunch](https://techcrunch.com/2021/03/02/proptech-startup-states-title-now-doma-going-public-via-spac-in-3b-deal/)
- [Doma sold to TRG $85M 2024 — HousingWire](https://www.housingwire.com/articles/doma-agrees-to-sell-to-title-resources-group/)
- [Endpoint background — First American](https://www.firstam.com/news/2019/first-american-launches-endpoint-20191112.html)
- [HM Land Registry digital conveyancing 2025 — RMZ Law](https://rmzlaw.co.uk/2025/02/19/digital-conveyancing-in-the-uk-will-2025-finally-kill-the-paper-trail/)
- [Torrens system — Wikipedia](https://en.wikipedia.org/wiki/Torrens_title)
- [Title Insurance complements Torrens — DUAL](https://www.dualinsurance.com/au-en/dual-school/blog/title-insurance-complements-the-torrens-land-registration-system)
- [Cuatrecasas — Decreto-ley 2/2025 grandes tenedores](https://www.cuatrecasas.com/es/spain/inmobiliario/art/catalunya-registro-grandes-tenedores-derecho-tanteo-retracto)
- [Loft down round a16z — Bloomberg Línea](https://www.bloomberglinea.com/english/brazilian-unicorn-loft-denies-receiving-down-round/)
- [Loft layoffs 543 — Bloomberg Línea](https://www.bloomberglinea.com/english/brazil-proptech-lofts-cuts-reach-543-with-new-round-of-layoffs/)
- [Loft breakeven 2023 — Online Marketplaces](https://www.onlinemarketplaces.com/articles/brazilian-proptech-loft-claims-break-even/)
- [RI Digital ONR Brasil](https://ridigital.org.br/)
- [Central Registradores BR](https://www.registrodeimoveis.org.br/central-registradores-web-service)
- [Habi $1B unicorn](https://news.crunchbase.com/startups/colombias-la-haus-raises-35m-to-digitize-latams-residential-real-estate/)
- [Habi IDB Invest credit line](https://idbinvest.org/en/projects/habi-structured-line-credit-colombia)
- [La Haus layoffs 2022 — Online Marketplaces](https://www.onlinemarketplaces.com/articles/layoffs-at-la-haus-54-roles-cut/)
- [Opendoor 2025 — Motley Fool](https://www.fool.com/investing/2026/03/18/opendoor-technologies-stock-is-down-50-is-it/)
- [PropTech Argentina 2025 — Develop](https://developargentina.com/blog/proptech-revolucion-inmobiliaria-argentina-2025)
- [Lamudi México RPP](https://www.lamudi.com.mx/journal/que-es-registro-publico-propiedad-como-registrar-tu-casa/)
- [E&O Insurance cost — Insureon](https://www.insureon.com/real-estate-business-insurance/cost)
- [E&O Insurance NAR](https://www.nar.realtor/errors-omissions-eo-insurance)
