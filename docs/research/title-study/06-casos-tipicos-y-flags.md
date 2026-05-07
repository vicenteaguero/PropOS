# 06 — Casos típicos y flags pre-listing

> **Audiencia**: ingeniero diseñando safeguard automatizado. **No abogado**.
> **Glosario rápido (primera mención)**:
> - **CBR** = Conservador de Bienes Raíces (registro de propiedad por comuna).
> - **CC** = Código Civil chileno.
> - **CS** = Corte Suprema.
> - **DOM** = Dirección de Obras Municipales.
> - **FNA** = Foja, Número, Año (referencia inscripción en CBR: `Fojas 12345 Nº 6789 año 2018`).
> - **DUP** = Declaración de Utilidad Pública (precursor de expropiación).
> - **EIA** = Estudio Impacto Ambiental.
> - **OGUC** = Ordenanza General de Urbanismo y Construcciones.
> - **LGUC** = Ley General de Urbanismo y Construcciones.
> - **SERVIU** = Servicio de Vivienda y Urbanización.
> - **CGP** = Certificado de Gravámenes y Prohibiciones (CBR).
> - **Cabida** = superficie del predio según título.
> - **Deslindes** = vecinos colindantes por los 4 puntos cardinales.
> - **Tradición** = transferencia dominio (en inmuebles = inscripción CBR, art 686 CC).
> - **Estudio título** = revisión cadena 10+ años + gravámenes + actuales propietarios + cargas.

Cada caso = qué es / detección / remedio / tiempo y costo / flag color / automatización.

---

## 1. Hipoteca vigente con alzamiento pendiente

**Qué es**. Banco recibió pago último dividendo pero nunca instruyó al notario emitir escritura cancelación, o la emitió y nadie la inscribió en CBR. La hipoteca queda viva en registro aunque deuda esté saldada.

**Detección**. CGP del CBR muestra hipoteca inscrita. Cross-check: pedir al banco "carta cancelación" o "escritura alzamiento" + verificar si fue protocolizada e inscrita. Patrón típico: crédito hipotecario más de 20 años atrás, escritura cancelación firmada pero sin inscripción margen al CBR.

**Remedio**. (1) Banco emite escritura pública cancelación (gratis si crédito vigente, hasta $300k si banco extinguió cartera). (2) Notario protocoliza. (3) CBR inscribe alzamiento al margen de la inscripción hipotecaria original. Vendedor o corredor gestiona, costo CBR ~$30-80k según comuna.

**Tiempo y costo**. 7-30 días, $30-300k.

**Flag**. 🟡 Yellow. No bloquea venta si banco coopera; bloquea cierre si banco quebró o fusión retrasa archivo.

**Automatización**. ✅ 100%. Parsear CGP + buscar inscripción hipoteca + verificar inscripción cancelación al margen. Si hay hipoteca sin cancelación → flag.

---

## 2. Prohibiciones SERVIU 5 / 15 años + Ley 20.868 alzamiento de oficio

**Qué es**. Vivienda comprada con subsidio habitacional trae prohibición de enajenar, gravar y celebrar actos a favor del SERVIU. Plazos: **5 años** subsidios estándar, **10 años** subsidio densificación en altura, **15 años** subsidio localización (DS 49 o equivalentes con condiciones especiales). Ley 20.868 (28-oct-2015) modificó DL 2.833 estableciendo que vencido el plazo la prohibición se entiende **alzada de pleno derecho** y CBR puede certificar/cancelar de oficio o a petición de cualquier persona.

**Detección**. CGP muestra prohibición SERVIU. Calcular fecha vencimiento desde inscripción. Si vencida → debería haberse cancelado pero a veces sigue figurando como inscripción no marginada.

**Remedio**. Si plazo cumplido: presentar al CBR donde está inscrita la prohibición + copia inscripción dominio + cédula → CBR cancela y certifica vencimiento. Si plazo no cumplido: imposible vender sin autorización SERVIU (excepcional, ej. fuerza mayor).

**Tiempo y costo**. Vencido = 5-15 días $20-50k. No vencido = 60-180 días si SERVIU autoriza, mayoría no.

**Flag**. Vencido pendiente de marginar = 🟢 Green. Vigente = 🔴 Red.

