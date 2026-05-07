# 19 — Modelo de negocio y pricing PropOS Title Study (Chile)

**Audiencia:** founder PropOS. Caveman markdown denso. Cifras CLP salvo nota. Today: 2026-05-07.

---

## 1. Mercado direccionable Chile

### 1.1 Volumen transaccional (TAM bruto)

CBR no publica registro nacional consolidado. Proxy combinado:

| Fuente | Métrica | Año | Valor |
|---|---|---|---|
| CChC MIS RM | Venta viviendas nuevas RM | 2025 | 26.386 unidades (+10% YoY, +28% Q4 subsidio tasa) |
| CChC nacional | Proyección viviendas nuevas | 2025 | ~41.800 unidades |
| Histórico 2010-2020 | Promedio nacional viviendas nuevas | — | ~30.000/año (actual -18%) |
| SII F2890 (proxy IPV BCCh) | Inscripciones enajenación BR (incluye usadas+nuevas+rurales+comerciales) | 2024 | ~180-220k transacciones estimadas (no público) |

**Estimación TAM transacciones registrables/año Chile = 180.000-220.000.**
- Viviendas nuevas: ~42k
- Viviendas usadas: ~110-130k (mayor volumen, requiere ET más profundo)
- Rural/agrícola: ~15-20k
- Comercial/industrial: ~10-15k
- Otros (sucesiones, donaciones, permutas registradas): resto

### 1.2 Distribución geográfica

| Región | % volumen estimado | Característica |
|---|---|---|
| RM | 40-50% | Urbano, depto+casa, cadenas cortas, CBR Santiago saturado pero digitalizado |
| Valparaíso | 10-12% | Costa, segunda vivienda, Viña/Concón premium |
| Biobío | 8-10% | Concepción urbano + rural forestal |
| O'Higgins + Maule | 10-12% | **Vitivinícola premium**, predios complejos, cadenas largas, regularizaciones DL 2.695, servidumbres aguas |
| Resto | 20-25% | Norte minero (Antofagasta industrial), Araucanía indígena (DL 17.729), Los Lagos turístico |

### 1.3 Gremio y compradores

| Segmento | Tamaño aprox Chile | Comportamiento |
|---|---|---|
| CChC (constructoras+inmobiliarias) | ~3.000 socios | Volumen alto, due diligence proyecto entero, equipos legales internos en grandes |
| COPROCH (corredores asociados) | ~1.500-2.000 corredores formales | Asociados gremio, generalmente más profesional |
| Corredores licenciados activos (universo total) | **~8.000-12.000** estimado (no hay registro único nacional, requisito mínimo curso) | 70% individuales/microempresa, 30% en franquicias o boutiques |
| Inmobiliarias franquicia premium | Engel & Völkers (30 of), Coldwell Banker (9), RE/MAX (~80 of), Sotheby's (4-6) | ~120-150 oficinas, cada una 5-30 brokers = 1.500-3.000 brokers |
| Bancos hipotecarios | 6 grandes (BancoEstado, Santander, BCI, Chile, Itaú, Scotiabank) + cooperativas | DD pre-crédito hoy externalizan a estudios jurídicos in-house o convenios |
| Abogados inmobiliaristas | ~500-1.000 especializados | Competencia + posibles aliados revenue share |

**Mercado objetivo accionable PropOS año 1-2: ~300-500 inmobiliarias+franquicias medianas-grandes en RM/Valparaíso/O'Higgins-Maule.**

---

## 2. Segmentación clientes

### 2.1 Cinco segmentos principales

