EVENT_EMOJI_MAP: dict[str, str] = {
    "auth": "\U0001f510",
    "data": "\U0001f4e6",
    "start": "\U0001f680",
    "deploy": "\U0001f680",
    "success": "\u2705",
    "error": "\u274c",
    "warning": "\u26a0\ufe0f",
    "process": "\U0001f504",
    "write": "\U0001f4dd",
    "delete": "\U0001f5d1\ufe0f",
    "query": "\U0001f50d",
    "request": "\U0001f4e1",
    "test": "\U0001f9ea",
}

DEFAULT_EMOJI = "\U0001f4e1"


def get_emoji(event_type: str) -> str:
    return EVENT_EMOJI_MAP.get(event_type, DEFAULT_EMOJI)
