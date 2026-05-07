# CBR y cadena de títulos — fundamentos para el safeguard

Fecha consulta: 2026-05-07. Audiencia: ingeniero, no abogado.

## 1. Qué es el CBR

**CBR = Conservador de Bienes Raíces.** Oficina pública (auxiliar de la administración de justicia, depende del Poder Judicial pero no es tribunal) que lleva el registro inmobiliario de Chile. Cada CBR es un **monopolio territorial**: existe uno por cada "departamento" histórico (hoy aproximadamente provincia/agrupación de comunas). Hay ~280 CBRs en el país. Cada uno opera independiente: sin servidor central, sin folio real unificado, sin API estándar.

Tres funciones principales bajo el mismo techo en muchos casos:
- Conservador de Bienes Raíces (inmuebles).
- Conservador de Comercio (sociedades, poderes).
- Conservador de Minas y/o de Aguas (cuando aplica).
- Archivero Judicial (causas archivadas) — frecuentemente acumulado en el mismo cargo en ciudades chicas.

### Jurisdicción del scope

Cobertura no por comuna sino por **agrupación histórica de comunas**. La misma propiedad SIEMPRE va al mismo CBR; nunca dos CBRs compiten por el mismo predio (excepto patología — ver §10). Verificado lista 2026-05-07:

**RM (cubre 52 comunas vía ~10 CBRs):**
- **CBR Santiago** ([conservador.cl](https://conservador.cl)): 26 comunas — Cerrillos, Cerro Navia, Colina, Conchalí, Estación Central, Huechuraba, Independencia, La Florida (límite Diego Portales), La Reina, Lampa, Las Condes, Lo Barnechea, Lo Prado, Macul, Maipú, Ñuñoa, Peñalolén, Providencia, Pudahuel, Quilicura, Quinta Normal, Recoleta, Renca, Santiago, Til-Til, Vitacura. Único de mayor volumen del país.
- **CBR Puente Alto** ([conservadorpuentealto.cl](https://www.conservadorpuentealto.cl)): Puente Alto, San José de Maipo. (Pirque escindido, ahora CBR Pirque propio.)
- **CBR San Bernardo**: San Bernardo, Calera de Tango.
- **CBR Buin** ([cbrbuin.cl](https://www.cbrbuin.cl)): Buin, Paine.
- **CBR Talagante** ([cbrtalagante.cl](https://www.cbrtalagante.cl)): Talagante, Isla de Maipo, El Monte.
- **CBR Peñaflor** ([conservadorpenaflor.cl](https://conservadorpenaflor.cl)): Peñaflor.
- **CBR Melipilla**: Melipilla, Curacaví, María Pinto, San Pedro, Alhué.
- **CBR San Miguel**: comunas surponiente santiago centro (San Miguel, La Cisterna, Lo Espejo, etc).
- **CBR Independencia**: solo comuna Independencia (escisión reciente del CBR Santiago).
- **CBR Las Condes**: solo Las Condes (operación coexistente con Santiago en algunos trámites).

**O'Higgins:**
- **CBR Rancagua** ([cbrrancagua.cl](https://www.cbrrancagua.cl)): Rancagua, Codegua, Graneros, Machalí, Mostazal, Olivar.
- **CBR Rengo** ([conservadorderengo.cl](http://www.conservadorderengo.cl)): Rengo, Requínoa, Quinta de Tilcoco, Malloa.
- **CBR San Fernando**: San Fernando, Chimbarongo, Placilla, Nancagua, otros Colchagua.
- **CBR Santa Cruz**: Santa Cruz, Lolol, Pumanque, Peralillo, Palmilla.
- **CBR Pichilemu**: costa Cardenal Caro.
- **CBR Peumo**: Peumo, Pichidegua, Las Cabras, San Vicente Tagua Tagua.

**Maule:**
- **CBR Talca** ([conservadortalca.cl](https://www.conservadortalca.cl)): Talca, San Clemente, San Rafael, Pelarco, Pencahue, Río Claro.
- **CBR Curicó** (info@conservadorcurico.cl): Curicó, Romeral, Teno, Rauco, Sagrada Familia, Hualañé, Licantén, Vichuquén, Molina.
- **CBR Linares** (contacto@conservadorlinares.cl): Linares, San Javier, Yerbas Buenas, Villa Alegre, Colbún, Longaví.
- **CBR Constitución**: Constitución, Empedrado.
- **CBR Cauquenes**: Cauquenes, Pelluhue, Chanco.
- **CBR Parral**: Parral, Retiro.

Para resto país relevante: **CBR Valparaíso** y **CBR Viña del Mar** son separados (mismo eje conurbado pero registros distintos). **CBR Concepción**, **CBR Talcahuano**, **CBR Temuco** (existen 1° y 2° Temuco como oficinas paralelas), **CBR Antofagasta**, **CBR Puerto Montt**: cada uno con plataforma propia, todos alineados al estándar conservador.cl en madurez digital alta.

Implicancia para safeguard: necesitas **mapeo `comuna → CBR`** mantenido manualmente. No hay endpoint nacional. Comunas escindidas (Independencia, Pirque) cambian de CBR; documentos pre-escisión quedan en el CBR padre.

## 2. Reglamento del Registro Conservatorio (DS 1857)

El **Reglamento del Registro Conservatorio de Bienes Raíces**, decreto supremo s/n del 24-jun-1857 (idNorma 255400 BCN, dictado al amparo del art. 695 CC), es la norma central. Ya tenía 168 años cuando se escribió este doc. Pieza de derecho casi inmutable; parche menor por leyes posteriores (19.903 posesión efectiva, 19.799 firma electrónica). Define oficina, libros, tarifas, calificación, recursos.

### 2.1 Tres registros (arts. 31–33 Reglamento)

Cada CBR lleva tres libros separados, cosidos y foliados anualmente:

| # | Registro | Qué se inscribe | Ejemplos |
|---|----------|-----------------|----------|
| 1 | **Propiedad** | Translaciones de dominio | Compraventas, herencias (inscripción especial), donaciones, daciones en pago, adjudicaciones en partición o remate, permutas, aportes a sociedad, transferencias gratuitas Estado |
| 2 | **Hipotecas y Gravámenes** | Derechos reales que limitan dominio | Hipotecas (bancarias, voluntarias), censos, usufructos, uso, habitación, fideicomisos, servidumbres voluntarias |
| 3 | **Interdicciones y Prohibiciones de Enajenar** | Impedimentos al libre ejercicio de enajenar | Embargos, medidas precautorias, prohibición SERVIU, prohibición Ley 20.868, prohibición DL 2695, interdicciones por demencia, quiebra |

Adicional: **Registro de Aguas** (cuando el CBR tiene jurisdicción de aguas; si no, hay Conservador de Aguas separado), **Registro de Comercio**, **Registro de Hipotecas de Aguas**, **Registro Especial de Herencias**.

Cada registro tiene su propia foliatura anual independiente. Por eso el primary key es **(CBR, registro, foja, número, año)**.

### 2.2 Repertorio (arts. 24–32 Reglamento)

Libro **diario** donde se anota TODO título presentado al CBR, en orden cronológico estricto, con numeración correlativa anual. Función crítica: **fija prioridad temporal**. Si dos títulos contradictorios entran el mismo día, gana el del número de repertorio menor. Si entre ingreso a Repertorio e inscripción en el Registro pasa un tiempo (ej. CBR está observando defectos formales del título, "carátula"), la inscripción que finalmente se practique vale desde la fecha de Repertorio, no de Registro. Por eso el conservador solicita correcciones sin perder lugar.

Implicancia safeguard: si una propiedad está "en repertorio" hay título pendiente de inscripción. Ningún certificado de dominio vigente reflejará la operación, pero hay riesgo. El campo `estado de carátula` que exponen los CBRs digitales (e.g. [conservador.cl/portal/estado](https://conservador.cl/portal/estado)) responde por número de repertorio.

### 2.3 Sistema Foja / Número / Año (FNA) — el primary key

Las inscripciones se citan así: **"a fojas 1234 número 5678 del Registro de Propiedad del año 2018 del CBR de Santiago"**. Notación común: `Fs. 1234 N° 5678 año 2018` o `1234/5678/2018` o `f.1234 n°5678/2018`.

- **Foja**: número de página del libro físico donde empieza la inscripción.
- **Número**: número correlativo dentro del libro de ese año.
- **Año**: año del libro.

Reglas operativas para OCR:
- Foja a veces aparece con "vta." (vuelta) o "v." cuando es el dorso de la página → `1234v` ≠ `1234`.
- Año ocasionalmente mal: el repertorio cierra el 31-dic; títulos ingresados en diciembre pueden inscribirse en enero del año siguiente y aún así llevar año del Repertorio. Cuando notario o estudio cita "año 2024" pero el CBR responde "año 2025", probable ese caso. Validar contra fecha de la propia inscripción.
- Antes ~1980 algunos CBRs usaban guarismos romanos en foja. Tomos antiguos (pre-1900) digitalizados en Archivo Nacional ([documentos.archivonacional.cl](https://documentos.archivonacional.cl)).
- En registros con **continuación marginal**: una inscripción puede empezar en foja 1234 y "continuar al margen" — la copia autorizada incluye ambas.
- Una propiedad puede tener una **inscripción** y múltiples **subinscripciones** (notas marginales con datos posteriores: cancelación de hipoteca, alzamiento, rectificación). FNA cita la inscripción raíz; las subinscripciones cuelgan.

El FNA no se reemite: si una compraventa cancela la inscripción anterior, la nueva tiene un FNA nuevo y la antigua queda con nota marginal de cancelación apuntando al nuevo FNA. Cadena se reconstruye saltando hacia atrás.

### 2.4 Tracto sucesivo

**Tracto sucesivo** = principio que exige que cada inscripción tenga como antecedente la inscripción del transferente. Entre la inscripción 0 y la N hay una cadena ininterrumpida; cada eslabón derivó del anterior con causa válida (compraventa, sucesión, etc.).

Base legal: art. 686 CC (la tradición de inmuebles se hace **sólo** por inscripción), art. 728 CC (la posesión inscrita sólo cesa por nueva inscripción que cancele la anterior). Resultado: en Chile rige el **principio de inscripción**, distinto al sistema causalista francés. La inscripción NO es prueba absoluta de dominio (puede haber título nulo subyacente), pero es prueba de posesión y único modo de tradición.

**Regla de los 10 años**: viene del art. 2492 CC (prescripción extraordinaria) en relación al art. 2510. Quien posee 10 años continuos adquiere por prescripción extraordinaria, aún sin título. **Por eso el estudio de títulos retrocede mínimo 10 años**: si hubo vicio en eslabón anterior, prescripción ya saneó. La práctica conservadora va 10 años, la prudente 15-20 años, la especialmente cuidadosa hasta el primer título inmemorial. Bancos en general aceptan 10 años para créditos hipotecarios estándar; para operaciones grandes (terrenos, comerciales) piden 30 años.

Caveat: prescripción contra título inscrito requiere posesión **material** + **inscripción nueva** que cancele la anterior. La sentencia CS rol 19261-2018 (Forestal Mininco c/ Follador, 22-abr-2021) ratificó interpretación absoluta del art. 2505 CC: no se prescribe contra inmueble inscrito sin título inscrito propio. Esto cierra el riesgo del "ocupante prescribiente" sin papeles cuando hay inscripción vigente del vendedor.

### 2.5 Tipos de eslabones (qué se inscribe / qué revisas)

Para cada eslabón, el documento que origina la inscripción se llama **título** (escritura pública o resolución). El CBR lo conserva en sus archivos físicos/digitales. Lo que se inscribe es un **extracto** o copia.

| Eslabón | Título | Qué revisas en estudio |
|---------|--------|------------------------|
| **Compraventa** | Escritura pública ante notario. Art. 1801 CC: solemne para inmuebles. | Capacidad partes, autorización conyugal (art. 1749 CC si sociedad conyugal), pago precio, inexistencia condiciones suspensivas (arts. 1490-1491 CC). |
| **Herencia** | (1) Resolución posesión efectiva (Reg. Civil si intestada, tribunal si testada — Ley 19.903). (2) Inscripción auto PE en CBR. (3) Inscripción especial de herencia por inmueble. (4) Adjudicación en partición. | Que las cuatro inscripciones estén hechas (art. 688 CC: heredero NO puede disponer hasta que se inscriba). Si falta paso, eslabón roto. |
| **Donación** | Escritura pública + insinuación judicial cuando excede 2 centavos (regla histórica; práctica entiende >2 UTM). Inmuebles siempre requieren insinuación. | Resolución insinuación, pago impuesto donaciones (Ley 16.271), inscripción en Reg. Propiedad. |
| **Dación en pago** | Escritura pública. | Capacidad, valoración, autorización conyugal. Riesgo: deudores en problemas → eventual revocatoria pauliana. |
| **Adjudicación en remate** | Acta remate + escritura pública adjudicación. | Que la ejecución haya respetado tercerías, embargo inscrito, posesión efectiva del inmueble. |
| **Partición (no judicial)** | Escritura pública partición o laudo árbitro + resolución aprobatoria. | Cuotas, comparecencia todos los comuneros. |
| **Permuta** | Escritura pública. Tratada como doble compraventa. | Igual que compraventa para ambos lados. |
| **Aporte a sociedad** | Escritura pública constitución/aumento capital. | Que sociedad esté inscrita en Reg. Comercio, vigencia. |
| **Transferencia gratuita Estado / Bienes Nacionales** | DS o resolución MBN + plano. | Plano archivado, cumplimiento condiciones DL 1939. |
| **Saneamiento DL 2695** | Resolución administrativa Bienes Nacionales. | Plazo de 1 año para impugnar terceros (riesgo si reciente). |

## 3. Calificación del CBR (art. 13 Reglamento)

El conservador NO es notario: NO da fe del contenido del título. PERO tiene **facultad calificadora** acotada (art. 13 Reglamento + art. 70): puede **rehusar** la inscripción si hay defecto **manifiesto** que aparezca del título mismo o de los registros (no investiga afuera). Si rehúsa, devuelve con **nota de reparo** (también llamada "observación").

Errores típicos que generan reparo:
- Falta de individualización del inmueble (deslindes incompletos, sin foja anterior).
- Antefirma defectuosa (firma sin atestado notarial completo).
- Falta autorización conyugal (art. 1749 CC) — aunque CS 2025 limitó este reparo solo a casos de nulidad absoluta evidente.
- Tracto roto: la inscripción anterior no figura a nombre del vendedor.
- Patrimonio reservado mujer casada (art. 150 CC) sin acreditar.
- Incongruencia entre descripción del inmueble en escritura y en última inscripción.
- Cláusulas resolutorias o condicionales no individualizadas.

**Recurso (arts. 18, 19, 20 Reglamento)**: el perjudicado va al **juez de letras civiles** del territorio del CBR, en jurisdicción voluntaria. El juez revisa motivos del conservador, escucha al CBR, resuelve por escrito sin más trámite. Si acoge, ordena inscribir; si rechaza, queda firme. Plazo prescripción acción registral: práctica varía, pero la inscripción retrotrae al ingreso al Repertorio si finalmente se ordena.

Implicancia safeguard: en el Repertorio puede haber títulos **rechazados** o **observados pendientes**. Al detectar discrepancia entre estado de carátula = "observado" y certificado dominio vigente, alertar.

## 4. Inscripciones digitales y FEA

Ley 19.799 (2002) reconoce documentos electrónicos. Los CBRs comenzaron a emitir copias y certificados firmados con **Firma Electrónica Avanzada** (FEA) hace ~10 años. Hoy Santiago, Valparaíso, Viña del Mar, Concepción, Puente Alto, Talagante, Buin, Rancagua, Temuco emiten PDF firmados con FEA + **código de validación QR** y URL de verificación.

Validación: cada CBR digital tiene endpoint del tipo `/portal/verificacion_documentos` (CBR Santiago: [conservador.cl/portal/verificacion_documentos](https://conservador.cl/portal/verificacion_documentos)) donde pegas folio + RUT solicitante o lees QR → confirma autenticidad e integridad. NO hay endpoint nacional.

Limitación clave: **la FEA sirve para certificados emitidos por el CBR**, no para originar inscripciones. La compraventa de inmuebles sigue requiriendo escritura pública notarial en papel (o escritura electrónica notarial, recientemente, pero CBR aún pide ingreso físico en muchas oficinas). Una "promesa" o "minuta" firmada con FEA por particulares NO es inscribible.

Madurez digital irregular:
- **Alta**: Santiago, Valparaíso, Viña, Las Condes, Puente Alto, Talagante, Concepción, Temuco, Rancagua, Talca. Solicitud + entrega 100% online, FEA, pago electrónico, QR de validación.
- **Media**: muchos CBRs regionales (Linares, Curicó, Rengo, San Fernando, Constitución, Cauquenes) tienen sitio web con formulario de solicitud, pero **emisión** puede requerir retiro presencial o llegar por email sin FEA en todos los formatos. Verificar caso a caso.
- **Baja**: CBRs rurales pequeños (Pichilemu, Peumo, Parral, Hualañé, etc.) — históricamente solo presencial; algunos delegan al portal del **Archivo Nacional** ([documentos.archivonacional.cl](https://documentos.archivonacional.cl)) que centraliza fondos antiguos pero no es certificación viva.

Implicancia: el safeguard NO puede asumir API uniforme. Estrategia: (a) clasificar CBR por tier digital; (b) tier alto = ingestión PDF + parser FNA + validación QR programática; (c) tier bajo = ingestión PDF escaneado + OCR + flag "verificación humana" + posible visita presencial.

## 5. Casos especiales / patologías

### 5.1 Doble inscripción / inscripciones paralelas

Patología registral: dos inscripciones vigentes para el mismo predio sin nota marginal de cancelación cruzada. Causas estructurales (Águila & Cía, *Inscripciones Paralelas en el Derecho Chileno*):
1. **Folio personal** (no real): los registros se ordenan por nombre del titular, no por inmueble. No hay índice físico-único del predio.
2. **Sin catastro unificado**: deslindes descritos textualmente, ambiguos. Predio rústico de "el cerro Huelén con la quebrada al norte..." se superpone con vecino.
3. **Calificación limitada del CBR**: el conservador no verifica realidad material; si el título cita una foja anterior plausible, inscribe.

Detección: comparar deslindes, rol SII, descripción literal en inscripciones de predios colindantes. Jurisprudencia CS aplica doctrina **"posesión integral"**: prevalece quien une inscripción + tenencia material. Inscripción de papel sin tenencia es ineficaz.

Sentencia CS rol **19261-2018** (22-abr-2021, *Forestal Mininco c/ Follador*): refuerza el art. 2505 CC — no hay prescripción extraordinaria contra inmueble inscrito sin título inscrito; protege inscripción registral cuando coincide con posesión material. Es jurisprudencia núcleo para safeguard que detecta superposición.

Art. 92 Reglamento regula cancelaciones que evitan la patología (cancelación expresa por nota marginal cuando se transfiere); cuando el CBR omite la nota, nace inscripción paralela.

### 5.2 Cancelación irregular (art. 728 CC)

Inscripción cancelada sin que la nueva inscripción cumpla los requisitos legales. Resultado: inscripción aparente en cabeza del adquirente que jurídicamente no canceló la antigua. Cuando la nueva se anula judicialmente, la antigua "revive". Detección: nota marginal de cancelación con foja de destino que no existe / no corresponde.

### 5.3 DL 2695 (saneamiento posesión irregular)

Vía administrativa Bienes Nacionales para que poseedor irregular adquiera dominio. Genera inscripción nueva, frecuentemente paralela a inscripción anterior nunca cancelada. Plazo de impugnación de terceros: 1 año. Predios rurales son los más afectados. Si el eslabón en cadena es DL 2695 con < 1 año, alertar.

### 5.4 Conservador de Aguas separado

En zonas con alta presión hídrica (Aconcagua, Petorca, La Ligua, partes de Limarí), el **Registro de Aguas** está físicamente separado del CBR de inmuebles, en una oficina propia o en CBR distinto. Para predios rurales con derechos de agua asociados, la carpeta de títulos del inmueble NO incluye los del derecho de aprovechamiento de aguas — hay que pedirla al Conservador de Aguas correspondiente. SAG y DGA son fuentes complementarias (Catastro Público de Aguas).

Para el scope: en O'Higgins y Maule el Registro de Aguas suele estar dentro del mismo CBR (Rancagua, Talca, Curicó). En zonas pre-cordilleranas RM (San José de Maipo) hay disputas hídricas que requieren chequeo cruzado.

### 5.5 Posesión efectiva trunca

Heredero que vende sin completar las cuatro inscripciones del art. 688 CC. El CBR rechaza la inscripción de la compraventa. Si milagrosamente inscribe (error CBR), el comprador queda en posesión inválida. Safeguard debe exigir cadena completa: PE inscrita → inscripción especial herencia por cada inmueble → adjudicación si hay partición.

## 6. Implicancias para el safeguard

1. **Schema de datos** debe modelar `(cbr_id, registro_tipo, foja, numero, anio, es_vuelta, subinscripciones)`.
2. **Mapeo `comuna → cbr_id`** mantenido como tabla mestra. Comunas escindidas requieren historial: una inscripción de 2010 en Pirque está en CBR Puente Alto, una de 2024 en CBR Pirque.
3. **Cadena ≥ 10 años** mínima; recomendado 15. Cada eslabón validado con copia del título (no solo cita FNA). Detectar gaps temporales > 3 meses entre eslabones (alerta).
4. **Coherencia transversal**: nombre + RUT del comprador del eslabón N debe = vendedor del eslabón N+1. Un mismatch es bandera roja.
5. **Estado de carátula vivo**: chequear repertorio antes de aceptar listing. Si hay título pendiente / observado, riesgo.
6. **Validación FEA programática** cuando el CBR la entrega: extraer QR, pegar al endpoint del CBR, parsear respuesta. Tier bajo: OCR + score humano.
7. **Detección inscripciones paralelas**: cruzar rol SII del predio (Servicio de Impuestos Internos) con titular registral. Si SII paga otro RUT, alerta. Si el CBR tiene índice por inmueble (raro, solo Santiago lo aproxima), aprovechar.
8. **Tipos de eslabón sensibles**: DL 2695 < 1 año, dación en pago < 1 año (riesgo pauliano), adjudicación remate sin certificado de no impugnación, donación sin insinuación, herencia con PE incompleta.
9. **Gravámenes activos**: hipoteca con banco fusionado/liquidado dificulta alzamiento. Prohibición SERVIU vigente bloquea venta.
10. **Manual fallback**: para CBR tier bajo, el safeguard genera checklist humano + pide carpeta presencial con plazo proyectado.

## Fuentes principales

- BCN, [Reglamento del Registro Conservatorio idNorma 255400](https://www.bcn.cl/leychile/navegar?idNorma=255400)
- BCN, [Ley 19.903 posesión efectiva](https://www.bcn.cl/leychile/navegar?idNorma=215613)
- BCN, [Ley 19.799 firma electrónica](https://www.bcn.cl/leychile/Navegar?idNorma=196640)
- BCN, [DL 3516 subdivisión predios rústicos](https://www.bcn.cl/leychile/navegar?idNorma=7155)
- CBR Santiago, [tramites](https://conservador.cl/portal/tramites_registros), [jurisdicción](https://conservador.cl/portal/jurisdiccion), [verificación documentos](https://conservador.cl/portal/verificacion_documentos)
- Águila & Cía, [Inscripciones paralelas](https://www.aguilaycia.cl/post/inscripciones-paralelas-en-el-derecho-chileno) y [Prescripción adquisitiva extraordinaria](https://www.aguilaycia.cl/post/la-prescripci%C3%B3n-adquisitiva-extraordinaria-en-el-derecho-civil-chileno-requisitos-efectos-y-contro)
- Revista Fojas (CBRs Chile), [Calificación registral](http://fojas.conservadores.cl/articulos/consideraciones-relativas-a-la-calificacion-registral)
- Diario Constitucional, [Límites a calificación CBR (CS 2025)](https://www.diarioconstitucional.cl/2025/09/23/corte-suprema-reafirma-limites-a-la-calificacion-registral-del-conservador-de-bienes-raices-y-restringe-su-rechazo-solo-a-casos-de-nulidad-absoluta/)
- Revista Derecho UCN, [Comentario CS rol 19261-2018](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-97532023000100301)
- Conservador Chile (directorio), [conservadorchile.com](https://conservadorchile.com)
