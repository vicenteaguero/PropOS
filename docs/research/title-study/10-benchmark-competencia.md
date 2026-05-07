# 10 — Benchmark de competencia: legaltech + proptech + APIs públicas Chile

> Fecha de consulta: 2026-05-07. Audiencia: ingeniero/founder PropOS sin background inmobiliario. Si un término aparece por primera vez se define inline.
>
> Glosario rápido (primer uso):
> - **CBR** = Conservador de Bienes Raíces. Registro público obligatorio donde se inscriben dominios, hipotecas, prohibiciones, gravámenes. Hay ~80 CBRs en Chile, uno por jurisdicción territorial. Análogo: registry of deeds en US, distinto es que el dominio se prueba **solo** por inscripción CBR.
> - **Estudio de títulos** = due diligence legal sobre la cadena de inscripciones de un inmueble en los últimos 10 años (plazo prescripción adquisitiva extraordinaria). Es el producto core que PropOS apunta a automatizar.
> - **DOM** = Dirección de Obras Municipales (cada municipio tiene la suya). Emite certificados urbanísticos: número municipal, recepción definitiva, informes previos, zonificación.
> - **SII** = Servicio de Impuestos Internos. Emite avalúo fiscal y rol de bienes raíces (`rol-subrol` por comuna).
> - **TGR** = Tesorería General de la República. Cobra contribuciones (impuesto territorial) y emite certificado de deuda.
> - **DGA** = Dirección General de Aguas. Registra derechos de aprovechamiento de aguas (críticos en rural).
> - **CONADI** = Corporación Nacional de Desarrollo Indígena. Administra Registro Público de Tierras Indígenas (Ley 19.253).
> - **CMN** = Consejo de Monumentos Nacionales. Restricciones en monumentos históricos y zonas típicas.
> - **PJUD** = Poder Judicial. Tribunales civiles, familia, laboral. Para detectar litigios sobre inmuebles.
> - **BCN** = Biblioteca del Congreso Nacional. Mantiene Ley Chile (corpus legal completo).
> - **FEA** = Firma Electrónica Avanzada (Ley 19.799). Equivalente legal a firma manuscrita salvo para actos solemnes (compraventa de inmuebles requiere escritura pública notarial, no se puede firmar electrónicamente).
> - **UF** = Unidad de Fomento, unidad indexada a inflación (~$38.000 CLP a 2026-05-07).

---

## 0. Resumen ejecutivo (TL;DR)

Investigamos ~45 actores. La conclusión clave para PropOS:

**No existe en Chile un SaaS vertical end-to-end que ingiera la cadena completa de títulos (CBR + SII + TGR + DGA + DOM + Registro Civil + PJUD + CONADI + CMN + SubsecFFAA), corra extracción IA estructurada sobre los PDFs, detecte flags y emita un informe accionable.** Lo que existe son fragmentos:

1. **Estudios jurídicos boutique** que hacen estudio de títulos manualmente (Wolfenson, Schneider, Ayala&Cía, Legal Prisma, Vercetti, Abogaley, Total Abogados). Servicio humano puro, $50K–$150K CLP por estudio urbano. Ningún pipeline automatizado. Tusler aparece referenciada como “primera legaltech inmobiliaria”, pero su tracción digital es baja, sin API pública, sin documentación de IA generativa.
2. **Legaltech IA horizontal** (Spektr, Leyer, Lexius, Justiciano, Magnar, Tirant Sof-IA, BotiLex). Todas hacen research jurisprudencial / redacción de contratos / análisis docs genéricos. Ninguna tiene cadena de custodia inmobiliaria ni scrapers de CBR. Lexius cobra $9.499 CLP/mes — es el único con pricing público transparente en el segmento IA legal CL.
3. **Proptech CRM** (Dataprop, KiteProp, ICONCRETA, ComunidadFeliz). Foco en gestión comercial (leads, listados, multipublicación, gastos comunes). Ninguno toca due diligence legal.
4. **Portales/data** (Portal Inmobiliario, Yapo, TocToc, DataBAM). Listados + valoración estadística. TocToc tiene API B2B con datos de avalúos, transacciones y valor comercial, **única API real-time relevante** del lado privado.
5. **Infra pública**. Conservadores Digitales tiene un APIManager (microservicios sobre Kubernetes) pero **no expone API pública para terceros**: solo integraciones institucionales. SII, TGR, DGA, DOM en Línea, CONADI, PJUD, CMN, SubsecFFAA, Coordinador Eléctrico — ninguno tiene API REST pública documentada para consultas masivas. Acceso es vía ClaveÚnica + UI web → scraping/RPA es la salida. BCN Ley Chile sí tiene API real (Linked Open Data W3C) y es referente mundial.
6. **Notaría online + FEA** (Firma Virtual, Firma.cl, Acepta, MuySimple, NotarioVirtual, TuFirma). Complementarios, **no competidores**: la compraventa de inmueble exige escritura pública ante notario, no se firma con FEA. PropOS los integra para anexos no solemnes.