**Automatización**. ✅ 100%. Calcular fecha inscripción + plazo asignado (parsear texto inscripción para identificar tipo subsidio) → veredicto.

---

## 3. Sociedad conyugal sin autorización cónyuge (art 1749 CC) + pacto 1723 sin subinscribir

**Qué es**. Régimen sociedad conyugal: marido administra, pero art 1749 CC prohíbe enajenar/gravar bienes raíces sociales **sin autorización mujer** (escrita, específica, otorgada por escritura pública o que intervenga expresa y directamente en el acto). Sanción = nulidad relativa, plazo 4 años desde disolución sociedad. Art 1754 CC para bienes propios mujer. Pacto art 1723 CC permite cambiar régimen pero **sólo surte efecto desde subinscripción al margen del acta matrimonio dentro de 30 días** desde escritura.

**Detección**. (1) Pedir certificado matrimonio del Registro Civil con subinscripciones. (2) Si casados antes 1994 default es sociedad conyugal. (3) Verificar régimen al margen acta. (4) Si pacto 1723 → confirmar subinscripción dentro 30 días — si no, pacto nulo entre partes y terceros, sigue habiendo sociedad conyugal.

**Remedio**. Caso típico: obtener autorización cónyuge (firma escritura compraventa o autorización separada por escritura pública) — costo notarial $50-150k. Caso pacto sin subinscribir = otorgar nuevo pacto + subinscribir + esperar (no retroactivo, no afecta gravámenes anteriores; ver Diario Constitucional 30-dic-2025).

**Tiempo y costo**. Autorización cónyuge cooperativo = 1-7 días. Cónyuge ausente/separado de hecho = 30-120 días (autorización subsidiaria juez).

**Flag**. 🟡 Yellow. Cónyuge desaparecido o conflictivo = 🔴 Red.

**Automatización**. Parcial. Sistema puede detectar matrimonio + régimen vía certificado Registro Civil; humano valida si autorización cónyuge requerida y obtenible.

---

## 4. Sucesión sin posesión efectiva tramitada

**Qué es**. Causante (titular fallecido) muere y herederos no tramitan **posesión efectiva** (resolución que declara herederos + bienes). Sin ella herederos no pueden disponer del inmueble inscrito a nombre del fallecido. Trámite: SRCeI si intestada, juzgado civil si testada.

**Detección**. Inscripción dominio CBR a nombre persona fallecida (verificar contra Registro Civil defunciones). Sin nuevas inscripciones especiales herencia.

**Remedio**. (1) Tramitar posesión efectiva en SRCeI ($0 si masa <15 UTM, escalada hasta ~2.5% UTM sobre tramo según Ley 20.094) o tribunal (~$300k-1MM honorarios). (2) Pago impuesto herencia SII + certificado. (3) Pagar contribuciones al día (TGR). (4) Inscribir resolución en CBR de domicilio causante + CBR ubicación inmueble.

**Tiempo y costo**. SRCeI intestada simple = 30-90 días, $50-300k. Testada o conflictiva = 6-18 meses.

**Flag**. 🟡 Yellow. Si masa modesta y herederos cooperan = manejable.

**Automatización**. Parcial. Sistema detecta titular fallecido cruzando CBR con Registro Civil; humano confirma estado posesión efectiva.

---

## 5. Posesión efectiva inscrita pero sin inscripción especial herencia / sin adjudicación

**Qué es**. Pasos post-muerte (art 688 CC): (a) inscripción decreto/resolución posesión efectiva en CBR último domicilio causante, (b) **inscripción especial de herencia** sobre cada inmueble (a nombre todos los herederos en común), (c) si hay partición, **inscripción adjudicación** al heredero que se quedó con la cosa. Falta cualquier eslabón = no se puede vender o solo se vende cuota.

**Detección**. CBR inmueble: si inscripción a nombre causante, falta (b). Si inscripción a herederos en común y se quiere vender 100% sin firma de todos, falta (c).

**Remedio**. (b) Inscripción especial herencia = $30-100k CBR + minuta abogado. (c) Acto partición/adjudicación por escritura pública + inscripción $100-300k según valor.

