"""Canonical tool definitions in OpenAI function-calling format.

The LLM client adapter (anita/llm.py) translates to provider-specific
formats (Anthropic uses input_schema instead of parameters).
"""

from __future__ import annotations

# Read-only tools (no proposals; hit live data)
READ_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "find_person",
            "description": "Busca personas (contactos) por nombre, RUT o alias. Retorna candidatos con score.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Nombre o fragmento."},
                    "limit": {"type": "integer", "default": 5, "maximum": 20},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_property",
            "description": "Busca propiedades por título o dirección.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "status": {"type": "string", "enum": ["AVAILABLE", "RESERVED", "SOLD", "INACTIVE"]},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_organization",
            "description": "Busca organizaciones (notarías, portales, agencias) por nombre.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "kind": {"type": "string"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_project",
            "description": "Busca proyectos por nombre.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_campaign",
            "description": "Busca campañas publicitarias por nombre.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "channel": {"type": "string"},
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clarify",
            "description": "Pregunta al usuario para resolver ambigüedad. NO escribe nada en BD.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "candidates": {"type": "array", "items": {"type": "object"}},
                },
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_data",
            "description": "Analytics seguro: solo views/filtros pre-aprobados. Retorna ≤200 filas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "view": {
                        "type": "string",
                        "enum": [
                            "transactions_summary",
                            "tasks_open_count",
                            "interactions_count",
                            "opportunities_pipeline",
                        ],
                    },
                    "filters": {"type": "object"},
                },
                "required": ["view"],
            },
        },
    },
]


# Mutation tools (all create pending_proposals)
PROPOSE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "propose_create_person",
            "description": "Crea un contacto/persona. Requiere full_name + kind.",
            "parameters": {
                "type": "object",
                "properties": {
                    "full_name": {"type": "string"},
                    "kind": {
                        "type": "string",
                        "enum": [
                            "BUYER", "SELLER", "LANDOWNER", "NOTARY",
                            "INVESTOR", "EMPLOYEE", "FAMILY", "VENDOR",
                            "STAKEHOLDER", "OTHER",
                        ],
                    },
                    "rut": {"type": "string"},
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                    "notes": {"type": "string"},
                    "summary_es": {"type": "string", "description": "Resumen 1-línea para UI."},
                },
                "required": ["full_name", "kind", "summary_es"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_log_interaction",
            "description": "Registra visita, llamada, email, nota, reunión, showing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["VISIT", "CALL", "EMAIL", "WHATSAPP_LOG", "NOTE", "MEETING", "SHOWING", "OTHER"]},
                    "summary": {"type": "string"},
                    "body": {"type": "string"},
                    "occurred_at": {"type": "string", "description": "ISO8601 o vacío para now()."},
                    "duration_minutes": {"type": "integer"},
                    "participant_person_ids": {"type": "array", "items": {"type": "string"}},
                    "property_id": {"type": "string"},
                    "project_id": {"type": "string"},
                    "summary_es": {"type": "string"},
                },
                "required": ["kind", "summary", "summary_es"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_create_task",
            "description": "Crea TODO/PENDING/GOAL/OBJECTIVE/PLAN.",
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["TODO", "PENDING", "GOAL", "OBJECTIVE", "PLAN"]},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "due_at": {"type": "string"},
                    "priority": {"type": "integer"},
                    "related": {"type": "object"},
                    "summary_es": {"type": "string"},
                },
                "required": ["kind", "title", "summary_es"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_log_transaction",
            "description": "Registra gasto/ingreso/boleta. Amount en pesos enteros (50000 = $50.000 CLP).",
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {"type": "string", "enum": ["IN", "OUT"]},
                    "category": {
                        "type": "string",
                        "enum": [
                            "AD_SPEND", "COMMISSION", "RENT", "UTILITY", "SALARY",
                            "NOTARY_FEE", "MARKETING", "SOFTWARE", "TAX",
                            "REIMBURSEMENT", "SALE_PROCEEDS", "DEPOSIT", "REFUND",
                            "TRANSFER", "OTHER",
                        ],
                    },
                    "amount": {"type": "integer", "description": "En pesos enteros (no centavos)."},
                    "currency": {"type": "string", "default": "CLP"},
                    "occurred_at": {"type": "string"},
                    "description": {"type": "string"},
                    "vendor_org_id": {"type": "string"},
                    "related_property_id": {"type": "string"},
                    "related_project_id": {"type": "string"},
                    "related_campaign_id": {"type": "string"},
                    "summary_es": {"type": "string"},
                },
                "required": ["direction", "category", "amount", "summary_es"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_create_campaign",
            "description": "Crea campaña publicitaria.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "channel": {"type": "string", "enum": ["META", "GOOGLE", "PORTAL", "EMAIL", "OFFLINE", "OTHER"]},
                    "budget": {"type": "integer", "description": "Pesos enteros."},
                    "currency": {"type": "string", "default": "CLP"},
                    "start_at": {"type": "string"},
                    "end_at": {"type": "string"},
                    "summary_es": {"type": "string"},
                },
                "required": ["name", "channel", "summary_es"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_create_organization",
            "description": "Crea organización (notaría, portal, banco, etc).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "kind": {"type": "string", "enum": ["NOTARY", "PORTAL", "GOV", "BANK", "AGENCY", "BROKERAGE", "CONTRACTOR", "SUPPLIER", "OTHER"]},
                    "summary_es": {"type": "string"},
                },
                "required": ["name", "kind", "summary_es"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_add_note",
            "description": "Agrega nota libre asociada a una entidad.",
            "parameters": {
                "type": "object",
                "properties": {
                    "body": {"type": "string"},
                    "target_table": {"type": "string"},
                    "target_row_id": {"type": "string"},
                    "summary_es": {"type": "string"},
                },
                "required": ["body", "summary_es"],
            },
        },
    },
]


def all_tools() -> list[dict]:
    return READ_TOOLS + PROPOSE_TOOLS
