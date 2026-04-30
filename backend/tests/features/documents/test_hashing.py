from app.features.documents.hashing import sha256_hex


def test_sha256_hex_known_value():
    # SHA-256 of empty bytes
    assert sha256_hex(b"") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_sha256_hex_deterministic():
    assert sha256_hex(b"hello world") == sha256_hex(b"hello world")


def test_sha256_hex_different_input():
    assert sha256_hex(b"a") != sha256_hex(b"b")


def test_sha256_hex_length():
    assert len(sha256_hex(b"anything")) == 64
