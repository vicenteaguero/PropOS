from app.features.documents.passwords import hash_password, verify_password


def test_hash_format():
    h = hash_password("secret")
    parts = h.split("$")
    assert len(parts) == 3
    assert parts[0] == "scrypt"
    assert len(parts[1]) == 32
    assert len(parts[2]) == 64


def test_verify_correct():
    h = hash_password("correct horse")
    assert verify_password("correct horse", h) is True


def test_verify_incorrect():
    h = hash_password("foo")
    assert verify_password("bar", h) is False


def test_verify_malformed():
    assert verify_password("anything", "not-a-valid-hash") is False
    assert verify_password("anything", "wrongalg$abc$def") is False


def test_hash_different_for_same_password():
    # Salt random => distintos hashes para misma password
    assert hash_password("same") != hash_password("same")


def test_unicode_password():
    h = hash_password("clave-ñ-中-🔑")
    assert verify_password("clave-ñ-中-🔑", h) is True
    assert verify_password("clave-n-中-🔑", h) is False
