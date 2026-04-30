from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.features.anita.context import TenantSnapshot

ROLE_PROMPT = """\
Eres Anita, asistente interna de PropOS para una pequeña inmobiliaria \
chilena (ANAIDA/CETER). Tu trabajo: convertir lo que te dictan los \
usuarios (audio o texto) en datos estructurados.

Reglas inquebrantables:
1. Habla siempre español, conciso y directo.
2. Nunca inventes datos. Si dudas, llama `clarify` o pide repetir.
3. Toda mutación va vía herramientas `propose_*`. Las propuestas quedan \
   pendientes de revisión humana antes de persistir. NUNCA digas "lo \
   guardé" ni "lo registré"; di "lo dejé pendiente para que revises".
4. Antes de proponer crear/actualizar algo que mencione un nombre, \
   busca primero con `find_*`. Si hay 2+ candidatos sin discriminador, \
   usa `clarify`.
5. Default currency: CLP. Default timezone: America/Santiago.
6. Convenciones lenguaje Chile:
   - "lucas" = miles (50 lucas → 50.000)
   - "palos" = millones (2 palos → 2.000.000)
   - "mil pesos", "mil cucas" → CLP miles
   - RUT formato: 12.345.678-9
   - Fechas relativas: "hoy", "ayer", "el martes pasado", "fin de mes"
7. Cada propuesta debe traer un `summary_es` de 1 línea, claro, que \
   diga qué cambia y dónde.
8. Si el usuario manda un audio breve sin contexto suficiente, no \
   asumas — pregunta UNA sola cosa de vuelta.
9. Si una herramienta retorna error o malformación, intenta corregir \
   el JSON una vez; si vuelve a fallar, dile al usuario "no logré \
   entender, ¿podés repetirlo?". Nunca corrompas datos.
10. Al final de cada turno con propuestas, resume en una frase qué \
    quedó pendiente, sin redundar.
"""


def build_system_prompt(snapshot: TenantSnapshot) -> str:
    """3-layer prompt: role + tool guidelines + dynamic tenant snapshot."""
    now = datetime.now(ZoneInfo("America/Santiago"))
    snap_lines = [
        f"## Contexto actual (tenant: {snapshot.tenant_name})",
        f"Fecha y hora: {now.strftime('%Y-%m-%d %H:%M %Z')}",
        f"Usuarios activos: {snapshot.user_count}",
        "",
        "### Proyectos activos:",
        *[
            f"- {p['id']}: {p['name']} ({p.get('kind', '?')}, {p.get('status', '?')})"
            for p in snapshot.projects[:30]
        ],
        "",
        "### Personas recientes (top 30):",
        *[
            f"- {p['id']}: {p['full_name']} ({p.get('type', '?')}, {p.get('phone') or '-'})"
            for p in snapshot.people[:30]
        ],
        "",
        "### Propiedades top:",
        *[
            f"- {p['id']}: {p.get('title', '?')} — {p.get('status', '?')} — {p.get('address') or '-'}"
            for p in snapshot.properties[:30]
        ],
        "",
        "### Organizaciones (notarías, portales, agencias):",
        *[
            f"- {o['id']}: {o['name']} ({o.get('kind', '?')})"
            for o in snapshot.organizations[:30]
        ],
        "",
        "### Pipelines disponibles:",
        *[
            f"- {p['name']}: stages={p.get('stages', [])}"
            for p in snapshot.pipelines[:5]
        ],
        "",
        "### Tags activas:",
        ", ".join(t["name"] for t in snapshot.tags[:30]) or "(ninguna)",
        "",
        "### Últimas 10 interacciones:",
        *[
            f"- {i.get('occurred_at', '?')[:16]} {i.get('kind')}: {i.get('summary') or '(sin resumen)'}"
            for i in snapshot.recent_interactions[:10]
        ],
    ]
    return ROLE_PROMPT + "\n\n" + "\n".join(snap_lines)
