# 07 — Casos raros y extremos

> Mismo formato que 06. Glosario adicional:
> - **DL** = Decreto Ley.
> - **DGA** = Dirección General de Aguas.
> - **CMN** = Consejo de Monumentos Nacionales.
> - **CONADI** = Corporación Nacional Desarrollo Indígena.
> - **MBN** = Ministerio Bienes Nacionales.
> - **SAG** = Servicio Agrícola y Ganadero.
> - **DGTM** = Dirección General Territorio Marítimo (Armada).
> - **SBAP** = Servicio Biodiversidad Áreas Protegidas (Ley 21.600).
> - **DUP** = Declaración Utilidad Pública.

Estos casos son menos frecuentes pero **catastróficos** si pasan filtro pre-listing. Énfasis en RM, O'Higgins (Rancagua, Machalí), Maule (Talca, Curicó) — predios vitivinícolas/agrícolas/parcelas frecuentes.

---

## 1. Doble inscripción / títulos paralelos

**Qué es**. Mismo predio (o porción) tiene dos cadenas inscritas paralelas en CBR — fenómeno conocido como "inscripciones paralelas" o "superposición de predios". Causas: error CBR antiguo, fraude, saneamientos DL 2.695 sobre inmueble ya inscrito, deslindes mal copiados. Conflicto típico: poseedor material con título saneado vs titular inscrito tradicional.

**Detección**. (a) Estudio título 30+ años buscando inscripciones que apunten a la misma cabida. (b) **Inspección topográfica** + cruce con catastro SII + planos colindantes. (c) Buscar antecedente común en planos CBR (búsqueda transversal por nombre causahabiente o referencia FNA).

**Remedio**. Vía judicial — acción reivindicatoria, nulidad, o ambas. **Jurisprudencia clave**: CS rol **19261-2018** sentencia 22-abr-2021 (caso *Forestal Mininco con Follador*). Criterio: la CS revirtió fallo apelaciones y privilegió la **inscripción** (registro) sobre el poseedor material que invocaba prescripción extraordinaria contra título inscrito. Lectura: doble inscripción → gana el primer inscrito de cadena legítima, no el saneamiento posterior. Comentario académico SciELO 2023.

**Tiempo y costo**. Juicio = 2-6 años, $5-30MM honorarios + peritajes.

**Flag**. 🔴 Red.

**Automatización**. Parcial. Sistema detecta superposición geo si tiene polígonos georreferenciados de inscripciones; humano + abogado decide.

---

## 2. Tierras indígenas Ley 19.253 art 13 (nulidad absoluta venta a no-indígena)

**Qué es**. Ley 19.253 art 13: tierras indígenas (definidas art 12 — pueden ser **rurales o urbanas**, criterio funcional según CS 2025) **no pueden ser enajenadas, embargadas ni adquiridas por prescripción**, excepto entre indígenas de la misma etnia, o permuta con terreno no indígena de igual valor autorizada CONADI. Sanción = **nulidad absoluta** (ratificada CS junio-2025 caso Panguipulli, restitución predio). Saneamiento = 10 años.

**Detección**. (a) Cruzar inmueble con **Registro Público de Tierras Indígenas CONADI**. (b) Verificar antecedentes calidad indígena del causahabiente (cédula con apellido + comuna ancestral mapuche/aymará/atacameño/etc). (c) Si predio adquirido vía título de merced, comisariato, decreto Ley 17, etc → flag automático. (d) Atención calificación retroactiva: CS aplica criterio funcional, inmueble urbano puede ser tierra indígena.

**Remedio**. Si calidad indígena confirmada → comprador debe ser indígena misma etnia o permuta CONADI. Si venta nula consumada → restitución + sin indemnización al comprador no indígena (mala fe presumida si CONADI tenía registro).

**Tiempo y costo**. Imposible normalizar para venta a no indígena salvo permuta autorizada (12-24 meses CONADI).

**Flag**. 🔴 Red total.

