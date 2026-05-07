# 04 — Suelo Rural y Parcelaciones

> Safeguard pre-listing PropOS. Lector: ingeniero. Estilo denso, definiciones primera ocurrencia.
> Scope geográfico: RM Santiago + O'Higgins (Rancagua, Machalí, Rengo, Graneros, San Fernando) + Maule (Talca, Curicó, Linares, Constitución).
> Fechas consulta web: **2026-05-07**.

---

## 1. La línea urbano vs rural

La frontera entre suelo urbano y rural la define el **PRC** (Plan Regulador Comunal) o el **PRMS** (intercomunal). Cada metro cuadrado de Chile cae en una de dos categorías:

- **Suelo urbano**: dentro del límite urbano. Aplica LGUC + OGUC + PRC. Subdivisión predial mínima la fija el PRC. Construcción autorizada por DOM mediante permiso edificación regular.
- **Suelo rural**: fuera del límite urbano. Aplica **art 55 LGUC** (régimen excepcional) + **DL 3.516** (subdivisión).

Implicaciones radicales del lado rural:
- No se puede abrir calles, formar poblaciones ni levantar construcciones, salvo excepciones tasadas.
- Subdivisión mínima: **0,5 hectáreas** (5.000 m²) por DL 3.516, ni un metro menos.
- Cualquier construcción no agrícola requiere **autorización SEREMI Agricultura** con informe SAG y SEREMI Vivienda.

Para safeguard, geocoding del predio contra capas PRC/PRMS (vía IDE MINVU o IDE Chile) es prerequisito. En O'Higgins y Maule la mayoría del territorio es rural, por eso este archivo pesa más que en otras regiones.

---

## 2. DL 3.516 — la "parcela de agrado"

