# 16 — Fraudes y casos prensa Chile (2014-2026)

> Audiencia: founder + engineer PropOS. Densidad alta, prosa caveman. Cada caso lleva URL + fecha. Foco: cómo opera el defraudador, cómo lo detectaríamos automáticamente, qué queda fuera del alcance técnico de PropOS.

---

## 0. Marco general

Chile no tiene un torrens system puro: el CBR es declarativo, no constitutivo de fe pública absoluta. Inscripción confiere posesión inscrita (art. 686 CC) pero no sanea vicios del título. Notarios funcionan como gatekeeper de autenticación de identidad y voluntad — pero la ley no obliga a verificación biométrica, ni cruce con Registro Civil en línea, ni a guardar copia escaneada con timestamp inalterable. Resultado: superficie de ataque enorme, repartida entre notaría, CBR, municipalidad (DOM), SII, Bienes Nacionales, CONADI, Registro Civil.

El fraude inmobiliario en Chile no es delito tipificado autónomo. Se persigue por estafa (468 CP), estafa residual (473 CP), apropiación indebida (470 CP), uso malicioso de instrumento público falso (193 CP), suplantación de identidad (214 CP), infracciones LGUC art. 138 bis (loteo brujo). Penas blandas, prescripción 5 años contados desde inscripción CBR (en discusión proyecto que la extiende a 10 cuando hay dolo). Investigación fiscal lenta — el caso Mundo Parcelas tardó tres meses en abrirse después del ROS de la notaría.

---

## 1. Tipologías de fraude — mecánica, detección, automatización PropOS

### 1.1 Suplantación del dueño con cédula falsa ante notario

**Mecánica.** Defraudador estudia propiedad de alto valor poco habitada (segunda vivienda, dueño anciano postrado, residente extranjero). Imprime cédulas falsas con foto del impostor + datos reales del dueño (RUN, nombre, número de serie). Se presenta a notaría con cómplice "compradora" (a veces sociedad recién constituida o palo blanco). Firma escritura de compraventa. Notario o auxiliar autoriza sin verificar biometría ni vigencia en Registro Civil. Repertorio se inscribe en CBR — desde ahí, segundo comprador "de buena fe" ya queda con título posesorio.

**Cómo se detecta.** Tarde. Dueño real se entera al recibir aviso de contribuciones a nuevo titular, o cuando intenta vender. Notarías que detectan en la pre-firma usan luz UV y consulta a www.registrocivil.cl/cedula-vigente — pero no es obligatorio.