**Tiempo y costo**. (b) 7-30 días. (c) Acuerdo extrajudicial = 30-90 días. Partición judicial = 1-3 años.

**Flag**. (b) sólo = 🟢 Green. (c) sin acuerdo = 🟡 a 🔴.

**Automatización**. ✅ 100% para (b). Parcial para (c).

---

## 6. Sucesión con heredero menor / interdicto / preterido

**Qué es**. Heredero menor de 18 años, declarado interdicto (incapaz mental, demencia, prodigalidad), o **preterido** (omitido en testamento/posesión efectiva sin desheredarlo). Para enajenar bienes raíces de incapaz se requiere **autorización judicial** del juez letras lugar inmueble (art 393, 1754 CC y juzgados de familia respecto a hijos). Preterido = posesión efectiva atacable hasta que prescriba (5-10 años).

**Detección**. Listado herederos en posesión efectiva contiene fecha nacimiento → verificar mayoría edad. Cruzar con **Registro Nacional de Discapacidad** + interdicciones. Buscar testamentos en Registro Nacional de Testamentos. Preterido: comparar herederos legales (cónyuge sobreviviente + descendientes art 988 CC) contra los listados.

**Remedio**. Menor = autorización judicial venta + dinero a depósito o subrogación real (compra otro bien). 60-180 días, $500k-2MM. Preterido = sumarlo a posesión efectiva o juicio petición herencia.

**Tiempo y costo**. 3-12 meses, $500k-3MM.

**Flag**. 🔴 Red.

**Automatización**. Parcial. Detecta menor por DOB; preterido requiere humano + análisis registro civil.

---

## 7. Co-propietarios en comunidad indivisa sin acuerdo (incluye comunidad hereditaria mixta)

**Qué es**. Inmueble pertenece a varias personas en cuotas (comunidad cuasicontractual o hereditaria). Cualquier comunero puede vender **su cuota** sin permiso de los demás (CS reiterada). Para vender el **100%** se requiere unanimidad o acción de partición (art 1317 CC). Mixta = parte herencia parte sociedad conyugal disuelta.

**Detección**. CBR muestra varias inscripciones de cuotas o inscripción especial herencia con N personas. Cruzar Registro Civil para detectar muerte de algún comunero (genera sub-comunidad).

**Remedio**. (a) Acuerdo extrajudicial todos firman compraventa. (b) Compra cuota disidente. (c) Juicio partición ante juez árbitro. (d) Adjudicación en remate.

**Tiempo y costo**. Acuerdo = 30-90 días. Partición = 1-4 años, $1-5MM honorarios árbitro.

**Flag**. Acuerdo previsible = 🟡. Conflictivo = 🔴.

**Automatización**. Parcial. Sistema cuenta comuneros y detecta muertes; humano evalúa cooperatividad.

---

## 8. Recepción final faltante (DOM nunca certificó construcción)

**Qué es**. Art 145 LGUC: para habitar/usar obra se requiere **recepción definitiva DOM** (total o parcial). Falta de recepción = obra ilegal aunque permiso edificación exista. Sanción art 20 LGUC: multa 0,5% a 20% del presupuesto, alcalde puede inhabilitar y desalojar.

**Detección**. Pedir **certificado de recepción definitiva DOM**. Si DOM responde "no consta" o emite certificado parcial → flag. Cross-check con permiso edificación + plano arquitectura aprobado.

**Remedio**. (a) Solicitar recepción ahora si obra cumple permiso original — costo profesional revisor independiente $300k-2MM, derechos DOM ~1% presupuesto. (b) Si hay diferencias regularizar bajo Ley 20.898 ("Ley del Mono") extendida hasta **31-dic-2027** por Ley 21.725 (1-mar-2025).

**Tiempo y costo**. Recepción simple = 30-90 días $500k-2MM. Regularización Ley Mono = 60-180 días $800k-3MM (planos + arquitecto + DOM).

**Flag**. 🟡 Yellow si recuperable. 🔴 si construcción no normalizable (excede coeficientes plan regulador).

**Automatización**. Parcial. Sistema detecta certificado DOM ausente; humano evalúa fixability.

---

## 9. Ampliaciones sin permiso (regularizables vía Ley 20.898 / 21.725)