**Decreto Ley 3.516** de 1980, M. Agricultura, [BCN idNorma=7155](https://www.bcn.cl/leychile/navegar?idNorma=7155). Texto fundacional:

> Los predios rústicos podrán ser divididos libremente por sus propietarios, siempre que los lotes resultantes tengan una superficie no inferior a 0,5 hectárea.

Requisito formal: **certificación SAG** (Servicio Agrícola y Ganadero) de la subdivisión. Trámite digitalizado en `https://sag.cerofilas.gob.cl/` con ClaveÚnica.

### 2.1 Intención original vs práctica histórica

Intención: facilitar fragmentación productiva pequeña dentro del agro. Lo que pasó: durante 40+ años se usó como vía para **vivienda secundaria/permanente** en zona rural, sin urbanización formal, sin recepción de loteo, sin cesiones. Resultado: explosión de "parcelas de agrado" en RM (Pirque, Buin, Calera de Tango, Talagante, Melipilla, Lampa, Colina) y especialmente en **O'Higgins (Machalí precordillera, Rengo, San Fernando) y Maule (Talca rural, Curicó valle, Pencahue, San Clemente)**.

Cifra clave: solicitudes SAG cayeron **61% entre 2022 y 2025** (de 22.378 a 8.650) tras endurecimiento administrativo ([San Carlos Online, marzo 2026](https://www.sancarlosonline.cl/2026/03/ley-de-parcelaciones-rurales-vuelve-al.html)).

### 2.2 Estado regulatorio 2021–2026 (cronología)

| Fecha | Acto | Efecto |
|---|---|---|
| 18-ene-2021 | **DDU 445 MINVU** (recapitula y reconsidera DDUs previas sobre art 55 LGUC y DL 3.516) | Aclara que predio rural se subdivide libremente ≥0,5 ha pero NO autoriza construcción habitacional |
| 12-jul-2022 | **Ord MINAGRI 637** | Instruye al SAG suspender certificación cuando detecta cambio de destino |
| jul-2022 | **Circular SAG 475/2022** | Criterios de suspensión/rechazo (servidumbres, conectividad, etc.) |
| 2022 | DDU 509 MINVU | Refuerza cesiones y aportes en zona rural |
| 30-jul-2024 | **Ingreso Proyecto Ley "Protección del Territorio y la Vida Rural"** al Congreso | Primer trámite Comisión Agricultura Cámara Diputados |
| feb-2025 | Ley 21.727 prorroga plazos inscripción derechos agua a 6-abr-2027 | |
| ene-2026 | Gobierno pide acelerar tramitación | Sin urgencia formal aún |
| mar-2026 | Reanuda discusión tras 19 meses paralizado | Sigue en Comisión Agricultura Cámara |

### 2.3 Proyecto Ley Parcelaciones — estado mayo 2026

**Estado al 7-may-2026**: en primer trámite constitucional, Comisión de Agricultura, Silvicultura y Desarrollo Rural de la Cámara de Diputados. Sin fecha de votación. Reanudado en marzo 2026 ([gob.cl](https://www.gob.cl/noticias/proyecto-ley-proteccion-territorio-vida-rural-parcelaciones-objetivos-venta-terrenos-suelos-agricolas/)).

Propuestas concretas verificadas ([Produncan](https://produncan.cl/nueva-ley-de-parcelaciones/), [MINVU](https://www.minvu.gob.cl/proteccion-del-territorio-y-la-vida-rural/)):

- Mantiene mínimo 0,5 ha pero **prohíbe expresamente uso habitacional** en subdivisiones DL 3.516 tradicionales.
- Crea figura nueva: **"Conjunto Residencial Rural"** — única vía legal para vivienda planificada en rural. Requisitos:
  - Servicios formales: agua, alcantarillado, electricidad, recolección residuos.
  - Acceso a camino público.
  - Medidas contra incendios.
  - Porcentaje del territorio para actividad agrícola o conservación.
- **Presunción legal**: proyecto con **6+ lotes colindantes de máximo 3 hectáreas** se clasifica automáticamente como Conjunto Residencial Rural (fundamental — captura el patrón actual de 6+ parcelas de agrado vendidas juntas).
- Modifica LGUC, DL 3.516 y Ley 18.755 (rol fiscalizador SAG).
- Garantía a compradores: contratos con caución vía póliza o boleta bancaria, ante notario.
- Multas: la versión pública del proyecto refuerza atribuciones de fiscalización y sanción; los textos divulgativos no precisan porcentaje exacto. La tesis de "200% del avalúo" circulada en prensa corresponde al espíritu del proyecto pero no se confirma como cifra fija aprobada en el articulado actual.

Implicación safeguard: hasta promulgación, DL 3.516 sigue vigente. Pero **una parcela DL 3.516 vendida hoy con destino habitacional ya enfrenta riesgo retroactivo via fiscalización SAG**, especialmente si se ofrece dentro de un conjunto.

---

## 3. Loteos brujos

**Loteo brujo** = subdivisión sin permiso ni recepción DOM, comercializada como si fueran lotes independientes.

### 3.1 Modalidades comunes

1. **Cesión de derechos**: el dueño no vende un inmueble sino una "cuota" abstracta sobre el predio común. CBR no inscribe dominio de un lote individual; el comprador recibe escritura de cesión que no le da uso exclusivo de un sitio determinado.
2. **Cuota indivisa de %**: variante de la anterior. Se vende "el 5% de los derechos sobre el predio". Indeterminación física total.
3. **Promesa con plano referencial**: promesa de compraventa con un plano de loteo informal que nunca se inscribe.
4. **Subdivisión apenas inferior al mínimo**: forzar lotes <0,5 ha con artificios (servidumbres, "predios fundo más sitio").

Resultados para el comprador:
- No puede inscribir dominio individual.
- No puede pedir CIP (no hay rol del lote).
- No puede empalmar agua/luz formalmente.
- No puede constituir hipoteca.
- Riesgo de juicios de partición forzada por otros comuneros.

CBR y notarios **deben rechazar** estos vehículos cuando son evidentes, pero la línea es difusa cuando se disfraza como cesión hereditaria. ([Portal Pirque](https://www.portalpirque.cl/index.php/world/19-noticias/1770-cesion-de-derechos-o-loteos-brujos-cuando-lo-barato-cuesta-caro02))

### 3.2 Geografía del problema en scope

- **RM**: Pirque, Calera de Tango, Talagante, Melipilla, Lampa rural.
- **O'Higgins**: Machalí precordillera, Rengo viñedos rural, San Fernando rural alto, Codegua, Coltauco. Zonas atractivas para parcelación de agrado por cercanía a Santiago en 1h–1h30.
- **Maule**: Pencahue, San Clemente, Maule rural, Curicó valle Tinguiririca-Teno, Linares precordillera. Aquí se mezcla con tierra agrícola productiva (uva vinífera) generando conflictos con denominación de origen y consumo de derechos de agua.

Tesis UC documenta el patrón ([Estudios Urbanos UC, J. Olivares](https://estudiosurbanos.uc.cl/wp-content/uploads/2022/01/TESIS-JOL.pdf)).

---

## 4. Cambio de uso de suelo — art 55 LGUC

Para construir cualquier cosa **no agrícola** en suelo rural, mecanismo:

```
Solicitud → SEREMI Agricultura
   ↓ pide
   ↓ Informe SAG (vinculante)
   ↓ Informe SEREMI MINVU (vinculante)
   ↓
Resolución Favorable / Desfavorable SEREMI Agricultura
   ↓ si favorable
DOM emite permiso edificación
```

### 4.1 Excepciones que NO requieren cambio de uso

LGUC art 55 ([leyes-cl.com](https://leyes-cl.com/aprueba_nueva_ley_general_de_urbanismo_y_construcciones/55.htm)):

- **Vivienda del propietario o sus trabajadores** (la legítima, no figura).
- **Equipamiento esencial** para la explotación agrícola del propio predio.
- **Vivienda social ≤1.000 UF** que cumpla requisitos de subsidios estatales.

Cualquier cosa fuera de esto = procedimiento art 55 inciso 3.

### 4.2 IFC — Informe de Factibilidad para Construcciones ajenas a la agricultura en área rural

SAG emite IFC ([sag.gob.cl](https://www.sag.gob.cl/ambitos-de-accion/informe-de-factibilidad-para-construcciones-ajenas-la-agricultura-en-area-rural-ifc)). NO implica subdivisión ni pérdida de calidad agrícola del resto del predio. Es sólo aval técnico de que la construcción es compatible con la actividad agrícola circundante.

---

## 5. Ley 20.234 + Ley 21.477 — saneamiento de loteos consolidados

**Ley 20.234** (2008) creó procedimiento simplificado para regularizar **obras mínimas de urbanización** de asentamientos poblados sin permiso ni recepción de loteo.

**Ley 21.477** (10-ago-2022) modificó el procedimiento y extendió vigencia hasta **31-dic-2030** ([DOE Actualidad Jurídica](https://actualidadjuridica.doe.cl/ley-21-477-conoce-mas-sobre-la-ley-que-modifica-el-procedimiento-de-saneamiento-y-regularizacion-de-loteos-y-extiende-su-vigencia/)).

Requisitos clave:
- Asentamiento existente, consolidado, ocupado.
- **Mínimo 70% residentes permanentes** primera vivienda.
- Solicitud por la comunidad, autoridad municipal, gobierno regional o SERVIU.
- DOM aprueba con normas urbanísticas adaptadas, no las regulares.

**Lo que NO regulariza**: el **dominio individual**. Solo arregla la urbanización (calles, agua, luz comunitaria). Cada residente sigue necesitando título individual vía DL 2.695, herencia, o compraventa.

Útil para safeguard si el predio está en un loteo en saneamiento: dato debe figurar como bandera amarilla — predio dentro de proceso Ley 20.234 = transitorio jurídico.

---

## 6. DL 2.695 — saneamiento de la pequeña propiedad raíz

**DL 2.695** de 1979, M. Tierras (hoy Bienes Nacionales). [BCN idNorma=6982](https://www.bcn.cl/leychile/navegar?idNorma=6982).

Permite a un poseedor material constituir dominio cuando:
- Posee material y tranquilamente al menos **5 años**.
- Avalúo fiscal del predio ≤ umbral legal (rural ≤ 800 UTM, urbano ≤ 380 UTM aproximadamente; revisar valor vigente).
- No hay título inscrito a nombre de otro fácilmente identificable, o el dominio es confuso.

Tramitación administrativa-judicial mixta: **Ministerio de Bienes Nacionales** instruye y representa al solicitante; tribunales resuelven oposiciones.

### 6.1 Riesgos legales — la "bandera roja"

Tras inscripción regularizada:
- **1 año** de plazo para acción de oposición administrativa.
- **5 años** para acción reivindicatoria del verdadero dueño (prescripción extraordinaria mientras tanto).
- Pasado el año desde inscripción, el regularizado se vuelve **poseedor regular**; al cumplir 5 años desde primera inscripción se consolida dominio absoluto vía prescripción extintiva de las acciones del antiguo titular.

**Para safeguard PropOS**: si en estudio CBR detectamos que la inscripción de dominio actual proviene de DL 2.695 y tiene **menos de 5 años de antigüedad**, marcar como **bandera roja** automática. El comprador potencial corre riesgo concreto de perder el predio por reivindicatoria. Banco probablemente niega hipoteca.

---

## 7. Ley 21.442 — copropiedad inmobiliaria (2022) + reglamento DS ene-2025

**Ley 21.442** publicada 13-abr-2022, deroga ley 19.537 anterior. Reglamento (DS aprobando reglamento) publicado **9-ene-2025** ([MINVU](https://www.minvu.gob.cl/wp-content/uploads/2025/01/Reglamento-de-la-ley-21442.pdf)).

### 7.1 Clasificación condominios

- **Tipo A**: edificios o conjuntos en un mismo terreno común, con unidades sobre bienes comunes.
- **Tipo B**: subdivisión en sitios de dominio exclusivo + áreas comunes (típico condominio horizontal de casas con sus propios sitios).

Distinción importa para coeficientes, gastos comunes, derechos sobre bienes comunes por sector.

### 7.2 Registro Nacional de Administradores MINVU

A cargo MINVU. **Obligatorio, público, gratuito**. Desde **septiembre 2025** todo administrador de condominio debe estar inscrito ([Kastor](https://kastorsoftware.cl/2025/05/05/ley-de-copropiedad-21-442-para-administradores-que-pasa-en-2025-y-como-adaptarte-sin-enredos/)).

### 7.3 Gastos comunes — art 35

Las deudas por gastos comunes **persiguen a la unidad**, no solo al deudor moroso. El nuevo dueño hereda el saldo. Para safeguard pre-listing en condominio:
- Solicitar **certificado de gastos comunes al día** del administrador.
- Verificar inscripción del administrador en registro MINVU.
- Verificar **reglamento de copropiedad inscrito en CBR** + plano archivado.

Plazo único: condominios tienen hasta **9-ene-2026** (un año desde publicación reglamento) para adaptar sus reglamentos internos.

### 7.4 Registro de copropietarios

Obligación de mantener registro de copropietarios, arrendatarios y ocupantes con nombre, RUT y email.

---

## 8. ADI y tierras indígenas (Ley 19.253) — relevancia geográfica scope

**Ley 19.253** crea CONADI. Art 13: tierras indígenas inalienables, inembargables, imprescriptibles, salvo **entre indígenas misma etnia**. Excepciones limitadas: permutas y construcciones religiosas/sociales/deportivas autorizadas por CONADI.

**ADI** (Áreas de Desarrollo Indígena) art 26: Alto Bío Bío, Atacama La Grande (San Pedro), Rapa Nui, Lago Budi, Puel Nahuelbuta, Wallmapu (Araucanía), entre otras. **Todas fuera del scope core RM/O'Higgins/Maule**. Mención por completitud — un cliente con predio en La Araucanía Norte, Bío Bío sur o Atacama altoandino requiere consulta CONADI obligatoria.

---

## 9. Predios agrícolas en O'Higgins y Maule — específico

### 9.1 Derechos de agua DGA

Para predio agrícola sin derecho inscrito en **CPA** (Catastro Público de Aguas, DGA): predio sin valor productivo. Cubierto en archivo siguiente con detalle, pero referencia mínima:
- **Ley 21.435** (Código Aguas reformado 2022): obliga inscripción de derechos.
- **Ley 21.727** (feb-2025) prorroga plazo regularización a **6-abr-2027**.
- Endpoint: `https://dga.mop.gob.cl/derechos-de-agua/derechos-registrados/`.

Para safeguard rural en O'Higgins/Maule: cualquier predio agrícola sin derecho inscrito = bandera roja productiva.

### 9.2 Denominación de origen vinos (DO)

**Decreto 464/1994** ([SAG](https://www.sag.gob.cl/sites/default/files/decreto_ndeg_464.pdf)). Para etiquetar un vino como "Cachapoal", "Colchagua", "Maule", "Curicó" se requiere ≥75% de uva del lugar declarado.

Implicación para venta de viña:
- Cambio de uso de suelo agrícola dentro de zona DO afecta el padrón de viñedos colindantes (la mancha vinífera).
- Predio dentro de DO con renombre comercial mejora el avalúo comercial pero el comprador necesita conocer el reglamento de cada DO; algunos imponen prácticas (riego, variedades aceptadas).

### 9.3 INDAP y pequeño productor

Predio acreditado como "Pequeño Productor Agrícola" INDAP tiene derecho a subsidios Agua en Regla, créditos blandos, asesoría. Si se vende a un no-pequeño-productor, beneficios cesan. No bloquea venta pero sí afecta el universo de compradores y el flujo financiero.

### 9.4 Zonas de protección agrícola — PRMS y PRC

PRMS define **AVP** (Área de Valor Productivo Agrícola) y **AIA** (Área de Interés Silvoagropecuario). Predios dentro de AVP/AIA: cambio uso restringido. En O'Higgins/Maule, planes intercomunales más recientes replican lógica.

### 9.5 Restricciones cultivos sensibles

OGM, cáñamo, opio, coca: SAG y MINSAL fiscalizan. No bloquean venta del predio en sí pero sí actividad si ya está en marcha. Para nuestro safeguard: out of scope inmediato.

---

## 10. Tabla — patrones de detección de parcela problemática

| Patrón observable | Indicador concreto | Severidad |
|---|---|---|
| Predio con rol agrícola pero subdividido en CBR ≥10 veces en 5 años | rol matriz único, N inscripciones nuevas misma fecha | ALTA |
| Inscripción de dominio vía DL 2.695 con <5 años | título referencia "DL 2.695" + fecha reciente | ALTA |
| Cesión de derechos / cuota indivisa en lugar de compraventa de inmueble | escritura tipo "cesión de derechos" sin individualización | ALTA |
| Lotes de 0,5–0,6 ha en conjuntos de 6+ colindantes | densidad lotificada precordillera Machalí, Rengo, San Clemente | ALTA (proyecto ley futuro lo prohíbe explícito) |
| SII rol agrícola con avalúo "construcciones habitacionales" | desglose detallado SII muestra m² habitacionales | MEDIA-ALTA |
| Diferencia entre m² SII y m² recepción definitiva DOM | cualquier delta >10% | ALTA |
| Predio sin derechos de agua DGA inscritos pero ofrecido como "agrícola productivo" | búsqueda CPA negativa | ALTA |
| Predio dentro de PRMS AVP/AIA pero comercializado como residencial | zona PRMS vs uso oferta | ALTA |
| Loteo en saneamiento Ley 20.234 vigente | resolución municipal en curso | MEDIA (transitorio) |
| Ausencia de IFC / autorización SEREMI Agricultura para construcciones rurales no agrícolas | sin resolución SEREMI Agricultura | ALTA |
| Predio dentro de ZT/MH/ADI/SBAP sin disclosure | match capa CMN/SBAP/CONADI vs polígono | ALTA |
| Faja MOP-Vialidad sobre el predio | informe expropiación positivo | ALTA |
| Cuotas contribuciones impagas >4 | TGR certificado deuda | MEDIA |
| Condominio post-Ley 21.442 sin reglamento adaptado <ene-2026 | falta inscripción reglamento actualizado | MEDIA |
| Administrador condominio no inscrito Registro MINVU desde sep-2025 | búsqueda registro nacional negativa | MEDIA |
| 80m playa fiscal sin concesión marítima | match capa SSFFAA + DL 1.939 | ALTA |
| Construcciones en predio rural sin recepción definitiva DOM | LGUC art 145: inhabitable jurídicamente | ALTA |

---

## 11. Cierre — relevancia para PropOS

Módulo "rural + parcelaciones" es donde más valor agrega el safeguard pre-listing. La asimetría de información compra/venta es máxima en suelo rural: comprador urbano migrante a O'Higgins/Maule rara vez sabe distinguir DL 3.516 de loteo brujo, ni IFC de permiso edificación, ni rol agrícola con habitacional encima.

Pipeline mínimo PropOS rural:

1. Geocoding del predio → polígono.
2. Cruce contra capas: PRMS/PRC (urbano/rural), AVP/AIA, ZT/MH/SBAP/ADI, faja MOP, 80m playa fiscal.
3. CBR: serie de inscripciones del rol → detectar cesiones/cuotas indivisas/DL 2.695 reciente.
4. SII detallado vs DOM recepción definitiva.
5. SAG: certificación DL 3.516 + IFC para construcciones.
6. DGA: derechos agua inscritos.
7. Si condominio: registro administrador MINVU + reglamento CBR + gastos comunes.

Cuando el proyecto ley parcelaciones se promulgue (probablemente segundo semestre 2026 o 2027 dada la inercia política actual), el módulo deberá:
- Detectar **conjuntos ≥6 lotes ≤3 ha colindantes** y aplicar presunción legal de "Conjunto Residencial Rural" (requeriría servicios formales + caminos + cesión agrícola/conservación).
- Bloquear listings sin acreditación de servicios formales o sin caución póliza/boleta.

Documentos relacionados en `docs/research/title-study/`:
- `03-fiscal-municipal-urbanistico.md` — SII, TGR, DOM, DOM en línea, PRC/PRMS, sectoriales.
- `endpoints_publicos.csv` — catálogo de endpoints integrables (este directorio).