| Seg | Quién | Pain | Disposición a pagar | Producto adecuado |
|---|---|---|---|---|
| **A. Inmobiliarias grandes / franquicias premium** | E&V, Coldwell, RE/MAX, Sotheby's, boutiques Las Condes | Volumen 20-50 listings/mes/oficina, broker no quiere tocar legal, riesgo reputacional | Alta | Subscription seat + estudios incluidos; SLA <48h |
| **B. Inmobiliarias medianas (5-50 brokers)** | Boutiques Vitacura/Providencia, regionales líderes | 5-20 listings/mes, equipo pequeño, sin abogado interno | Media-alta | Hybrid: base mensual + per-study con descuento por volumen |
| **C. Brokers individuales / microagencias** | Corredor freelance, 1-3 listings/mes | Ocasional, precio sensible, no contrata abogado siempre | Baja | Freemium + per-study transaccional |
| **D. Vitivinícolas / agrícolas premium** | Bodegas O'Higgins, Maule, Colchagua, fondos viña | Predios complejos, cadenas largas, derechos agua, servidumbres, due diligence M&A | Muy alta | Enterprise per-study premium + consultoría abogado integrado |
| **E. Bancos / hipotecarias / family offices** | BancoEstado, Santander, BCI; FFOO compra activos | DD pre-crédito masivo / pre-inversión | Muy alta | Enterprise API + volumen comprometido + SLA contractual |

### 2.2 Priorización ICP año 1

1. Segmento B (medianas) — sweet spot conversión + ARPU
2. Segmento A (grandes) — ancla logos + ARR
3. Segmento D (vitivinícolas) — niche premium, alta retención, defensible
4. Segmento C — postergar (CAC > LTV con pricing transaccional bajo)
5. Segmento E — rebalanceo año 2-3 (ciclo venta enterprise 6-12m)

---

## 3. Costos de producción por estudio (fully-loaded)

### 3.1 Estudio típico (urbano RM, depto, cadena 10 años, 3 propietarios)

| Línea | Costo unitario | Notas |
|---|---|---|
| Aranceles CBR (certificados, inscripciones, copias) | $15.000-30.000 | Dominio vigente $5-15k, GP $6.600 + $2k litigios, copia inscripción $3-5k, varios |
| Documentos notariales | $5.000-15.000 | Copias autorizadas escrituras |
| LLM tokens (Claude Sonnet, ~80k input + 10k output, prompt caching) | $250-600 | $3/$15 por 1M con cache hits ~70% |
| RPA infra prorrateada (CBR scrape, OCR, pipeline) | $200-500 | EC2/Cloud Run + queue + storage por estudio |
| Captcha resolution (2captcha/Anti-Captcha) | $30-100 | $0.03/captcha × 1-3 captchas/sesión |
| Storage (PDFs originales + procesados, 50-200MB) | $50-150 | S3/GCS + retención 7 años |
| **Subtotal automatizado** | **$20.500-46.350** | |
| Tier-3 humano (abogado revisor) — % casos amarillos/rojos | weighted | Ver 3.2 |
| Soporte cliente prorrateado | $1.000-3.000 | CSM + tickets |
| **Total fully-loaded estimado** | **$28.000-58.000** | |

### 3.2 Tier-3 humano (cost weighted)

| Tipo caso | % volumen estimado | Tiempo abogado | Costo |
|---|---|---|---|
| Verde (auto-aprobado) | 60% | 0 min | $0 |
| Amarillo (revisión rápida) | 30% | 15-30 min @ tarifa $80k/h interno | $20.000-40.000 |
| Rojo (escalado experto) | 10% | 1-2h @ tarifa $80k/h | $80.000-160.000 |

**Costo Tier-3 weighted = 0.6×0 + 0.3×$30k + 0.1×$120k = $9.000 + $12.000 = $21.000/estudio promedio.**

### 3.3 Costo total fully-loaded promedio

**Caso urbano simple: ~$25.000-35.000**
**Caso vitivinícola complejo: ~$80.000-150.000** (más documentos, más cadena, derechos agua, servidumbres, posible Tier-3 escalado siempre)

Margen objetivo 50-60% sobre venta.

---

## 4. Pricing models — análisis comparado

### Modelo A — Per-study transaccional

- **Precio:** $35.000-50.000 estudio urbano simple; $90.000-180.000 rural/vitivinícola
- **Pros:** transparente, baja fricción inicial, capta segmento C+B sin compromiso, alineado con percepción "comprar un servicio"
- **Contras:** revenue lumpy, no recurring, churn invisible, retention requiere uso constante
- **Target:** B, C, D ad-hoc
- **ARPU broker mediano:** 5 estudios/mes × $40k = $200k/mes
- **Churn:** alto (no hay lock-in mensual)

### Modelo B — Subscription per broker seat ilimitado

