"""Regression tests for UNNE Titan mbox parsing logic.

Tests cover the v12+ classifier and extractor regexes used in
`backend/notebooks/unne_email_analysis.ipynb`. Run via:

    cd backend
    poetry run pytest scripts/test_unne_email_parsing.py -v
"""

from __future__ import annotations

import re

import pytest


LEAD_SUBJECT_PATTERNS = {
    "Yapo": re.compile(
        r"alguien est[aá] interesado|te han contactado|"
        r"interesado en (?:el )?anuncio|"
        r"yapo\.cl\s*-\s*(?:interesado|consulta reenviada)",
        re.I,
    ),
    "TocToc": re.compile(r"solicitud de contacto a la propiedad", re.I),
    "Portal Inmobiliario": re.compile(r"recibiste un contacto", re.I),
    "MercadoLibre": re.compile(r"te contactaron en", re.I),
    "Proppit": re.compile(r"nueva solicitud|nueva consulta", re.I),
    "Chile Propiedades": re.compile(r"contacto en chilepropiedades", re.I),
    "Doomos": re.compile(r"has recibido una pregunta", re.I),
    "Enlace Inmobiliario": re.compile(r"notificaciones de acci[oó]n", re.I),
}

CUSTOMER_REPLY_SUBJ = re.compile(r"^\s*re:\s+", re.I)

ENLACE_ACTIONS = [
    "Consulta Corredora",
    "Consulta Whatsapp",
    "Visita a la Ficha",
    "Ver datos Corredora",
    "Quiero que me Contacten",
    "Solicitud de PreAprobación Enviada",
    "Solicitud de PreAprobación Respondida",
    "Solicitud de PreAprobación Inconclusa",
    "Simulación Dividendo",
]
ACTIVE_ACTIONS = {
    "Consulta Corredora",
    "Consulta Whatsapp",
    "Ver datos Corredora",
    "Quiero que me Contacten",
}
MORTGAGE_ACTIONS = {
    "Solicitud de PreAprobación Enviada",
    "Solicitud de PreAprobación Respondida",
    "Solicitud de PreAprobación Inconclusa",
    "Simulación Dividendo",
}
_action_pat = "|".join(re.escape(a) for a in ENLACE_ACTIONS)
ACTION_ROW_RE = re.compile(
    r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})"
    rf"({_action_pat})"
    r"(\d+)([A-ZÁÉÍÓÚÑa-záéíóúñ ]+?)(?:Enlace|Banco|Marketplace|Simulador|Hipotecario)",
    re.I,
)

PROPPIT_TEMPLATE_B = re.compile(
    r"Propiedad de inter[eé]s\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,0-9]+?)\s+(\d{4,5})\s+(?:\$|UF|\d)",
    re.I,
)
PROPPIT_OLD_REF = re.compile(r"Ref\.\s*(\d{9})", re.I)

YAPO_ID_EXTERNO_RE = re.compile(r"ID\s+Externo:?\s*(\d{3,5})", re.I)
TOCTOC_BODY_CODE_RE = re.compile(r"C[oó]digo de propiedad:?\s*(\d+)", re.I)
TOCTOC_SUBJ_RE = re.compile(r"propiedad\s+(\d+)", re.I)
ENLACE_HEADER_NR_RE = re.compile(r"producto\s+(\d+)", re.I)
CP_EXT_RE = re.compile(r"C[oó]digo\s+Externo\s+(\d+)", re.I)
CP_EXT_SUBJ_RE = re.compile(r"ID externo:?\s*(\d+)", re.I)
DOOMOS_SLUG_RE = re.compile(r"doomos\.cl/[^/]+/(\d+)_", re.I)


class TestYapoClassifier:
    def test_lead_subject_classic(self):
        s = "Alguien está interesado en tu anuncio - 85702049"
        assert LEAD_SUBJECT_PATTERNS["Yapo"].search(s)

    def test_lead_subject_consulta_reenviada(self):
        s = "Yapo.cl - Consulta reenviada"
        assert LEAD_SUBJECT_PATTERNS["Yapo"].search(s)

    def test_lead_subject_interesado_en_anuncio(self):
        s = "Yapo.cl - Interesado en anuncio no. 28645748"
        assert LEAD_SUBJECT_PATTERNS["Yapo"].search(s)

    def test_marketing_subject_rejected(self):
        assert not LEAD_SUBJECT_PATTERNS["Yapo"].search("Reposiciona tus anuncios y vende más rápido")
        assert not LEAD_SUBJECT_PATTERNS["Yapo"].search("Prueba IRIS hoy por $990")
        assert not LEAD_SUBJECT_PATTERNS["Yapo"].search("¡Estás invitado!")

    def test_yapo_id_externo_extraction(self):
        body = "ID de anuncio 32015937 ID Externo: 32327 Nombre: Verónica Teléfono: 0056 957181497"
        m = YAPO_ID_EXTERNO_RE.search(body)
        assert m is not None and m.group(1) == "32327"


class TestTocTocClassifier:
    def test_lead_subject_match(self):
        s = "TOCTOC.com - Solicitud de contacto a la propiedad 34589"
        assert LEAD_SUBJECT_PATTERNS["TocToc"].search(s)

    def test_nps_marketing_rejected(self):
        assert not LEAD_SUBJECT_PATTERNS["TocToc"].search("📈 Tu feedback importa: responde nuestra encuesta")
        assert not LEAD_SUBJECT_PATTERNS["TocToc"].search("¡No olvides compartir tu opinión! Con tu evaluación NPS")
        assert not LEAD_SUBJECT_PATTERNS["TocToc"].search("¡Última oportunidad! Tu evaluación NPS")
        assert not LEAD_SUBJECT_PATTERNS["TocToc"].search("¡Tasación con 20% de descuento!")

    def test_codigo_propiedad_extraction(self):
        body = "Buenas noticias ... Código de propiedad: 34589 Tipo de propiedad: Casa"
        m = TOCTOC_BODY_CODE_RE.search(body)
        assert m is not None and m.group(1) == "34589"

    def test_subject_propiedad_id(self):
        s = "TOCTOC.com - Solicitud de contacto a la propiedad 11581"
        m = TOCTOC_SUBJ_RE.search(s)
        assert m is not None and m.group(1) == "11581"


