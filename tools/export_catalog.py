"""Export public API data to the standalone snapshot, preserving legacy aliases."""
import argparse
import json
from pathlib import Path
from urllib.request import urlopen

from deployment_smoke import validate_url

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--api-url", required=True)
parser.add_argument("--allow-local-http", action="store_true")
args = parser.parse_args()
api = validate_url(args.api_url, api=True, allow_local_http=args.allow_local_http)
with urlopen(api + "/colleges/catalog", timeout=60) as response:
    catalog = json.load(response)
if any(p["dataStatus"] == "demo" for p in catalog):
    raise SystemExit("Refusing to export the legacy demo catalog")
aliases = json.loads((root / "frontend/src/data/legacy-options.json").read_text())
legacy_by_id = {item["courseId"]: item["legacyId"] for item in aliases}
for profile in catalog:
    for course in profile["courses"]:
        if course["id"] in legacy_by_id:
            course["legacyId"] = legacy_by_id[course["id"]]
(root / "frontend/src/data/colleges.json").write_text(
    json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"
)
print("Standalone public catalog snapshot exported; private data is not included.")