- **Precio:** $80.000-150.000/seat/mes (ilimitado o fair-use 30/mes)
- **Pros:** ARR predecible, lock-in alto, escalable, NRR alto si broker vende más, defendible
- **Contras:** broker debe usarlo mucho para break-even; risk over-paying; venta más larga
- **Target:** A, B
- **ARPU oficina 10 brokers:** $1.000.000-1.500.000/mes
- **Churn:** bajo (3-5% mensual proptech benchmark)

### Modelo C — Subscription inmobiliaria flat

- **Precio:** $1.500.000-5.000.000/mes flat por inmobiliaria
- **Pros:** simple comercial, anchor enterprise
- **Contras:** difícil escalar (cada cliente custom), price discrimination compleja, no captura upside crecimiento
- **Target:** A, E
- **ARPU:** alto pero volumen bajo
- **Churn:** medio (renegociación anual)

### Modelo D — Hybrid base + per-study

- **Precio:** $300.000/mes base oficina (incluye 5-10 estudios) + $25.000 estudio adicional
- **Pros:** captura ARR + upside volumen, alinea costos variables, fácil entender
- **Contras:** dos KPIs comerciales (seats + uso), facturación más compleja
- **Target:** B (sweet spot), también A
- **ARPU oficina 10 brokers, 25 estudios/mes:** $300k + 15×$25k = $675.000/mes
- **Churn:** bajo-medio

### Modelo E — % precio venta (al estilo title insurance USA)

- **Precio:** 0.05-0.15% precio venta (USA promedio 0.42% incluye seguro real, PropOS no asegura por ahora)
- **Pros:** alineado con valor transacción, escala con premium, narrativa "title insurance Chile"
- **Contras:** Chile no tiene cultura title insurance (el sistema de fe pública del CBR + escritura pública sustituye); requiere capital reserva legal o partner asegurador (regulación CMF); rechazo cultural broker
- **Target:** D, E con partner asegurador
- **ARPU casa UF 5.000 (~$190M):** $95k-285k/estudio
- **Churn:** medio
- **Gating:** requiere alianza aseguradora o cambio regulatorio. **No viable año 1 standalone**, sí como add-on año 2+.

### Modelo F — Freemium

- **Precio:** Tier 1 gratis (estudio básico, solo CBR, sin Tier-3, SLA best-effort 7 días); Premium $35-50k full
- **Pros:** captación masiva segmento C, virality, training data
- **Contras:** costos LLM+RPA reales aunque sea "gratis"; cannibaliza pago si tier 1 demasiado bueno; soporte gratis caro
- **Target:** C principalmente, top-of-funnel para B
- **ARPU:** $0 free, conversión esperada 5-10% a paid
- **Churn free:** N/A (no es métrica relevante); paid churn medio

### 4.1 Resumen comparativo

| Modelo | ARR predictability | Escalable | CAC payback | Lock-in | Mejor segmento |
|---|---|---|---|---|---|
| A per-study | Baja | Alta | Corto | Bajo | C, B ocasional |
| B subscription seat | Muy alta | Alta | Medio | Alto | A, B |
| C subscription flat | Alta | Baja | Largo | Alto | A, E |
| **D hybrid** | **Alta** | **Alta** | **Medio** | **Medio-alto** | **B, A** |
| E % venta | Media | Media | Variable | Bajo | D, E (gated) |
| F freemium | Baja inicial | Alta funnel | Largo | Bajo | C |

---

## 5. Anchoring de precio

| Alternativa cliente | Precio | Tiempo | Posicionamiento PropOS |
|---|---|---|---|
| Abogado privado tradicional | $75.000-150.000 (UF 4-6) urbano simple; $300k-1M complejo | 5-15 días, hasta 1 mes | Anchor alto |
| Abogado in-house inmobiliaria | "gratis" pero saturado, demoras, riesgo de error humano | 1-3 sem | Velocity competitor |
| Notaría + due diligence informal | Cubierta parcialmente notario (no es ET) | inmediato pero incompleto | No comparable |
| TocToc Pro / DataProp PRO (CRM, no ET) | ~$30-80k/mes seat estimado (no público) | N/A | Comparable subscription, pero distinto producto |
| Tusler / startups locales | No transparente, presumed $20-40k/estudio | 24-72h | Competidor directo, escalando con $$$ |
| **PropOS sweet spot** | **$25.000-50.000 simple; $90-180k complejo** | **<24-48h** | **50% descuento sobre abogado, 5-10x más rápido, margen 40-60%** |

