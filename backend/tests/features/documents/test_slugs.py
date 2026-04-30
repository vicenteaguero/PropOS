import re

from app.features.documents.slugs import generate_slug


def test_default_length():
    assert len(generate_slug()) == 8


def test_custom_length():
    assert len(generate_slug(12)) == 12


def test_alphabet():
    pattern = re.compile(r"^[a-z0-9]+$")
    for _ in range(20):
        assert pattern.match(generate_slug())


def test_unique_enough():
    slugs = {generate_slug() for _ in range(1000)}
    # 1000 slugs de 8 chars de alfabeto 36 → colisiones casi imposibles
    assert len(slugs) == 1000
