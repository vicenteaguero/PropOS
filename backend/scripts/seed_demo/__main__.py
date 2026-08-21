"""Populate a large, coherent demo dataset for the `PropOS Demo` tenant.

    poetry run python -m scripts.seed_demo            # create / top up
    poetry run python -m scripts.seed_demo --wipe     # delete, then recreate
    poetry run python -m scripts.seed_demo --wipe-only

The data lives in `public` alongside real rows and is isolated by tenant_id
only, so every write funnels through `context.assert_safe_to_write`.
"""

from __future__ import annotations

import argparse
import sys

from scripts.seed_demo import context as ctx
from scripts.seed_demo.core import seed_core
from scripts.seed_demo.media import seed_media
from scripts.seed_demo.relations import seed_relations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="seed_demo")
    parser.add_argument("--wipe", action="store_true", help="delete demo rows before seeding")
    parser.add_argument("--wipe-only", action="store_true", help="delete demo rows and stop")
    parser.add_argument("--seed", type=int, default=20260819, help="RNG seed for reproducibility")
    args = parser.parse_args(argv)

    ctx.assert_safe_to_write(ctx.DEMO_TENANT_ID)

    with ctx.connect() as conn:
        if args.wipe or args.wipe_only:
            ctx.wipe(conn)
            conn.commit()
            print(f"wiped tenant {ctx.DEMO_TENANT_ID}")
            if args.wipe_only:
                return 0

        state = ctx.SeedContext()
        seed_core(conn, state, rng_seed=args.seed)
        conn.commit()
        seed_media(conn, state, rng_seed=args.seed)
        conn.commit()
        seed_relations(conn, state, rng_seed=args.seed)
        conn.commit()

    width = max(len(k) for k in state.counts) if state.counts else 0
    for label, n in sorted(state.counts.items()):
        print(f"{label.ljust(width)}  {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