**Automatización**. Parcial. Cruce CONADI Registro Público; humano valida etnia comprador.

**Zonas**: aplica baja en RM/O'Higgins/Maule pero ojo con predios cordillera/precordillera con antecedente comunidad pehuenche o Maule sur.

---

## 3. Bienes nacionales / fiscales (transferencias gratuitas con destinación + cláusulas resolutorias)

**Qué es**. MBN transfiere gratis inmueble fiscal a entidad pública o particular calificado (junta vecinos, ONG, municipalidad). **Prohibición enajenar 5 años** mínimo desde inscripción, salvo autorización ministerial. Algunas transferencias tienen **cláusula resolutoria con reversión al Fisco** si destino no se cumple (escuela, hospital, parque) o si se cambia uso.

**Detección**. CBR muestra título origen "MBN", "Fisco", "decreto destinación", "transferencia gratuita". Leer escritura completa buscando cláusulas reversión.

**Remedio**. (a) Vencido plazo + destino cumplido → autorización MBN para alzar prohibición. (b) Saneamiento condición resolutoria = pagar al Fisco diferencia avalúo o cumplir destino. (c) Casos sin remedio si reversión activada.

**Tiempo y costo**. 60-180 días MBN, $0-5MM (a veces tasación + pago Fisco).

**Flag**. 🟡-🔴.

**Automatización**. Parcial. NLP sobre escritura origen.

---

## 4. DL 2.695 saneamiento reciente (1 año reivindicatoria + 5 años prescripción extraordinaria)

**Qué es**. DL 2.695 (1979) permite poseedor material 5 años + buena fe regularizar dominio vía MBN sin pasar por juicio reivindicatorio. Resolución MBN se inscribe CBR. Pero quedan **dos plazos peligrosos**: (a) **1 año** desde inscripción = terceros pueden ejercer acciones de dominio (reivindicatoria); (b) **5 años** = otro poseedor regular puede adquirir por prescripción ordinaria contra el saneado. CS rol 19261-2018 confirma que título inscrito anterior puede prevalecer.

**Detección**. CBR muestra inscripción "DL 2.695" + fecha. Si fecha < 1 año → riesgo total. Si entre 1 y 5 años → riesgo medio. Buscar inscripciones anteriores sobre misma cabida.

**Remedio**. Esperar plazos. Antes del año = no asegurable, riesgo no transferible. Cobertura seguro título posible post-año (escasa oferta Chile).

**Tiempo y costo**. Solo tiempo (espera).

**Flag**. <1 año = 🔴. 1-5 años = 🟡. >5 años con cadena limpia = 🟢.

**Automatización**. ✅ 100% detección por marca DL 2.695 + cálculo plazo.

**Zonas**: muy frecuente Maule (Curicó, Talca rural), O'Higgins (precordillera Machalí, Coltauco).

---

## 5. Servidumbres no inscritas adquiridas por prescripción art 882 CC

**Qué es**. Art 882 CC: servidumbres **continuas y aparentes** (acueducto visible, callejón histórico de paso vehicular, etc) pueden adquirirse por **prescripción de 5 años**, sin distinguir ordinaria/extraordinaria (Rosso Elorriaga, Rev. Chilena Derecho Privado 2017). **No requieren inscripción** para nacer. Discontinuas o continuas inaparentes = sólo por título.

**Detección**. (a) Inspección física: ductos visibles, caminos, canales, líneas eléctricas. (b) Entrevistar vecinos colindantes. (c) Comparar planos antiguos vs realidad. (d) Asegurar cláusula declaratoria escritura sobre inexistencia servidumbres.

**Remedio**. (a) Reconocer formalmente por escritura + inscripción → no impide venta pero baja valor. (b) Negociar con dominante para extinguir + indemnizar.

**Tiempo y costo**. Reconocer = 30 días $200-500k. Extinguir = variable.

**Flag**. 🟡.

**Automatización**. Imposible 100% (no registrales). Foto satelital + comparación catastro detecta candidatos.

