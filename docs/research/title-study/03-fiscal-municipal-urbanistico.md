# 03 — Fiscal, Municipal y Urbanístico

> Safeguard pre-listing PropOS. Lector: ingeniero. Estilo denso, definiciones primera ocurrencia.
> Scope geográfico: RM Santiago + O'Higgins (Rancagua, Machalí, Rengo, Graneros, San Fernando) + Maule (Talca, Curicó, Linares, Constitución).
> Fechas consulta web: **2026-05-07**.

---

## 1. SII — Servicio de Impuestos Internos (lado fiscal del bien raíz)

**SII** = autoridad tributaria nacional. Mantiene el catastro fiscal de bienes raíces (avaluación). No registra dominio (eso es CBR), pero sin SII no se cobra contribuciones ni se firma escritura porque la notaría exige el avalúo.

### 1.1 Rol vs RUT vs subrol

- **Rol** (rol de avalúo): identificador catastral de un predio en una comuna. Formato `NNNN-NN` (manzana-predio). Cada comuna numera autónomamente, por eso el rol no es único nacional sin la comuna.
- **Subrol**: división interna del rol cuando hay copropiedad horizontal (departamentos, oficinas, bodegas, estacionamientos en un mismo predio matriz). Un edificio = un rol matriz + N subroles.
- **RUT**: identificador tributario de personas/entidades, no del predio. El predio NO tiene RUT.

Implicación PropOS: la PK del predio en nuestros datos debe ser `(comuna_id, rol, subrol)`, jamás solo rol.

### 1.2 Avalúo fiscal vs comercial

