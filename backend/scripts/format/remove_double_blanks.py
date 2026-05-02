"""Collapse 4+ consecutive newlines into 3 (= 2 blank lines, PEP8-safe)."""

import re
from pathlib import Path


def remove_double_blank_lines(file_path: Path) -> bool:
    content = file_path.read_text(encoding="utf-8")
    new_content = re.sub(r"\n{4,}", "\n\n\n", content)
    if new_content == content:
        return False
    file_path.write_text(new_content, encoding="utf-8")
    return True


def main() -> None:
    fixed = 0
    for base in [Path("app"), Path("scripts"), Path("tests")]:
        if not base.exists():
            continue
        count = sum(1 for f in base.rglob("*.py") if remove_double_blank_lines(f))
        if count:
            print(f"  double-blanks: {base}/ — {count} file(s) fixed")
        fixed += count
    if not fixed:
        print("  double-blanks: clean")


if __name__ == "__main__":
    main()