---

## 6. Servidumbres alta tensión (Ley General Servicios Eléctricos)

**Qué es**. Líneas alta tensión (≥23 kV típicamente) tienen **franja de servidumbre** legal donde art 57° LGSE prohíbe al dueño predio sirviente plantar, construir o ejecutar obras que perturben el ejercicio. Ancho franja varía con voltaje (5-40 m a cada lado eje).

**Detección**. (a) Inspección satelital — torres alta tensión cruzando predio. (b) CBR registro hipotecas y gravámenes — servidumbre eléctrica inscrita a favor empresa transmisión. (c) Si NO inscrita pero línea existe → servidumbre legal de pleno derecho + indemnización pendiente.

**Remedio**. No remediable — limitación intrínseca al uso. Sólo divulgar comprador.

**Tiempo y costo**. N/A (es restricción permanente). Si construcción dentro franja → demolición forzada por concesionaria.

**Flag**. 🟡 si declarada y no afecta uso comprador. 🔴 si construcción existente dentro franja.

**Automatización**. Parcial. Foto satelital + capa SEC líneas transmisión + búsqueda CBR.

---

## 7. Derechos de agua separados del suelo (Código Aguas + Ley 21.435 / 21.740)

**Qué es**. Código Aguas 1981 separó derechos aprovechamiento del suelo — se transan independientes. Inmuebles agrícolas RM/O'Higgins/Maule típicamente tienen derechos asignados pero pueden estar inscritos a nombre tercero (usufructuario, vendedor anterior que reservó), o no inscritos. **Reforma Ley 21.435 (6-abr-2022)**: nuevos derechos = concesión 30 años, prórroga si DGA acredita uso efectivo. **Caducidades**: (a) **no inscripción al 6-abr-2025** = derechos antiguos no inscritos en Registro Propiedad Aguas CBR caducan; pequeños productores agrícolas tienen plazo extendido a 6-abr-2027. (b) **No uso efectivo** = DGA puede declarar extinción. **Ley 21.740 (publicada 23-abr-2025)** — modifica fiscalización DGA, multas con allanamiento y descuento 25%.

**Detección**. (a) Pedir certificado Registro Propiedad Aguas CBR a nombre vendedor. (b) Si no inscrito → caducado o por caducar. (c) Verificar inscripción canalista comunidad aguas. (d) Solicitar a DGA constancia uso efectivo.

**Remedio**. Inscribir derechos antes plazo. Regularizar uso efectivo y reportar DGA.

**Tiempo y costo**. Inscripción = 30-90 días $200k-1MM. Regularización uso = variable.

**Flag**. 🟡 si recuperable. 🔴 si caducado y no recuperable.

**Automatización**. ✅ 100% verificación inscripción Registro Aguas.

**Zonas**: crítico Maule/O'Higgins viñas y agrícolas.

---

## 8. Loteos brujos / parcelaciones encubiertas DL 3.516

**Qué es**. DL 3.516 (1980) permite subdivisión predios rústicos hasta 0,5 ha mínimas con destino exclusivo agrícola, ganadero o forestal. **Loteo brujo** = subdivisión de facto creando lotes residenciales con calles internas, agua potable, alumbrado — eludiendo permisos urbanización LGUC. Caso típico parcelas de agrado RM, O'Higgins, Maule. **Jurisprudencia CS**: rol **62.948-2020** (oct-2020) confirmó decisión Contraloría Los Ríos declarando ilegal loteo Bahía Panguipulli (228 parcelas) — sólo subdivisión SAG no habilita uso residencial; CS 2023 mantuvo suspensión de loteos no ajustados a DL 3.516. **Proyecto Ley Parcelaciones** ingresado **30-jul-2024**, primer trámite Cámara comisión Agricultura — busca exigir conservación + acceso real + servicios. Estado mayo-2026 = en discusión, no promulgada.