class TestEnlaceParsing:
    def test_action_row_basic(self):
        body = "2026-03-27 10:53:48Consulta Corredora32352RancaguaEnlace Banco de Chile Usados"
        m = ACTION_ROW_RE.search(body)
        assert m is not None
        assert m.group(3) == "Consulta Corredora"
        assert m.group(4) == "32352"

    def test_action_row_visita_ficha(self):
        body = "2025-10-17 23:57:01Visita a la Ficha20802RancaguaEnlace Falabella"
        m = ACTION_ROW_RE.search(body)
        assert m is not None
        assert m.group(3) == "Visita a la Ficha"
        assert m.group(4) == "20802"

    def test_action_row_consulta_whatsapp(self):
        body = "2026-04-30 14:31:58Consulta Whatsapp34457RancaguaEnlace Banco de Chile"
        m = ACTION_ROW_RE.search(body)
        assert m is not None and m.group(3) == "Consulta Whatsapp"

    def test_action_row_mortgage_preaprobacion(self):
        body = "2026-04-21 22:16:19Solicitud de PreAprobación Enviada32288RancaguaBanco de Chile"
        m = ACTION_ROW_RE.search(body)
        assert m is not None
        assert m.group(3) == "Solicitud de PreAprobación Enviada"

    def test_action_row_simulacion_dividendo(self):
        body = "2026-04-21 22:08:17Simulación Dividendo32302RancaguaSimulador Hipotecario"
        m = ACTION_ROW_RE.search(body)
        assert m is not None and m.group(3) == "Simulación Dividendo"

    def test_multiple_rows_in_one_email(self):
        body = (
            "2025-10-17 23:57:01Visita a la Ficha20802RancaguaEnlace Falabella ... "
            "2025-10-17 20:35:48Visita a la Ficha19000Isla de MaipoEnlace Falabella"
        )
        matches = ACTION_ROW_RE.findall(body)
        assert len(matches) == 2

    def test_active_vs_passive_vs_mortgage_categorization(self):
        assert "Consulta Corredora" in ACTIVE_ACTIONS
        assert "Consulta Whatsapp" in ACTIVE_ACTIONS
        assert "Visita a la Ficha" not in ACTIVE_ACTIONS
        assert "Visita a la Ficha" not in MORTGAGE_ACTIONS
        assert "Simulación Dividendo" in MORTGAGE_ACTIONS

    def test_header_nr_extraction(self):
        body = "para el producto 32327 con dirección SECTOR SANTA NATALIA"
        m = ENLACE_HEADER_NR_RE.search(body)
        assert m is not None and m.group(1) == "32327"


class TestProppitExtraction:
    def test_template_b_extraction(self):
        body = "Propiedad de interés VIÑA SANTA BLANCA 32535 90.000.000 CLP Pasaje Nemesio Antúnez"
        m = PROPPIT_TEMPLATE_B.search(body)
        assert m is not None and m.group(2) == "32535"

    def test_template_b_with_uf(self):
        body = "Propiedad de interés VIÑA SANTA BLANCA 33398 3.050 CLF 282, Rancagua"
        m = PROPPIT_TEMPLATE_B.search(body)
        assert m is not None and m.group(2) == "33398"

    def test_template_a_9digit_ref(self):
        body = "Ref. 101064405"
        m = PROPPIT_OLD_REF.search(body)
        assert m is not None and m.group(1) == "101064405"


class TestChilePropiedadesExtraction:
    def test_codigo_externo_body(self):
        body = "Código 28597708 Código Externo 101068155 Valor"
        m = CP_EXT_RE.search(body)
        assert m is not None and m.group(1) == "101068155"

    def test_id_externo_subject(self):
        s = "Contacto en ChilePropiedades.cl [ID externo: 101068155]"
        m = CP_EXT_SUBJ_RE.search(s)
        assert m is not None and m.group(1) == "101068155"


class TestDoomosExtraction:
    def test_slug_id_extraction(self):
        body = "https://www.doomos.cl/de/2265260_venta-casa-machali-haras-de-machali.html"
        m = DOOMOS_SLUG_RE.search(body)
        assert m is not None and m.group(1) == "2265260"


class TestCustomerReplyDetection:
    def test_subject_starts_re(self):
        assert CUSTOMER_REPLY_SUBJ.search("Re: casa el Parronal")
        assert CUSTOMER_REPLY_SUBJ.search("RE: arriendo departamento")

    def test_non_reply_subject_rejected(self):
        assert not CUSTOMER_REPLY_SUBJ.search("Alguien está interesado")
        assert not CUSTOMER_REPLY_SUBJ.search("Consulta de propiedad")


@pytest.mark.parametrize(
    "input_phone,expected",
    [
        ("+56 9 90905082", "90905082"),
        ("+56990905082", "90905082"),
        ("990905082", "90905082"),
        ("9-90905082", "90905082"),
        ("", None),
    ],
)
def test_phone_normalization(input_phone, expected):
    digits = re.sub(r"\D", "", input_phone or "")
    if not digits:
        result = None
    else:
        if digits.startswith("56") and len(digits) > 9:
            digits = digits[2:]
        result = digits[-8:] if len(digits) >= 8 else digits
    assert result == expected
