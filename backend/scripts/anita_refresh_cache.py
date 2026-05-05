"""Re-transcribe every audio in `tests/integration/anita/audios/` and
overwrite the cache. Use after re-recording audios or if Whisper quality
itself improves.

Respects Groq rate limit (20 req/min) by sleeping 4s between calls.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from app.features.anita.transcribe import transcribe_audio

AUDIOS_DIR = Path(__file__).parent.parent / "tests" / "integration" / "anita" / "audios"
CACHE_DIR = AUDIOS_DIR / ".cache"


def main() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    audios = sorted(p for p in AUDIOS_DIR.iterdir() if p.suffix.lower() in {".mp3", ".wav", ".m4a", ".webm"})
    print(f"refreshing {len(audios)} audios → {CACHE_DIR}")
    for i, p in enumerate(audios, 1):
        with p.open("rb") as f:
            result = transcribe_audio(f, p.name)
        st = p.stat()
        cache_path = CACHE_DIR / f"{p.name}.json"
        cache_path.write_text(
            json.dumps(
                {"signature": f"{st.st_size}-{int(st.st_mtime)}", "result": result},
                ensure_ascii=False,
                indent=2,
            )
        )
        print(f"  [{i}/{len(audios)}] {p.name}  ({result.get('source', '?')}, {len(result['text'])} chars)")
        if i < len(audios):
            time.sleep(4)
    print("done")


if __name__ == "__main__":
    main()
