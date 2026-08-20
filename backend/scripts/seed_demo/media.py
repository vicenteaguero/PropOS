"""Demo seed, part two: photos, documents, finance, WhatsApp inbox and the UF series.

Runs after `seed_core` has committed, so every id this module references already
exists. Everything here is deterministic: ids come from `uuid.uuid5` over the
row's natural key, so a re-run under `ON CONFLICT DO NOTHING` is a no-op rather
than a second copy of the demo.

Storage follows the conventions the app already reads back:

* photos  -> `media` bucket, `{tenant_id}/properties/{property_id}/{key}.jpg`,
  with `media_files.url` holding the canonical public locator that
  `features/properties/photos.py::display_url` re-signs on read.
* documents -> `documents` bucket, `1_raw/` + `2_normalized/` paths built by
  `features/documents/storage.py`.

Images are Creative Commons (CC0 / Public Domain Mark / CC-BY / CC-BY-SA)
photos sourced through the Openverse API; the creator and licence of each one
is written into `media_files.description` so the attribution travels with the
row.
"""

from __future__ import annotations

import hashlib
import io
import os
import random
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from psycopg.types.json import Jsonb
from PIL import Image

from app.core.supabase.client import get_supabase_client
from app.features.documents import storage as doc_storage
from scripts.seed_demo.context import (
    DEMO_TENANT_ID,
    SeedContext,
    assert_safe_to_write,
    insert_many,
)
from scripts.seed_demo.core import demo_uuid

MEDIA_BUCKET = "media"

# Cache for the downloaded originals; a re-run skips the network entirely.
IMAGE_CACHE = os.environ.get(
    "SEED_DEMO_IMAGE_CACHE",
    "/private/tmp/claude-501/-Users-vicenteaguero-real-state-PropOS"
    "/fb4a9bba-dfa9-4b5d-ae44-f79dd8ce1579/scratchpad/seed-images",
)

MAX_IMAGE_BYTES = 200_000
MAX_IMAGE_EDGE = 1600


def _uid(kind: str, *parts: object) -> str:
    """Deterministic uuid for a demo row, keyed on its natural identity.

    Shares ``core.demo_uuid``'s namespace so the whole seed lives in one id
    space; the composite key is just flattened into ``demo_uuid``'s single one.
    """
    return demo_uuid(kind, "|".join(str(part) for part in parts))