**La oportunidad PropOS:** ser el **primer SaaS vertical** que conecte todas estas fuentes fragmentadas mediante RPA/scraping + LLM extraction + reglas, vendido a corredores, bancos hipotecarios, abogados inmobiliarios y compradores directos. Riesgo central: el moat es operativo (mantener scrapers funcionando contra ~80 CBRs + ~345 DOMs + sistemas legacy), no algorítmico.

---

## 1. Categoría: Legaltech vertical inmobiliario Chile

### 1.1 Tusler (https://tusler.cl/)

Marketed como “legaltech inmobiliaria” pero **footprint digital es bajísimo** — la búsqueda directa de “Tusler legaltech Chile” en Google no devuelve ni un resultado primario sobre la marca, solo competidores adyacentes en SERP. No hay documentación de API, ni pricing publicado, ni casos de uso. Conclusión: o pivotó, o es un estudio jurídico con landing y branding tech sin producto SaaS real. Si existe, opera bajo perfil con clientes B2B directos. **Gap vs PropOS:** sin ingestion automatizada PDF, sin pipeline IA documental.

### 1.2 Conservadores Digitales (https://conservadoresdigitales.cl/)

**No es competidor — es la fuente principal de PropOS.** Plataforma público-privada de los CBR de Chile, lanzada fines 2017. Recibe >18.000 visitas/día desde ~140 países, >500.000 usuarios registrados, emite >8.000 certificados/día. Internamente corre **APIManager + microservicios sobre Kubernetes** ([fuente: gerencia.cl](https://www.gerencia.cl/transformacion-digital/la-transformacion-digital-del-conservador-de-bienes-raices-de-santiago/), [df.cl Red Hat](https://www.df.cl/brandcorner/red-hat/el-camino-del-conservador-de-bienes-raices-de-santiago-hacia-la)).

**Limitación crítica para PropOS:** el APIManager está cerrado a integraciones institucionales (otros organismos del Estado), no abierto a terceros. La cobertura de CBRs adheridos es **parcial**: el CBR de Santiago lidera, los regionales pequeños siguen en sistemas locales o papel. Hoy la única vía es scraping web autenticado o convenio comercial con cada CBR.

### 1.3 MisAbogados (https://www.misabogados.com/)

Marketplace legaltech fundado ~2014, posiciona como “SaaS de servicios legales para PYME”. Tiene guía de compraventa de inmuebles publicada ([guia-compraventa-inmuebles](https://www.misabogados.com/guia-compraventa-inmuebles)) y enruta a abogado humano. **No automatiza nada de estudio de títulos.** Sirve como canal de referidos pero no como pipeline IA. Listado en Capterra como software para SMEs.

### 1.4 Legal Prisma (https://www.legalprisma.cl/estudio-de-titulos-chile/)

Estudio jurídico boutique. Ofrece estudio de títulos manual con la metodología clásica: revisión de transferencias 10 años, informe escrito final. Sin tecnología. Cliente potencial de PropOS más que competidor.

### 1.5 Wolfenson (https://www.wolfenson.cl/)

Boutique premium de Las Condes. Servicios full custom alto-valor. Honorarios no públicos. Importante: el socio Ariel Wolfenson tiene controversias legales mediáticas activas en 2025 ([The Clinic, oct 2025](https://www.theclinic.cl/2025/10/26/las-causas-que-complican-al-mejor-abogado-de-chile-las-nuevas-denuncias-contra-ariel-wolfenson-acusado-por-apropiacion-indebida-por-un-policia-checo-y-un-medico-frances/)) → ojo con asociar marca PropOS.

### 1.6 Ayala & Cía (https://www.ayalaycia.cl/)

Boutique inmobiliaria, online-only, Lo Barnechea. Redacción de escrituras rectificatorias, clarificatorias, ratificatorias y complementarias — todo manual. Cliente arquetípico de PropOS.

### 1.7 Schneider Abogados (https://schneiderabogados.cl/)

Estudio civil con 15+ años en estudios de títulos. **Único con pricing semi-público:** $75.000 CLP estudio urbano Santiago < 500 UF; sobre 500 UF varía. Cubren urbano + rural + DL 2.695 (saneamiento de pequeña propiedad raíz) + saneamiento + aguas. Proceso: videollamada + informe digital. Sigue siendo 100% manual, sin OCR ni automatización.

### 1.8 Vercetti Propiedades (https://www.vercettipropiedades.cl/)

Híbrido corretaje + legal. Ofrecen estudio de títulos preventivo **gratis** como gancho de su corretaje. Modelo de bundling tradicional, no SaaS.

### 1.9 Abogaley (https://www.abogaley.cl/)

30+ años, multipractice (familia, laboral, civil, penal, propiedades), 20+ ciudades, fuerte canal de leads online. Estudio de títulos como un servicio más. Sin automatización ni IA. Competidor de canal/leads, no de producto.

### 1.10 Aguila & Cía (https://www.aguilaycia.cl/)

Regional Puerto Montt. 30+ años. Mario Aguila ejerce desde 1988. Mercado Region Los Lagos + corresponsal Santiago para Corte Suprema. Sin tech.

### 1.11 Firma Virtual / Firma.cl / Acepta / Notaría Virtual

Categoría notaría online + FEA. Operan bajo Ley 19.799. **Limitación legal hard-coded:** los actos solemnes (compraventa de inmuebles, hipotecas) **requieren escritura pública** ante notario y NO admiten FEA según interpretación de la Corte Suprema y de Carey Abogados ([carey.cl](https://www.carey.cl/firma-electronica-cuando-puede-utilizarse-y-cuando-no)). Por tanto firman anexos, mandatos, promesas, autorizaciones, pero no la compraventa misma. PropOS los integra como complemento, nunca compite.

### 1.12 FENECH

No encontramos sitio público claro para “FENECH Chile”. Probable referencia es la **Federación de Notarios y Conservadores** o similar gremio. Sin producto SaaS. Stakeholder político, no competidor.

### 1.13 Total Abogados (https://totalabogados.cl/)

Se autodefine “primera legaltech de Chile” ([nosotros](https://totalabogados.cl/nosotros)). Marketplace digital de servicios modulares con cuotas mensuales y descuentos de red 20%. Multipractice incluyendo inmobiliario. Sin pipeline de extracción documental.

---

## 2. Categoría: Legaltech IA generalista (Chile + LATAM)

### 2.1 Spektr (https://www.spektr.legal/)

Lanzada oct-2023. **Primera IA jurídica nativa Chile** según prensa ([emol feb-2024](https://www.emol.com/noticias/Economia/2024/02/07/1120968/legaltech-alianza-universidad-catolica-juridica.html), [estadodiario](https://estadodiario.com/noticias/spektr-y-el-centro-de-alumnos-de-derecho-de-la-pontificia-universidad-catolica-se-unen-para-co-crear-inteligencia-artificial-juridica-chilena/)). Arquitectura multi-agente, entrenada en 50+ áreas del derecho chileno, alianza con Centro de Alumnos de Derecho UC. Lanzamiento Argentina 2025. Reclama 80% mejora de eficiencia. Sin foco vertical inmobiliario, sin scrapers CBR, sin pipeline de PDFs estructurados.

### 2.2 Leyer (https://leyer.cl/)

IA para abogados Chile. Foco research: leyes + jurisprudencia + análisis docs **con citas verificables**. Diferenciador: cita explícita de artículo y sentencia ([df.cl jul 2025](https://www.df.cl/df-lab/transformacion-digital/de-estudio-juridico-a-legaltech-el-camino-de-hedy-matthei-para)). Research-only, no genera artefactos formales tipo informe de títulos.

### 2.3 Lexius (https://lexius.io/cl/)

**Único con pricing público transparente CL:** $9.499 CLP/mes, $22.999 CLP/trim, $56.899 CLP/año, planes corporativos preferentes ≥5 licencias. 278.837 textos legales y 4.888.391 sentencias indexados. Abogado virtual con voz, podcast legal, redacción automática. Acepta CLP, USD, USDT/USDC/BTC/ETH/MATIC/BNB/AVAX. Trial 4 días gratis. Horizontal — sin pipeline CBR.

### 2.4 Justiciano / MiChat Legal (https://michatlegal.cl/)

“Primera plataforma chilena para PYMES con IA en derecho chileno” ([michatlegal.cl](https://michatlegal.cl/)). Redacción guiada de contratos (laborales, comerciales, arriendo, inversión, poderes). Análisis y chat 24/7. Vertical PYME B2B/B2C, no inmobiliario.

### 2.5 Magnar (https://www.magnar.ai/cl)

**Tracción más rápida del segmento.** Fundada ago-2025 por Andrés Arellano (CEO), Nicolás López, Andrés Rodríguez. Entrenada con corpus chileno (leyes + Corte Suprema + CMF + SII). 15.000 usuarios en 8 meses. **Carey** (mayor estudio jurídico de Chile) invirtió USD 500K en ene-2026 ([df.cl](https://www.df.cl/df-mas/punto-de-partida/carey-entra-al-mundo-startup-e-invierte-us-500-mil-en-legaltech-magnar), [carey.cl](https://www.carey.cl/carey-invierte-en-la-legaltech-de-ia-magnar-para-potenciar-la-expansion-regional-de-la-startup)). Levantamiento adicional USD 300K con Buenaonda + Platanus Ventures. Operación Chile + Perú + Colombia, expansión a 6 países anunciada Q2 2026. **Alerta competitiva:** si Magnar decide entrar al vertical inmobiliario con su corpus chileno + capital Carey, sería el competidor más peligroso en 24 meses. Hoy es horizontal.

### 2.6 Tirant Sof-IA → SOFIA 3.0 (https://prime.tirant.com/cl/)

Editor jurídico español Tirant lo Blanch. Sof-IA inicial 2024, SOFIA 3.0 lanzamiento feb-2026 ([contadores.tirant.com feb 2026](https://contadores.tirant.com/2026/02/06/sofia-3-0/)). IA generativa multi-doc: combinar, comparar, coherencia, discrepancias. Suscripción Tirant Prime. Corpus base España con extensiones país. No conoce CBR ni cadena de títulos chilena.

### 2.7 LemonTech (https://www.lemontech.com/)

**Legaltech #1 LATAM por escala.** ISO/IEC 27001 ([sobre-nosotros](https://www.lemontech.com/sobre-nosotros)). Productos: LemonSuite (gestión de firma), LemonFlow (gestión legal corporativa), CaseTracking (juicios masivos). 1.300 firmas clientes, 13 países. Chambers & Partners Band 1 LATAM. **Practice management, NO doc pipeline.** Complementario: PropOS podría integrarse vía LemonSuite para flujos de firmas grandes.

### 2.8 Techlex (ex Hedy Matthei & Cía, https://techlex.cl/)

Especializada en **cobranza judicial automatizada**. Bots, ML, CRM propio. Rebranded en dic-2023. Procesa cientos de miles de causas/día para 19 grandes clientes + 150 PYMEs. Expansión Perú + España. Sin overlap real estate.

### 2.9 BotiLex 2.0 (https://www.ijuridica.cl/botilex-2-0-ia-juridica-premium/)

Chatbot legal entrenado en jurisprudencia editada. Plan Portal Legal Premium uso ilimitado. >98% precisión auto-reportada. Generalista, no inmobiliario.

### 2.10 Otros del ecosistema mencionados

- **Leida** (https://leida.cl/) — automatización gestión legal con IA.
- **Tech-Law AI** (https://tech-law.ai/) — IA legal aplicada genérica.
- **Legal Technologies Chile** (https://www.legaltechnologies.cl/) — servicios para abogados.
- **Juztina** (https://www.juztina.ai/cl/es) — IA legal CL.
- **CaseTracking** (https://www.thecasetracking.com/) — producto Lemontech.
- **ALI / Asistente Legal Inteligente** (https://www.asistente-legal.com/cl) — asesoría legal gratis con IA.

Ninguno con foco inmobiliario.

---

## 3. Categoría: Proptech Chile

Asociación gremial **PropTech Chile** ([proptechchile.cl](http://proptechchile.cl/), [grupocolibri.cl/proptech](https://www.grupocolibri.cl/proptech)) mapea 90–120 startups. Llegó a Chile ~6 meses después que México/Colombia/Perú, originalmente vía iniciativa de cámara inmobiliaria.

### 3.1 Dataprop (https://dataprop.cl/)

CRM inmobiliario líder local. 500+ corredores activos. Funciones: gestión leads, multipublicación a portales sin costo extra, red de canje 3.000+ propiedades, análisis de precios con SII/CBR/TGR como fuentes ([dataprop.cl/portal-inmobiliario-en-chile](https://dataprop.cl/blog/portal-inmobiliario-en-chile/)). API custom para clientes empresariales. Pricing planes mensuales + anuales con descuento 17%, valores específicos requieren consulta. **Sin vertical legal — complementario a PropOS.**

### 3.2 KiteProp (https://www.kiteprop.com/cl)

CRM Chile + Argentina (Rosario). Fundadores con 20 años en corretaje. Planes Single, Basic, Office en UF mensual. Trial 15 días. **MCP de IA recientemente lanzado** (https://mcp.kiteprop.com/) — “tu inmobiliaria controlada por IA”, señal de foco IA en gestión comercial, no en due diligence.

### 3.3 ICONCRETA (https://iconcreta.com/)

CRM enterprise sobre Microsoft Dynamics 365. 20+ años. Módulos contratos + bodegas + activos + “IA para abogados” (vago, sin documentación pública). Stack legacy MS, contratos enterprise.

### 3.4 ComunidadFeliz (https://www.comunidadfeliz.com/)

Proptech estrella de Chile. Gestión de comunidades/condominios — gastos comunes, reservas, comunicación. LATAM. Sin overlap PropOS.

### 3.5 TocToc (https://www.toctoc.com/)

**Líder en data+valoración inmobiliaria CL.** Tasador online residencial, reportes con valor comercial + arriendo, evolución 3 años, datos m², año construcción, contribuciones, avalúo fiscal. **APIs B2B robustas en tiempo real** ([Ayuda → APIs](https://www.toctoc.com/Ayuda/TocTocInmobiliarias)). Cobertura continental Chile en zonas con mercado activo. **Para PropOS: integración crítica como fuente de pricing benchmark, no competidor.**

### 3.6 Portal Inmobiliario (https://www.portalinmobiliario.com/)

Marca de MercadoLibre. **#1 portal de listados Chile.** Solo publicación, no due diligence.

### 3.7 Yapo (https://www.yapo.cl/bienes-raices)

148.650 avisos. Clasificados gratis. Salón Inmobiliario anual. Sin overlap.

### 3.8 DataBAM (https://databam.cl/)

Data inmobiliaria histórica: compraventas, herencias, adjudicaciones. Para tasadores y corredores. Sin overlap funcional con PropOS, posible fuente de cruzas.

### 3.9 “Deoz”

**No identificable como proptech.** Resultados de búsqueda apuntan a DeOZ Estudio de Diseño (Viña del Mar, agencia branding+web desde 2006) o a fanclub Mägo de Oz. Probable error de nombre en el brief original — sin producto proptech identificable.

### 3.10 Otros proptech relevantes (vía directorio Grupo Colibrí 90+)

Tipologías: agentes virtuales, marketplaces nicho (oficinas, retail), tasación, financiamiento online (CrediHipotecario, Toctoc Crédito), property management (ComunidadFeliz, Edipro), construcción tech (iConstruye, Construye2025).

---

## 4. Categoría: APIs y datos públicos (fuentes para PropOS)

Crítico: **ninguno expone API REST documentada para terceros** salvo BCN. Todo lo demás es scraping de UI autenticada con ClaveÚnica o RPA.

### 4.1 SII — bienes raíces y avalúo (https://www.sii.cl/servicios_online/1048-.html)

Certificado de avalúo fiscal por rol-subrol-comuna. “Mis bienes raíces” es vista integrada para propietarios autenticados. Detalle completo solo al propietario registrado. PDF descargable. Acceso público parcial a avalúo público. **Sin API pública oficial.** Endpoint scrapeable: https://zeus.sii.cl/avalu_cgi/br/brc110.sh.

### 4.2 TGR — contribuciones (https://www.tgr.cl/certificado-deuda-contribuciones/)

Certificado deuda + certificado pago de contribuciones, gratis, vía ClaveÚnica + RUT. Sin API formal. Cartola tributaria adicional ([cartola-deudas-tributarias](https://www.chileatiende.gob.cl/fichas/4396-cartola-de-deudas-tributarias-de-la-tgr)).

### 4.3 DOM en Línea (https://domenlinea.minvu.cl/)

Iniciativa MINVU desde 2016. **Cobertura municipal incompleta hacia 2026.** Permite certificados, permisos de obra, subdivisión, regularización. Las DOMs no adheridas (muchas regionales) usan Filedom (https://puentealto.filedom.cl/dom/) u otras tercerizaciones. **Para PropOS:** mapeo municipio-por-municipio + fallback presencial/email.

### 4.4 DGA — derechos de aprovechamiento de aguas (https://dga.mop.gob.cl/derechos-de-agua/)

Catastro Público de Aguas (CPA) + portal SNIA (https://snia.mop.gob.cl/portal-web/) con ClaveÚnica. Búsqueda por titular o ubicación. UI sin API técnica. **Crítico para due diligence rural** — derecho de agua se inscribe separado del dominio del predio.

### 4.5 Registro Civil (https://www.registrocivil.cl/)

Certificados nacimiento, matrimonio, defunción, antecedentes. Datos abiertos parciales (datos.gob.cl). **Sin API pública de personas formal.** Tercero comercial: **Floid** (https://www.floid.io/servicios/api-registro-civil) — API REST de pago, devuelve verificación + PDF certificado. Útil para PropOS integración pagada.

### 4.6 MOP IDE / GeoMOP (https://geomop.mop.gob.cl/)

SIG MOP con capas de infraestructura, aguas, riesgos. **WMS + WFS OGC** estándar — única fuente con servicios geo abiertos consumibles en QGIS / GeoPandas / ArcGIS sin scraping.

### 4.7 IDE Bienes Nacionales (https://ide.bienes.cl/)

Catastro fiscal de terrenos del Estado, concesiones, bienes nacionales. WMS/WFS. Útil para detectar invasión de fiscal.

### 4.8 CONADI (https://www.conadi.gob.cl/)

Registro Público de Tierras Indígenas. Certificado de calidad indígena. 10 pueblos reconocidos. Cubre 10 a 60 días. Sin API. **Crítico rural sur** — tierras indígenas tienen restricciones de transferencia (Ley 19.253).

### 4.9 CMN — Monumentos Nacionales (https://www.monumentos.gob.cl/geoportal)

Geoportal con monumentos históricos, zonas típicas, santuarios de la naturaleza, monumentos arqueológicos/paleontológicos/públicos. Ley 17.288. Restringe intervención de inmuebles afectos. WMS. **Flag duro para PropOS:** intervención requiere autorización CMN.

### 4.10 Subsecretaría FFAA — concesiones marítimas (https://portalconcesiones.ssffaa.cl/)

Tramitación 100% online desde nov-2020 con ClaveÚnica. Cubre borde costero. Sin búsqueda pública de roles, solo seguimiento del trámite propio. **Flag costero PropOS.**

### 4.11 Coordinador Eléctrico Nacional (https://www.coordinador.cl/)

Datos públicos de instalaciones, subestaciones, líneas de transmisión. Reportes y estadísticas. **Sin API pública de servidumbres eléctricas** — hay que solicitar SAIP (Solicitud de Acceso a Información Pública, Ley 20.285). Útil para detectar servidumbre eléctrica gravando rural.

### 4.12 BCN Ley Chile (https://www.bcn.cl/leychile/)

**El único caso real de API pública abierta.** 300.000+ normas. Web service Legislación Abierta (https://www.bcn.cl/leychile/consulta/legislacion_abierta_web_service). Linked Open Data W3C. Reconocido como referente mundial ([bcn.cl ejemplo-mundial](https://www.bcn.cl/noticias/bcn-es-mecionada-como-ejemplo-a-nivel-mundial-en-datos-abiertos-legislativos)). PropOS lo usa para citar normativa con vínculo verificable en cada flag de informe.

### 4.13 Poder Judicial (https://www2.pjud.cl/consulta-de-causas2)

Consulta unificada de causas. Oficina Judicial Virtual con ClaveÚnica. **Sin API pública para terceros.** Scraping frágil con anti-bot. PropOS necesita detectar litigios civiles sobre el inmueble target → punto de fragilidad operativa.

Listado de APIs públicas Chile mantenido en GitHub: https://github.com/juanbrujo/listado-apis-publicas-en-chile y https://github.com/GaedoC/AppisPublicas. Útil como inventario.

---

## 5. Modelos de negocio comparados

| Modelo | Ejemplos | Pricing | Margen | Escalabilidad |
|---|---|---|---|---|
| Estudio jurídico boutique manual | Schneider, Ayala, Wolfenson, Legal Prisma | $50K–$150K CLP/estudio urbano; rural variable | Alto por hora pero dependiente de horas-abogado | Lineal en headcount |
| Marketplace legaltech | Misabogados, Total Abogados | Plan mensual o servicio modular | Medio (toman fee + escalan abogados externos) | Cuasi-lineal |
| Legaltech IA horizontal SaaS | Lexius, Magnar, Spektr, Leyer | $9.5K–$60K CLP/mes individual; corporativos sobre demanda | Alto (SaaS LLM passthrough) | Software scaling |
| Legaltech enterprise gestión | LemonTech, ICONCRETA, Techlex | Contratos enterprise no públicos | Alto | Software scaling con CSM heavy |
| Proptech CRM | Dataprop, KiteProp | UF mensual por usuario | Alto | Software scaling |
| Proptech data | TocToc, DataBAM | Mix B2C freemium + API B2B usage-based | Alto | API metering |
| Notaría online + FEA | Firma Virtual, Firma.cl, Acepta | Por trámite | Medio (toman cut del notario) | Lineal a notarios partner |
| Infra pública | Conservadores Digitales, BCN | Arancel por certificado / gratis | n/a | Operación pública |

**Lectura PropOS:** el sweet spot es **SaaS vertical** combinando (a) scrapers/RPA de fuentes públicas como capa de datos, (b) LLM extraction para estructurar PDFs (escrituras, certificados), (c) reglas + UI para producir informe accionable. Pricing potencial: por estudio ($30K–$80K para underprice estudios manuales) o suscripción mensual a corredores/bancos. Ver `12-resumen-ejecutivo.md` y `11-ai-feasibility-y-arquitectura.md`.

---

## 6. Gap analysis: ¿hay vertical SaaS Chile end-to-end?

**Respuesta: NO.** Confirmado tras revisar 45+ actores. El espacio está **estructuralmente fragmentado**:

- Lado legal: estudios manuales o IA horizontal sin pipeline inmobiliario.
- Lado proptech: CRM/marketplace/data sin capa due diligence.
- Lado infra: APIs cerradas, scraping necesario, cobertura municipal irregular.
- Lado notarial: bloqueado por marco solemne (escritura pública).

El que arme el integrador completo gana el primer-mover en un mercado pequeño pero pegajoso. **Tamaño estimado:** ~250.000 transacciones inmobiliarias/año en Chile × $30K–$80K CLP por estudio digital = $7.5B–$20B CLP/año TAM teórico, con SAM realista 10–20% en años 1–3 (corredores tech-forward + bancos hipotecarios B2B + abogados que outsourcean al stack PropOS).

---

## 7. Riesgos competitivos

1. **Magnar entra al vertical inmobiliario.** Capital Carey + corpus chileno + 15K usuarios = si pivotean a real estate, son la amenaza más concreta a 18–24 meses. Mitigación: barreras operativas (scrapers + cobertura CBR/DOM mantenidos, partnerships con CBRs específicos, datasets propios anotados).
2. **Conservadores Digitales abre API pública a terceros.** Esto democratiza el acceso al insumo más caro de PropOS. Mitigación: el moat se desplaza río abajo (extracción IA + UI + flags + workflow), no en el acceso.
3. **TocToc o Dataprop integran capa legal.** TocToc tiene API + capital + datos; Dataprop tiene 500+ corredores activos. Si suman due diligence legal vía partnership (ej. con Magnar o Spektr), se quedan con el cliente final. Mitigación: ir al canal corredor antes que ellos, o ser el proveedor white-label de uno de ellos.
4. **Banco grande (BancoEstado, Santander, BCI) construye in-house.** Los bancos hipotecarios ya hacen estudio de títulos internamente. Si lo modernizan in-house, no son cliente. Mitigación: vender a corredores y compradores B2C, no depender de bancos.
5. **Cambio regulatorio: escritura pública desolemnizada o digital.** Si Chile aprobara compraventa inmueble con FEA (proyecto Notaría Digital en discusión legislativa), Firma Virtual + Firma.cl se vuelven canal dominante y absorben parte del workflow. Mitigación: alianza temprana con uno de ellos para integrar el flujo end-to-end.
6. **Spektr/Leyer/Lexius lanzan módulo inmobiliario.** Bajo costo marginal: ya tienen LLM, suscriptores, corpus jurisprudencial. Mitigación: ventaja vertical en datos (dataset anotado de escrituras + certificados + flags) y en pipeline de scrapers, que ellos no tienen.
7. **Litigios sobre uso de scrapers.** Conservadores Digitales o un CBR podría bloquear acceso programático invocando ToS o competencia desleal. Mitigación: convenios formales con CBR Santiago primero (cubre ~40% del volumen nacional), después regionales.
8. **Reputación de Wolfenson manchando legaltech.** Si el caso Ariel Wolfenson escala mediáticamente, contagio reputacional al segmento legaltech inmobiliario es posible. Mitigación: branding distinto, comms técnicas, no asociarse comercialmente con boutiques con riesgo reputacional.

---

## 8. Tabla de acciones inmediatas para PropOS

| Prioridad | Acción | Categoría | Razón |
|---|---|---|---|
| P0 | Scraper Conservadores Digitales (CBR Santiago primero) | Infra | Insumo crítico inmodelable sin esto |
| P0 | Scraper SII rol/avalúo + TGR contribuciones | Infra | Cruce mínimo viable |
| P0 | Pipeline OCR + LLM extraction de escrituras PDF | IA | Diferenciador core |
| P1 | Integración WMS/WFS MOP IDE + IDE Bienes Nacionales | Infra | Geo flags |
| P1 | Integración API BCN Ley Chile | Infra | Citas verificables |
| P1 | Mapeo municipio→DOM en Línea vs Filedom vs presencial | Infra | Cobertura urbana |
| P2 | Integración Floid API Registro Civil | Infra | Identidad partes |
| P2 | Convenio con TocToc para pricing benchmark | Partnership | Datos comerciales |
| P2 | Convenio con Dataprop o KiteProp como canal | Partnership | Distribución corredores |
| P3 | Scraper PJUD consulta unificada (con anti-bot mitigation) | Infra | Litigios pendientes |
| P3 | Scraper DGA + CONADI + CMN + SubsecFFAA + CEN | Infra | Rural + flags especiales |
| P3 | Monitoreo competitivo Magnar (radar mensual) | Intel | Detectar pivote vertical |

---

## Fuentes verificadas (consulta 2026-05-07)

Legaltech inmobiliario:
- https://www.misabogados.com/, https://www.misabogados.com/guia-compraventa-inmuebles, https://totalabogados.cl/nosotros, https://www.legalprisma.cl/estudio-de-titulos-chile/, https://www.wolfenson.cl/, https://en.wolfenson.cl/estudio-de-titulos, https://www.ayalaycia.cl/, https://www.ayalaycia.cl/estudio-de-titulos, https://schneiderabogados.cl/, https://schneiderabogados.cl/abogados/civil/estudio-de-titulos, https://www.vercettipropiedades.cl/estudio-titulos.html, https://www.abogaley.cl/estudio-de-titulos/, https://www.aguilaycia.cl/, https://firmavirtual.legal/, https://firma.cl/, https://acepta.com/, https://www.tufirma.digital/, https://muysimple.cl/, https://www.notariovirtual.cl/, https://www.theclinic.cl/2025/10/26/las-causas-que-complican-al-mejor-abogado-de-chile-las-nuevas-denuncias-contra-ariel-wolfenson-acusado-por-apropiacion-indebida-por-un-policia-checo-y-un-medico-frances/

Legaltech IA:
- https://www.spektr.legal/, https://www.emol.com/noticias/Economia/2024/02/07/1120968/legaltech-alianza-universidad-catolica-juridica.html, https://leyer.cl/ia-para-abogados-chile, https://lexius.io/cl/, https://lexius.io/cl-planes/, https://michatlegal.cl/, https://prime.tirant.com/cl/, https://contadores.tirant.com/2026/02/06/sofia-3-0/, https://www.lemontech.com/, https://www.lemontech.com/sobre-nosotros, https://techlex.cl/, https://www.magnar.ai/cl, https://www.df.cl/df-mas/punto-de-partida/carey-entra-al-mundo-startup-e-invierte-us-500-mil-en-legaltech-magnar, https://www.carey.cl/carey-invierte-en-la-legaltech-de-ia-magnar-para-potenciar-la-expansion-regional-de-la-startup, https://entorno.vc/magnar-ai-levanta-usd-300k-con-apoyo-de-buenaonda-y-platanus-ventures/, https://www.ijuridica.cl/botilex-2-0-ia-juridica-premium/

Proptech:
- https://dataprop.cl/, https://dataprop.cl/planes-dataprop/, https://www.kiteprop.com/cl, https://www.kiteprop.com/cl/planes, https://mcp.kiteprop.com/, https://iconcreta.com/, https://www.toctoc.com/, https://www.toctoc.com/Ayuda/TocTocInmobiliarias, https://www.portalinmobiliario.com/, https://www.yapo.cl/bienes-raices, https://databam.cl/, https://www.comunidadfeliz.com/, http://proptechchile.cl/, https://www.grupocolibri.cl/proptech

Infra pública:
- https://conservadoresdigitales.cl/, https://www.gerencia.cl/transformacion-digital/la-transformacion-digital-del-conservador-de-bienes-raices-de-santiago/, https://www.df.cl/brandcorner/red-hat/el-camino-del-conservador-de-bienes-raices-de-santiago-hacia-la, https://www.sii.cl/servicios_online/1048-.html, https://zeus.sii.cl/avalu_cgi/br/brc110.sh, https://www.tgr.cl/certificado-deuda-contribuciones/, https://domenlinea.minvu.cl/, https://puentealto.filedom.cl/dom/, https://dga.mop.gob.cl/derechos-de-agua/, https://snia.mop.gob.cl/portal-web/, https://www.registrocivil.cl/, https://www.floid.io/servicios/api-registro-civil, https://geomop.mop.gob.cl/, https://ide.bienes.cl/, https://www.conadi.gob.cl/, https://www.monumentos.gob.cl/geoportal, https://portalconcesiones.ssffaa.cl/, https://www.coordinador.cl/, https://www.bcn.cl/leychile/, https://www.bcn.cl/leychile/consulta/legislacion_abierta_web_service, https://www2.pjud.cl/consulta-de-causas2, https://github.com/juanbrujo/listado-apis-publicas-en-chile

---

*Documento generado en sesión de research PropOS, 2026-05-07. Cualquier afirmación crítica debe re-verificarse contra la URL primaria antes de decisiones go/no-go de producto.*
