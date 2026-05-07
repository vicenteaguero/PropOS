# 13 — Profundización regional: O'Higgins + Maule (zona beta safeguard PropOS)

> **Audiencia**: ingeniero PropOS implementando safeguard pre-listing. **Fecha de corte**: 2026-05-07.
> **Foco**: por qué O'Higgins/Maule es **mejor zona beta** que Santiago, qué riesgos específicos viven aquí y no en RM, qué CBR/DOM/datos se pueden automatizar y cuáles no.
> **Glosario** ver archivo 12. Adicional: **DO** = Denominación de Origen (vino). **JV** = Junta de Vigilancia (río). **AC** = Asociación de Canalistas. **CPA** = Catastro Público de Aguas. **IFC** = Informe Factibilidad Construcciones rurales (SAG previo a permiso DOM art 55 LGUC).

---

## 1. Por qué O'Higgins + Maule (no RM) para beta

Tres razones duras:

1. **Concentración de los flags más jugosos del país en suelo rural y costa**. Parcelas DL 3.516, viñedos con DO, derechos de agua sobre cuencas estresadas, loteos brujos pre-Ley 20.234, casas de playa sobre 80m fiscal DL 1939. Santiago tiene mayoría predios urbanos saneados; aquí el broker pierde comisión semanalmente por flags no detectados.
2. **Volumen suficiente sin la sobreoferta de RM**. Maule lidera Chile en superficie vitivinícola: **52.822 ha (40,61%)** del Catastro Vitícola Nacional 2021; O'Higgins **41.539 ha (31,93%)** ([SAG Catastro 2021](https://www.sag.gob.cl/noticias/sag-presenta-catastro-viticola-nacional-2021)). Conjunto = **72,5% superficie vitícola Chile** en dos regiones contiguas. Más Pichilemu/Cahuil/Vichuquén como mercados de segunda vivienda activos.
3. **CBRs digitalizados parcialmente**. Rancagua + Talca + Curicó + San Fernando + Cauquenes + Linares + Constitución todos con sitio web y `conservadoresdigitales.cl` o portal propio. No hay que viajar para 80% certificados. RM tiene mejor cobertura pero competencia notarial ya los persigue. Aquí aún no.

---

## 2. CBRs de la zona — ficha por oficina

> **Patrón común**: jurisdicción no se mapea 1:1 a comuna. Un CBR cubre paquete de comunas heredado de departamentos pre-1976. Cuando broker dice "predio en Doñihue" hay que enviar al CBR Rancagua (no existe CBR Doñihue). Tabla obligatoria en backend `cbr_jurisdictions`.

### 2.1 CBR Rancagua