# ---------------------------------------------------------------------------
# 1. Image pool
# ---------------------------------------------------------------------------
# (role, source_url, licence, creator). Harvested from the Openverse API with
# `license_type=commercial`; each entry was downloaded, re-encoded and verified
# before being pinned here, so the list is stable input rather than a live query.
IMAGE_POOL: tuple[tuple[str, str, str, str], ...] = (
    (
        "BATHROOM",
        "https://live.staticflickr.com/932/44024944781_a7e245c456_b.jpg",
        "by",
        "Free Public Domain Illustrations by rawpixel",
    ),
    (
        "BATHROOM",
        "https://live.staticflickr.com/4808/32493277888_72e6181d04_b.jpg",
        "by",
        "Free Public Domain Illustrations by rawpixel",
    ),
    (
        "BATHROOM",
        (
            "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwxOTY3MDM4MTUwNi1pbWFnZS1reWJlbjl4bi5qcGc.jpg"
        ),
        "cc0",
        "Unknown",
    ),
    ("BATHROOM", "https://live.staticflickr.com/1435/4730114714_a93d8f4083_b.jpg", "by-sa", "olofw"),
    ("BATHROOM", "https://live.staticflickr.com/7587/28274979174_dcca2983c6_b.jpg", "pdm", "Hasselkus PR"),
    ("BATHROOM", "https://live.staticflickr.com/2668/4059819138_2de796a2e3_b.jpg", "by-sa", "lumachrome"),
    ("BATHROOM", "https://live.staticflickr.com/2820/9200533111_8dd892bb74_b.jpg", "pdm", "Foto Miki Digital"),
    ("BATHROOM", "https://live.staticflickr.com/3719/9199997115_5fabf5f471_b.jpg", "pdm", "Foto Miki Digital"),
    ("BATHROOM", "https://live.staticflickr.com/7312/10169659726_b747928964_b.jpg", "pdm", "Hasselkus PR"),
    ("BATHROOM", "https://live.staticflickr.com/8622/28277344223_3d5b4b9f3d_b.jpg", "pdm", "Hasselkus PR"),
    ("BEDROOM", "https://live.staticflickr.com/8421/29813589472_53bd1d15c6_b.jpg", "by", "Paintzen"),
    (
        "BEDROOM",
        "https://live.staticflickr.com/65535/50440714752_644744df4b_b.jpg",
        "by",
        "Free Public Domain Illustrations by rawpixel",
    ),
    ("BEDROOM", "https://live.staticflickr.com/4658/39866722321_d6d7b75791_b.jpg", "by", "nhadatvideo"),
    ("BEDROOM", "https://live.staticflickr.com/4649/39872967422_1a4bf3fa86_b.jpg", "by", "nhadatvideo"),
    ("BEDROOM", "https://live.staticflickr.com/4581/37723535975_cbf7bddb8a_b.jpg", "cc0", "EthereumClassic"),
    ("BEDROOM", "https://live.staticflickr.com/3192/2590424724_a3403e9c00_b.jpg", "by", "Boston Public Library"),
    ("BEDROOM", "https://live.staticflickr.com/2080/2590424418_b7c7024dd8_b.jpg", "by", "Boston Public Library"),
    ("BEDROOM", "https://live.staticflickr.com/4704/39807220302_092a2a22d8_b.jpg", "by", "nhadatvideo"),
    ("BEDROOM", "https://live.staticflickr.com/8144/29844388151_3d13063041_b.jpg", "by", "Paintzen"),
    ("EXTERIOR", "https://live.staticflickr.com/3/6424956_55df02e512_b.jpg", "by", "Daveybot"),
    ("EXTERIOR", "https://live.staticflickr.com/8515/8573651373_8bdf6ca207_b.jpg", "by", "o palsson"),
    ("EXTERIOR", "https://live.staticflickr.com/3070/2565057817_892753320a_b.jpg", "by", "seier+seier"),
    ("EXTERIOR", "https://live.staticflickr.com/8275/8701033326_c6788fdf6c_b.jpg", "by", "Forsaken Fotos"),
    (
        "EXTERIOR",
        "https://live.staticflickr.com/5337/30299947841_f34a16b3bd_b.jpg",
        "pdm",
        "Amsterdam free photos & pictures of the Dutch city",
    ),
    ("EXTERIOR", "https://live.staticflickr.com/3106/2613424677_db8d5e5438_b.jpg", "by", "seier+seier"),
    (
        "EXTERIOR",
        "https://live.staticflickr.com/5610/30368464831_ac0e37ecb5_b.jpg",
        "cc0",
        "Amsterdam free photos & pictures of the Dutch city",
    ),
    (
        "EXTERIOR",
        "https://live.staticflickr.com/5785/30094174900_bdf3c8503d_b.jpg",
        "cc0",
        "Amsterdam free photos & pictures of the Dutch city",
    ),
    (
        "EXTERIOR",
        (
            "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvZmwyODA4NjQxNTUxMi1pbWFnZS1reWNqaWJrMC5qcGc.jpg"
        ),
        "cc0",
        "Unknown",
    ),
    ("EXTERIOR", "https://live.staticflickr.com/8668/28773281922_171f0769f4_b.jpg", "pdm", "herr loeffler"),
    ("EXTERIOR", "https://live.staticflickr.com/7158/6797211953_c6cd4cbeab_b.jpg", "by", "Ben Ledbetter, Architect"),
    ("EXTERIOR", "https://live.staticflickr.com/7245/7017887823_f22056cc0f_b.jpg", "by", "seier+seier"),
    ("EXTERIOR", "https://live.staticflickr.com/73/215370699_5142c0e193_b.jpg", "by", "dbking"),
    ("EXTERIOR", "https://live.staticflickr.com/3171/2565086827_282392d7c7_b.jpg", "by", "seier+seier"),
    ("EXTERIOR", "https://live.staticflickr.com/5256/5486664417_53c8de8277_b.jpg", "by", "seier+seier"),
    ("EXTERIOR", "https://live.staticflickr.com/6034/6282896731_7a1c9134f8_b.jpg", "by", "Ben Ledbetter, Architect"),
    (
        "EXTERIOR",
        "https://live.staticflickr.com/5485/30413736220_e3fc78fb28_b.jpg",
        "cc0",
        "Amsterdam free photos & pictures of the Dutch city",
    ),
    ("EXTERIOR", "https://live.staticflickr.com/3806/13612020775_72c7ac3c85_b.jpg", "by", "Eric Fischer"),
    ("EXTERIOR", "https://live.staticflickr.com/33/38194590_e25a3aa30f_b.jpg", "by", "dbking"),
    (
        "EXTERIOR",
        "https://upload.wikimedia.org/wikipedia/commons/7/76/Weiguan_Jinlong_residential_building.jpg",
        "by-sa",
        "ScoutT7",
    ),
    ("EXTERIOR", "https://live.staticflickr.com/6237/6282896719_63d77c2243_b.jpg", "by", "See “About” for projects."),
    ("EXTERIOR", "https://live.staticflickr.com/5241/5330817446_e227a759ae_b.jpg", "by", "seier+seier"),
    (
        "EXTERIOR",
        "https://live.staticflickr.com/5541/12075595544_5141781236_b.jpg",
        "cc0",
        "Amsterdam free photos & pictures of the Dutch city",
    ),
    ("EXTERIOR", "https://live.staticflickr.com/4037/4428355645_8f5fc0615e_b.jpg", "by", "kevinpoh"),
    (
        "EXTERIOR",
        "https://live.staticflickr.com/2850/11467867955_7530e51217_b.jpg",
        "cc0",
        "Amsterdam free photos & pictures of the Dutch city",
    ),
    (
        "KITCHEN",
        "https://live.staticflickr.com/7467/16110046486_791bbb5902_b.jpg",
        "by",
        "準建築人手札網站 Forgemind ArchiMedia",
    ),
    ("KITCHEN", "https://live.staticflickr.com/2907/14723972332_1a6879b719_b.jpg", "by", "TChapman9"),
    ("KITCHEN", "https://live.staticflickr.com/8273/29813588892_d82a979ef7_b.jpg", "by", "Paintzen"),
    ("KITCHEN", "https://live.staticflickr.com/400/19281939844_6af5971490_b.jpg", "by", "nicolas.boullosa"),
    ("KITCHEN", "https://live.staticflickr.com/65535/51310622849_f6199f9607_b.jpg", "by", "Queensland State Archives"),
    ("KITCHEN", "https://live.staticflickr.com/5241/5192000995_128f8fc130_b.jpg", "by-sa", "☺ Lee J Haywood"),
    ("KITCHEN", "https://live.staticflickr.com/8019/29813588732_3e5e45e070_b.jpg", "by", "Paintzen"),
    ("KITCHEN", "https://live.staticflickr.com/3683/11493916616_dd03c15fca_b.jpg", "by", "quinet"),
    (
        "KITCHEN",
        "https://live.staticflickr.com/3945/15754414125_2147e39495_b.jpg",
        "by",
        "Mike Licht, NotionsCapital.com",
    ),
    ("KITCHEN", "https://live.staticflickr.com/3897/14434110104_fdc6d2f5f9_b.jpg", "by", "larkandlarks"),
    ("KITCHEN", "https://live.staticflickr.com/3869/14537609860_c1ca6324c8_b.jpg", "by", "TChapman9"),
    ("KITCHEN", "https://live.staticflickr.com/3306/3519826864_c39974062b_b.jpg", "by", "Bryn Pinzgauer"),
    ("KITCHEN", "https://live.staticflickr.com/8333/8109126239_6acbca380d_b.jpg", "by", "ell brown"),
    ("KITCHEN", "https://live.staticflickr.com/8334/29300385324_361473db02_b.jpg", "by", "Paintzen"),
    ("KITCHEN", "https://live.staticflickr.com/3048/3070410217_63eb640e17_b.jpg", "by", "Bryn Pinzgauer"),
    ("LIVING", "https://live.staticflickr.com/3768/9200493419_60e8f1ee79_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/5487/10915694613_b4a1b12490.jpg", "by", "{studiobeerhorst}-bbmarie"),
    ("LIVING", "https://live.staticflickr.com/3741/9203093348_25ce7555fe_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/65535/51302265903_a8c94e64ea_b.jpg", "pdm", "murlisachi"),
    ("LIVING", "https://live.staticflickr.com/7458/12221757635_f1ddeb72eb_b.jpg", "by", "outreachr.com"),
    ("LIVING", "https://live.staticflickr.com/3702/9203762080_23f7b38ef9_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/4397/36633083081_6a09998c8f_b.jpg", "by", "homethods"),
    ("LIVING", "https://live.staticflickr.com/2877/9202816086_7ece5ace83_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/8312/29300385704_c56b4f1c75_b.jpg", "by", "Paintzen"),
    ("LIVING", "https://live.staticflickr.com/7378/10560644186_6931775a00_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/3745/9200932367_e7d095cd99_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/3797/10798143964_5fc2e95a00_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/8744/29844388041_6a558e438d_b.jpg", "by", "Paintzen"),
    ("LIVING", "https://live.staticflickr.com/8456/29813589182_fdb0fda8b5_b.jpg", "by", "Paintzen"),
    ("LIVING", "https://live.staticflickr.com/4516/37894176234_0159a5d67d_b.jpg", "cc0", "EthereumClassic"),
    ("LIVING", "https://live.staticflickr.com/4401/36633084871_9ec6e549b1_b.jpg", "by", "homethods"),
    ("LIVING", "https://live.staticflickr.com/65535/48230253692_ba6e0a2151_b.jpg", "by", "dejankrsmanovic"),
    ("LIVING", "https://live.staticflickr.com/2814/9199967533_4f53389600_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/7452/9200481377_06eaae8c59_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/5484/10560297166_74945d1618_b.jpg", "pdm", "Foto Miki Digital"),
    ("LIVING", "https://live.staticflickr.com/3825/10560658216_06341aaf4e_b.jpg", "pdm", "Foto Miki Digital"),
    ("OTHER", "https://live.staticflickr.com/5450/9269045959_e58619816a_b.jpg", "by", "sisssou"),
    ("OTHER", "https://live.staticflickr.com/5350/17962820046_cc935a4806_b.jpg", "by", "SUPERADRIANME"),
    ("OTHER", "https://live.staticflickr.com/6161/6180731667_821d8ee355_b.jpg", "by", "storebukkebruse"),
    ("OTHER", "https://live.staticflickr.com/3460/3370238964_afa516da45_b.jpg", "by", "hansbrastad"),
    ("OTHER", "https://live.staticflickr.com/2685/4140519697_13c0f1bac4_b.jpg", "by", "Jeremy Levine Design"),
    ("OTHER", "https://live.staticflickr.com/2151/2107624809_18f59fe877_b.jpg", "by", "aforero"),
    ("OTHER", "https://live.staticflickr.com/4125/5176276604_4bfd95d5ba_b.jpg", "by", "zoetnet"),
    ("OTHER", "https://live.staticflickr.com/4129/4951467367_aae758851c_b.jpg", "by", "Sean MacEntee"),
    (
        "OTHER",
        "https://collections.museumsvictoria.com.au/content/media/3/437453-large.jpg",
        "pdm",
        "Creator: Archibald Gordon (Mac) Maclaurin",
    ),
    ("OTHER", "https://live.staticflickr.com/4581/38944147171_ddb05c29e3_b.jpg", "pdm", "Aussie~mobs"),
    ("OTHER", "https://live.staticflickr.com/2078/1893141861_b0e36b271d_b.jpg", "by", "Consumerist Dot Com"),
    ("OTHER", "https://live.staticflickr.com/65535/49862231446_cd05592d3b_b.jpg", "by", "flooringclarity"),
    ("OTHER", "https://live.staticflickr.com/4152/4957179841_d3bf1785de_b.jpg", "by", "Sean MacEntee"),
    ("OTHER", "https://live.staticflickr.com/1113/1425023577_be5a920983_b.jpg", "by", "chrismeller"),
    (
        "OTHER",
        (
            "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDIyLTA1L25zMTc4NzAtaW1hZ2Uta3d2eTl6NXQuanBn.jpg"
        ),
        "cc0",
        "Unknown",
    ),
    ("OTHER", "https://live.staticflickr.com/2943/15324727542_54b8a571a2_b.jpg", "by", "M. Martin Vicente"),
    ("OTHER", "https://live.staticflickr.com/3361/3640107485_967e3767b9_b.jpg", "by", "Jeremy Levine Design"),
    (
        "OTHER",
        (
            "https://images.rawpixel.com/editor_1024/czNmcy1wcml2YXRlL3Jhd3BpeGVsX2ltYWdlcy93ZWJzaXRlX2NvbnRlbnQvbHIvbnMxNjg2MC1pbWFnZS1rd3Z3b2txbi5qcGc.jpg"
        ),
        "cc0",
        "Unknown",
    ),
    (
        "OTHER",
        (
            "https://images.rawpixel.com/editor_1024/cHJpdmF0ZS9zdGF0aWMvaW1hZ2Uvd2Vic2l0ZS8yMDIyLTA0L2xyL25zMjA1ODItaW1hZ2Uta3d2d24zb2suanBn.jpg"
        ),
        "cc0",
        "Unknown",
    ),
    ("OTHER", "https://live.staticflickr.com/5621/29813588502_e2973efea2_b.jpg", "by", "Paintzen"),
    ("OTHER", "https://live.staticflickr.com/2406/2107624813_50b471cc00_b.jpg", "by", "aforero"),
    ("OTHER", "https://live.staticflickr.com/3140/2818734013_0ab9f754a8_b.jpg", "by", "Jeremy Levine Design"),
    ("OTHER", "https://live.staticflickr.com/3038/2821064805_527bf745d1_b.jpg", "by", "Jeremy Levine Design"),
    ("OTHER", "https://live.staticflickr.com/1543/25607326286_410dbda9a9_b.jpg", "by", "simpleinsomnia"),
    ("OTHER", "https://live.staticflickr.com/5322/9199999759_5977a397a4_b.jpg", "pdm", "Foto Miki Digital"),
    ("OTHER", "https://live.staticflickr.com/1248/1479254938_a57ceee601_b.jpg", "by", "northways"),
    ("TERRACE", "https://live.staticflickr.com/6103/6311932699_301940ef85_b.jpg", "by", "seier+seier"),
    ("TERRACE", "https://live.staticflickr.com/7099/7167415241_bdd4196677_b.jpg", "by", "Ruth and Dave"),
    ("TERRACE", "https://live.staticflickr.com/7518/15148004024_623347a089_b.jpg", "by", "Steve Parker"),
    ("TERRACE", "https://live.staticflickr.com/8705/17069645169_49da09bf5f_b.jpg", "by-sa", "SteelMaster Buildings"),
    ("TERRACE", "https://live.staticflickr.com/8172/8034442704_7efbc8c2de_b.jpg", "by", "Jeremy Levine Design"),
    ("TERRACE", "https://live.staticflickr.com/3582/3652656498_14fecfefd5_b.jpg", "by", "hortulus"),
    ("TERRACE", "https://live.staticflickr.com/4079/4825884643_898d67aae6_b.jpg", "by", "(vincent desjardins)"),
    ("TERRACE", "https://live.staticflickr.com/8241/8490068951_5afd873a9a_b.jpg", "by", "jimg944"),
    ("TERRACE", "https://live.staticflickr.com/4111/4967216882_1052c82293_b.jpg", "by", "PermaCultured"),
    ("TERRACE", "https://live.staticflickr.com/5491/9504756798_6387343032_b.jpg", "by", "Dave Catchpole"),
    ("TERRACE", "https://live.staticflickr.com/5296/5478559760_3ce212b550_b.jpg", "by", "jemasmith"),
    ("TERRACE", "https://live.staticflickr.com/1355/943177129_78471868bb_b.jpg", "by-sa", "combust"),
    ("TERRACE", "https://live.staticflickr.com/4003/4528900271_0265048031_b.jpg", "by", "rutlo"),
    ("TERRACE", "https://live.staticflickr.com/4138/4826496610_d705d8615a_b.jpg", "by", "(vincent desjardins)"),
    ("TERRACE", "https://live.staticflickr.com/3755/9519013456_6066b64609_b.jpg", "by", "Dave Catchpole"),
)