**Qué es**. Propietario amplió m² (segunda planta, quincho, dormitorio adicional) sin permiso DOM. Construcción "irregular" pero habitable. Ley 20.898 ("Ley del Mono") procedimiento simplificado regularización viviendas autoconstruidas o ampliadas. Ley 21.725 (publicada 1-mar-2025) **extiende plazo hasta 31-dic-2027**.

**Detección**. Comparar plano arquitectura aprobado DOM vs realidad (m² actuales) vs avalúo SII (a veces SII detectó la ampliación en terreno). Drone/medición + plano vs registro = patrón confiable.

**Remedio**. (a) Vía Ley del Mono si cumple requisitos (vivienda, m² topes según avalúo, no zona protegida). Arquitecto + planos + derechos DOM. (b) Permiso edificación regular si excede topes Ley Mono.

**Tiempo y costo**. Ley Mono = 60-180 días $500k-2MM. Regular = 6-18 meses $2-8MM.

**Flag**. 🟡 Yellow.

**Automatización**. Parcial. Detección requiere comparación geométrica.

---

## 10. Deuda contribuciones / gastos comunes (Ley 21.442 + Reglamento ene-2025)

**Qué es**. (a) **Contribuciones** (impuesto territorial): deuda persigue al inmueble — comprador hereda morosidad si no exige certificado al día TGR. (b) **Gastos comunes**: nueva Ley 21.442 (publicada 13-abr-2022, derogó 19.537), Reglamento publicado 9-ene-2025. Introduce concepto "obligación económica" amplio (gastos ordinarios + extraordinarios + fondo reserva + fondo operacional + multas + intereses + primas seguros). Comunidades plazo hasta 9-ene-2026 para adecuar reglamento. **Las cláusulas viejas que contradicen 21.442 se entienden derogadas tácitamente**, pero la falta de reglamento actualizado genera incertidumbre sobre validez del título ejecutivo de cobro.

**Detección**. Contribuciones = certificado deuda TGR. Gastos comunes = certificado administrador + revisar reglamento copropiedad inscrito + verificar adecuación a 21.442.

**Remedio**. Contribuciones: pagar o convenir TGR + descontar en escritura. Gastos comunes: pagar saldo + retener provisión en escritura.

**Tiempo y costo**. Días, costo = monto deuda.

**Flag**. 🟢 Green si pagable; 🟡 si reglamento copropiedad no adecuado (riesgo cobro futuro disputable, ver Aguilar Abogados análisis).

**Automatización**. ✅ 100% TGR (API/SII). Parcial gastos comunes (depende administrador).

---

## 11. Embargos judiciales / medidas precautorias

**Qué es**. Embargo (juicio ejecutivo, ya hay sentencia o título ejecutivo) o medida precautoria (precautorio, juicio en curso) inscrita al margen del dominio (Registro de Hipotecas, Gravámenes y Prohibiciones del CBR). Bloquea enajenación.

**Detección**. CGP vigente CBR muestra inscripción embargo/precautoria con tribunal + rol + fecha.

**Remedio**. (a) Pagar deuda → secretaría tribunal oficia alzamiento → CBR cancela. (b) Sustituir por otra garantía (caución). (c) Tercería dominio si embargo afecta bien ajeno.

**Tiempo y costo**. Pago + alzamiento = 30-90 días, $50-200k tramitación + monto deuda.

**Flag**. 🔴 Red hasta saneado.

**Automatización**. ✅ 100% detección. Remedio = humano.

---

## 12. Cláusulas resolutorias o condiciones art 1490-1491 CC oponibles a terceros

**Qué es**. Vendedor puede pactar **condición resolutoria** (ej. precio pagadero a plazo, si no paga se resuelve) que afecta inmueble. Art 1491 CC: si la condición consta en el título inscrito o consta por escritura pública, la resolución **afecta a terceros** que adquirieron del comprador deudor — pueden perder el inmueble. Aplica también a saldo precio garantizado con hipoteca (caso típico).

**Detección**. Leer escritura compraventa antecesora completa. Buscar: "saldo precio", "condición", "se entenderá resuelto", "pacto comisorio", "se reserva el dominio". Si saldo no pagado y antecesor demanda resolución → catastrófico.

