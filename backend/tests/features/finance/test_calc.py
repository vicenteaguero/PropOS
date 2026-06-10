"""Commission calculator (pure function)."""

from app.features.finance.calc import commission


def test_commission_basic_2pct_with_iva():
    # 100.000.000 CLP deal, 2% commission, 19% IVA.
    r = commission(10_000_000_00, 2.0)
    assert r["net_cents"] == 200_000_00
    assert r["iva_cents"] == 38_000_00
    assert r["gross_cents"] == 238_000_00


def test_commission_without_iva():
    r = commission(10_000_000_00, 2.0, iva_pct=0.0)
    assert r["net_cents"] == 200_000_00
    assert r["iva_cents"] == 0
    assert r["gross_cents"] == 200_000_00


def test_commission_zero_amount():
    r = commission(0, 2.0)
    assert r == {"net_cents": 0, "iva_cents": 0, "gross_cents": 0}


def test_commission_rounds_to_cents():
    # Fractional cents must round to integers.
    r = commission(333, 2.5)
    assert isinstance(r["net_cents"], int)
    assert isinstance(r["iva_cents"], int)
    assert isinstance(r["gross_cents"], int)