# Order a gallery reads naturally: street view first, then the rooms.
ROLE_ORDER = ("EXTERIOR", "LIVING", "KITCHEN", "BEDROOM", "BATHROOM", "TERRACE", "OTHER")

ROLE_TITLES_ES = {
    "EXTERIOR": "Fachada",
    "LIVING": "Living comedor",
    "KITCHEN": "Cocina",
    "BEDROOM": "Dormitorio principal",
    "BATHROOM": "Baño",
    "TERRACE": "Terraza",
    "OTHER": "Ambiente",
}

LICENSE_LABELS = {
    "cc0": "CC0 1.0",
    "pdm": "Public Domain Mark 1.0",
    "by": "CC BY",
    "by-sa": "CC BY-SA",
}


def _cache_key(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:20]


def _normalized_image(url: str) -> bytes:
    """Downloaded, downscaled and recompressed JPEG bytes for `url`.

    Cached on disk under `IMAGE_CACHE`, so only the first run touches the
    network. Compression steps down in quality until the frame fits
    `MAX_IMAGE_BYTES` — the demo bucket should not balloon.
    """
    os.makedirs(IMAGE_CACHE, exist_ok=True)
    path = os.path.join(IMAGE_CACHE, f"{_cache_key(url)}.jpg")
    if os.path.exists(path):
        with open(path, "rb") as handle:
            return handle.read()

    response = httpx.get(url, timeout=40.0, follow_redirects=True, headers={"User-Agent": "PropOS-seed/1.0"})
    response.raise_for_status()
    image = Image.open(io.BytesIO(response.content)).convert("RGB")
    image.thumbnail((MAX_IMAGE_EDGE, MAX_IMAGE_EDGE), Image.LANCZOS)

    buffer = io.BytesIO()
    for quality in (82, 72, 62, 52):
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=quality, optimize=True, progressive=True)
        if buffer.tell() <= MAX_IMAGE_BYTES:
            break
    content = buffer.getvalue()
    with open(path, "wb") as handle:
        handle.write(content)
    return content


def _object_exists(client: Any, bucket: str, path: str) -> bool:
    """True when the object is already in the bucket, so the upload can be skipped."""
    folder, _, name = path.rpartition("/")
    try:
        listed = client.storage.from_(bucket).list(folder, {"search": name, "limit": 100})
    except Exception:  # noqa: BLE001 — a listing failure just means "upload again"
        return False
    return any(item.get("name") == name for item in listed or [])