- **Jurisdicción**: Rancagua, Codegua, Graneros, Machalí, Mostazal, Olivar ([cbrrancagua.cl vía conservadorchile](https://conservadorchile.com/rancagua/), [resumen jurisdicción](https://conservadorchile.com/rancagua/)). **Ojo**: Doñihue, Coltauco y Coinco aparecen mencionados como **clientes** del CBR Rancagua para reinscripciones gratuitas pero los protocolos primarios pueden estar en otro CBR (verificar caso a caso). 
- **Web**: `cbrrancagua.cl` + portal `conservador.cl/portal` (CBRS Santiago compartido).
- **Trámites en línea**: copias y certificados Reg. Propiedad / Hipotecas / Prohibiciones; constitución y modificación sociedades (Reg. Comercio); copias de derechos de agua (Reg. Aguas) ([trámites CBRS](https://conservador.cl/portal/tramites)).
- **Captcha / anti-scraping**: el sitio `cbrrancagua.cl` está detrás de **Cloudflare verification** (timeout en WebFetch directo). Implica scraping vía RPA con headless browser + cookies, no `requests`. Endpoint API público inexistente.
- **Costo certificado dominio vigente**: ~$4.600–$13.500 CLP rango nacional (archivo 01 §2.3). Sitios de terceros no publican arancel oficial Rancagua; pedirlo por email `info@cbrrancagua.cl` o desde portal ya logueado.
- **Dirección física fallback**: Gamero 446, Rancagua, L-V 8:30–14:00 / 15:00–16:30. Tel +56 72 235 5800.

### 2.2 CBR San Fernando

- **Jurisdicción**: cubre provincia Colchagua norte. Dirección Curali, Colchagua 930, San Fernando. Tel +56 72 297 5720 ([CBR San Fernando](https://conservadorchile.com/san-fernando/), [ficha conservadores digitales](https://conservadoresdigitales.cl/conservador/san-fdo)).
- **Web**: `cbrsanfernando.cl` + integración `conservadoresdigitales.cl` (red privada notarial — distinta de la red CBRS portal `conservador.cl`).
- **Trámites en línea**: dominio vigente, hipotecas/gravámenes/prohibiciones, certificados de aguas y minas. Misma red `conservadoresdigitales.cl` usada por Curicó, Cauquenes y otros — formato uniforme.
- **Horario L-V 9:00–14:00**.

### 2.3 CBR Pichilemu

- **Jurisdicción**: Pichilemu (también típicamente Paredones/Marchigüe — verificar). Sitio `conservadorpichilemu.cl`. Conservador Isabel Margarita Chadwick Vergara. Tel 72 284 3066. Email `info@conservadorpichilemu.cl` ([listing inforedchile](https://inforedchile.cl/publico/pichilemu/conservador-de-bienes-raices/conservador-de-bienes-raices-de-pichilemu/6978)).
- **Riesgo CBR-específico**: **Pichilemu inscribió cesiones de derechos como bienes raíces sin haberse aprobado planimetría municipal** durante años, alimentando los loteos brujos descritos en §6 ([diagnóstico PRC Pichilemu Oct-2024](https://pichilemu.cl/wp-content/uploads/2024/10/Informativo_OrdN1810_DiagnosticoPRC-Octubre2024_compressed.pdf)). El propio CBR es co-responsable histórico. Implica: **inscripción CBR vigente NO garantiza loteo legal** en Pichilemu/Cahuil. Cross-check obligatorio con DOM Pichilemu y SAG.

### 2.4 CBR Talca

- **Jurisdicción**: Talca, Maule, Pelarco, Pencahue, Río Claro, San Clemente, San Rafael ([conservadortalca.cl](https://www.conservadortalca.cl/), [tramitescbr Talca](https://tramitescbr.com/conservador-de-bienes-raices-talca/)). **Pero** existe además **CBR San Clemente independiente** (`cbrsanclemente.cl`) — solapamiento histórico, verificar protocolo concreto antes de pedir el certificado.
- **Conservadora**: Camila Jorquiera Monardez (desde 12-abr-2021).
- **Web**: `conservadortalca.cl`, también con Cloudflare wait-room (timeout WebFetch).
- **Dirección**: Calle 1 Norte 911, Talca, L-V 8:00–15:00. Tel 71-2717011.
- **Trámites en línea**: dominio vigente, hipotecas/gravámenes, búsqueda por dirección o nombre dueño, inscripciones títulos posesorios. Plataforma compartida con red CBRS.

### 2.5 CBR Curicó

- **Jurisdicción judicial paralela**: Curicó, Teno, Romeral, Rauco; **Licantén** cubre Licantén + Hualañé + Vichuquén ([COT art 34](https://leyes-cl.com/codigo_organico_de_tribunales/34.htm)). El CBR sigue grosso modo esa partición → predios en Vichuquén (lago y entorno) probablemente protocolizados en **CBR Licantén**, no Curicó. Confirmar oficio.
- **Web**: `conservadorcurico.cl` + ficha en `conservadoresdigitales.cl`. Edificio Manuel Montt 357, 3er piso. Tel +56 75 231 0142.
- **Notas**: el sitio sufre timeouts en WebFetch (red `conservadoresdigitales.cl` lenta o anti-bot). Plan B = email institucional + portal de descargas de archivos.

### 2.6 CBR Linares

- **Jurisdicción**: Linares, Colbún, Yerbas Buenas (otros predios de la provincia van a CBRs separados Parral, San Javier, Longaví fragmentados — la provincia tiene **6+ CBRs** distintos, no uno).
- **Web**: `cbr-linares.cl`. Horario solicitudes L-V 8:00–14:00; retiro y consulta hasta 15:00.
- **CBR San Javier independiente** (`cbrsanjavier.cl`) — provincia Linares no centraliza.

### 2.7 CBR Constitución

- **Jurisdicción**: Constitución + Empedrado ([conservadorconstitucion.cl](http://www.conservadorconstitucion.cl/)).
- **Web**: `conservadorconstitucion.cl` (HTTP, no HTTPS — flag de seguridad menor; **certificate expirado** observado al WebFetch). Base de datos "actualizada en tiempo real" con índices últimos 42 años (declarado por el sitio).
- **Riesgo zona**: **27/F 2010 destruyó casco histórico Constitución**. Reconstrucción generó pueblos solidarios (27 de Febrero, Antofa, Caleta Pellines, La Poza, Puertas Verdes) con saneamientos de título acelerados ([CIGIDEN](https://www.cigiden.cl/desdeelcielo/constitucion.html), [SciELO Reconstrucción](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-83582015000100003)). Cualquier predio inscrito 2010–2014 en Constitución debe revisarse para regularización vía DL 2.695 o subsidio reconstrucción — riesgo de cadena con título posesorio sin saneamiento completo.

### 2.8 CBR Cauquenes

- **Jurisdicción**: solo comuna Cauquenes ([conservadorbienesraicescauquenes.cl](https://www.conservadorbienesraicescauquenes.cl/), [resumen](https://conservadorchile.com/cauquenes/)). Dirección Catedral 189, L-V 8:30–16:00. Tel +56 73 2512873.
- **Comunas vecinas Pelluhue + Chanco** caen en **CBR Chanco-Pelluhue** (Notario y Conservador Nicolas Constenla Novoa, Ramón Freire 131 Chanco, [notariachanco.cl](http://www.notariachanco.cl/quienes.php), [conservadorchanco.cl](https://www.conservadorchanco.cl/)) — no Cauquenes. Es figura **mixta notario+conservador+archivero judicial**, frecuente en comunas chicas (genera ambigüedades de retención: el mismo funcionario otorga la escritura y la inscribe).
- **Trámites en línea**: red CBRS portal `conservador.cl/portal`. Búsqueda por dirección/dueño, certificados copia, propiedades + comercio + aguas + minas.

### 2.9 CBR Parral

- **Jurisdicción**: Parral + Retiro ([resumen](https://conservadorchile.com/parral/)). Conservador Jorge Enrique Figueroa Herrera, Anibal Pinto 575, 2º piso. Email `info@cbrparral.cl`.
- **DOM Digital habilitado** en municipalidad Parral ([domdigital.cl noticias](https://www.domdigital.cl/noticias)) — uno de los pocos municipios chicos del Maule con DOM Digital ya en producción.

### 2.10 Tabla resumen scraping target

| CBR | Web propia | Red | Cloudflare/anti-bot | Costo cert. publicado | Plan PropOS |
|---|---|---|---|---|---|
| Rancagua | `cbrrancagua.cl` | CBRS portal | sí (wait-room) | no | RPA headless |
| San Fernando | `cbrsanfernando.cl` | conservadoresdigitales | mixto | no | RPA headless |
| Pichilemu | `conservadorpichilemu.cl` | propio | n/v | no | email + RPA |
| Talca | `conservadortalca.cl` | CBRS portal | sí | no | RPA headless |
| Curicó | `conservadorcurico.cl` | conservadoresdigitales | timeout | no | RPA headless + email |
| Linares | `cbr-linares.cl` | propio | n/v | no | RPA headless |
| Constitución | `conservadorconstitucion.cl` | propio (HTTP) | cert expirado | no | RPA headless, riesgo MITM |
| Cauquenes | `cbrcauquenes.cl` | CBRS portal | bajo | no | RPA headless |
| Parral | `cbrparral.cl` | propio | n/v | no | email + RPA |

> **Implicación PropOS**: la heterogeneidad obliga a **adaptador por CBR** (no un cliente HTTP único). Reutilizar adaptador "CBRS portal" para Rancagua/Talca/Cauquenes (3 oficinas con misma plataforma `conservador.cl/portal`) es la inversión #1.

---

## 3. DOMs en la zona — alcance digital

- **DOM en Línea (MINVU)** plataforma nacional `domenlinea.minvu.cl`, +80 trámites disponibles según comuna ([detalle MINVU](https://domenlinea.minvu.cl/AcercaDe/Detalle/7/)). Cobertura nacional ~22 comunas declaradas en cuenta pública 2024.
- **DOM Digital (`domdigital.cl`)** plataforma privada competidora — **Parral** y **Molina** confirmados habilitados (Maule). No O'Higgins en lista pública.
- **Smart DOM (`smartdom.cl`)** — **Rancagua** (`rancagua.smartdom.cl`) y **Maule comuna** (`maule.smartdom.cl`) usan esta variante. Tres plataformas paralelas → tres adaptadores distintos.
- **Talca** opera vía `filedom.cl` (subdominio `talca.filedom.cl/solicitud_certificados_mala/previos/`) — cuarta plataforma. Pago consultable en `filedom.cl/talca/solicitud_certificados_mala/consultapagos.php`.

**CIP Certificado Informaciones Previas**: costo varía por municipio (rango habitual $5.000–$25.000 CLP, no publicado uniformemente; verificar en cada plataforma con consulta no autenticada). Plazo legal 15 días hábiles (DOM debe responder por OAR sin pago si excede). Dato crítico para safeguard: **el CIP es la única fuente que cruza `(rol SII, uso suelo PRC, restricciones, DUP, afectación utilidad pública)` — gratis para hipoteca pero pagado si se pide externamente**. PropOS debería pedirlo para todo listing pre-publicación: $5K–$25K es nada vs costo de detectar afectación DUP post-promesa.

> **DOMs sin plataforma digital** en la zona: muchas comunas chicas (Empedrado, Curepto, Vichuquén, Pumanque, Pichidegua, Marchigüe, Litueche, Paredones, etc.) → trámite presencial o email institucional. Para estos PropOS necesita SLA con runner físico o email worker, no scraper.

---

## 4. Industria vitivinícola — DO, INAPI, SAG, art 55 LGUC

### 4.1 Denominaciones de Origen vigentes en la zona

Régimen base: **Decreto 464 / 1995** (Ministerio Agricultura) zonificación vitícola ([texto SAG](https://www.sag.gob.cl/sites/default/files/decreto_ndeg_464.pdf), [texto Alessandri](https://www.alessandri.legal/wp-content/uploads/sites/4/2013/09/DECRETO_464.pdf)). Establece DO sobre regiones / sub-regiones / zonas / áreas. En la franja PropOS:

- **Región vitícola Valle Central** → sub-región **Valle del Rapel** → zonas **Cachapoal** (incl. áreas Rancagua, Requínoa, Rengo, Peumo) y **Colchagua** (Santa Cruz, Chimbarongo, Nancagua, Palmilla, Peralillo, Marchigüe). O'Higgins entera.
- Sub-región **Valle de Curicó** → zonas Teno, Lontué; áreas Rauco, Romeral, Sagrada Familia, Molina.
- Sub-región **Valle del Maule** → zonas Río Claro (Talca, San Rafael), San Clemente, Loncomilla (San Javier, Linares, Longaví, Parral), Tutuvén (Cauquenes).
- Sello de Origen INAPI: solo sobre productos previamente reconocidos por INAPI como IG/DO/marca colectiva/de certificación ([INAPI Sello Origen](https://www.inapi.cl/sello-de-origen/para-informarse)). Distinto de la zonificación vitícola del decreto 464; el productor debe registrar sello en INAPI explícitamente.
- Regla 75%: para etiquetar con DO al menos 75% del vino debe provenir de uvas de la zona indicada (Decreto 464).

> **Implicación safeguard**: viñedo en venta dentro de zona DO **es activo más valioso que su tierra desnuda** — la DO se transfiere con el predio (no es derecho personal), pero el comprador debe verificar que el productor previo haya cumplido declaración SAG anual (§4.2) y que la planta corresponda a variedad declarada. PropOS debe pedir Catastro Vitícola del SAG por rol del predio.

### 4.2 SAG — registro plantaciones y catastro vitícola

- **Obligación legal**: dueños o tenedores de viñedo ≥5.000 m² deben **declarar al SAG anualmente al 31-dic** variedades, superficies, plantaciones nuevas ([SAG Catastro Vitícola](https://www.sag.gob.cl/ambitos-de-accion/catastro-viticola-nacional)).
- **Catastro Vitícola Nacional** publicado anualmente (último consultado 2021/2022). Maule 40,61% / O'Higgins 31,93% del país.
- Fuente catastrable por PropOS: SAG entrega datos agregados públicos pero no individuales por rol. Para verificar plantación específica → certificado SAG por solicitud del dueño (firma del dueño requerida = no scrapeable).

### 4.3 Construcción bodegas y enoturismo en suelo rural — art 55 LGUC + IFC SAG

Regla base: **fuera del límite urbano del PRC, está prohibido construir excepto destinos agrícolas** (art 55 LGUC, [texto](https://leyes-cl.com/aprueba_nueva_ley_general_de_urbanismo_y_construcciones/55.htm)). Excepciones:

- Construcción de **infraestructura agrícola** (bodega de vinificación, guarda, lagares, oficinas viñedo) → permitida sin trámite art 55 inc. 4 si destino agrícola.
- Construcción de **vivienda del dueño / trabajadores** del predio → permitida.
- Construcción de **hotel / restaurante / sala de cata enoturística** → activa art 55 LGUC: requiere **IFC del SAG** (Informe Factibilidad Construcciones ajenas a la agricultura, [SAG IFC](https://www.sag.gob.cl/ambitos-de-accion/informe-de-factibilidad-para-construcciones-ajenas-la-agricultura-en-area-rural-ifc)) + informe favorable SEREMI Vivienda + permiso DOM.
- Cualquier subdivisión/urbanización rural complementaria → autorización SEREMI Agricultura previo informe favorable SEREMI Vivienda (art 55 inc 3 LGUC).

> **Flag PropOS**: viña en venta con bodega + casona + restaurante **debe mostrar IFC SAG histórico + recepción DOM municipal** para esa edificación enoturística. Sin IFC o con bodega ampliada post-permiso = construcción clandestina rural, sancionable + difícil de regularizar. Cruzar con SII detallado m². Casos típicos en Santa Cruz, Apalta, Marchigüe, Lolol.

### 4.4 Mercado y precios señalados

- Santa Cruz / Colchagua mercado activo enoturismo. Tour Viña Santa Cruz $54.000–$210.000 CLP por persona ([Cava Colchagua tours](https://www.cavacolchagua.cl/en/tours/)) — referencia de qué tan monetizado está el destino. Casonas restauradas tipo Viña Maquis, Viña Neyen, Hotel Santa Cruz Plaza.
- Brokers especializados: **VC Propiedades** (Valle Colchagua, vrpropiedades@gmail.com, +56 9 7596151), **Propiedades Colchagua** (`propiedadescolchagua.cl`), **A&C Propiedades**, **Doble A Inmobiliaria** (Av. Comercio 2851 Pichilemu) — **target de adopción PropOS** = corredores con 50–500 listings/año en suelo rural mixto (parcelas + viñedos + segunda vivienda costa).

---

## 5. Parcelas DL 3.516 — concentración y loteos brujos

### 5.1 Marco DL 3.516

- DL 3.516 / 1980 ([texto SAG PDF](https://www.sag.gob.cl/sites/default/files/D_3516_SUBDIV_PREDIAL.pdf)) permite subdivisión predial rural a **mínimo 0,5 ha (5.000 m²)** sin cambio de destino agrícola, ganadero o forestal.
- **Certificación SAG obligatoria** (30–90 días hábiles según oficina regional) antes de inscribir en CBR ([SAG Subdivisión Predial](https://www.sag.gob.cl/ambitos-de-accion/subdivision-predial)). Sin SAG ⇒ CBR no inscribe; sin embargo cesiones de derechos sí se inscribieron históricamente (gap explotado por loteos brujos).
- Predio subdividido sigue afecto a **prohibición de cambio de destino** art 55 + 56 LGUC: **no es predio urbano, no se puede construir vivienda residencial estilo barrio, no existe pavimentación pública, no hay alcantarillado público, no hay rol urbano SII**. Casos típicos de venta engañosa: "parcela de agrado" vendida como solución habitacional por desarrollador.

### 5.2 Caída solicitudes 2022–2025

22.378 → 8.650 = **−61%** (archivo 12 §1) — endurecimiento SAG + presión Corte Suprema (febrero 2026: descarta ilegalidad y arbitrariedad cuando subdivisión SAG ajusta DL 3.516 estrictamente, [Diario Constitucional](https://www.diarioconstitucional.cl/2026/02/20/corte-suprema-descarta-ilegalidad-y-arbitrariedad-en-autorizacion-de-subdivision-rural-del-sag-por-ajustarse-al-dl-3-516/)).

### 5.3 Zonas calientes en O'Higgins / Maule

| Zona | Patrón | Riesgo |
|---|---|---|
| Pichilemu / Cahuil / Punta de Lobos | parcelas costeras y precordillera, segunda vivienda surf + arriendo Airbnb | **loteos brujos masivos**, cesiones de derechos inscritas en CBR sin planimetría municipal aprobada ([diagnóstico PRC 2024](https://pichilemu.cl/wp-content/uploads/2024/10/Informativo_OrdN1810_DiagnosticoPRC-Octubre2024_compressed.pdf)) |
| Litueche / Navidad / Marchigüe | parcelas de agrado interior O'Higgins | mismo patrón, menor escala |
| Vichuquén lago | parcelas borde lago, segunda vivienda alta gama | **concesiones marítimas/lacustres irregulares** denunciadas por Senadora Vodanovic ([Séptima Página 2025](https://www.septimapaginanoticias.cl/senadora-vodanovic-pidio-al-municipio-aclarar-posibles-concesiones-irregulares-en-lago-vichuquen)); proyecto "Altos de Culenmapu" pedido a SEIA por Unión Comunal por colapso ambiental ([El Mostrador](https://www.elmostrador.cl/unidad-de-investigacion/2025/05/22/de-joya-turistica-a-pantano-estancado-la-crisis-del-lago-vichuquen/)); fallo judicial cambió aguas, eutrofización ([El Líbero](https://ellibero.cl/actualidad/el-fallo-judicial-que-cambio-las-aguas-del-vichuquen-temen-por-el-desarrollo-del-turismo-ante-surgimiento-de-algas-espuma-y-malos-olores/)) |
| Precordillera Maule (San Clemente, Colbún, Linares) | parcelas vista cordillera, condominio cerrado | menor riesgo loteo brujo, mayor riesgo derechos de agua sin caudal |
| Machalí precordillera (Coya, Chacayes, El Llano) | condominios cerrados 5.000 m² con APR + electricidad subterránea | **dentro de DL 3.516 pero formalizados**; precios 1,5 UF/m² ([referencia mercado](https://casas.mitula.cl/casas/parcelas-machali)); riesgo medio si vendedor declara servicios que no están conectados |

### 5.4 Loteos brujos — caso Pichilemu específico

Diagnóstico PRC Pichilemu Oct-2024 reconoce explícitamente:

> "Un gran número de loteos irregulares se desarrolló, acompañados por prácticas problemáticas en notarías y registros, detonando un desarrollo inmobiliario creciente pero precario."

Calles y pasajes resultantes **no cumplen anchos mínimos LGUC** → afectan determinación de utilidad pública futura. PRC vigente desde 2005 declarado obsoleto; modificaciones 01-2024 y 02-2024 v.2025 en aprobación. **Plazo de postergación de permisos** vigente publicado en DO ([Postergación Permisos Pichilemu CVE 2702679](https://pichilemu.cl/wp-content/uploads/2025/10/DO-CVE-270679-POSTERGACION-DE-PERMISOS-PICHILEMU.pdf)) — flag duro: durante postergación DOM Pichilemu **no otorga permisos nuevos en ciertas zonas**. PropOS debe consultar postergaciones vigentes por comuna antes de listar.

> **Implicación safeguard**: para Pichilemu un certificado de dominio vigente CBR aprobado **NO basta**. Mínimo: (a) CIP DOM Pichilemu por rol, (b) consulta SAG si aplica DL 3.516, (c) verificación postergación permisos PRC vigente, (d) si hay edificación, recepción definitiva DOM. Caso sin estos checks = riesgo demolición probable.

---

## 6. Derechos de agua — cuencas, JV/AC, caducidad, Conservador de Aguas

### 6.1 Cuencas relevantes

- **O'Higgins**: cuenca Rapel = ríos **Cachapoal** + **Tinguiririca** confluyendo en embalse Rapel.
- **Maule**: cuenca **Mataquito** (norte Maule, ríos Teno + Lontué); cuenca **Maule** (centro, ríos Maule + Claro + Loncomilla); cuenca **Itata-Cauquenes** (sur).

### 6.2 Junta Vigilancia / Asociación Canalistas

- **JV Río Cachapoal 1ra Sección** (creada 4-nov-1964 por escritura ante notario Rancagua): 10 AC con 24 canales principales ([JV Cachapoal 1ra](https://www.federacionjuntas.cl/junta/rio-cachapoal-1ra-seccion)).
- **JV Río Cachapoal 2da Sección**: 24 organizaciones, 25 canales, 3.000 regantes ([JV Cachapoal 2da](https://www.federacionjuntas.cl/junta/rio-cachapoal-2da-seccion)).
- **JV Río Cachapoal 3ra Sección** ([federacionjuntas.cl](https://federacionjuntas.cl/junta/rio-cachapoal-3ra-seccion)).
- **JV Río Tinguiririca 1ra Sección** (escritura 29-jul-1955 notaría San Fernando, decreto supremo 1986 / 2-oct-1956, [JV Tinguiririca](https://www.tinguiririca.com/)).
- Federadas en **Federación de Juntas de Vigilancia de la Sexta Región** (corporación derecho privado, octubre 2005, [federacionjuntas.cl](https://federacionjuntas.cl/)).

> **Implicación**: para predio con derecho de agua superficial sobre Cachapoal/Tinguiririca verificar (a) inscripción en CBR Reg. Aguas, (b) inscripción como miembro de la JV correspondiente, (c) cuota canal de la AC. Discrepancia entre lo inscrito en CBR y lo registrado en JV es flag clásico — la JV cobra y entrega caudal sobre la base de su libro propio, no del CBR.

### 6.3 Caducidad 6-abr-2025 → prorrogada a 6-abr-2027

- Reforma Código de Aguas (Ley 21.435 / 2022) introdujo caducidad de derechos de aprovechamiento de aguas (DAA) constituidos por autoridad y **no inscritos en CBR Reg. Aguas al 6-abr-2025** ([Fontaine & Cía abr 2025](https://fontaineycia.cl/6-de-abril-2025-vence-plazo-para-inscripcion-de-derechos-de-aprovechamiento-de-aguas/)).
- **Ley 21.727 / 18-feb-2025** prorrogó plazo a **6-abr-2027** ([DGA prórroga 2 años](https://dga.mop.gob.cl/amplian-en-2-anos-el-plazo-para-inscribir-derechos-de-aprovechamiento-de-aguas/)).
- Pequeños productores agrícolas con regularización iniciada: plazo extendido también a 2027.

> **Flag PropOS automático**: si el predio dice tener DAA pero la inscripción CBR Reg. Aguas no aparece → al **6-abr-2027** se extingue. Detectable scrapeando CBR Reg. Aguas por nombre titular o predio. Es de los flags más rentables: el broker no sabe esto, el comprador sí pregunta.

### 6.4 Áreas de restricción / zonas de prohibición DGA

- **O'Higgins**: 25 zonas prohibición + 31 áreas restricción ([Agroinchile resumen](https://www.agroinchile.cl/post/25-zonas-cr%C3%ADticas-declaradas-por-la-dga-prohibici%C3%B3n-de-nuevas-explotaciones-de-aguas-subterr%C3%A1neas)). Sectores nombrados: Río Clarillo Alto, Río Claro de Tinguiririca, Río del Portillo, Río de las Damas, Río del Azufre, Estero Antivero, Río San José, Río Tinguiririca Alto en Colchagua y Cachapoal ([DGA áreas restricción](https://dga.mop.gob.cl/derechos-de-agua/proteccion-de-las-fuentes/areas-de-restriccion/)).
- **Maule**: Esteros Belco y El Arenal (Cauquenes) declarados zona de prohibición ([DGA](https://dga.mop.gob.cl/derechos-de-agua/proteccion-de-las-fuentes/zonas-de-prohibicion/)).
- **Resolución DGA 48 / 30-jul-2025** declaró zona prohibición Río Rapel antes del Estero Rosario (RM y O'Higgins).
- **Tinguiririca inferior** (sector hidrogeológico común): plazo enero 2025 venció para inscripción de obras de titulares.

> **Implicación**: pozos profundos en parcelas zona declarada = **no se otorgan derechos nuevos**. Solo provisional o nada. Predio publicitado como "parcela con pozo + DAA" puede ser pozo sin derecho subterráneo. Flag duro.

### 6.5 Conservador de Aguas vs Conservador de Bienes Raíces

- En Chile (con excepción de Santiago donde existe el **Conservador de Minas y de Aguas** separado del CBR), los **CBR de provincia llevan el Reg. Aguas dentro de su oficio** ([CBRS Reg. Aguas](https://conservador.cl/portal/copia_otros)).
- En Rancagua, Talca, Curicó, San Fernando, Linares etc. = mismo CBR lleva Reg. Propiedad + Reg. Hipotecas + Reg. Comercio + **Reg. Aguas** + Reg. Minas + Reg. Comercio.
- Implica: certificado de dominio vigente sobre un predio **no incluye automáticamente** la inscripción del DAA. Hay que pedir certificado **separado** del Reg. Aguas. Doble llamada al mismo CBR.

---

## 7. Tipos de propiedad típicos zona y flags asociados

| Tipo | Comuna ejemplo | Flags zona-específicos PropOS |
|---|---|---|
| Casa urbana clase media | Rancagua, Talca, Curicó | precios 2.150–22.000 UF, m² ~40 UF (Rancagua 2022 [Diario El Pulso](https://www.diarioelpulso.cl/2023/02/01/departamentos-en-rancagua-suben-su-precio-en-un-13-durante-2022/)); flags estándar (recepción DOM, hipoteca) |
| Parcela precordillera condominio | Machalí (Coya, Chacayes), San Clemente | DL 3.516 + APR colectivo + condominio Ley 19.537; verificar reglamento + cuotas + servidumbres acceso |
| Viñedo + bodega + casona | Santa Cruz, Apalta, Colchagua, Curicó | DO Decreto 464; SAG Catastro Vitícola anual; IFC SAG si hay enoturismo; DAA superficial JV |
| Casa de playa | Pichilemu, Cahuil, Constitución, Curanipe, Pelluhue | **80 m fiscal DL 1939** medidos desde línea más alta marea = bien nacional uso público administrado por Subsecretaría FFAA; cualquier construcción dentro requiere concesión marítima ([Subsecretaría FFAA](https://www.ssffaa.cl/index.php/concesiones-maritimas/)); además PRC + postergación permisos (Pichilemu) |
| Predio agrícola tradicional | Maule (San Javier, Linares, Parral), O'Higgins (Rengo, Peumo) | DAA superficial + AC; servidumbres canal; Catastro Vitícola si tiene parras |
| Sitio industrial / agroindustria | Rancagua, Talca, San Fernando (zona logística Ruta 5) | uso suelo PRC industrial; RCA si proceso productivo; relación dependiente con DGA por descargas |
| Casa segunda vivienda lago | Vichuquén | concesión municipal ribera lago + irregularidades documentadas + crisis ambiental |
| Predio costero rural | Pelluhue, Chanco, Curepto, Paredones | DL 3.516 + 80m fiscal + fragilidad PRI inter-comunal Pichilemu-Navidad-Paredones-Litueche |

---

## 8. Casos públicos litigios / fiscalización

- **Pichilemu loteos brujos** documentados en diagnóstico PRC Oct-2024 ([PDF](https://pichilemu.cl/wp-content/uploads/2024/10/Informativo_OrdN1810_DiagnosticoPRC-Octubre2024_compressed.pdf)) — práctica notarial-registral cuestionada.
- **Lago Vichuquén** — Senadora Vodanovic pidió aclarar concesiones irregulares ([Séptima Página](https://www.septimapaginanoticias.cl/senadora-vodanovic-pidio-al-municipio-aclarar-posibles-concesiones-irregulares-en-lago-vichuquen)); fallo judicial cambió manejo aguas; eutrofización 2024–2025.
- **Caso "loteos brujos" Punta Arenas** — Fiscalía solicitó formalización abogado Marcos Ibacache Cortés y otros 4 (apropiación indebida + estafa + infracción LGUC, [La Prensa Austral abr 2026](https://laprensaaustral.cl/2026/04/30/caso-loteos-brujos-fiscalia-pidio-formalizar-al-abogado-ibacache-cortes-por-nueva-presunta-defraudacion/)) — caso de referencia nacional para tipificación penal.
- **Convenio SAG-SERVIU Ñuble** firmado para fortalecer fiscalización loteos rurales ([SAG noticia](https://www.sag.gob.cl/noticias/sag-y-serviu-firman-convenio-para-fortalecer-fiscalizacion-de-loteos-en-zonas-rurales-de-nuble)) — modelo replicable Maule + O'Higgins, indica dirección política pro-fiscalización.
- **Reconstrucción Constitución 27/F**: villas solidarias 2010 con saneamientos urgentes; revisar predio si fojas inscritas 2010–2014 ([SciELO](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-83582015000100003)).

---

## 9. SEREMIs y autoridades regionales

- **SEREMI Agricultura Maule**: Claudia Ramos Muñoz **renunció 12-sep-2025**; subroga **Juan Pablo López Aguilera** (director regional SAG Maule, [Diario El Centro sep 2025](https://www.diarioelcentro.cl/2025/09/12/renuncia-seremi-de-agricultura-del-maule-claudia-ramos-deja-su-cargo/), [Diario Frutícola](https://www.diariofruticola.cl/noticia/noticias-agricolas/2025/09/cambio-en-agricultura-maule-renuncia-la-seremi-claudia-ramos-y-asume-director-regional-del-sag)). **Bandera roja**: durante subrogación trámites IFC + DL 3.516 pueden tener delays adicionales en Maule.
- **SEREMI Agricultura O'Higgins**: oficina Cuevas 480 piso 2 Rancagua ([Minagri contacto](https://minagri.gob.cl/contacto/ohiggins/)).
- **SEREMI Vivienda Maule**: cambio post-2023 caso Fundaciones, verificar nombre actual antes de publicar.
- **DGA Regional MOP O'Higgins** publica resoluciones de áreas restricción ([SEREMI MOP O'Higgins](https://ohiggins.mop.gob.cl/direccion-general-de-aguas-del-mop-protege-fuentes-de-aguas-subterraneas-en-23-nuevos-acuiferos-del-pais/)).

---

## 10. Implicaciones safeguard PropOS — beta zona

### 10.1 Por qué buena beta vs Santiago

- **Densidad de flags por listing alta**: parcela Maule típica genera 4–6 checks no-triviales (CBR Reg. Propiedad + Reg. Aguas, SAG DL 3.516, SAG Catastro Vitícola si hay parras, IFC art 55 si hay bodega, DGA zona prohibición, JV inscripción miembro). Santiago urbano genera 2–3.
- **Brokers menos sofisticados, mayor disposición a externalizar**: corredoras como Habiter (>600 listings Curicó+Talca), Lorca, San Agustín, Vista, Maule Propiedades — perfil de adopción claro para SaaS $X CLP/listing vs abogado $50–150K externo.
- **CBR digitalizado parcialmente**: 9 oficinas con web; suficiente para automatizar 60% de checks en M0 sin runners físicos.
- **Concentración geográfica**: <300 km eje Rancagua-Parral cubre 72,5% superficie vitícola Chile, 1,3M habitantes urbanos, miles de transacciones rurales. Beta en RM dispersa esfuerzo en 52 comunas distintas con CBR único saturado.

### 10.2 Riesgos de la zona como beta

- **Heterogeneidad técnica de CBRs**: 4 plataformas distintas (CBRS portal, conservadoresdigitales.cl, propios, HTTP legacy Constitución). Inversión inicial en adaptadores grande relativo a volumen.
- **Cloudflare wait-rooms** en Rancagua, Talca, San Fernando → RPA headless obligatorio, no cliente HTTP simple. Costo infra mayor.
- **DOMs sin plataforma digital** en comunas chicas (Empedrado, Curepto, Vichuquén, Pumanque, Marchigüe, Litueche, Paredones) → workers presenciales o email = no escalable hasta tener volumen local.
- **Pichilemu CBR + DOM**: inscripciones históricas con loteos brujos invalidan asunción "CBR vigente = título sano". Necesario módulo de **flags municipales específicos** (postergación permisos PRC, modificaciones PRC en aprobación) → backend `municipal_flags` con feed manual.
- **Volatilidad SEREMIs**: Maule Agricultura subrogado desde sep-2025 → IFC delays, posibles cambios criterio. Operacional, no técnico.
- **Confidencialidad pequeñas comunas**: Chanco-Pelluhue tiene **un solo notario+conservador+archivero**; cualquier escalamiento de queja PropOS contra él compromete acceso. Tratamiento institucional cuidadoso requerido.

### 10.3 Orden de adaptadores recomendado para M0

1. **CBRS portal compartido** (Rancagua + Talca + Cauquenes) — un adaptador, 3 oficinas, ~50% de transacciones zona.
2. **Conservadoresdigitales** (San Fernando + Curicó) — segundo adaptador, +20%.
3. **DGA Catastro Público de Aguas** — gratis, nacional, alto valor por flag caducidad 2027.
4. **SAG Catastro Vitícola consulta agregada** + ficha rol-predio por email worker.
5. **DOM en Línea MINVU** + **Smart DOM Rancagua / Maule** + **filedom Talca** + **DOM Digital Parral** = 4 adaptadores municipales para cubrir capitales.
6. **Conservadores propios chicos** (Pichilemu, Linares, Constitución, Parral, Chanco-Pelluhue, San Clemente, Licantén, San Javier) — stub email + RPA mínimo, M1.

### 10.4 Pricing lock-in para zona

- Flag DAA caducidad 2027 + flag DL 3.516 sin SAG + flag IFC art 55 ausente = los 3 flags de mayor valor económico (predios afectados pueden perder 30–80% de su valor de venta declarado). PropOS debería cobrar por **detección efectiva** de estos 3, no plana.
- Estudio título tradicional $50–150K CLP no cubre estos flags rurales (abogado urbano no audita SAG ni DGA). Hueco de mercado claro.

---

## 11. Datos pendientes / no encontrados

- **Aranceles oficiales por certificado** publicados en cada CBR de la zona — solicitar por email a cada oficina o vía portal logueado.
- **Lista exhaustiva DOM Digital / Smart DOM / DOM en Línea** por comuna en Maule + O'Higgins — pedir a MINVU vía Ley 20.285.
- **Casos judiciales loteos brujos específicos Pichilemu / Cahuil / Vichuquén** con número de causa — no encontrados en búsqueda abierta; probable revisar sentencias Poder Judicial por comuna.
- **Catastro Vitícola Nacional 2024/2025** — última versión confirmada 2022; actualizar antes de marketing.
- **Conservador San Clemente vs Talca** delimitación exacta protocolos — confirmar oficio caso a caso.

---

**Fuentes principales** ya hipervinculadas inline. Total ~25 webfetches/searches consolidados.