**Detección**. (a) Plano subdivisión SAG = OK 0,5 ha c/u con destino agrícola. (b) Inspección satelital: cuadrícula de parcelas + calles + casas = loteo brujo. (c) Avalúo SII con código habitacional en zona rural = sospecha. (d) Promesa de venta con frase "parcela de agrado" + servicios prometidos.

**Remedio**. Acogerse Ley 20.234 modificada Ley 21.477 (saneamiento loteos hasta 31-dic-2030) si cumple requisitos urbanización mínima y antigüedad. Si no, demolición / multas + sin posibilidad regularizar uso residencial.

**Tiempo y costo**. Saneamiento Ley 20.234 = 12-36 meses $5-50MM dependiendo proyecto urbanización.

**Flag**. 🔴 hasta saneado.

**Automatización**. Parcial. Foto satelital + cruce SII + capa DOM ortofoto.

---

## 9. Expropiaciones DUP vigentes vs caducadas (Ley 19.939 + Ley 21.078)

**Qué es**. Plan regulador comunal (PRC) puede declarar predios DUP para vialidades/plazas/parques. **Ley 19.939 (13-feb-2004)** estableció caducidades. **Ley 20.791 (29-oct-2014)** eliminó régimen de caducidad y revivió DUP previas. **Ley 21.078 (15-feb-2018)** transparencia mercado suelo + impuesto plusvalía 10% sobre venta inmuebles tras ampliación límite urbano + observatorio MINVU. Resultado actual: DUP en plan regulador puede gravar predio indefinidamente sin expropiación efectiva.

**Detección**. (a) Certificado informaciones previas (CIP) DOM muestra afectación utilidad pública. (b) Plan regulador comunal vigente. (c) Buscar inscripción CBR si decreto expropiación notificado.

**Remedio**. (a) Si DUP no efectiva — vender informando, valor reducido en franja afecta. (b) Si expropiación inminente — esperar pago Fisco. (c) Reclamación judicial valor expropiación.

**Tiempo y costo**. Variable. Reclamación expropiación 1-3 años.

**Flag**. DUP marcada en CIP pero sin acción = 🟡. Decreto expropiatorio inscrito = 🔴.

**Automatización**. ✅ 100% si CIP DOM digital.

---

## 10. Zonas Típicas / Monumentos Históricos (Ley 17.288)