def _photo_plan(property_ids: list[str], rng: random.Random) -> list[tuple[str, int, tuple[str, str, str, str]]]:
    """`(property_id, position, pool_entry)` for every photo we intend to store."""
    by_role: dict[str, list[tuple[str, str, str, str]]] = {}
    for entry in IMAGE_POOL:
        by_role.setdefault(entry[0], []).append(entry)

    plan: list[tuple[str, int, tuple[str, str, str, str]]] = []
    for index, property_id in enumerate(property_ids):
        count = rng.randint(4, 8)
        # Always lead with a facade, then walk the rooms in reading order.
        roles = ["EXTERIOR"] + [ROLE_ORDER[1:][i % (len(ROLE_ORDER) - 1)] for i in range(count - 1)]
        for position, role in enumerate(roles):
            candidates = by_role.get(role) or by_role["OTHER"]
            plan.append((property_id, position, candidates[(index * 7 + position * 3) % len(candidates)]))
    return plan


def _seed_property_photos(conn: Any, state: SeedContext, rng: random.Random) -> None:
    property_ids = sorted(str(p) for p in state.property_ids)
    if not property_ids:
        return

    client = get_supabase_client()
    uploader = sorted(str(p) for p in state.profile_ids)[0] if state.profile_ids else None

    media_files: list[dict[str, Any]] = []
    media_assets: list[dict[str, Any]] = []

    for property_id, position, (role, url, licence, creator) in _photo_plan(property_ids, rng):
        key = _cache_key(url)
        object_path = f"{DEMO_TENANT_ID}/properties/{property_id}/{key}.jpg"
        if not _object_exists(client, MEDIA_BUCKET, object_path):
            client.storage.from_(MEDIA_BUCKET).upload(
                path=object_path,
                file=_normalized_image(url),
                file_options={"content-type": "image/jpeg", "upsert": "true"},
            )
        locator = str(client.storage.from_(MEDIA_BUCKET).get_public_url(object_path)).rstrip("?")

        media_file_id = _uid("media_file", property_id, key)
        media_files.append(
            {
                "id": media_file_id,
                "tenant_id": DEMO_TENANT_ID,
                "url": locator,
                # `type`/`source` are CHECK-constrained to the legacy vocabulary.
                "type": "photo",
                "source": "gallery",
                "kind": "PHOTO",
                "uploaded_by": uploader,
                "title": ROLE_TITLES_ES[role],
                "description": f"Foto {LICENSE_LABELS.get(licence, licence)} — {creator} (via Openverse)",
            }
        )
        media_assets.append(
            {
                "id": _uid("media_asset", property_id, key),
                "tenant_id": DEMO_TENANT_ID,
                "media_file_id": media_file_id,
                "target_table": "properties",
                "target_row_id": property_id,
                "role": "PHOTO",
                "position": position,
                "created_by": uploader,
            }
        )

    insert_many(conn, "media_files", media_files)
    insert_many(conn, "media_assets", media_assets)
    state.record("media_files", len(media_files))
    state.record("media_assets", len(media_assets))