**Remedio**. (a) Carta de pago / recibo total del precio + escritura pública que lo declare. (b) Si saldo pendiente, pagarlo antes de inscribir.

**Tiempo y costo**. 7-30 días si vendedor original ubicable, $50-300k.

**Flag**. 🟡 Yellow detectado a tiempo. 🔴 si vendedor antecesor desaparecido y saldo dudoso.

**Automatización**. Parcial. Detección requiere NLP sobre escritura. Humano confirma pago.

---

## 13. Promesa de compraventa anterior no cumplida ni resciliada

**Qué es**. Vendedor firmó promesa con tercero (incluso sin inscripción), no cumplió ni rescilió. Si la promesa se inscribió por anotación marginal o consta por escritura pública, expone al comprador actual a juicio cumplimiento forzado por promitente comprador anterior. Caso frecuente en parcelas y proyectos pre-venta.

**Detección**. Pedir al vendedor declaración jurada de inexistencia de promesas + revisar archivos notariales si hay sospecha.

**Remedio**. Resciliación expresa por escritura pública con promitente anterior + cláusula renuncia acciones.

**Tiempo y costo**. 7-30 días, $50-200k.

**Flag**. 🟡 Yellow.

**Automatización**. Imposible 100% (promesas privadas no registradas). Mitigación = declaración jurada vendedor + cláusula indemnidad.

---

# Resumen tabla rápida

| # | Caso | Flag | Auto | Tiempo fix | Costo fix CLP |
|---|------|------|------|-----------|--------------|
| 1 | Hipoteca sin alzar | 🟡 | ✅ | 7-30d | 30-300k |
| 2 | Prohib SERVIU vencida | 🟢 | ✅ | 5-15d | 20-50k |
| 2b | Prohib SERVIU vigente | 🔴 | ✅ | 60-180d | varía |
| 3 | Art 1749 sin autoriz | 🟡 | parcial | 1-30d | 50-150k |
| 4 | Sin posesión efectiva | 🟡 | parcial | 30-540d | 50k-3MM |
| 5 | Sin insc esp herencia | 🟢 | ✅ | 7-30d | 30-100k |
| 6 | Heredero menor/interd | 🔴 | parcial | 90-365d | 500k-3MM |
| 7 | Comuneros sin acuerdo | 🟡-🔴 | parcial | 30d-4a | 0-5MM |
| 8 | Sin recepción final | 🟡 | parcial | 30-180d | 500k-3MM |
| 9 | Ampliaciones sin permiso | 🟡 | parcial | 60-180d | 500k-3MM |
| 10 | Deuda contrib/GC | 🟢-🟡 | ✅/parcial | días | = deuda |
| 11 | Embargo/precautoria | 🔴 | ✅ | 30-90d | 50-200k+ |
| 12 | Cláusula resol art 1491 | 🟡-🔴 | parcial | 7-30d | 50-300k |
| 13 | Promesa anterior viva | 🟡 | imposible | 7-30d | 50-200k |

**Fuentes principales**: BCN ([Ley 21.725](https://www.bcn.cl/leychile/navegar?idNorma=1211463), [Ley 21.442](https://www.bcn.cl/leychile/navegar?idNorma=1174663), [Ley 20.868](https://vlex.cl/vid/ley-num-20868-publicada-585839962)), [MINVU Reglamento 21.442](https://www.minvu.gob.cl/wp-content/uploads/2025/01/Reglamento-de-la-ley-21442.pdf), [Aguila & Cía deslindes/cabidas](https://www.aguilaycia.cl/post/deslindes-de-un-inmueble-versus-plano-registrado-en-cbr), [Orrego — venta cuota hereditaria](https://juanandresorrego.cl/assets/pdf/pub/VENTA%20DE%20DERECHOS%20EN%20UN%20INMUEBLE%20HEREDITARIO%20DETERMINADO.pdf), [DOE — recepción definitiva](https://actualidadjuridica.doe.cl/la-falta-de-recepcion-definitiva-de-la-obra-y-sus-consecuencias-civiles/), [ChileAtiende SERVIU](https://www.chileatiende.gob.cl/fichas/81634-alzamiento-de-prohibiciones-serviu-por-plazo-vencido).