**Qué es**. CMN puede declarar Zona Típica/Pintoresca o Monumento Histórico. Cualquier intervención (incluso pintar fachada, reemplazar ventanas) requiere **autorización CMN previa** (Título VI art 30 Ley 17.288). Plazo respuesta CMN ~60 días. Aplica RM (Yungay, Lastarria, París-Londres, Cerro Concepción Valpo), también Sewell (O'Higgins).

**Detección**. (a) Capa CMN georreferenciada + cruce dirección. (b) Certificado informaciones previas DOM señala zona típica. (c) Decreto Mineduc/Cultura.

**Remedio**. No remediable — es limitación uso. Comprador debe asumir restricciones obras.

**Tiempo y costo**. N/A. Cualquier obra futura = +60 días + costo proyecto patrimonial.

**Flag**. 🟡 (no impide venta, restringe uso).

**Automatización**. ✅ 100% capa CMN pública.

---

## 11. Concesión marítima 80 m playa fiscal (DL 1.939 / DFL 340)

**Qué es**. Faja 80 m desde línea más alta marea = **terreno de playa fiscal** del Ministerio Defensa Nacional. Particular sólo accede vía **concesión marítima** (Subsecretaría FFAA) — nunca vende dominio. Construcciones particulares dentro 80 m sin concesión = ocupación ilegal, demolición posible.

**Detección**. (a) Coordenadas predio vs línea costa (geo). (b) CBR puede mostrar concesión inscrita. (c) Fronteras predio dentro 80 m fiscal.

**Remedio**. Solicitar concesión Capitanía Puerto. Demoler si denegada.

**Tiempo y costo**. Concesión 12-36 meses $1-10MM.

**Flag**. 🔴.

**Automatización**. ✅ 100% geo cruce.

**Zonas**: O'Higgins costa (Pichilemu, Bucalemu) — frecuente.

---

## 12. Copropiedad sin reglamento inscrito o reglamento bajo Ley 19.537 derogada

**Qué es**. Edificio/condominio acogido Ley 19.537 (derogada 13-abr-2022 por Ley 21.442). Plazo adecuar reglamento = **9-ene-2026** (12 meses desde reglamento publicado 9-ene-2025). Cláusulas viejas que contradicen nueva ley se entienden derogadas tácitamente, pero sin reglamento adecuado el título ejecutivo cobro gastos comunes queda en duda (Aguilar Abogados). Algunos condominios construidos antes 1997 (Ley Propiedad Horizontal) ni siquiera tienen reglamento moderno.

**Detección**. (a) Pedir copia reglamento copropiedad inscrito CBR. (b) Verificar fecha + actos de adecuación post abr-2022. (c) Comparar contra estructura Ley 21.442.

**Remedio**. Forzar asamblea para adecuar reglamento, nuevo borrador conforme Ley 21.442 + Reglamento ene-2025, votación quórum + escritura pública + inscripción CBR.

**Tiempo y costo**. 90-180 días, $1-5MM (abogado + asamblea + CBR).

**Flag**. 🟡. Se puede vender, pero comprador hereda riesgo cobros.

**Automatización**. Parcial.

---

## 13. Usufructo / nuda propiedad / fideicomiso — vender la propiedad equivocada

**Qué es**. Inmueble dividido en derechos: nudo propietario (titularidad) + usufructuario (uso y goce vitalicio o temporal). Casos típicos: padre dona nuda propiedad a hijo reservándose usufructo vitalicio. Vender nuda propiedad sin extinguir usufructo = comprador adquiere inmueble con vejete adentro hasta muerte usufructuario. Fideicomiso (art 733 CC) = propiedad sujeta a transferencia a un tercero al cumplirse condición.

**Detección**. CBR Registro Propiedad muestra dominio + Registro Hipotecas y Gravámenes muestra usufructo o fideicomiso.

**Remedio**. (a) Comprar también el usufructo (acuerdo + escritura pública + inscripción cancelación usufructo). (b) Esperar muerte usufructuario (no controlable). (c) En fideicomiso, esperar cumplimiento o frustración condición.

**Tiempo y costo**. Compra usufructo = días si acuerdo, costo = avalúo derecho.

**Flag**. 🟡 si usufructuario coopera. 🔴 si no.

**Automatización**. ✅ 100% detección.

---

## 14. Áreas de riesgo (inundación, deslizamiento, faja seguridad ductos/líneas)

**Qué es**. OGUC + plan regulador definen "áreas de riesgo" (inundación, anegamiento, surgencia napa, quebradas, deslizamientos, fajas ductos gas, fajas seguridad líneas). Edificación requiere **estudio fundado** especialista + aprobación DOH (Dirección Obras Hidráulicas) + medidas mitigación. Sin esto, DOM no debe permitir construcción; si permitió por error, recepción puede invalidarse.

**Detección**. (a) CIP DOM. (b) Capas SHOA, MOP-DOH, ENAP/GNL ductos. (c) Plan regulador. (d) Histórico inundaciones (ej. zona Talca río Maule, Curicó río Mataquito, RM Mapocho).

**Remedio**. Estudio fundado DOH si construcción ya está. Si no factible, demolición o uso restringido.

**Tiempo y costo**. Estudio + DOH 6-18 meses, $2-15MM.

**Flag**. 🟡-🔴.

**Automatización**. ✅ 100% capas geo.

---

## 15. Predios con afectación SBAP / sitio prioritario biodiversidad (Ley 21.600)

**Qué es**. Ley 21.600 (sept-2023) creó SBAP. MMA tiene plazo hasta sept-2028 para decreto definitivo sitios prioritarios. Lista preliminar = **99 sitios prioritarios** (más de 230 quedaron fuera de propuesta inicial). Proyecto/actividad en sitio prioritario o cercano = obligación EIA bajo Ley 19.300 art 11 letra d. Sitios ENB no seleccionados protegidos 5 años por defecto.

**Detección**. Capa MMA sitios prioritarios + ubicación predio. Considerar buffer.

**Remedio**. No remediable — es limitación. Restringe desarrollos, agricultura intensiva, loteo.

**Tiempo y costo**. N/A.

**Flag**. 🟡.

**Automatización**. ✅ 100% geo.

---

# Resumen tabla rápida

| # | Caso raro/extremo | Flag | Auto | Tiempo fix | Costo fix CLP |
|---|------|------|------|-----------|--------------|
| 1 | Doble inscripción | 🔴 | parcial | 2-6 años | 5-30MM |
| 2 | Tierra indígena | 🔴 | parcial | imposible* | N/A |
| 3 | Bien fiscal con destinación | 🟡-🔴 | parcial | 60-180d | 0-5MM |
| 4 | DL 2.695 reciente | 🔴/🟡/🟢 | ✅ | sólo tiempo | $0 |
| 5 | Servidumbres prescripción 882 | 🟡 | imposible 100% | 30d | 200-500k |
| 6 | Servidumbre alta tensión | 🟡-🔴 | parcial | N/A | N/A |
| 7 | Derechos agua separados | 🟡-🔴 | ✅ | 30-90d | 200k-1MM |
| 8 | Loteo brujo DL 3.516 | 🔴 | parcial | 12-36m | 5-50MM |
| 9 | DUP / expropiación | 🟡-🔴 | ✅ | 1-3a | reclamación |
| 10 | Zona típica CMN | 🟡 | ✅ | N/A | N/A |
| 11 | Concesión marítima 80m | 🔴 | ✅ | 12-36m | 1-10MM |
| 12 | Reglamento copropiedad obsoleto | 🟡 | parcial | 90-180d | 1-5MM |
| 13 | Usufructo/nuda prop/fideicomiso | 🟡-🔴 | ✅ | días | varía |
| 14 | Área de riesgo | 🟡-🔴 | ✅ | 6-18m | 2-15MM |
| 15 | SBAP / sitio prioritario | 🟡 | ✅ | N/A | N/A |

**Fuentes principales**: [SciELO doble inscripción CS rol 19261-2018](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0718-97532023000100301), [CS Panguipulli tierra indígena 2025](https://www.diarioconstitucional.cl/2025/06/21/corte-suprema-ratifica-nulidad-de-venta-de-derechos-sobre-tierra-indigena-ubicada-en-zona-urbana/), [Carey reforma Código Aguas 21.435](https://www.carey.cl/entra-en-vigor-la-reforma-al-codigo-de-aguas), [Aguila Ley 21.740](https://www.aguilaycia.cl/post/la-ley-n-21-740-de-2025-y-la-reforma-integraldel-c%C3%B3digo-de-aguas-de-chile), [Fitzroy parcelas agrado fraude](https://fitzroy.cl/parcelas-de-agrado-corte-suprema-pone-limites-al-fraude-inmobiliario/), [El Mostrador CS DL 3.516 2023](https://www.elmostrador.cl/noticias/pais/2023/07/13/corte-suprema-le-da-la-razon-a-agricultura-y-mantiene-fallo-contra-parcelas-de-agrado/), [Diario Constitucional SBAP 2026](https://www.diarioconstitucional.cl/2026/01/18/proyecto-de-ley-busca-modificar-ley-sbap-para-suspender-declaracion-de-nuevos-sitios-prioritarios-hasta-dictacion-del-reglamento-respectivo/), [CMN trámites zonas típicas](https://www.monumentos.gob.cl/tramites/autorizacion-intervencion-zonas-tipicas-pintorescas).