# ---------------------------------------------------------------------------
# 2. Documents
# ---------------------------------------------------------------------------
# WinAnsi has no em dash or curly quotes; fold them before the latin-1 encode.
_PDF_FOLD = str.maketrans({"\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"'})


def _pdf_escape(text: str) -> str:
    text = text.translate(_PDF_FOLD)
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _simple_pdf(title: str, lines: list[str]) -> bytes:
    """A one-page, single-font PDF.

    Hand-rolled rather than pulled from a rendering library: the demo only needs
    a real, openable object behind every `document_versions` row, and building
    it here keeps the byte stream — and therefore the sha256 — deterministic.
    """
    parts = ["BT", "/F1 16 Tf", "72 770 Td", f"({_pdf_escape(title)}) Tj", "/F1 11 Tf", "0 -30 Td"]
    for line in lines:
        parts.append(f"({_pdf_escape(line)}) Tj")
        parts.append("0 -16 Td")
    parts.append("ET")
    stream = "\n".join(parts).encode("latin-1", "replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]"
        b" /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + obj + b"\nendobj\n"

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n").encode()
    return bytes(out)


# (display_name template, tag, origin, target) — target picks the assignment kind.
# `{folio}` is the correlative a document manager stamps on each piece; it also
# keeps all 80 display names, bodies and hashes distinct.
DOCUMENT_KINDS: tuple[tuple[str, str, str, str], ...] = (
    ("Mandato de corretaje N° {folio} — {title}", "mandato", "UPLOAD", "PROPERTY"),
    ("Contrato de arriendo N° {folio} — {title}", "contrato", "UPLOAD", "PROPERTY"),
    ("Promesa de compraventa N° {folio} — {title}", "promesa", "UPLOAD", "PROPERTY"),
    ("Tasación comercial N° {folio} — {title}", "tasacion", "GENERATED", "PROPERTY"),
    ("Reglamento de copropiedad N° {folio} — {title}", "reglamento", "UPLOAD", "PROPERTY"),
    ("Certificado de dominio vigente N° {folio} — {title}", "dominio", "UPLOAD", "PROPERTY"),
    ("Carpeta tributaria N° {folio} — {name}", "tributaria", "UPLOAD", "CONTACT"),
    ("Cédula de identidad N° {folio} — {name}", "identidad", "CAMERA", "CONTACT"),
)

DOCUMENT_BODY_ES = {
    "mandato": [
        "Comparecen el mandante, individualizado al final de este instrumento, y el",
        "corredor de propiedades, quien acepta el encargo de gestionar la venta o",
        "arriendo del inmueble singularizado en la cláusula primera.",
        "",
        "PRIMERO: Objeto del mandato.",
        "SEGUNDO: Comisión pactada de 2% más IVA sobre el precio de cierre.",
        "TERCERO: Vigencia de 180 días corridos, renovable de común acuerdo.",
    ],
    "contrato": [
        "Contrato de arrendamiento de inmueble urbano, celebrado entre el arrendador",
        "y el arrendatario individualizados más abajo.",
        "",
        "PRIMERO: Renta mensual pagadera dentro de los primeros cinco días.",
        "SEGUNDO: Garantía equivalente a un mes de renta.",
        "TERCERO: Plazo de doce meses, renovable automáticamente.",
        "CUARTO: Los gastos comunes son de cargo del arrendatario.",
    ],
    "promesa": [
        "Promesa de compraventa sobre el inmueble singularizado en la cláusula primera.",
        "",
        "PRIMERO: Individualización del inmueble y sus deslindes.",
        "SEGUNDO: Precio y forma de pago, con pie a la firma de la escritura.",
        "TERCERO: Plazo para suscribir el contrato definitivo.",
        "CUARTO: Multa por incumplimiento equivalente al pie enterado.",
    ],
    "tasacion": [
        "Informe de tasación comercial elaborado con método de comparación de mercado.",
        "",
        "Se consideraron cinco referentes transados en los últimos doce meses dentro",
        "de un radio de 800 metros, ajustados por superficie útil, orientación,",
        "antigüedad y estado de terminaciones.",
        "",
        "Valor comercial estimado y rango de negociación en la última página.",
    ],
    "reglamento": [
        "Reglamento de copropiedad inmobiliaria.",
        "",
        "TÍTULO I: De los bienes de dominio común.",
        "TÍTULO II: De los gastos comunes y su prorrateo.",
        "TÍTULO III: Del uso de espacios comunes, quincho y sala multiuso.",
        "TÍTULO IV: De las mascotas y su circulación por áreas comunes.",
    ],
    "dominio": [
        "Certificado de dominio vigente emitido por el Conservador de Bienes Raíces.",
        "",
        "Se certifica que la propiedad se encuentra inscrita a nombre del titular",
        "individualizado, sin que consten inscripciones posteriores que alteren el",
        "dominio a la fecha de emisión.",
    ],
    "tributaria": [
        "Carpeta tributaria electrónica para acreditar renta.",
        "",
        "Incluye las últimas seis declaraciones mensuales y la declaración anual",
        "de impuesto a la renta del período.",
    ],
    "identidad": [
        "Copia de cédula de identidad aportada por el cliente para la carpeta.",
        "",
        "Documento capturado desde la aplicación móvil.",
    ],
}


def _seed_documents(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    properties: list[dict[str, Any]],
    contacts: list[dict[str, Any]],
    now: datetime,
) -> None:
    if not properties:
        return

    author = sorted(str(p) for p in state.profile_ids)[0] if state.profile_ids else None
    documents: list[dict[str, Any]] = []
    versions: list[dict[str, Any]] = []
    assignments: list[dict[str, Any]] = []

    for index in range(80):
        template, tag, origin, target = DOCUMENT_KINDS[index % len(DOCUMENT_KINDS)]
        prop = properties[(index * 13) % len(properties)]
        contact = contacts[(index * 3) % len(contacts)] if contacts else None
        if target == "CONTACT" and contact is None:
            # No contacts seeded: fall back to a property-scoped document.
            template, tag, origin, target = DOCUMENT_KINDS[0]

        display_name = template.format(
            folio=f"{index + 1:03d}",
            title=prop["title"],
            name=(contact or {}).get("full_name", prop["title"]),
        )
        document_id = _uid("document", index, tag, prop["id"])
        created_at = now - timedelta(days=rng.randint(5, 420), hours=rng.randint(0, 23))

        body = DOCUMENT_BODY_ES[tag] + ["", f"Referencia interna: {display_name}"]
        content = _simple_pdf(display_name, body)
        sha = hashlib.sha256(content).hexdigest()
        raw_path = doc_storage.raw_path(DEMO_TENANT_ID, document_id, sha, "pdf")
        normalized_path = doc_storage.normalized_path(DEMO_TENANT_ID, document_id, sha)

        client = get_supabase_client()
        for path in (raw_path, normalized_path):
            if not _object_exists(client, "documents", path):
                doc_storage.upload_object(path, content, "application/pdf")

        version_id = _uid("document_version", document_id, 1)
        documents.append(
            {
                "id": document_id,
                "tenant_id": DEMO_TENANT_ID,
                "display_name": display_name,
                "kind": "PDF",
                "origin": origin,
                "current_version_id": None,
                "sort_order": index,
                "tag": tag,
                "property_id": prop["id"] if target == "PROPERTY" else None,
                "created_by": author,
                "created_at": created_at,
                "updated_at": created_at,
            }
        )
        versions.append(
            {
                "id": version_id,
                "document_id": document_id,
                "tenant_id": DEMO_TENANT_ID,
                "version_number": 1,
                "raw_path": raw_path,
                "normalized_path": normalized_path,
                "size_bytes": len(content),
                "page_count": 1,
                "sha256": sha,
                "mime_type": "application/pdf",
                "original_filename": f"{tag}-{index + 1:03d}.pdf",
                "download_filename": f"{display_name}.pdf",
                "scan_status": "clean",
                "ocr_status": "done",
                "ai_analysis_status": "done",
                "created_by": author,
                "created_at": created_at,
            }
        )
        assignments.append(
            {
                "id": _uid("document_assignment", document_id, target),
                "document_id": document_id,
                "tenant_id": DEMO_TENANT_ID,
                "target_kind": target,
                "contact_id": contact["id"] if target == "CONTACT" and contact else None,
                "property_id": prop["id"] if target == "PROPERTY" else None,
                "internal_area_id": None,
                "created_by": author,
                "created_at": created_at,
            }
        )

    insert_many(conn, "documents", documents)
    insert_many(conn, "document_versions", versions)
    # `current_version_id` points at a row that did not exist when the document
    # was inserted, so it is stamped in a second pass.
    with conn.cursor() as cursor:
        cursor.executemany(
            "UPDATE documents SET current_version_id = %s WHERE id = %s AND tenant_id = %s",
            [(v["id"], v["document_id"], DEMO_TENANT_ID) for v in versions],
        )
    insert_many(conn, "document_assignments", assignments)

    state.document_ids = [row["id"] for row in documents]
    state.record("documents", len(documents))
    state.record("document_versions", len(versions))
    state.record("document_assignments", len(assignments))


# ---------------------------------------------------------------------------
# 3. Finance
# ---------------------------------------------------------------------------
# Recurring outflows a small brokerage actually books every month:
# (category, description, low CLP, high CLP, how many per month).
MONTHLY_COSTS: tuple[tuple[str, str, int, int, int], ...] = (
    ("SALARY", "Remuneración ejecutivo comercial", 850_000, 1_450_000, 2),
    ("SOFTWARE", "Suscripción portal inmobiliario", 89_000, 260_000, 2),
    ("SOFTWARE", "Plan PropOS", 49_000, 49_000, 1),
    ("UTILITY", "Arriendo y gastos comunes oficina", 380_000, 620_000, 1),
    ("UTILITY", "Internet y telefonía", 38_000, 74_000, 1),
    ("UTILITY", "Electricidad y agua oficina", 42_000, 130_000, 2),
    ("AD_SPEND", "Campaña Meta Ads", 60_000, 420_000, 4),
    ("AD_SPEND", "Google Ads — búsqueda de marca", 45_000, 210_000, 1),
    ("MARKETING", "Sesión fotográfica de propiedad", 55_000, 140_000, 2),
    ("MARKETING", "Letrero y gráfica en terreno", 28_000, 95_000, 2),
    ("MARKETING", "Tour virtual 360°", 70_000, 160_000, 1),
    ("NOTARY_FEE", "Legalización de firmas en notaría", 18_000, 85_000, 2),
    ("TAX", "PPM mensual", 120_000, 480_000, 1),
    ("REIMBURSEMENT", "Reembolso movilización y peajes", 12_000, 68_000, 2),
)


def _seed_transactions(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    properties: list[dict[str, Any]],
    now: datetime,
) -> None:
    author = sorted(str(p) for p in state.profile_ids)[0] if state.profile_ids else None
    rows: list[dict[str, Any]] = []

    def add(
        month: int,
        seq: int,
        direction: str,
        category: str,
        description: str,
        pesos: int,
        property_id: str | None = None,
        status: str = "COMPLETED",
    ) -> None:
        occurred = now - timedelta(days=month * 30 + rng.randint(0, 27), hours=rng.randint(8, 20))
        rows.append(
            {
                "id": _uid("transaction", month, seq, category, description),
                "tenant_id": DEMO_TENANT_ID,
                "direction": direction,
                "category": category,
                "amount_cents": pesos * 100,
                "currency": "CLP",
                "occurred_at": occurred,
                "description": description,
                "related_property_id": property_id,
                "status": status,
                "settled_at": occurred if status == "COMPLETED" else None,
                "due_at": occurred + timedelta(days=15) if status == "PENDING" else None,
                "source": "manual",
                "created_by": author,
            }
        )

    # Two standout closings so the yearly chart has real peaks instead of noise.
    big_closing_months = {3, 8}

    for month in range(12):
        seq = 0
        for category, label, low, high, per_month in MONTHLY_COSTS:
            for _ in range(per_month):
                add(month, seq, "OUT", category, label, rng.randrange(low, high + 1, 1_000))
                seq += 1

        # Rental commissions: steady, roughly half a month of rent each.
        for _ in range(rng.randint(4, 8)):
            prop = properties[rng.randrange(len(properties))] if properties else None
            add(
                month,
                seq,
                "IN",
                "COMMISSION",
                "Comisión de arriendo",
                rng.randrange(240_000, 620_000, 5_000),
                prop["id"] if prop else None,
            )
            seq += 1

        # Sale commissions: fewer, much larger, and lumpy month to month.
        for _ in range(rng.randint(1, 3) + (2 if month in big_closing_months else 0)):
            prop = properties[rng.randrange(len(properties))] if properties else None
            pesos = (
                rng.randrange(7_400_000, 11_800_000, 50_000)
                if month in big_closing_months
                else rng.randrange(1_900_000, 4_600_000, 50_000)
            )
            add(month, seq, "IN", "COMMISSION", "Comisión de venta", pesos, prop["id"] if prop else None)
            seq += 1

        # A handful of invoices still open, so the pending filter shows something.
        for _ in range(2 if month < 3 else 0):
            add(
                month,
                seq,
                "IN",
                "COMMISSION",
                "Comisión de venta por cobrar",
                rng.randrange(2_100_000, 5_200_000, 50_000),
                properties[rng.randrange(len(properties))]["id"] if properties else None,
                status="PENDING",
            )
            seq += 1

    insert_many(conn, "transactions", rows)
    state.record("transactions", len(rows))


# ---------------------------------------------------------------------------
# 4. Client messaging (WhatsApp inbox)
# ---------------------------------------------------------------------------
# Each arc is an ordered list of `(direction, sender_type, text)`. Placeholders
# are filled from the property the enquiry is about, so the inbox reads like
# real traffic rather than lorem ipsum. Spanish is neutral Chilean — no voseo.
CONVERSATION_ARCS: tuple[tuple[str, tuple[tuple[str, str, str], ...]], ...] = (
    (
        "disponibilidad_venta",
        (
            ("inbound", "contact", "Hola, buenas tardes. Vi la publicación de {title} en {comuna}. ¿Sigue disponible?"),
            (
                "outbound",
                "agent_ai",
                "¡Hola {name}! Sí, sigue disponible. El valor de lista es {precio}. ¿Le gustaría coordinar una visita?",
            ),
            ("inbound", "contact", "Sí, me interesa. ¿Cuántos metros útiles tiene?"),
            (
                "outbound",
                "agent_human",
                "Son {m2} m² útiles, {dorm} dormitorios y {banos} baños. Le mando el plano por acá.",
            ),
            ("inbound", "contact", "Perfecto. ¿Y en qué piso está?"),
            ("outbound", "agent_human", "En un piso alto, con orientación norponiente. Recibe sol toda la tarde."),
            ("inbound", "contact", "Se ve muy bien. ¿Tiene disponibilidad este sábado?"),
            ("outbound", "agent_human", "Sí, tengo bloques a las 11:00 y a las 12:30. ¿Cuál le acomoda más?"),
            ("inbound", "contact", "A las 11:00 me sirve."),
            (
                "outbound",
                "agent_human",
                "Listo, la agendo para el sábado a las 11:00. Le confirmo la dirección exacta el viernes.",
            ),
        ),
    ),
    (
        "arriendo_requisitos",
        (
            ("inbound", "contact", "Hola, consulta por el arriendo de {title}. ¿Cuáles son los requisitos?"),
            (
                "outbound",
                "agent_ai",
                (
                    "Hola {name}, gracias por escribir. Pedimos renta líquida de 3 veces el arriendo, "
                    "contrato vigente y últimas 3 liquidaciones."
                ),
            ),
            ("inbound", "contact", "Trabajo a honorarios. ¿Sirve con boletas de los últimos 6 meses?"),
            (
                "outbound",
                "agent_human",
                "Sí, en ese caso pedimos las últimas 6 boletas más la carpeta tributaria del SII.",
            ),
            ("inbound", "contact", "Bien. ¿Cuánto es el arriendo más los gastos comunes?"),
            ("outbound", "agent_human", "El arriendo es {renta} y el gasto común está en torno a {gc} mensuales."),
            ("inbound", "contact", "¿Piden mes de garantía?"),
            ("outbound", "agent_human", "Un mes de garantía, que se devuelve al término del contrato si no hay daños."),
            ("inbound", "contact", "¿Se puede postular con aval?"),
            (
                "outbound",
                "agent_human",
                "Sí, se acepta aval con las mismas condiciones de renta. También trabajamos con seguro de arriendo.",
            ),
            ("inbound", "contact", "Prefiero el seguro. ¿Cuánto sale?"),
            (
                "outbound",
                "agent_human",
                "Alrededor de medio mes de arriendo, por una vez. Le envío el detalle en un correo.",
            ),
        ),
    ),
    (
        "mascotas",
        (
            ("inbound", "contact", "Buenas, ¿aceptan mascotas en {title}? Tengo un gato."),
            (
                "outbound",
                "agent_ai",
                (
                    "Hola {name}. Sí, el reglamento de copropiedad permite mascotas domésticas. Los gatos no tienen "
                    "restricción de peso."
                ),
            ),
            ("inbound", "contact", "Qué bueno. ¿Y perros?"),
            (
                "outbound",
                "agent_human",
                "Perros también, hasta 15 kilos, y deben circular con correa por los espacios comunes.",
            ),
            ("inbound", "contact", "Perfecto, entonces me sirve. ¿Cuándo se puede ver?"),
            ("outbound", "agent_human", "Esta semana tengo martes y jueves en la tarde. ¿Le acomoda alguno?"),
            ("inbound", "contact", "El jueves a las 18:30 estaría bien."),
            ("outbound", "agent_human", "Perfecto, queda agendado para el jueves a las 18:30."),
        ),
    ),
    (
        "gastos_comunes",
        (
            ("inbound", "contact", "Hola, ¿cuánto es el gasto común de {title}?"),
            (
                "outbound",
                "agent_ai",
                (
                    "Hola {name}, el gasto común es de aproximadamente {gc} e incluye conserjería 24/7, agua caliente "
                    "central y mantención de áreas comunes."
                ),
            ),
            ("inbound", "contact", "¿Y las contribuciones?"),
            (
                "outbound",
                "agent_human",
                "Las contribuciones se pagan cada tres meses. Le puedo enviar el último comprobante si le sirve.",
            ),
            ("inbound", "contact", "Sí, por favor."),
            ("outbound", "agent_human", "Se lo envío hoy mismo por correo."),
        ),
    ),
    (
        "financiamiento",
        (
            ("inbound", "contact", "Hola, me interesa {title}. ¿El precio está en UF o en pesos?"),
            (
                "outbound",
                "agent_ai",
                (
                    "Hola {name}, el valor está expresado en pesos: {precio}. También le puedo pasar "
                    "la equivalencia en UF del día."
                ),
            ),
            ("inbound", "contact", "Gracias. ¿Ustedes ayudan con el crédito hipotecario?"),
            (
                "outbound",
                "agent_human",
                (
                    "Sí, trabajamos con tres bancos y con un corredor de créditos. Nos encargamos de la comparación de "
                    "tasas sin costo para usted."
                ),
            ),
            ("inbound", "contact", "¿Cuánto pie se necesita?"),
            (
                "outbound",
                "agent_human",
                (
                    "Los bancos están pidiendo entre 20% y 25% de pie para segunda vivienda, y 10% a 20% para primera "
                    "vivienda."
                ),
            ),
            ("inbound", "contact", "Sería primera vivienda. ¿Puedo postular con renta de dos personas?"),
            (
                "outbound",
                "agent_human",
                "Sí, se puede sumar la renta del cónyuge o de un codeudor. Eso mejora bastante el monto aprobado.",
            ),
            ("inbound", "contact", "Ya, lo conversamos con mi pareja y le aviso."),
            ("outbound", "agent_human", "Perfecto {name}, quedo atento. Cualquier duda me escribe por acá."),
        ),
    ),
    (
        "negociacion_precio",
        (
            (
                "inbound",
                "contact",
                "Hola. Estuve en la visita de {title} el fin de semana. ¿Hay margen de negociación en el precio?",
            ),
            (
                "outbound",
                "agent_human",
                (
                    "Hola {name}, gracias por la visita. El propietario está pidiendo {precio}, pero escucha ofertas "
                    "serias."
                ),
            ),
            ("inbound", "contact", "¿Qué le parece si ofrezco un 5% menos con pie al contado?"),
            (
                "outbound",
                "agent_human",
                "Con pie al contado es un buen argumento. Se lo presento hoy y le respondo mañana.",
            ),
            ("inbound", "contact", "Perfecto, quedo atento."),
            (
                "outbound",
                "agent_human",
                "{name}, el propietario contraofertó a un 3% de descuento y entrega en 60 días.",
            ),
            ("inbound", "contact", "Me parece razonable. ¿Cómo seguimos?"),
            (
                "outbound",
                "agent_human",
                "Preparo la promesa de compraventa y se la envío para revisión antes de firmar en notaría.",
            ),
        ),
    ),
    (
        "estacionamiento_bodega",
        (
            ("inbound", "contact", "Buenas tardes, ¿{title} incluye estacionamiento?"),
            (
                "outbound",
                "agent_ai",
                "Hola {name}, sí, incluye un estacionamiento subterráneo y una bodega, ambos en el mismo rol.",
            ),
            ("inbound", "contact", "¿Se puede arrendar un segundo estacionamiento en el edificio?"),
            (
                "outbound",
                "agent_human",
                "Suele haber disponibles con otros copropietarios. La administración lleva una lista de espera.",
            ),
            ("inbound", "contact", "Bien saberlo. ¿El edificio tiene quincho o sala multiuso?"),
            ("outbound", "agent_human", "Tiene quincho en la terraza, sala multiuso y gimnasio equipado."),
            ("inbound", "contact", "Excelente, me gustaría ir a verlo."),
            ("outbound", "agent_human", "Le propongo el sábado a las 12:00. ¿Le sirve?"),
        ),
    ),
    (
        "entrega_amoblado",
        (
            ("inbound", "contact", "Hola, ¿{title} se arrienda amoblado?"),
            (
                "outbound",
                "agent_ai",
                "Hola {name}, se entrega sin amoblar, pero con cocina equipada: encimera, horno y campana.",
            ),
            ("inbound", "contact", "¿Y desde cuándo estaría disponible para entrega?"),
            (
                "outbound",
                "agent_human",
                "A partir del día 1 del próximo mes. Los arrendatarios actuales entregan a fin de mes.",
            ),
            ("inbound", "contact", "Perfecto, calza con mis fechas. ¿Tiene calefacción central?"),
            ("outbound", "agent_human", "Sí, calefacción central por losa radiante, con medidor individual."),
        ),
    ),
    (
        "sin_respuesta",
        (
            ("inbound", "contact", "Hola, buenas. ¿{title} sigue disponible?"),
            ("inbound", "contact", "¿Hola? Consulté por la publicación de {comuna}."),
        ),
    ),
    (
        "descartado",
        (
            ("inbound", "contact", "Hola, consulta por {title}. ¿Cuál es el valor?"),
            ("outbound", "agent_ai", "Hola {name}, el valor de lista es {precio}."),
            ("inbound", "contact", "Uf, se me va bastante del presupuesto."),
            (
                "outbound",
                "agent_human",
                "Entiendo. ¿En qué rango está buscando? Tengo otras opciones en {comuna} y alrededores.",
            ),
            ("inbound", "contact", "Hasta un 25% menos, más o menos."),
            ("outbound", "agent_human", "Le mando tres alternativas en ese rango durante el día."),
            ("inbound", "contact", "Gracias, pero por ahora voy a dejarlo hasta acá. Estamos en contacto."),
            ("outbound", "agent_human", "Sin problema {name}. Quedo a disposición cuando quiera retomar la búsqueda."),
        ),
    ),
)

# Short exchanges appended to some threads so message counts are not uniform.
FILLER_EXCHANGES: tuple[tuple[tuple[str, str, str], ...], ...] = (
    (
        ("inbound", "contact", "Una última cosa: ¿tiene bodega?"),
        ("outbound", "agent_human", "Sí, bodega de 4 m² en el primer subterráneo."),
    ),
    (
        ("inbound", "contact", "¿Me puede mandar más fotos, por favor?"),
        ("outbound", "agent_human", "Claro, le envío la galería completa por acá."),
    ),
    (
        ("inbound", "contact", "¿La publicación de la web está actualizada?"),
        ("outbound", "agent_human", "Sí, la actualizamos esta semana con las fotos nuevas."),
    ),
    (
        ("inbound", "contact", "¿Puedo llevar a mi arquitecto a la visita?"),
        ("outbound", "agent_human", "Por supuesto, no hay problema."),
    ),
)


def _money_es(pesos: int) -> str:
    return "$" + f"{pesos:,}".replace(",", ".")


def _seed_client_messaging(
    conn: Any,
    state: SeedContext,
    rng: random.Random,
    properties: list[dict[str, Any]],
    contacts: list[dict[str, Any]],
    now: datetime,
) -> None:
    if not properties or not contacts:
        return

    profile_ids = sorted(str(p) for p in state.profile_ids)
    conversations: list[dict[str, Any]] = []
    messages: list[dict[str, Any]] = []
    consents: list[dict[str, Any]] = []
    seen_consent: set[str] = set()

    for index in range(150):
        contact = contacts[index % len(contacts)]
        prop = properties[(index * 11) % len(properties)]
        arc_name, arc = CONVERSATION_ARCS[index % len(CONVERSATION_ARCS)]

        turns = list(arc)
        if arc_name != "sin_respuesta":
            for _ in range(rng.choice((1, 1, 1, 2))):
                turns += list(FILLER_EXCHANGES[rng.randrange(len(FILLER_EXCHANGES))])

        # A third of the threads are cut off on an inbound turn: the client asked
        # something and nobody has replied yet. That is the broker's unread pile,
        # and without it every row in the inbox looks handled.
        if arc_name not in ("sin_respuesta", "descartado") and rng.random() < 0.33:
            while len(turns) > 2 and turns[-1][0] == "outbound":
                turns.pop()

        price_pesos = int((prop.get("list_price_cents") or 0) // 100)
        is_rent = (prop.get("listing_kind") or "SALE") in ("RENT", "LEASE")
        area = int(prop.get("area_sqm") or rng.randint(45, 140))
        fields = {
            "name": (contact["full_name"] or "").split(" ")[0] or "cliente",
            "title": prop["title"],
            "comuna": prop.get("comuna") or "el sector",
            "precio": _money_es(price_pesos) if price_pesos else "a convenir",
            "renta": _money_es(price_pesos)
            if is_rent and price_pesos
            else _money_es(rng.randrange(420_000, 1_300_000, 10_000)),
            "gc": _money_es(round(area * rng.randrange(1_600, 3_200, 100), -3)),
            "m2": area,
            "dorm": prop.get("bedrooms") or rng.randint(1, 4),
            "banos": prop.get("bathrooms") or rng.randint(1, 3),
        }

        # Threads are spread across the last five months; a slice of them are
        # from the last two days so the inbox has genuinely fresh traffic.
        recent = index % 5 == 0
        started = now - timedelta(
            hours=rng.randint(2, 46) if recent else rng.randint(48, 24 * 150),
            minutes=rng.randrange(60),
        )
        conversation_id = _uid("client_conversation", index, contact["id"], prop["id"])

        cursor_at = started
        last_inbound_at = None
        for turn_index, (direction, sender_type, template) in enumerate(turns):
            cursor_at += timedelta(minutes=rng.randint(2, 240), seconds=rng.randrange(60))
            if direction == "inbound":
                last_inbound_at = cursor_at
            sender_user_id = (
                profile_ids[index % len(profile_ids)] if sender_type == "agent_human" and profile_ids else None
            )
            messages.append(
                {
                    "id": _uid("client_message", conversation_id, turn_index),
                    "tenant_id": DEMO_TENANT_ID,
                    "conversation_id": conversation_id,
                    "direction": direction,
                    "sender_type": sender_type,
                    "sender_user_id": sender_user_id,
                    "content": template.format(**fields),
                    "external_message_id": f"demo-wamid-{conversation_id}-{turn_index:02d}",
                    "delivery_status": "read" if direction == "outbound" else "delivered",
                    "created_at": cursor_at,
                }
            )

        # An unanswered thread stays `open` and unassigned — that is what makes
        # the inbox's unread affordance light up.
        unanswered = turns[-1][0] == "inbound"
        if arc_name == "descartado":
            status = "closed"
        elif unanswered:
            status = "open"
        else:
            status = "assigned"

        conversations.append(
            {
                "id": conversation_id,
                "tenant_id": DEMO_TENANT_ID,
                "contact_id": contact["id"],
                "source": "whatsapp",
                "external_thread_id": f"demo-thread-{conversation_id[:12]}",
                "external_phone_e164": contact.get("phone") or f"+5699{2_000_000 + index:07d}",
                "status": status,
                "assigned_user_id": profile_ids[index % len(profile_ids)] if status != "open" and profile_ids else None,
                "ai_enabled": status != "closed",
                "last_inbound_at": last_inbound_at,
                "last_message_at": cursor_at,
                "created_at": started,
                "archived_at": cursor_at if status == "closed" and index % 3 == 0 else None,
                "metadata": Jsonb({"demo": True, "arc": arc_name, "property_id": prop["id"]}),
            }
        )

        if contact["id"] not in seen_consent:
            seen_consent.add(contact["id"])
            consents.append(
                {
                    "id": _uid("client_consent", contact["id"], "whatsapp"),
                    "tenant_id": DEMO_TENANT_ID,
                    "contact_id": contact["id"],
                    "channel": "whatsapp",
                    # Opt-in predates the thread: the contact wrote first.
                    "opted_in_at": started - timedelta(minutes=1),
                    "opted_out_at": None,
                    "method": "inbound_reply",
                    "proof": Jsonb({"demo": True, "note": "Contacto inició la conversación por WhatsApp"}),
                    "created_by": profile_ids[0] if profile_ids else None,
                }
            )

    insert_many(conn, "client_conversations", conversations)
    insert_many(conn, "client_messages", messages)
    insert_many(conn, "client_consents", consents)
    state.record("client_conversations", len(conversations))
    state.record("client_messages", len(messages))
    state.record("client_consents", len(consents))


# ---------------------------------------------------------------------------
# 5. UF series
# ---------------------------------------------------------------------------
UF_MONTHS_BACK = 18
UF_TARGET_TODAY = 39_800.0
UF_SEED_SOURCE = "demo-seed"


def _seed_uf_daily(conn: Any, state: SeedContext, rng: random.Random, today: date) -> None:
    """Fill any missing day in the last 18 months of `uf_daily`.

    `uf_daily` is keyed on `date` alone and is normally fed with real values
    scraped from sii.cl, so this only ever *adds* days the table does not have
    and tags them with its own source. Real rows are never overwritten.
    """
    start = today - timedelta(days=UF_MONTHS_BACK * 31)

    with conn.cursor() as cursor:
        cursor.execute("SELECT date FROM uf_daily WHERE date >= %s AND date <= %s", (start, today))
        existing = {row["date"] for row in cursor.fetchall()}

    span_days = (today - start).days
    if span_days <= 0:
        return

    # UF moves with the previous month's CPI: a fixed daily step inside each
    # month, no noise. Rates are drawn once per month, then the whole series is
    # scaled so today lands on a believable value.
    monthly_rates = [rng.uniform(0.0012, 0.0055) for _ in range(UF_MONTHS_BACK + 2)]
    factors: list[float] = [1.0]
    for day in range(1, span_days + 1):
        rate = monthly_rates[min(day // 30, len(monthly_rates) - 1)]
        factors.append(factors[-1] * (1.0 + rate / 30.0))
    scale = UF_TARGET_TODAY / factors[-1]

    rows = [
        {
            "date": start + timedelta(days=day),
            "value_clp": round(factors[day] * scale, 2),
            "source": UF_SEED_SOURCE,
        }
        for day in range(span_days + 1)
        if (start + timedelta(days=day)) not in existing
    ]
    if not rows:
        return
    insert_many(conn, "uf_daily", rows, conflict="date")
    state.record("uf_daily", len(rows))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def _comuna_of(row: dict[str, Any]) -> str:
    """Best-effort comuna for message copy: metadata first, then the address tail."""
    metadata = row.get("metadata") or {}
    if isinstance(metadata, dict):
        for key in ("comuna", "commune", "city"):
            value = metadata.get(key)
            if value:
                return str(value)
    address = row.get("address") or ""
    tail = [part.strip() for part in address.split(",") if part.strip()]
    return tail[-1] if tail else "el sector"


def _load_properties(conn: Any, property_ids: list[str]) -> list[dict[str, Any]]:
    if not property_ids:
        return []
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT id, title, address, metadata, bedrooms, bathrooms, area_sqm,"
            " list_price_cents, listing_kind FROM properties"
            " WHERE tenant_id = %s AND id = ANY(%s) ORDER BY id",
            (DEMO_TENANT_ID, property_ids),
        )
        rows = [dict(record) for record in cursor.fetchall()]
    for row in rows:
        row["id"] = str(row["id"])
        row["comuna"] = _comuna_of(row)
    return rows


def _load_contacts(conn: Any, state: SeedContext) -> list[dict[str, Any]]:
    """Contacts for the demo tenant, with the fields the message copy needs.

    `seed_core` writes its generated people into the `contacts` table and
    publishes their ids as `state.person_ids` — which is what
    `client_conversations`, `client_consents` and CONTACT-kind document
    assignments all FK to. The tenant-wide fallback covers a partial re-run
    where `state` was not carried over.
    """
    ids = [str(c) for c in (state.person_ids or [])]
    with conn.cursor() as cursor:
        if ids:
            cursor.execute(
                "SELECT id, full_name, phone FROM contacts"
                " WHERE tenant_id = %s AND id = ANY(%s) AND deleted_at IS NULL ORDER BY id",
                (DEMO_TENANT_ID, ids),
            )
        else:
            cursor.execute(
                "SELECT id, full_name, phone FROM contacts WHERE tenant_id = %s AND deleted_at IS NULL ORDER BY id",
                (DEMO_TENANT_ID,),
            )
        rows = cursor.fetchall()
    return [{"id": str(r["id"]), "full_name": r["full_name"] or "", "phone": r["phone"]} for r in rows]


def seed_media(conn: Any, state: SeedContext, rng_seed: int = 20260819) -> SeedContext:
    """Seed photos, documents, finance, the WhatsApp inbox and the UF series.

    Must run after `seed_core` has committed: every id referenced here is read
    back from the database rather than invented.
    """
    assert_safe_to_write(DEMO_TENANT_ID)
    rng = random.Random(rng_seed)
    now = datetime.now(UTC)

    properties = _load_properties(conn, [str(p) for p in state.property_ids])
    contacts = _load_contacts(conn, state)

    _seed_property_photos(conn, state, rng)
    _seed_documents(conn, state, rng, properties, contacts, now)
    _seed_transactions(conn, state, rng, properties, now)
    _seed_client_messaging(conn, state, rng, properties, contacts, now)
    _seed_uf_daily(conn, state, rng, now.date())
    return state
