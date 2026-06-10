"""Portal lead-email parser tests (promoted from scripts/test_unne_email_parsing.py)."""

import re

import pytest

from app.features.email_sync.parsers import (
    ACTION_ROW_RE,
    ACTIVE_ACTIONS,
    CP_EXT_RE,
    CP_EXT_SUBJ_RE,
    DOOMOS_SLUG_RE,
    ENLACE_HEADER_NR_RE,
    LEAD_SUBJECT_PATTERNS,
    MORTGAGE_ACTIONS,
    PROPPIT_OLD_REF,
    PROPPIT_TEMPLATE_B,
    TOCTOC_BODY_CODE_RE,
    TOCTOC_SUBJ_RE,
    YAPO_ID_EXTERNO_RE,
    classify_email,
    detect_portal,
    is_customer_reply,
    normalize_phone,
)


class TestYapoClassifier:
    def test_lead_subject_classic(self):
        assert LEAD_SUBJECT_PATTERNS["Yapo"].search("Alguien está interesado en tu anuncio - 85702049")

    def test_lead_subject_consulta_reenviada(self):
        assert LEAD_SUBJECT_PATTERNS["Yapo"].search("Yapo.cl - Consulta reenviada")

    def test_lead_subject_interesado_en_anuncio(self):
        assert LEAD_SUBJECT_PATTERNS["Yapo"].search("Yapo.cl - Interesado en anuncio no. 28645748")

    def test_marketing_subject_rejected(self):
        assert not LEAD_SUBJECT_PATTERNS["Yapo"].search("Reposiciona tus anuncios y vende más rápido")
        assert not LEAD_SUBJECT_PATTERNS["Yapo"].search("Prueba IRIS hoy por $990")

    def test_yapo_id_externo_extraction(self):
        body = "ID de anuncio 32015937 ID Externo: 32327 Nombre: Verónica"
        m = YAPO_ID_EXTERNO_RE.search(body)
        assert m is not None and m.group(1) == "32327"


class TestTocTocClassifier:
    def test_lead_subject_match(self):
        assert LEAD_SUBJECT_PATTERNS["TocToc"].search("TOCTOC.com - Solicitud de contacto a la propiedad 34589")

    def test_nps_marketing_rejected(self):
        assert not LEAD_SUBJECT_PATTERNS["TocToc"].search("📈 Tu feedback importa: responde nuestra encuesta")

    def test_codigo_propiedad_extraction(self):
        m = TOCTOC_BODY_CODE_RE.search("Código de propiedad: 34589 Tipo de propiedad: Casa")
        assert m is not None and m.group(1) == "34589"

    def test_subject_propiedad_id(self):
        m = TOCTOC_SUBJ_RE.search("TOCTOC.com - Solicitud de contacto a la propiedad 11581")
        assert m is not None and m.group(1) == "11581"


class TestEnlaceParsing:
    def test_action_row_basic(self):
        m = ACTION_ROW_RE.search("2026-03-27 10:53:48Consulta Corredora32352RancaguaEnlace Banco de Chile Usados")
        assert m is not None and m.group(3) == "Consulta Corredora" and m.group(4) == "32352"

    def test_action_row_visita_ficha(self):
        m = ACTION_ROW_RE.search("2025-10-17 23:57:01Visita a la Ficha20802RancaguaEnlace Falabella")
        assert m is not None and m.group(4) == "20802"

    def test_multiple_rows_in_one_email(self):
        body = (
            "2025-10-17 23:57:01Visita a la Ficha20802RancaguaEnlace Falabella ... "
            "2025-10-17 20:35:48Visita a la Ficha19000Isla de MaipoEnlace Falabella"
        )
        assert len(ACTION_ROW_RE.findall(body)) == 2

    def test_categorization(self):
        assert "Consulta Corredora" in ACTIVE_ACTIONS
        assert "Visita a la Ficha" not in ACTIVE_ACTIONS
        assert "Simulación Dividendo" in MORTGAGE_ACTIONS

    def test_header_nr_extraction(self):
        m = ENLACE_HEADER_NR_RE.search("para el producto 32327 con dirección SECTOR SANTA NATALIA")
        assert m is not None and m.group(1) == "32327"


class TestProppitExtraction:
    def test_template_b_extraction(self):
        m = PROPPIT_TEMPLATE_B.search("Propiedad de interés VIÑA SANTA BLANCA 32535 90.000.000 CLP Pasaje")
        assert m is not None and m.group(2) == "32535"

    def test_template_a_9digit_ref(self):
        m = PROPPIT_OLD_REF.search("Ref. 101064405")
        assert m is not None and m.group(1) == "101064405"


class TestChilePropiedadesExtraction:
    def test_codigo_externo_body(self):
        m = CP_EXT_RE.search("Código 28597708 Código Externo 101068155 Valor")
        assert m is not None and m.group(1) == "101068155"

    def test_id_externo_subject(self):
        m = CP_EXT_SUBJ_RE.search("Contacto en ChilePropiedades.cl [ID externo: 101068155]")
        assert m is not None and m.group(1) == "101068155"


class TestDoomosExtraction:
    def test_slug_id_extraction(self):
        m = DOOMOS_SLUG_RE.search("https://www.doomos.cl/de/2265260_venta-casa-machali.html")
        assert m is not None and m.group(1) == "2265260"


class TestCustomerReplyDetection:
    def test_subject_starts_re(self):
        assert is_customer_reply("Re: casa el Parronal")
        assert is_customer_reply("RE: arriendo departamento")

    def test_non_reply_subject_rejected(self):
        assert not is_customer_reply("Alguien está interesado")


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
    assert normalize_phone(input_phone) == expected


class TestClassifyEmail:
    def test_yapo_lead_detected(self):
        lead = classify_email("Yapo.cl - Interesado en anuncio no. 28645748", "ID Externo: 32327")
        assert lead is not None and lead.portal == "Yapo" and lead.property_external_id == "32327"

    def test_toctoc_lead_detected(self):
        lead = classify_email("TOCTOC.com - Solicitud de contacto a la propiedad 11581", "Código de propiedad: 34589")
        assert lead is not None and lead.portal == "TocToc" and lead.property_external_id == "34589"

    def test_marketing_not_a_lead(self):
        assert classify_email("Reposiciona tus anuncios y vende más rápido", "promo") is None

    def test_detect_portal_none(self):
        assert detect_portal("Newsletter semanal") is None

    def test_enlace_external_id(self):
        lead = classify_email(
            "Enlace Inmobiliario - notificaciones de acción",
            "2026-03-27 10:53:48Consulta Corredora32352RancaguaEnlace Banco de Chile",
        )
        assert lead is not None and lead.portal == "Enlace Inmobiliario" and lead.property_external_id == "32352"


def test_no_marketing_regex_false_positive():
    # Sanity: a plain promotional subject matches no portal.
    assert not any(p.search("¡Tasación con 20% de descuento!") for p in LEAD_SUBJECT_PATTERNS.values())
    assert re.compile  # keep `re` import meaningful
