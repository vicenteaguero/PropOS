"""Manual smoke test: send a Kapso template to a phone.

Usage:
    poetry run python -m scripts.kapso_send_template +56911111111 visit_confirmation \
        contact_name=Juan property_address="Calle 123" datetime="lunes 10:00"
"""

from __future__ import annotations

import asyncio
import sys

from app.features.integrations.kapso import client as kapso_client
from app.features.notifications.whatsapp import templates


async def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    phone = sys.argv[1]
    template_name = sys.argv[2]
    kv = dict(arg.split("=", 1) for arg in sys.argv[3:])

    template = templates.get(template_name)
    rendered = templates.render_variables(template, kv)
    resp = await kapso_client.send_template(phone, template.name, rendered, lang=template.language)
    print(resp)


if __name__ == "__main__":
    asyncio.run(main())