**Narrativa comercial:** "Mismo informe que tu abogado, en 24h, a la mitad del precio, con auditoría completa y respaldo humano cuando hay dudas reales."

---

## 6. Modelo financiero base año 1

### Supuestos

- 100 inmobiliarias adquiridas año 1 (ramp 5 → 10 → 15/mes)
- Promedio 30 listings/mes/inmobiliaria
- Adoption rate (listings que efectivamente piden ET via PropOS): 60%
- Estudios/mes/inmobiliaria al ramp full: 30 × 0.6 = **18 estudios/mes**
- Pricing modelo D (recomendado): base $300k/mes oficina + $25k/estudio adicional sobre 5 incluidos
- Margen contribución por estudio: $35.000 (precio $25k variable + $300k base / ~25 estudios = blended $37k/estudio; costo $20k = margen $17-22k variable; pero base cubre fijos)

### Cálculo ARR año 1

Mes promedio (asumiendo ramp lineal, equivalente ~6 meses full):

```
Clientes activos efectivos (ARR equivalente): 50 (mitad de 100 por ramp)
ARR-equivalente run-rate Q4: 100 oficinas × $675k/mes × 12 = $810.000.000 CLP/año (~USD $850k)
Revenue año 1 efectivo (con ramp): ~$400-500M CLP (~USD $450-550k)
```

### Costos OPEX año 1

| Línea | Mensual run-rate | Anual |
|---|---|---|
| Eng (3 senior + 1 ML/RPA) | $18M | $216M |
| Sales/CS (1 founder-led + 2 SDR + 1 CSM Q3+) | $8M | $96M |
| Infra (Cloud, LLM no facturable, RPA, captcha, observability) | $3M | $36M |
| Legal/abogado revisor Tier-3 (part-time → full-time Q3) | $4M | $48M |
| G&A (legal/contable, oficina, tools) | $2M | $24M |
| Marketing (LinkedIn ads, eventos CChC/COPROCH, contenido) | $2M | $24M |
| **Total OPEX** | **$37M** | **$444M** |

### Breakeven

- Break-even mensual: $37M de revenue ≈ 55 oficinas × $675k
- Alcanzable mes 8-10 con ramp planificado
- Burn año 1 estimado: $444M opex - $450M revenue = **breakeven al cierre**, con runway requerido $200-300M para superar trough Q1-Q2

### Sensibilidad

| Adoption | Estudios/of/mes | ARPU/of/mes | ARR run-rate Q4 (100 of) |
|---|---|---|---|
| 30% (pessimistic) | 9 | $400k | $480M |
| 60% (base) | 18 | $675k | $810M |
| 90% (bull) | 27 | $850k | $1.020M |

---

## 7. Go-to-market

### 7.1 Beachhead

