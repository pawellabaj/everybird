# Writes data/raw/birdbase/birdbase-mass.csv from the BIRDBASE workbook, the compact extract that
# scripts/build-data/build-species.ts reads (the whole xlsx is never committed).
#
# BIRDBASE: Şekercioğlu et al. 2025, Scientific Data, doi 10.1038/s41597-025-05615-3; Figshare
# doi 10.6084/m9.figshare.27051040.v1 (file "BIRDBASE v2025.1 Sekercioglu et al. Final.xlsx"); CC BY 4.0.
#
#   uv run --with openpyxl python -I scripts/build-data/birdbase-extract.py <BIRDBASE.xlsx> [--out <csv>]
#
# Keeps the Data sheet's rows that have an Average Mass (grams), in sheet order: the Species ID, the English
# name, the five name columns the matcher reads and the mass. The workbook is untrusted data: it is only read.
import csv
import hashlib
import sys
from pathlib import Path

import openpyxl

FIGSHARE_MD5 = "36d53d59af1e449db1fc4c30062d9d1f"
DEFAULT_OUT = Path(__file__).resolve().parents[2] / "data" / "raw" / "birdbase" / "birdbase-mass.csv"
# (CSV column, 0-based workbook column, the workbook's second-row header it must carry)
COLUMNS = [
    ("species_id", 0, None),
    ("english_name", 1, "English Name"),
    ("latin_birdlife_first", 2, "Latin"),
    ("hbw_birdlife", 3, "HBW/BirdLife"),
    ("ioc_15_1", 4, "IOC World Bird List"),
    ("ebird_clements_2024b", 5, "eBird/Clements"),
    ("avilist_v1_2025", 6, "AviList"),
    ("average_mass_g", 26, "Average Mass"),
]


def main(argv: list[str]) -> int:
    if not argv or argv[0].startswith("-"):
        print(__doc__, file=sys.stderr)
        return 2
    xlsx = Path(argv[0])
    out = DEFAULT_OUT
    if "--out" in argv:
        out = Path(argv[argv.index("--out") + 1])
    digest = hashlib.md5(xlsx.read_bytes()).hexdigest()
    if digest != FIGSHARE_MD5:
        print(f"warning: md5 {digest} is not the Figshare file's {FIGSHARE_MD5}", file=sys.stderr)

    ws = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)["Data"]
    rows = ws.iter_rows(min_row=1, max_row=2, values_only=True)
    _, header = [list(r) for r in rows]
    for name, col, expect in COLUMNS:
        if expect is not None and not str(header[col] or "").startswith(expect):
            raise SystemExit(f"column {col} is {header[col]!r}, expected {expect!r}: the workbook changed")

    kept, skipped = [], 0
    for r in ws.iter_rows(min_row=3, values_only=True):
        if r[0] is None:
            continue
        mass = r[26]
        if mass is None or str(mass).strip() == "":
            continue
        try:
            grams = float(mass)
        except (TypeError, ValueError):
            skipped += 1
            continue
        row = [str(int(r[0]))] if isinstance(r[0], (int, float)) else [str(r[0]).strip()]
        for _, col, _ in COLUMNS[1:-1]:
            v = r[col]
            row.append("" if v is None else str(v).strip())
        row.append(repr(grams))
        kept.append(row)

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow([name for name, _, _ in COLUMNS])
        w.writerows(kept)
    print(f"wrote {len(kept)} rows with a mass to {out} (skipped {skipped} non-numeric)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
