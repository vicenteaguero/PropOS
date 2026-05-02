"""Remove inline Python comments (preserves standalone comment lines + pragmas)."""

import io
import tokenize
from pathlib import Path

PRESERVED_MARKERS = ["type: ignore", "noqa", "pragma", "fmt:", "pylint:", "TODO", "FIXME"]


def remove_inline_comments(file_path: Path) -> bool:
    """Strip trailing `# ...` comments after code on a line."""
    content = file_path.read_text(encoding="utf-8")
    original = content

    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(content).readline))
    except tokenize.TokenError:
        return False

    lines = content.split("\n")
    removals: list[tuple[int, int]] = []

    for tok in tokens:
        if tok.type != tokenize.COMMENT:
            continue
        line_idx = tok.start[0] - 1
        col = tok.start[1]
        if any(m in tok.string for m in PRESERVED_MARKERS):
            continue
        if lines[line_idx][:col].strip() == "":
            continue
        removals.append((line_idx, col))

    if not removals:
        return False

    new_lines = list(lines)
    for line_idx, col in sorted(removals, reverse=True):
        new_lines[line_idx] = new_lines[line_idx][:col].rstrip()

    new_content = "\n".join(new_lines)
    if new_content == original:
        return False
    file_path.write_text(new_content, encoding="utf-8")
    return True


def main() -> None:
    fixed = 0
    for base in [Path("app"), Path("scripts"), Path("tests")]:
        if not base.exists():
            continue
        count = sum(1 for f in base.rglob("*.py") if remove_inline_comments(f))
        if count:
            print(f"  inline-comments: {base}/ — {count} file(s) fixed")
        fixed += count
    if not fixed:
        print("  inline-comments: clean")


if __name__ == "__main__":
    main()