**RM Santiago Las Condes / Vitacura / Providencia / Lo Barnechea premium.**
Razón: alta densidad inmobiliarias premium (E&V, Sotheby's, boutiques), tickets altos justifican pricing, broker tech-savvy, prensa proptech concentrada.

### 7.2 Expansion path

1. **Mes 0-6:** RM premium (10-30 logos)
2. **Mes 6-12:** RM resto (Ñuñoa, La Reina, comunas medianas) + Viña/Concón
3. **Mes 12-18:** Rancagua + Talca + Curicó (vitivinícola premium niche, conversión menor pero ARPU enterprise)
4. **Mes 18-24:** Concepción + Valdivia + Pucón segunda vivienda
5. **Mes 24+:** Vertical bancos (segmento E)

### 7.3 Channels

| Channel | Costo | Conversión esperada | Notas |
|---|---|---|---|
| Founder-led B2B (LinkedIn, intro warm, cafés) | Tiempo founder | Alta (20-40%) | Primeros 30 logos |
| LinkedIn Ads targeting brokers + jefes inmobiliarias | $2-5M/mes | 2-5% | Para escalar post-PMF |
| Partner abogados inmobiliarios revenue share | 15-25% rev share | Media | Lock-in geográfico, defensa anti-lobby |
| Eventos CChC / COPROCH / FIDI | $1-3M/evento | Brand + leads | Trust gremial necesario |
| Content SEO (blog ET en Chile, casos reales anonimizados) | $500k/mes contenido | Long-tail | Año 2+ |
| Referidos broker→broker (con incentivo $50k crédito) | Bajo | Alta calidad | Activar mes 6+ |

### 7.4 Trial / onboarding

- **Trial 30 días, 5 estudios gratis** (cubre costo $150k, lifetime expected $5-10M, ROI altísimo)
- **CS personalizado primeros 10 logos** (founder + CSM mano a mano, white-glove, capturar feedback producto)
- **Playbook onboarding:** kick-off call → primer estudio paired session → review día 7 → check-in día 30 → upsell oficina

---

## 8. Defensa competitiva (moats)

| Moat | Mecanismo | Tiempo construcción |
|---|---|---|
| **Network effect golden cases** | Cada estudio enriquece BD de patrones, errores, flags; mejor precisión LLM | 6-18 meses con volumen |
| **Data moat cadena tracto sucesivo** | BD propietaria de propietarios históricos cross-CBR; query "¿esta persona aparece en otra cadena?" | 12-24 meses |
| **Integraciones B2B con CBR Santiago** | Si volumen >5k estudios/mes, posible convenio API directa (vs scraping) | 18-36 meses, gated por relación |
| **Switching cost histórico** | Cliente acumula 100s de estudios + safeguards integrados con su CRM PropOS, dificil migrar | 6-12 meses por cliente |
| **Brand + trust gremial** | CChC/COPROCH endorsement, abogado-firm partnerships | 12-24 meses |
| **Regulatory know-how** | DL 2.695, DL 17.729, derechos agua, servidumbres rurales — barrera empírica | Continuo |

---

## 9. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Tusler u otro escala con $$$ VC** | Alta | Alto | Velocidad GTM, lock-in vía CRM integración, foco vertical (vitivinícola) |
| **BancoEstado/Santander lanza interno** | Media | Alto (comoditiza segmento E) | No competir en banco grande, foco inmobiliarias; ofrecer white-label B2B2C a banco mediano |
| **CBR cambia política / bloquea scraping** | Media | Alto | Diversificar CBRs; convenio API formal; lobby gremial vía CChC; respaldo legal scraping data pública |
| **Notarios/abogados lobby anti-tech** | Media | Medio | Partner con abogados (revenue share) en vez de competirlos; nunca presentar como "reemplazo abogado" |
| **Recesión inmobiliaria (-30% transacciones)** | Media | Medio | Pricing flexible, hibrido base+per-study amortigua; diversificar a bancos DD |
| **LLM costs explotan (Anthropic price hike)** | Baja | Medio | Multi-provider (Cerebras dev → Anthropic prod ya implementado), fallback Llama, prompt caching agresivo |
| **Liability legal por error en ET automatizado** | Media | Alto | Disclaimer claro "no sustituye abogado", póliza E&O, Tier-3 humano en casos rojos, log auditoría completo |

---

## 10. Métricas comerciales objetivo

| Métrica | Target año 1 | Benchmark proptech B2B |
|---|---|---|
| CAC payback | <12 meses | 12-18m benchmark; <12m excelente |
| LTV/CAC | >3x | 3-5x healthy, 5-8x excellent |
| NRR (Net Revenue Retention) | >110% | 100% mantención, >120% top quartile |
| Gross margin | >70% | 70-80% SaaS típico, lower con costos variables RPA+LLM |
| Logo churn anual | <15% | Proptech 10-20% |
| Magic number | >0.7 | >1 = invertir más en sales |
| Time to first value | <7 días | Primer estudio entregado |
| Ramp time broker activo | <30 días | 5+ estudios/mes |

---

## 11. Experimentos pricing año 1

| Experimento | Hipótesis | Métrica decisión | Timing |
|---|---|---|---|
| **A/B per-study (A) vs subscription seat (B)** sobre 30 leads | B genera 1.5x ARR pero conversión inicial 30% menor | LTV after 6m | Q1-Q2 |
| **Premium tier SLA <24h** (+30% precio) | 20-30% clientes premium pagarán | Take rate | Q2 |
| **Add-on consultoría abogado revenue share** (PropOS factura $120k, abogado partner cobra $80k, PropOS keep $40k) | Incrementa NRR sin diluir margen | Attach rate | Q3 |
| **Volume discount tiers** (50+ estudios/mes -15%, 100+ -25%) | Acelera adoption oficinas grandes | Estudios/of/mes | Q2-Q3 |
| **Vitivinícola enterprise per-deal** ($500k-1.5M por DD M&A predio) | Captura segmento D con price discrimination | Closed deals | Q3-Q4 |
| **Free tier limitado (1 estudio/mes broker individual)** | Conversión 5-8% paid + lead gen | Paid conversion | Q4 |

---

## 12. Recomendación pricing

### Modelo recomendado #1: **Hybrid (D)**

**Estructura:**
- **Base oficina:** $300.000/mes (incluye 5 estudios/mes pooled, hasta 10 broker seats activos)
- **Per-study adicional:** $25.000 urbano simple, $90.000 rural/vitivinícola
- **Premium SLA <24h:** +30%
- **Vitivinícola enterprise DD:** $500k-1.5M custom per deal
- **Volume discount:** 50+ estudios/mes -15%, 100+ -25%

### 3 razones

1. **Captura ARR predecible (base $300k/of × 100 of = $30M/mes recurring) sin sacrificar upside volumen** (per-study escala con uso real broker, alinea costos variables LLM+RPA+Tier-3 con ingresos)
2. **Anchoring eficaz en ambos lados:** base mensual posiciona como "infra inmobiliaria" tipo software (lock-in alto, mental model SaaS), per-study compite directo con abogado tradicional ($25k vs $75-150k = 50-70% descuento explícito narrativa comercial)
3. **Flexibilidad segmentación:** mismo modelo sirve segmento A (grandes con descuento por volumen), B (sweet spot), D (premium per-deal); mientras segmentos C (freemium tier futuro) y E (enterprise contract) se adaptan como variantes sin reescribir core pricing

### 1 alerta crítica

**Liability legal del estudio automatizado.** Si PropOS no está claramente posicionado como herramienta de apoyo (no reemplazo del abogado/notario), un solo caso de error material en ET que provoque pérdida patrimonial al comprador (ej. cadena rota no detectada, embargo oculto post-fecha corte) puede generar (a) demanda civil por daños, (b) lobby gremial Colegio de Abogados con eco mediático, (c) crisis trust irreparable en stage temprano. **Mitigación obligatoria pre-launch comercial:**
- Disclaimer contractual robusto firmado por cliente en cada estudio
- Póliza Errors & Omissions con cobertura ≥UF 5.000/evento
- Tier-3 humano abogado revisor obligatorio en cualquier caso amarillo/rojo (no opt-out cliente)
- Log auditoría inmutable de cada decisión LLM + intervención humana
- Política de re-emisión gratuita + reembolso 100% si error comprobable detectado <30 días

---

## Ruta del documento

`/Users/vicenteaguero/real-state/PropOS/docs/research/title-study/19-business-model-pricing.md`

## Fuentes

- CChC informes mercado inmobiliario RM 2024-2025
- Banco Central Chile IPV (basado en SII F2890)
- La Tercera Pulso "Venta viviendas RM 2025 +28%"
- Aranceles CBR (pjud.cl, conservador.cl, cbrchillan.cl)
- Total Abogados, Patrocinium, Espinosa & Cía, GPremium honorarios ET Chile
- COPROCH coproch.cl
- Engel & Völkers Chile, Coldwell Banker Chile websites
- DataProp.cl, TocToc.com pricing públicos
- First American, Bankrate, Urban Institute title insurance USA
- Qubit Capital PropTech SaaS benchmarks; Pavilion B2B SaaS 2025 benchmarks
- Startupeable / Latitud / Contxto Loft + Habi Latam proptech reports