- **Avalúo fiscal**: valor que asigna SII por reavalúo masivo. Base imponible del impuesto territorial (contribuciones).
- **Avalúo comercial**: valor de mercado. Lo determina el sector privado.
- Reavalúo no agrícola entró en vigencia **enero 2025** (Ley 21.078 obliga revisión periódica). Reavalúo agrícola opera por separado y suele ir desfasado. ([SII Reavalúo 2025](https://www.sii.cl/destacados/reavaluo/2025/index.html))

### 1.3 Contribuciones (impuesto territorial)

- 4 cuotas anuales: abril, junio, septiembre, noviembre.
- Tasa anual ~1% para no agrícolas habitacionales sobre tramo gravado, ~1.4% comerciales/industriales, ~1% agrícolas; con sobretasas progresivas para suma de avalúos altos.
- **Exención habitacional 2025**: avalúo fiscal ≤ **$56.846.995** queda exento.
- **Exención habitacional 2026**: monto exento sube a **$60.030.710** ([fuente](https://portaltrabajo.cl/quienes-estan-exentos-de-pagar-contribuciones-en-chile-este-2025/)).
- Beneficio adulto mayor (mujer ≥60, hombre ≥65) habitacional: rebaja 100% si ingresos ≤ $669.911 mensuales y avalúo fiscal ≤ $133.319.168; 50% en tramo intermedio.

### 1.4 Endpoints SII relevantes

| Trámite | URL | Auth | Notas |
|---|---|---|---|
| Búsqueda rol por dirección | `https://www4.sii.cl/mapasui/internet/` | no | "SII Mapas" — geocoder catastral |
| Certificado avalúo fiscal simple | `https://zeus.sii.cl/avalu_cgi/br/brc110.sh` | no | Gratuito. Necesita comuna + rol |
| Certificado avalúo detallado | `https://www2.sii.cl/vicana/Menu/ConsultarAntecedentesSC` | clave tributaria (solo dueño inscrito) | Incluye desglose terreno/construcciones |
| Reavalúos y rol semestral | `https://www.sii.cl/servicios_online/1048-2569.html` | no | |
| Guía formal certificado | `https://www.sii.cl/servicios_online/docs/guia_certificado_de_avaluo_fiscal.pdf` | no | |

**Diferencia simple vs detallado**: el simple basta para escritura de compraventa. El detallado lista cada construcción tasada (importa para detectar construcciones no recepcionadas — divergencia entre lo que SII tiene tasado y lo que tiene recepción definitiva DOM). Es nuestra primera red para "construcción fantasma".

### 1.5 Cómo se descubre el rol desde la dirección

3 vías:
1. SII Mapas (geocoder oficial, falla en direcciones nuevas o rurales).
2. Boleta contribuciones del dueño actual (si la tiene).
3. Cruce CBR → rol: la inscripción de dominio no siempre cita rol; puede ser necesario buscar por nombre del propietario en SII Mi SII.

Para rural agrícola: rol agrícola usa otra serie. Cuidado en O'Higgins/Maule: parcelas DL 3.516 frecuentemente conservan rol agrícola matriz aun después de subdivisión inscrita en CBR — bandera roja silenciosa.

---

## 2. TGR — Tesorería General de la República (cobro)

**TGR** ejecuta el cobro de contribuciones que determina SII. No expropia ni traba dominio por sí sola; solo cobra y, vencidas, inicia juicio ejecutivo.

Mito a desactivar: "TGR puede embargar tu casa". Sí puede, pero a través de juicio ejecutivo de cobro de impuesto territorial. Lo importante para safeguard:
- El **Certificado de Deuda de Contribuciones** ( `https://www.tgr.cl/certificado-deuda-contribuciones/` ) es gratuito, online, vigencia 1 mes.
- Datos requeridos: comuna + rol + subrol.
- Aparece toda deuda (vigente y morosa) por cuotas impagas.
- En escritura, el notario exige certificado al día. Sin él no se firma.

Mutar a luz roja en safeguard si: deuda > 4 cuotas atrasadas (1 año), o monto > 5% avalúo fiscal.

---

## 3. DOM — Dirección de Obras Municipales (lado urbanístico)

**DOM** = unidad municipal que aplica la **LGUC** (Ley General de Urbanismo y Construcciones, DFL 458/1975) y **OGUC** (Ordenanza General, reglamento de la LGUC). Base orgánica: LGUC art 9.

DOM emite todos los actos administrativos que dan vida jurídica a una construcción: aprobación anteproyecto, permiso edificación, recepción definitiva, certificados de informaciones previas, número, no expropiación, zonificación.

### 3.1 CIP — Certificado de Informaciones Previas (el más importante)

OGUC art 1.4.4. Documento que indica las normas urbanísticas vigentes para un predio. Contenido obligatorio:

- Identificación: dirección, manzana, sitio, rol asociado.
- Instrumentos de planificación territorial aplicables (PRC, PRI/PRMS, OGUC, LGUC).
- **Zona o subzona** del predio.
- **Usos de suelo permitidos** y prohibidos.
- **Coeficiente de constructibilidad** (m² edificables / m² terreno).
- **Coeficiente de ocupación de suelo**.
- **Altura máxima**.
- **Densidad** (hab/ha o viv/ha).
- **Antejardín**, **distanciamientos**, sistema de **agrupamiento** (aislado/pareado/continuo).
- **Subdivisión predial mínima**.
- **Áreas de riesgo** (inundación, remoción en masa, volcánico, incendio forestal) y áreas de protección.
- **Declaratoria de utilidad pública** que afecte el predio (vialidades por abrir, ensanches, plazas).
- Servicios disponibles: agua, alcantarillado, electricidad.
- Pendientes, cierros, ochavos.

Validez típica: 6 meses (variable por comuna). Costo y plazo: ver tabla §6.

Sin CIP actualizado **no se inicia ningún diseño ni anteproyecto**. Para safeguard: si CIP marca área de riesgo o utilidad pública sobre el predio, listing necesita disclosure obligatorio.

### 3.2 Certificado de número

Asigna o confirma la numeración municipal vigente. Importa porque CBR puede tener una numeración antigua que ya no existe en cartografía municipal — bandera amarilla cuando rol y dirección actual no calzan con título.

### 3.3 Recepción definitiva (LGUC arts 144 y 145) — CRÍTICO

- **Art 144**: terminada la obra, propietario y arquitecto solicitan recepción al DOM. Director revisa cumplimiento solo en lo urbanístico del permiso. Plazo legal 30 días. Si hay observaciones, 60 días para subsanar; vencido sin corrección, DOM rechaza.
- **Art 145**: **ninguna obra puede ser habitada o destinada a uso alguno antes de su recepción definitiva**.

Implicancia jurídica brutal:
- Construcción sin recepción definitiva = **inexistente jurídicamente** para efectos de uso y habitabilidad. No puede arrendarse. Banco no presta hipoteca. Notaría puede negar escritura. Seguro no cubre.
- Es la divergencia más común y costosa en mercado chileno: ampliaciones, segundas plantas, quinchos cerrados, departamentos en azotea, oficinas convertidas en residencia. Todas sin recepción.

Detección PropOS: cruce de SII detallado vs recepción definitiva DOM. Si SII tasa 220 m² construidos y DOM tiene recepción solo por 140 m², diferencia = obra clandestina o no recepcionada.

### 3.4 Permiso de edificación

Acto previo, autoriza ejecutar la obra conforme a un proyecto. Sin permiso, la obra es ilegal desde el primer día. Vencimiento: el permiso caduca si no inicia obra en 3 años (con prórroga). Renunciable.

### 3.5 Certificado de no expropiación / Certificado de afectación a utilidad pública

- **Municipal**: lo emite el DOM, sobre afectaciones que provienen del **PRC** (vialidades, áreas verdes, equipamiento previsto).
- **MINVU**: portal `https://cne.minvu.cl/cne.web/` para Certificado de No Expropiación nacional MINVU.
- **MOP-Vialidad**: `https://vialidad.mop.gob.cl/informe-de-no-expropiacion/` Informe de No Expropiación por proyectos viales nacionales/regionales. Gratis, online, plataforma SIAC. Pide certificado avalúo SII + copia inscripción + croquis.

Fuente: ([blog Portal Terreno sobre CAUP](https://blog.portalterreno.cl/2025/11/21/documentos-fundamentales-certificado-de-afectacion-a-utilidad-publica/))

Tres expropiadores distintos = **tres certificados distintos**. Safeguard debe pedir los tres en paralelo.

### 3.6 Certificado de zonificación / uso de suelo

A veces redundante con CIP, a veces complementario. En comunas grandes (Santiago, Las Condes) es un trámite separado más barato y rápido cuando solo se necesita confirmar uso.

---

## 4. DOM en Línea (MINVU)

Plataforma centralizada `https://domenlinea.minvu.cl/`. Proyecto MINVU para digitalizar +80 trámites DOM. Estado mayo 2026: **operativa en ~190 comunas** ([MINVU lista oficial](https://www.minvu.gob.cl/dom-en-linea/)).

Variabilidad operativa enorme: dos comunas vecinas pueden estar una al 100% online y la otra solo recibiendo papel. La página pública de MINVU confirma operatividad para nuestras zonas core (RM Santiago + O'Higgins capitales + Maule capitales) pero la lista de comunas exactas se mantiene en una hoja Google Drive `1KCzxqMxsr1WqWfZEIBj7zAqLbCDSc3cW`.

Acceso: ClaveÚnica (RUT). Login municipal en interfaz `https://revisiondom.minvu.cl/`.

---

## 5. PRC y la jerarquía de instrumentos de planificación territorial (IPT)

```
PRDU (regional)
   ↓
PRI / PRMS (intercomunal o metropolitano)
   ↓
PRC (comunal)
   ↓
Plan Seccional / Límite Urbano
```

- **PRDU** Plan Regional de Desarrollo Urbano: lineamientos.
- **PRI/PRMS**: el de Santiago es el **PRMS** (Plan Regulador Metropolitano de Santiago). Ordenanza vigente fundamental ([PRMS enero 2019](https://metropolitana.minvu.gob.cl/wp-content/files_mf/1549050083OrdenanzaPRMSENERO2019.pdf)).
- **PRC**: el operativo a escala predial. Define zonas, usos, alturas, densidades.
- **Plan Seccional**: zoom para sectores patrimoniales o de mayor detalle.

Norma posterior prevalece solo si el IPT superior no la regula. PRC no puede contradecir PRI/PRMS.

### 5.1 Disponibilidad cartográfica

- **MINVU IDE Geoportal**: `https://ide.minvu.cl` ofrece capas vectoriales (WMS/WFS) de PRMS. Para PRC individuales la cobertura es parcial.
- **Centro de Estudios MINVU**: `https://centrodeestudios.minvu.gob.cl/planes-reguladores/` lista de PRC por estado.
- **Observatorio Urbano**: `http://observatorios.minvu.cl/esplanurba/main.php` estado de tramitación.
- **IDE Chile** (geoportal nacional): capas más amplias.

Para PropOS: implementar geoespacial sobre PRMS (cobertura RM completa) es factible. PRC O'Higgins/Maule cobertura desigual — varias comunas (especialmente rurales) operan con PRC obsoleto o sin PRC, donde rige **art 55 LGUC** directo.

### 5.2 Ley 21.725 — modernización de planes reguladores

Publicada 2025 ([balance BCN](https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21725_2025-03-01)). Diversifica mecanismos de modificación, reconoce evaluación ambiental estratégica simplificada, fortalece atribuciones administrativas. Implicación: mayor velocidad de cambio en normas urbanísticas → CIP debe revalidarse más frecuente.

---

## 6. Tabla DOMs scope — disponibilidad y costos referenciales

| Comuna | Región | DOM en línea | Costo CIP referencial | Plazo CIP | URL DOM | Notas |
|---|---|---|---|---|---|---|
| Las Condes | RM | Sí | ~$15.000 CLP | 5–10 d háb | [lascondes.cl/tramites/obras-municipales](https://www.lascondes.cl/tramites/obras-municipales/tramites-online/) | Portal propio robusto, complemento DOM en Línea |
| Providencia | RM | Sí | ~$12.000 | 5–7 d | [providencia.cl/.../obras-municipales](https://providencia.cl/provi/municipalidad/servicios/obras-municipales/certificado-de-informaciones-previas) | DOM en línea integrado |
| Vitacura | RM | Sí | ~$15.000 | 5–10 d | vitacura.cl | |
| Santiago | RM | Sí | ~$8.000 | 7–15 d | santiagoenlinea.cl | |
| Maipú | RM | Parcial | variable | 10–20 d | maipu.cl | DOM con backlog histórico |
| Ñuñoa | RM | Sí | ~$10.000 | 5–10 d | nunoa.cl | |
| La Florida | RM | Sí | ~$10.000 | 7–15 d | laflorida.cl | |
| Puente Alto | RM | Parcial | ~$8.000 | 15–30 d | mpuentealto.cl | volumen alto, tiempos largos |
| Lo Barnechea | RM | Sí | ~$15.000 | 5–10 d | lobarnechea.cl | |
| Rancagua | O'Higgins | Sí | ~$8.000 | 10–20 d | rancagua.cl | DOM en Línea operativo |
| Machalí | O'Higgins | Sí | ~$8.000 | 10–20 d | machali.cl | |
| Rengo | O'Higgins | Parcial/papel | ~$6.000 | 15–30 d | rengo.cl | |
| Graneros | O'Higgins | Parcial | ~$6.000 | 15–30 d | graneros.cl | |
| San Fernando | O'Higgins | Parcial | ~$7.000 | 15–25 d | sanfernando.cl | |
| Talca | Maule | Sí | ~$8.000 | 10–20 d | talca.cl | DOM en Línea operativo |
| Curicó | Maule | Sí | ~$8.000 | 10–20 d | curico.cl | |
| Linares | Maule | Parcial | ~$7.000 | 15–25 d | linares.cl | |
| Constitución | Maule | Parcial | ~$7.000 | 15–30 d | mconstitucion.cl | |

Costos y plazos: estimaciones referenciales mayo 2026; cada comuna fija arancel por ordenanza local que actualiza anualmente. **Validar antes de cada caso.**

---

## 7. Loteos urbanos (LGUC + OGUC)

**Loteo** = subdivisión de un predio urbano destinada a generar nuevos lotes con frente a vía pública.

- **Loteo con urbanización**: ejecuta calles, agua, alcantarillado, electricidad, áreas verdes.
- **Loteo sin urbanización (DFL 2)**: solo lo permite la ley en casos acotados; rara vez aceptado.

### 7.1 Cesiones obligatorias — el 44%

LGUC art 70 y OGUC art 2.2.5. En todo loteo urbano se ceden gratuita y obligatoriamente al municipio terrenos para circulación, áreas verdes, deportes/recreación y equipamiento. **Tope: 44% del predio original.** Porcentaje exacto se calcula por densidad del proyecto vía tabla OGUC. ([Figueroa Abogados](https://www.figueroaabogados.cl/cesion-gratuita-de-equipamientos-a-municipalidad-en-obra-nueva-segun-articulo-70-lguc/))

### 7.2 Recepción definitiva del loteo

Análoga a la recepción de obras. Sin recepción de loteo, los lotes individuales NO pueden venderse jurídicamente como unidades autónomas. En la práctica se vende vía promesas con condición suspensiva, pero la inscripción CBR del lote individual no procede hasta recepción.

---

## 8. Comercial / industrial / SEIA / sectoriales

### 8.1 RCA — Resolución de Calificación Ambiental

**SEIA** = Sistema de Evaluación de Impacto Ambiental. Lo administra el **SEA** (Servicio de Evaluación Ambiental, `https://www.sea.gob.cl/`).

Proyectos inmobiliarios entran a SEIA cuando: ≥ 7 hectáreas o ≥ 300 viviendas en zonas declaradas latentes/saturadas. Industriales: la lista de tipologías obligadas está en el reglamento del SEIA.

Vía DIA (Declaración) o EIA (Estudio). Sale **RCA favorable o desfavorable**. Sin RCA favorable: no hay permiso edificación válido. Caducidad: si no se ejecuta en 5 años desde notificación, caduca.

Búsqueda pública RCA: `https://sinia.mma.gob.cl/evaluacion-y-fiscalizacion/resoluciones-de-calificacion-ambiental-rca/` y mapa `https://sig.sea.gob.cl/mapadeproyectos/`.

### 8.2 Permisos sanitarios MINSAL

SEREMI Salud autoriza funcionamiento sanitario para industrias, locales comerciales con manipulación de alimentos, bodegas con sustancias peligrosas. Trámite vía formulario sectorial; sin él la municipalidad no entrega patente comercial.

### 8.3 SEC — Superintendencia de Electricidad y Combustibles

- **TE-1/TE-2/TE-3/TE-4**: declaraciones de instalaciones eléctricas. La distribuidora (CGE, Enel, etc.) emite primero **certificado de factibilidad**.
- Plazo factibilidad: 8 días hábiles (según norma SEC), prorrogables 15 + 10 si requiere obras adicionales.
- Para alta tensión / subestaciones: aprobación SEC del proyecto eléctrico (ITM, planos), inscripción en registro respectivo.
- Portal: `https://www.sec.cl`.

### 8.4 DS 40 ruido y DS 43 sustancias peligrosas

- **DS 38/2011 MMA** (a veces aún citado como DS 146 antiguo) regula niveles máximos de ruido. Para industrial cerca de zona residencial, planimetría acústica obligatoria.
- **DS 43/2015 MINSAL** regula almacenamiento de sustancias peligrosas (>12 ton clase 3, etc.). Bodegas industriales requieren autorización SEREMI Salud bajo este decreto.

### 8.5 SISS — factibilidad sanitaria

Empresas sanitarias (Aguas Andinas, Essbio, Nuevosur en O'Higgins/Maule) emiten **certificado de factibilidad** dentro de su territorio operacional. Plazo: 20 días hábiles + 20 prórroga. Vigencia 1–2 años. Fuera del territorio operacional: solución particular (APR rural, fosa séptica, pozo) sometida a SEREMI Salud.

---

## 9. Permisos sectoriales que pueden bloquear venta (ortogonales al título)

Estos NO están en el título ni en CBR pero pueden volver el predio invendible o la transacción nula.

| Sector | Norma | Riesgo | Endpoint consulta |
|---|---|---|---|
| Vialidad MOP | DFL 850 / Ley Caminos | Faja fiscal expropiable | `vialidad.mop.gob.cl/informe-de-no-expropiacion/` |
| SBAP áreas protegidas | Ley 21.600 (sept 2023) | Predio dentro de SNASPE/área privada protegida | `https://areasprotegidas.mma.gob.cl/`, `https://sbap.gob.cl/` |
| CMN — Monumentos | Ley 17.288 | ZT, MH, MA, SN: toda intervención requiere autorización CMN previa | `https://www.monumentos.gob.cl/servicios/normas` |
| Concesiones marítimas | DL 1.939 + reglamento | 80 m desde alta marea = playa fiscal; toda obra requiere concesión Subsecretaría FFAA | `https://portalconcesiones.ssffaa.cl/` |
| CONADI / tierras indígenas | Ley 19.253 art 13 | Tierras inalienables salvo entre indígenas misma etnia, autorización CONADI | `http://www.conadi.gob.cl/` |
| Indígena ADI | Ley 19.253 art 26 | Áreas Desarrollo Indígena: focus estatal. Cobertura RM/O'Higgins/Maule muy baja; ADIs principales: Alto Bío Bío, Atacama La Grande, Wallmapu (fuera scope core) | CONADI |
| DGA agua | Código Aguas + Ley 21.435 + Ley 21.727 (feb 2025 prorroga plazos a 6-abr-2027) | Predio agrícola sin derechos inscritos = predio sin valor productivo | `https://dga.mop.gob.cl/derechos-de-agua/derechos-registrados/` |

---

## 10. Cierre — cómo encaja con safeguard pre-listing

Pipeline mínimo PropOS para módulo "fiscal-municipal-urbanístico":

1. Input: dirección + comuna (o rol+comuna).
2. **SII Mapas** → resolver rol/subrol.
3. **SII certificado avalúo** simple + detallado (si dueño) → snapshot fiscal.
4. **TGR certificado deuda** → estado contribuciones.
5. **DOM CIP** → snapshot urbanístico (zona, usos, riesgo, utilidad pública municipal).
6. **DOM permiso edificación + recepción definitiva** → contraste con SII detallado m² → flag obra clandestina.
7. **MINVU CNE + MOP no expropiación + DOM no expropiación** → triple cobertura expropiatoria.
8. **CMN georeferenciador** → flag patrimonio.
9. **SBAP/MMA** → flag conservación.
10. **SEA/SEIA buscador** → flag RCA caducada o pendiente.

Cualquier disonancia se vuelve `risk_flag` con severidad calculada. El usuario corredor recibe explicación traducida al español; la lógica de detección permanece en código inglés conforme a `CLAUDE.md`.

Documento `04-suelo-rural-y-parcelaciones.md` cubre la otra mitad (rural + DL 3.516 + saneamientos + copropiedad + agro).