**Caso prensa.**
- **Zapallar — terreno 3.000 m² $1.500-1.600 millones.** Notaría Ronchera (10ª de Santiago, también la del caso Mundo Parcelas). Julio 2024. Dos personas se presentaron con cédulas adulteradas haciéndose pasar por los dueños. Operación pre-acordada por correo electrónico. Fiscalía Judicial CA Santiago (mayo 2026) propone sanción/remoción contra la notaria por sistema operativo deficiente: ingreso informal de documentos, cédulas escaneadas, autonomía de funcionarios, falta de supervisión sobre suplente. Fuente: [The Clinic 14-jul-2025](https://www.theclinic.cl/2025/07/14/firmaron-ante-notario-con-cedulas-falsas-y-traspasaron-terreno-de-1-500-millones-en-zapallar-el-metodo-de-estafa-que-abre-dudas-sobre-la-seguridad-notarial/) y [The Clinic 04-may-2026](https://www.theclinic.cl/2026/05/04/fraude-por-suplantacion-la-millonaria-propiedad-de-zapallar-de-3-mil-metros-cuadrados-que-fue-usurpada-en-una-notaria/).
- **Rancagua — dos casas $1.000+ millones.** Notario suplente Felipe Bascuñán (titular Carlos Muñoz Soto), 26ª Notaría Las Condes. 2025. Tres documentos de identidad falsos. Víctima: madre adulta mayor postrada de 78 años + hijo Pablo Sánchez. Fiscalía Metropolitana Oriente, OS9. Fuente: [T13 14-abr-2026](https://www.t13.cl/noticia/nacional/notario-acusado-suplantacion-identidad-venta-irregular-dos-casas-1000-millones-14-4-2026).
- **Caso Rol 7.321-2019 CA Santiago.** Notario delegó autenticación a auxiliar, no verificó visualmente partes ni cédulas. Compraventa maliciosa con suplantación. Condena civil $14M + reajustes. Fuente: [PJUD 4-jun-2021](https://www.pjud.cl/prensa-y-comunicaciones/noticias-del-poder-judicial/57119).

**Magnitud.** Cada caso individualmente $500M-$2.000M. Frecuencia creciente — al menos 3 casos públicos 2024-2026 con notarías de prestigio. Cifra negra alta porque víctimas suelen recuperar vía nulidad civil sin que llegue prensa.

**Automatizable PropOS.** **Parcial.** PropOS puede:
- Cruzar RUN del vendedor en escritura contra API Registro Civil (Floid, Apitude) — vigente / no vigente / fallecido / serie correcta.
- Comparar foto cédula entregada vs registro biométrico (si dueño dio enroll previo).
- Alertar si hay "domicilio en cédula" cambiado en últimos N meses.
- Exigir prueba de vida en video timestamped antes de firma para venta remota.

Lo que NO podemos: forzar al notario a verificar. Si la notaría sigue siendo deficiente operativamente, el fraude se consuma fuera de PropOS. Mitigación: PropOS como pre-DD obligatoria para corredor; reportar inconsistencias antes de que llegue a notaría.

### 1.2 Fraude DL 2.695 — regularización de propiedad ajena

**Mecánica.** DL 2.695 (1979) permite regularizar pequeña propiedad raíz vía Bienes Nacionales acreditando 5 años de posesión material pacífica e ininterrumpida. Defraudador identifica predio cuyo dueño inscrito está ausente (extranjero, fallecido sin posesión efectiva, sucesión sin tramitar). Presenta solicitud administrativa con testigos comprados que firman declaración de posesión material. Bienes Nacionales publica en diarios — si no hay oposición en plazo, dicta resolución que ordena inscripción en CBR a nombre del solicitante. Quedan dos inscripciones paralelas: la histórica + la nueva del DL 2.695, que prescribe en 1 año contra el dueño original.

**Cómo se detecta.** Casi imposible salvo que dueño revise diario regional o monitoree CBR. CS 2022 confirmó que la sola inscripción anterior no impide saneamiento si no se prueba posesión material — una invitación al fraude. Proyecto de ley propone extender prescripción penal a 10 años para quien obtuvo calidad de poseedor regular dolosamente.

**Caso prensa/jurisprudencia.**
- [Diario Constitucional 15-may-2022](https://www.diarioconstitucional.cl/2022/05/15/demandante-pierde-inmueble-al-no-lograr-probar-su-posesion-frente-a-particular-que-lo-saneo-a-traves-del-procedimiento-administrativo-del-dl-n2695-de-1979/) — demandante pierde inmueble al no probar posesión material frente a saneador.
- Discusión doctrinaria scielo: [Rev. Derecho Bienes 2014](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-80722014000100011).

**Magnitud.** No hay cifra agregada pública. Bienes Nacionales tramita ~30.000 saneamientos anuales — % fraudulento desconocido pero >0.

**Automatizable PropOS.** **Sí.** Al detectar inscripción CBR <12-24 meses con título "DL 2.695" o "Resolución Bienes Nacionales", flag rojo automático. Cross-check con CBR histórico (¿hay inscripción previa vigente sin cancelar = paralela?). Verificar que solicitante DL 2.695 = vendedor actual; si vende inmediatamente post-saneamiento, sospechoso. Detectar publicación oposición previa.

### 1.3 Loteos brujos — cesión de derechos sobre predio rural

**Mecánica.** SpA con palo blanco compra predio agrícola 4-9 ha en zona donde subdivisión <0.5 ha está prohibida (LGUC art. 55 + DFL 458). En vez de subdividir y vender lotes (delito LGUC art. 138 bis, hasta 10 años cárcel), se reparten en 50-200 acciones nominativas y se vende un % de acciones a cada "comprador". Comprador no es dueño de un retazo físico sino de cuotas societarias sin garantía registral en CBR. Sociedad luego no entrega servicios, no urbaniza, o vende más acciones que el predio soporta.

**Cómo se detecta.**
- Aviso vago "parcela 5.000 m² $9M" sin dirección precisa, contacto solo por WhatsApp.
- Notarización en ciudad lejana al predio (notario amigo).
- Compradores firman cesión de derechos privada, no escritura de compraventa.
- No hay rol SII propio del lote.
- No hay certificado de informaciones previas (CIP) DOM positivo.

**Caso prensa.**
- **La Ligua / Papudo.** [La Tercera Investigación 2024](https://www.latercera.com/investigacion-y-datos/noticia/como-operan-los-grupos-responsables-de-los-loteos-brujos-en-la-ligua/6RPZDHX35ZBZHPBZIGHII4TPGU/) detalla red Saavedra-Rojas-Hernández-Romero. Compra predio $20-26M, vende 131 cuotas de acciones $3.9M c/u + $200k gastos. >4.000 viviendas irregulares La Ligua, 2.000 Papudo desde 2016. Modus: SpA en Mi Empresa en un Día, palos blancos como representante legal, contacto WhatsApp, notarías alejadas.
- **Punta Arenas — sector Cerro Campana.** Abogado Marcos Ibacache Cortés + 4 cómplices (Millán Mancilla x3, Carrillo Barría). Loteo en zona boscosa donde Ley de Bosques prohíbe lotear. Víctimas: profesora estatal $20M, Mauricio Caro Zapata $10M, ~20-30 más. Fiscal Rina Blanco. Formalización 4-may-2026. Fuente: [La Prensa Austral 30-abr-2026](https://laprensaaustral.cl/2026/04/30/caso-loteos-brujos-fiscalia-pidio-formalizar-al-abogado-ibacache-cortes-por-nueva-presunta-defraudacion/).
- **Pirque.** [Tesis IEUT UC](https://estudiosurbanos.uc.cl/exalumnos/loteos-brujos-en-el-territorio-rural-una-accion-normalizada-por-la-incapacidad-administrativa-y-de-fiscalizacion-del-estado-caso-de-estudio-el-principal-de-pirque/) — caso El Principal, fenómeno normalizado por incapacidad estatal de fiscalización.

**Magnitud.** Estudios académicos estiman >50.000 lotes brujos vigentes en zona central. Ley 21.461 (2022) "Devuélveme mi casa" + proyecto loteos brujos aún en trámite — no resuelven backlog.

**Automatizable PropOS.** **Sí, alto valor.** Detectar:
- Vendedor es SpA con <2 años de constitución, capital nominal, dirección genérica.
- "Cesión de derechos" en lugar de "compraventa" en documento.
- Sin rol SII individual del lote (solo el rol madre del predio matriz).
- Inscripción CBR del vendedor original es de gran predio (>0.5 ha), no del retazo prometido.
- Notaría de firma en comuna distinta al predio.
- Comuna del predio en lista negra: La Ligua, Papudo, Cabildo, Pirque, El Monte, Olmué.
- DOM no emite CIP favorable (cruce por API municipal o webscraping).

### 1.4 Doble venta art. 686 CC

**Mecánica.** Vendedor firma escritura de compraventa con comprador A pero retrasa o evita inscripción en CBR. Antes de que A inscriba, vendedor firma segunda escritura con comprador B. B inscribe primero. Por art. 686 + 1817 CC, B es dueño inscrito; A queda con acción personal contra el vendedor (insolvente o desaparecido). Variante: ambos compradores corren a CBR mismo día — gana el de menor número de Repertorio.

**Cómo se detecta.** Ventana entre firma y inscripción es la zona muerta. Si A no anota preventivamente la demanda o no inscribe en <48h, queda expuesto.

**Caso prensa/jurisprudencia.**
- Análisis penal: [TuAbogadoInmobiliario](https://www.tuabogadoinmobiliario.com/blog/vertiente-penal-de-la-doble-venta-inmobiliaria) — vertiente penal estelionato.
- Caso Eurolatina (CS 2013) tuvo elementos de doble disposición vía hipoteca-compraventa fraudulenta. [La Tercera 2013](https://www.latercera.com/noticia/caso-eurolatina-suprema-condena-a-hermanos-elgueta-por-los-delitos-de-usura-y-estafa/), [DF](https://www.df.cl/empresas/actualidad/caso-eurolatina-corte-suprema-dicta-condena-por-delitos-de-usura-y-estafa).

**Magnitud.** Subreportada — la mayoría se resuelve civilmente con el comprador perdedor demandando al vendedor.

**Automatizable PropOS.** **Sí.** Monitorear Repertorio CBR diariamente para inmuebles bajo gestión PropOS: detectar nuevas anotaciones del mismo predio entre firma de promesa y firma de definitiva. Al firmar promesa, exigir anotación marginal o caución. Alertar si CBR muestra solicitud de inscripción pendiente del mismo Rol con titular distinto.

### 1.5 Hipoteca oculta sin alzar

**Mecánica.** Vendedor pidió crédito hipotecario, lo pagó pero no tramitó alzamiento (responsabilidad del banco desde 2016 — frecuentemente no lo hace). O peor: hipoteca está vigente y vendedor oculta el certificado de gravámenes. Comprador inscribe a su nombre pero la hipoteca lo persigue (art. 2428 CC, derecho de persecución del acreedor). Variante moderna: hipoteca a través de financiera tipo Eurolatina con cláusula de mutuo abusiva.

**Cómo se detecta.** Certificado de hipotecas y gravámenes (CHG) emitido por CBR. Pero algunas hipotecas convencionales se inscriben en otro CBR (hipoteca en banco con domicilio Santiago sobre inmueble Pucón). Comprador desprevenido pide CHG solo en CBR de la propiedad.

**Caso prensa.**
- **Eurolatina (Elguetas).** Sistema 1993-2000: préstamos $500k-$3M tasas usurarias con cláusula que hipotecaba la casa. Cientos de familias perdieron su vivienda. CS condenó hermanos Elgueta por usura y estafa, 5 años + 1 día, mayo 2013. [La Tercera](https://www.latercera.com/noticia/caso-eurolatina-suprema-condena-a-hermanos-elgueta-por-los-delitos-de-usura-y-estafa/), [Microjuris](https://aldiachile.microjuris.com/2013/05/02/corte-suprema-dicta-condena-por-delitos-de-usura-y-estafa-en-caso-eurolatina/), [CIPER 2013](https://www.ciperchile.cl/2013/05/09/las-reglas-del-mercado-que-cambian-con-los-fallos-de-la-corte-suprema-contra-eurolatina-y-cencosud/), [Archivo 24 Horas](https://www.24horas.cl/nacional/archivo-24-eurolatina-la-estafa-que-dejo-sin-casa-a-cientos-de-familias-a-10-anos-de-la-detencion-de-los-hermanos-elgueta-5028304).
- **Eurolatina 3.0** — DF reportó financieras irregulares replicando esquema con préstamos a través de garantías hipotecarias. [DF](https://www.df.cl/empresas/banca-instituciones-financieras/eurolatina-3-0-financieras-irregulares-dan-prestamos-a-traves-de).

**Magnitud.** Eurolatina: >800 familias afectadas. Schema replicado vigente.

**Automatizable PropOS.** **Sí.** Pedir CHG actualizado <30 días al emisor real (CBR de la propiedad). Cross-check CMF deudas vendedor + lista CMF financieras autorizadas vs acreedor de hipoteca inscrita. Si acreedor no es banco autorizado CMF y monto > 30% avalúo, flag alto. Alzamiento pendiente >12 meses tras pago = pedir certificado banco. Detección OCR de clausulas usurarias en escritura de mutuo si la conseguimos.

### 1.6 Posesión efectiva trucha — heredero falso

**Mecánica.** Causante fallece. Heredero falso (cónyuge no reconocido, hijo extramatrimonial inventado, peruano con filiación reconocida fraudulentamente) tramita posesión efectiva intestada en Registro Civil omitiendo herederos legítimos. Registro Civil no investiga, solo registra lo declarado. PE inscrita habilita inscripción especial de herencia en CBR a nombre del falso heredero, que luego vende a tercero "de buena fe".

**Cómo se detecta.** Vía acción de petición de herencia (art. 1264 CC) — verdadero heredero contra falso. Prescribe en 10 años (5 si falso es heredero putativo con buena fe). Mientras tanto, propiedad puede haberse transferido varias veces.

**Caso prensa/jurisprudencia.**
- **CA Arica 2024.** Mujer peruana reconocida como heredera vía filiación fraudulenta — causante nunca tuvo movimientos migratorios que permitieran ser su padre. Condena por uso malicioso de instrumento privado mercantil falso. [Diario Constitucional 14-jul-2024](https://www.diarioconstitucional.cl/2024/07/14/rechazar-solicitud-de-rectificacion-de-posesion-efectiva-intestada-para-eliminar-a-heredera-cuya-filiacion-fue-obtenida-de-manera-fraudulenta-vulnera-el-derecho-de-propiedad-de-los-legitimos-heredero/).
- Doctrina UDD: [Mendoza & Munita 2019](https://derecho.udd.cl/noticias/2019/12/sobre-la-mutacion-de-la-calidad-de-verdadero-heredero-a-la-de-heredero-putativo-por-pamela-mendoza-y-renzo-munita/).

**Magnitud.** Registro Civil no publica estadística. Estimación de abogados sucesorios: 3-7% de PE intestadas tienen herederos no declarados.

**Automatizable PropOS.** **Parcial.** Cruzar:
- Posesión efectiva intestada inscrita CBR <24 meses + venta inmediata por heredero único = flag.
- Causante hombre + heredera única declarada como hija pero filiación inscrita post-fallecimiento = flag.
- Causante con cónyuge sobreviviente registrada vs declaración de heredero único = inconsistencia.
- Búsqueda en publicaciones legales (Diario Oficial, defunciones.cl) si hay otros que reclamaron.

PropOS no resuelve si herederos legítimos no aparecen en sistemas — esos son los más difíciles.

### 1.7 CONADI — tierras indígenas vendidas a no-indígenas con apellido prestado

**Mecánica.** Ley 19.253 art. 13: tierras indígenas son inalienables, inembargables, imprescriptibles, no pueden gravarse ni adquirirse por no-indígenas. Para evadir: matrimonio express con persona indígena → adquiere calidad indígena → divorcio rápido reteniendo tierra. O usar apellido aparentemente indígena (Huenchumán, Catrileo) prestado, sin acreditar calidad. CONADI debiera verificar pero registro y fiscalización débiles.

**Cómo se detecta.** Auditoría CONADI 2014 detectó 15 casos de irregularidades en compras de tierras 2011-2013, $10.000M en posibles fraudes al Fisco vía licitaciones.

**Caso prensa.**
- **CONADI 2014.** Director Alberto Pizarro Chañilao denunció fraude $10.000M. [Emol 26-may-2014](https://www.emol.com/noticias/nacional/2014/05/26/662103/detectan-fraude-al-fisco-y-serie-de-irregularidades-al-interior-de-la-conadi.html), [El Mostrador](https://www.elmostrador.cl/noticias/pais/2014/05/26/director-de-conadi-denuncia-posible-fraude-al-fisco-por-10-mil-millones-en-licitaciones-durante-administracion-de-pinera/), [Radio U Chile](https://radio.uchile.cl/2014/05/27/director-de-conadi-denuncia-eventual-fraude-en-compra-de-tierras/), [LyD](https://lyd.org/centro-de-prensa/noticias/2014/05/denuncia-de-irregularidades-en-compra-de-tierras/).
- **Matrimonios express + abogados/notarios.** Esquema documentado en region IX para obtener subsidio CONADI o pasar como indígena. Mismo reporte CONADI 2014.
- **Comunidad Tomas Cañicul, Lican Ray.** Apropiación de tierras vía engaños. [Resumen Latinoamericano 23-jul-2021](https://www.resumenlatinoamericano.org/2021/07/23/nacion-mapuche-lican-ray-comunidad-tomas-canicul-denuncio-fraudulento-apropiamiento-de-sus-tierras-por-particulares-a-traves-de-enganos/).
- **Longueira jefe gabinete Min. Desarrollo Social compró tierras indígenas.** [CIPER 6-jun-2019](https://www.ciperchile.cl/2019/06/06/juan-pablo-longueira-las-tierras-indigenas-que-compro-el-jefe-de-gabinete-del-ministro-de-desarrollo-social/).

**Magnitud.** $10.000M solo en período 2011-2013 según CONADI. Backlog histórico mayor.

**Automatizable PropOS.** **Sí, parcial.** Cruce:
- Predio inscrito en Registro Público de Tierras Indígenas (CONADI) → bloquear venta a comprador sin acreditación.
- Vendedor adquirió calidad indígena <2 años antes de la venta vía matrimonio + divorcio rápido → flag.
- Apellido del vendedor no es evidentemente indígena → exigir certificado calidad CONADI.
- Predio en zonas indígenas (IX, XIV, X, II, XV, área de subsidio art. 20) → flag automático.

### 1.8 Concesión marítima vendida como dominio

**Mecánica.** Concesión marítima sobre playa, terreno de playa, fondo de mar es derecho personal otorgado por SSFFAA (no Bienes Nacionales). No es dominio, no se inscribe en CBR. Defraudador construye en concesión, "vende" mediante cesión del derecho de concesión + escritura ambigua que el comprador entiende como compraventa de inmueble. Comprador descubre que no es dueño, no puede heredar libremente, concesión vence en X años o se revoca por incumplimiento.

**Cómo se detecta.** Concesión figura en Portal Concesiones SSFFAA, no en CBR. Si "vendedor" no exhibe inscripción CBR del bien matriz sino solo decreto de concesión, alerta.

**Caso prensa.** Sin caso emblemático en mi búsqueda, pero documentado en [SSFFAA Portal Concesiones](https://portalconcesiones.ssffaa.cl/CCMM) y reglamento DS 9 / 2018. Ver también [Scielo análisis](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-00122020000300045) sobre oposiciones.

**Magnitud.** Subreportada. Alta en costas Pichilemu, Cachagua, Maitencillo donde construcciones playeras venden con título dudoso.

**Automatizable PropOS.** **Sí.** Cruzar dirección/coordenadas con Portal Concesiones SSFFAA. Si predio dentro de 80 m de la línea de más alta marea + sin rol SII propio + título de venta es "cesión" o "transferencia" → flag concesión marítima. Verificar plazo restante de concesión.

### 1.9 Promesa privada sin escriturar — parcelas en verde

**Mecánica.** Promesa de compraventa privada (no escritura pública) por predio que el "vendedor" todavía no es dueño o no ha subdividido. Comprador paga 30-100% del precio. Vendedor invierte en otro proyecto, no entrega, desaparece o incumple plazos. Sin escritura pública no hay anotación CBR, no hay garantía real, comprador es acreedor común concursal si la SpA quiebra. Variante con reintegro parcial via partial deposit y amenazas legales para silenciar.

**Caso prensa — el grand slam de 2025.**
- **Mundo Parcelas / Agroparcelas / Costa del Sol / Megaterrenos / Elige Tu Terreno.** Empresas controladas por mismo grupo. >3.000 contratos firmados nov 2020-abr 2025. Ingresos >$1.300M. ~400 denunciantes, ≥38 querellas. Notaría 10ª Santiago (Valeria Ronchera) emitió ROS a UAF 27-sep-2024 por 30 operaciones sospechosas, incluyendo venta de 15 empresas sin movimientos tributarios por $280M en un solo día. Fiscalía recién supo en diciembre 2024 (3 meses de lag). Sernac pidió orden de arresto contra rep legal dic-2024 + denuncia mar-2025. [CIPER 15-sep-2025](https://www.ciperchile.cl/2025/09/15/caso-mundo-parcelas-una-notaria-reporto-a-la-uaf-posibles-delitos-en-venta-masiva-de-terrenos-pero-la-fiscalia-no-fue-alertada/), [Sernac](https://www.sernac.cl/portal/604/w3-article-84250.html), [Sernac arresto](https://www.sernac.cl/portal/604/w3-article-83637.html), [BioBio 7-mar-2025](https://www.biobiochile.cl/noticias/economia/negocios-y-empresas/2025/03/07/parcelas-en-verde-denuncian-presuntas-estafas-en-venta-de-terrenos-tras-cien-reclamos-en-sernac.shtml), [CNN Chile 8-mar-2025](https://www.cnnchile.com/pais/sernac-presenta-denuncia-fiscalia-presuntas-estafas-venta-terrenos-han-recibido-mas-100-reclamos_20250308/).
- **Inversiones Latam.** 14 proyectos en sur. 143+ denunciantes Cochamó/Puelo/Chiloé. Mario Alegría (gerente comercial), Isaías Krause. Promesas de infra (canchas, piscina, senderos). Amenazas legales a víctimas que hablaron en redes. Fiscalía Puerto Montt + BRIDEC PDI. [BioBio 27-mar-2025](https://www.biobiochile.cl/noticias/nacional/chile/2025/03/27/143-personas-denuncian-estafa-por-parcelas-en-chiloe-nunca-entregadas-empresa-respondio-con-amenazas.shtml), [Reporte Diario](https://reportediario.cl/2025/03/27/inversiones-latam-promesas-incumplidas-y-amenazas-a-clientes-defraudados/), sitio víctimas [afectadosparcelas.cl](https://afectadosparcelas.cl/).
- **Bosque de Los Nevados — Pucón.** Mismo grupo Inversiones Latam. 7 querellas en un mes (jul-ago 2025) + 12 personas con monto >$170M (feb 2026). Fiscalía Pucón + Unidad Delitos Económicos. [La Voz de Pucón 4-ago-2025](https://www.lavozdepucon.cl/2025/08/04/escandalo-por-parcelas-en-el-sur-se-traslada-a-pucon-van-siete-querellas-en-el-ultimo-mes-por-terrenos-sin-entregar-en-los-nevados/), [BioBio 3-feb-2026](https://www.biobiochile.cl/noticias/nacional/region-de-la-araucania/2026/02/03/millonarios-anticipos-y-cero-parcelas-afectados-se-querellan-contra-inmobiliaria-por-estafa-en-pucon.shtml).

**Automatizable PropOS.** **Sí, alto.** Detectar:
- Vendedor SpA <3 años, capital nominal, sin movimientos tributarios SII.
- Promesa privada sin escritura pública.
- Predio matriz no subdividido (rol SII único) pero promesa habla de "lote N°".
- Ratio anticipo vs avalúo fiscal >50% sin garantía real.
- Notaría no es la del CBR competente.
- Búsqueda nombre empresa en cl-noticias / Sernac open data → reclamos previos.

### 1.10 Ampliaciones sin permiso vendidas como recibidas

**Mecánica.** Casa con ampliación construida sin permiso DOM y sin recepción final. Vendedor declara superficie total construida (incluyendo ampliación) en aviso y escritura. Comprador asume metros válidos. Después: banco castiga tasación de m² sin permiso, municipalidad puede ordenar demolición, multa 1-300 UTM, recargo 100% sobre derechos. Si la ampliación viola coeficiente de constructibilidad o rasante, no hay regularización posible.

**Caso prensa.**
- **CS condena inmobiliaria por publicidad engañosa — ampliación que no podía autorizarse por exceder coeficiente constructibilidad.** $10M por departamento. [Diario Constitucional 24-jul-2025](https://www.diarioconstitucional.cl/2025/07/24/corte-suprema-condena-a-inmobiliaria-por-publicidad-enganosa-debera-pagar-10-millones-por-cada-departamento/).

**Automatizable PropOS.** **Sí, fuerte.** Cross-check m² declarados SII vs m² escritura vs imagen satelital reciente (Google Earth historical, Mapbox, sentinel-hub). Si imagen muestra construcción ≥10% mayor que la declarada SII → flag. Verificar permiso DOM (algunas comunas tienen API/portal). Verificar recepción final municipal.

---

## 2. Estafas famosas última década — repaso rápido

| Caso | Año(s) | Modus | Magnitud | Sentencia |
|------|--------|-------|----------|-----------|
| Eurolatina | 1993-2000 | Préstamos usurarios con hipoteca encubierta | >800 familias, cientos de propiedades | CS 2013, Elgueta hermanos 5y+1d |
| 13 inscripciones falsificadas CBR Stgo | 2013-2015 | Lavado químico páginas, sellos preservados | 13 hojas, 5 fraudes consumados; caso emblemático Quilicura $565M ($290M girados Itaú) | [CIPER 18-feb-2015](https://www.ciperchile.cl/2015/02/18/detectan-13-inscripciones-falsificadas-en-los-libros-del-conservador-de-bienes-de-santiago/), [La Tercera demandas $223M vs CBR](https://www.latercera.com/noticia/inscripciones-falsas-demandan-por-223-millones-a-conservador-de-bienes-raices/) |
| CONADI fraude licitaciones | 2011-2013 | Negociación incompatible, tráfico influencias | $10.000M | Investigación Pizarro, judicialización parcial |
| Caso Mundo Parcelas | 2020-2025 | Promesas en verde, palos blancos, lavado UAF | $1.300M+ ingresos, 400 víctimas | Fiscalía investigando |
| Inversiones Latam | 2020-2026 | Parcelas en verde, amenazas a víctimas | $170M+ Pucón solo, 143+ Chiloé | Fiscalías Puerto Montt + Pucón |
| Loteo brujo La Ligua | 2016-2024 | SpA + cesión acciones + palos blancos | >4.000 viviendas irregulares | Investigación Fiscalía Valparaíso |
| Loteo brujo Cerro Campana | ~2020-2025 | Loteo zona boscosa prohibida | $30M+ víctimas conocidas | Formalización 2026 |
| Zapallar suplantación | 2024-2026 | Cédulas falsas notaría Ronchera | $1.500M | Fiscalía Judicial CA Stgo evaluando sanción notaria |
| Rancagua suplantación | 2024-2025 | Cédulas falsas notaría Las Condes | $1.000M | Fiscalía Met Oriente investigando |
| Caso Rol 7.321-2019 | 2019-2021 | Notario delegó autenticación | $14M | Condena civil notario CA Stgo |
| Ibacache Punta Arenas | 2024-2026 | Loteo zona bosques | $30M+ víctimas | Formalización mayo 2026 |

---

## 3. Sernac y stats oficiales 2024-2026

- **Sernac Mar 2025:** >100 reclamos parcelas → derivó a Fiscalía denuncia formal contra Agroparcelas / Mundo Parcelas / Costa del Sol / Megaterrenos / Elige Tu Terreno. [Sernac 84250](https://www.sernac.cl/portal/604/w3-article-84250.html).
- **Sernac dic 2024:** Solicitó orden de arresto rep legal por incumplimiento de plazos. [Sernac 83637](https://www.sernac.cl/portal/604/w3-article-83637.html), [Meganoticias 6-dic-2024](https://www.meganoticias.cl/nacional/468862-sernac-orden-arresto-representante-legal-agroparcelas-mundo-parcelas-inmobiliarias-brk-06-12-2024.html).
- **Sernac nov 2025:** Pide explicaciones a inmobiliaria por viviendas incompletas con altos anticipos. [BioBio 12-nov-2025](https://www.biobiochile.cl/noticias/economia/consumidor/2025/11/12/sernac-pide-explicaciones-a-inmobiliaria-clientes-pagaron-altos-adelantos-por-viviendas-incompletas.shtml).
- **Quiebras inmobiliarias 2024:** 16 empresas en quiebra + 4 reorganizándose en sector. [DF](https://www.df.cl/empresas/construccion/inmobiliarias-reciben-el-impacto-de-la-crisis-en-la-construccion). Compradores con promesas firmadas pasan a acreedores comunes.

---

## 4. 20+ red flags concretos accionables PropOS

Cada uno mapeable a un check automatizable. Severidad H/M/L.

| # | Red flag | Severidad | Fuente datos |
|---|---|---|---|
| 1 | Cédula del vendedor: estado ≠ "vigente" en RC | H | API RC (Floid/Apitude/RC) |
| 2 | Vendedor figura como fallecido en RC | H | API RC |
| 3 | Domicilio en cédula cambiado <90 días vs aviso | M | API RC + aviso |
| 4 | Cesión de derechos privada (no escritura pública) | H | OCR contrato |
| 5 | Inscripción CBR del título <6 meses + precio >2× avalúo | H | CBR + SII |
| 6 | Inscripción DL 2.695 <12 meses sobre el dominio | H | CBR título |
| 7 | Posesión efectiva <24 meses + heredero único + venta inmediata | H | CBR + RC defunciones |
| 8 | Múltiples solicitudes Repertorio CBR mismo Rol últimos 30 días | H | CBR Repertorio |
| 9 | RUT vendedor ≠ titular inscrito CBR (sin POE/cesión válida) | H | CBR + RUT |
| 10 | Avalúo SII subido >40% últimos 6 meses sin reavalúo oficial | M | Histórico SII |
| 11 | M² imagen satelital >10% mayores que SII | M | Google Earth/Sentinel + SII |
| 12 | Vendedor SpA <2 años, capital nominal, 0 movimientos SII | H | SII + ME1Día |
| 13 | Predio rural <0.5 ha sin certificado subdivisión SAG | H | SAG + DOM |
| 14 | Predio en lista negra comuna (La Ligua, Papudo, Pirque, ...) | M | Tabla interna |
| 15 | Notaría firma en comuna ≠ comuna del predio + ≠ domicilio vendedor | M | Notaría + dirección |
| 16 | CHG con hipoteca vigente acreedor no-CMF | H | CBR CHG + CMF lista |
| 17 | Acreedor hipotecario es sociedad SpA o persona natural >$30M UF | M | CBR + análisis acreedor |
| 18 | Predio en Registro Tierras Indígenas CONADI + comprador sin acreditación | H | CONADI |
| 19 | Predio dentro de 80m línea costa + sin rol SII propio | H | Geocoding + SII + SSFFAA |
| 20 | Vendedor adquirió calidad indígena <2 años antes de venta | M | CONADI histórico |
| 21 | Contacto solo WhatsApp + sin oficina física verificable | M | Webscraping aviso |
| 22 | Aviso sin dirección precisa o solo sector | L | Parsing aviso |
| 23 | Vendedor con denuncia previa Sernac (cruzar nombre) | H | Sernac open data |
| 24 | Vendedor / SpA nombrada en prensa por estafa (cruzar) | H | Newscrawl |
| 25 | UAF: notaría reportó ROS sobre vendedor (no público pero podemos firmar convenio) | H | UAF si convenio |
| 26 | Promesa con anticipo >30% sin escritura pública ni garantía real | H | OCR contrato |
| 27 | Construcción visible Google Maps no aparece en SII | M | Visión + SII |
| 28 | Ratio precio venta / avalúo fiscal <0.5 (¿lavado?) o >5 (sospechoso) | M | Comparable |

---

## 5. Tooling adicional sugerido para PropOS

1. **API Registro Civil cédula vigente.** Floid, Apitude, ImpishWorks. Verifica estado vigente / fallecimiento. ~CLP $20-80 por consulta. [Floid](https://www.floid.io/servicios/api-registro-civil), [Apitude](https://apitude.co/es/docs/services/identity-cl/).
2. **Reverse image satelital.** Google Earth Engine + Sentinel-2 + Mapbox histórico para detectar construcciones no declaradas. Diff temporal cada 6 meses sobre cartera.
3. **ML anomalía precio.** Modelo ridge / xgboost con features avalúo fiscal, m², comuna, distancia a comparables. Z-score >2.5 → flag. Entrenar con CBR scrapeado + portales.
4. **Whois RUT empresas zombie.** Cruce SII (movimientos, declaraciones), Diario Oficial (constituciones, modificaciones), CMF (multas), Mi Empresa en un Día (actualidad). Score zombi: 0 movimientos + capital nominal + edad <3 años.
5. **CMF deudas vendedor.** Boletín CMF + DICOM (vía partner). Vendedor sobreendeudado → riesgo de venta apurada con vicios.
6. **Cross-check Repertorio CBR diario.** Webscraping CBR Stgo (conservador.cl) + integraciones regionales. Para cada inmueble bajo gestión, alertar nuevas anotaciones.
7. **OCR + LLM contrato.** Parser de promesa/escritura/cesión que extrae cláusulas usurarias, ambigüedad sobre objeto, plazos imposibles, montos en USD vs CLP.
8. **Newscrawl.** Crawler diario de t13, biobiochile, latercera, ciperchile, eldinamo, eldesconcierto, emol, df, theclinic, prensa regional. Indexar nombres de personas + RUT/SpA mencionados como imputados, formalizados, querellados. Cruce con vendedor / corredor / notario de operación.
9. **Sernac open data.** Sernac publica reclamos por proveedor — cruce nombre comercial, RUT.
10. **DOM municipal.** APIs municipales (sólo algunas: Las Condes, Providencia). Resto via webscraping o gestor.

---

## 6. Limitaciones — lo que PropOS NO puede prevenir

1. **Suplantación notarial profesional.** Si la notaría es deficiente y autoriza con cédula falsa de buena calidad sin verificar biometría, el fraude se consuma fuera de PropOS. Mitigación parcial: PropOS exige flujo pre-firma con prueba de vida + biometría enrolada por el dueño, pero requiere que dueño use PropOS desde la titulación inicial.
2. **Conspiración con notario corrupto.** Si el notario es cómplice (no solo negligente), firma falsa de "comparecencia personal" cuando dueño nunca asistió. PropOS no puede detectar firma falsa en escritura pública desde fuera salvo cross-check con video presencia.
3. **Conspiración con conservador.** 13 inscripciones falsificadas CBR Stgo demostraron que el libro físico puede adulterarse con químicos. PropOS depende de la integridad del CBR — si el dato fuente está adulterado, las queries devuelven el dato falso. Mitigación: snapshots periódicos hash-firmados, alerta cuando inscripción cambia retroactivamente.
4. **Precio depredador no-fraude.** Vendedor con apuro vendiendo bajo precio o comprador sobre-pagando por gusto no es fraude — pero ML los marca. Falsos positivos ineliminables.
5. **Promesa privada en mercado informal.** Mercado rural informal compra/vende con cesión de derechos a sabiendas. PropOS puede advertir pero no impedir si las partes consienten.
6. **Cambios legales retroactivos.** Sentencias de nulidad llegan años después. PropOS opera ex-ante; no puede deshacer una inscripción válida que después se anule.
7. **Lavado de activos sofisticado.** Estructuras offshore / trust que blanquean origen del dinero del comprador no son detectables sin acceso UAF/SII confidencial. PropOS puede señalar el patrón pero no probarlo.
8. **Ineficiencia fiscal.** Aun detectando fraude, fiscalía tarda meses-años en formalizar. PropOS reporta, no acelera el aparato penal.
9. **Sin enrol previo del dueño.** Para los flags de identidad y biometría, PropOS necesita que el dueño legítimo se haya enrolado antes. Para predios donde el primer contacto es el vendedor falso, no hay baseline contra qué comparar.
10. **Datos no digitalizados.** CBR regionales con libros pre-2000 manuscritos. APIs incompletas. Cobertura de PropOS desigual por región.

---

## 7. Sumario para founder + engineer

PropOS debe diseñar el motor anti-fraude como pipeline de scoring multi-fuente con tres tiers:
- **Tier 1 — Blocking (datos públicos baratos):** validación cédula RC, CBR título, SII rol/avalúo, SAG subdivisión, CONADI tierra indígena, SSFFAA concesión.
- **Tier 2 — Riesgo elevado (datos de pago):** Floid/Apitude biometría, CMF deudas, DICOM, UAF (si convenio), Sernac open data crawl.
- **Tier 3 — Inteligencia (custom):** newscrawl prensa, ML precio, satellite diff, OCR contratos, scoring zombi de SpA.

Casos como Mundo Parcelas o Inversiones Latam habrían disparado **Tier 1 + Tier 3** (SpA reciente sin movimientos, predio matriz único sin subdivisión, prensa con denuncias previas). Casos como Zapallar/Rancagua suplantación habrían disparado **Tier 2** (biometría y validación cédula) si la notaría hubiera usado PropOS. Casos como CBR-Quilicura solo se detectan con **Tier 3 + integridad CBR** (snapshots).

---

## Anexos — fuentes prensa adicionales

- [La Tercera — loteos brujos nueva ley](https://www.latercera.com/pulso/noticia/loteos-brujos-la-nueva-ley-espera-ordenar-las-zonas-rurales-del-pais/333349/)
- [Pirque municipal](https://www.pirque.cl/loteos-brujos-el-gran-fraude-que-afecta-a-las-comunas-rurales/)
- [La Tribuna 12-mar-2024 loteos brujos](https://www.latribuna.cl/cronica-ciudadana/2024/03/12/que-son-los-loteos-brujos-y-cuales-son-los-peligros-de-comprar-terrenos-irregulares-en-chile.html)
- [Bienes Nacionales — loteo irregular](https://www.bienesnacionales.cl/que-es-un-loteo-irregular/)
- [La Ligua municipal — cesión derechos](https://www.comunadelaligua.cl/cesion-o-venta-de-derechos-evite-fraudes-y-enganos/)
- [El Rancagüino 26-jul-2025 fraudes inmobiliarios](https://www.elrancaguino.cl/2025/07/26/fraudes-inmobiliarios-cuando-el-sistema-mira-hacia-otro-lado/)
- [Sepúlveda y Escudero — fraude inmobiliario](https://www.sepulvedayescudero.cl/english/wp-content/uploads/2019/12/rvpdf2-A.pdf)
- [Estudio Camus estafas](https://estudiocamus.cl/abogados-compraventa/estafas-inmobiliarias/)
- [Diario Financiero Eurolatina 3.0](https://www.df.cl/empresas/banca-instituciones-financieras/eurolatina-3-0-financieras-irregulares-dan-prestamos-a-traves-de)
- [BioBio Investigación Megatime/Traverso 7-abr-2026](https://www.biobiochile.cl/especial/bbcl-investiga/noticias/articulos/2026/04/07/de-traverso-a-megatime-el-patron-judicial-que-hoy-tensiona-causas-por-administracion-desleal.shtml)
- [Diario Constitucional reavaluo](https://www.diarioconstitucional.cl/2026/01/30/tribunal-tributario-acoge-reclamo-por-reavaluo-fiscal-y-ordena-recalcular-avaluo-de-departamento-en-pinto/)
- [Herencias en Chile — anular PE](https://herenciasenchile.cl/se-puede-anular-una-posesion-efectiva/)
- [Carta involucrados Mundo Parcelas + respuesta CIPER 20-sep-2025](https://www.ciperchile.cl/2025/09/20/carta-de-los-involucrados-en-el-caso-mundo-parcelas-y-respuesta-de-ciper/)
