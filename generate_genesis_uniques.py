from __future__ import annotations

import argparse
import csv
import html
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, unquote, urlparse

import requests
from bs4 import BeautifulSoup, Tag


WIKI_API_URL = "https://www.poewiki.net/w/api.php"
WIKI_PAGE_URL = "https://www.poewiki.net/wiki/{}"
POEDB_FOULBORN_URL = "https://poedb.tw/us/Foulborn"
BREACH_UNIQUE_LIST_PAGE = "List_of_Breach_unique_items"
DEFAULT_OUTPUT = Path("uniques.csv")
SUPPORTED_SECTIONS = {
    "Axes",
    "Maces",
    "Swords",
    "Staves",
    "Daggers",
    "Claws",
    "Wands",
    "Bows",
    "Shields",
    "Quivers",
    "Helmets",
    "Gloves",
    "Boots",
    "Body Armours",
    "Belts",
    "Amulets",
    "Rings",
    "Flasks",
    "Jewels",
}
TIER_CELL_PATTERN = re.compile(
    r"(?:T-1|TF|[0-5])(?:[rdu])?(?:-(?:T-1|TF|[0-5])(?:[rdu])?)*$",
    re.IGNORECASE,
)
CORE_POOL_BREACH_UNIQUE_NAMES: set[str] = set()


@dataclass(slots=True)
class GuideItem:
    name: str
    page: str
    guide_section: str
    guide_subsection: str
    tier: str
    tier_raw: str
    drop_pool: str = "core"
    is_breach_unique: bool = False


@dataclass(slots=True)
class ItemMetadata:
    page: str
    name: str
    item_class: str
    base_item: str
    required_level: str
    required_strength: str
    required_dexterity: str
    required_intelligence: str


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "poe-genesis-tree-generator/1.0 (+https://www.poewiki.net/wiki/The_Genesis_Tree)",
        }
    )
    return session


def normalize_name(value: str) -> str:
    normalized = html.unescape(value)
    normalized = unicodedata.normalize("NFKC", normalized)
    normalized = normalized.replace("’", "'").replace("‘", "'")
    normalized = normalized.replace("–", "-").replace("—", "-")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized.casefold()


def clean_text(value: str) -> str:
    cleaned = html.unescape(value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def clean_node_text(node: Tag) -> str:
    return clean_text(node.get_text(" ", strip=True))


def item_key(page: str, name: str) -> str:
    return normalize_name(page) or normalize_name(name)


def title_from_href(href: str) -> str:
    parsed = urlparse(href)
    if parsed.path.startswith("/wiki/"):
        return clean_text(unquote(parsed.path.split("/wiki/", 1)[1]).replace("_", " "))
    if parsed.path.startswith("/w/"):
        title = parse_qs(parsed.query).get("title", [""])[0]
        return clean_text(unquote(title).replace("_", " "))
    return ""


def fetch_page_html(session: requests.Session, page: str) -> str:
    response = session.get(WIKI_PAGE_URL.format(page.replace(" ", "_")), timeout=60)
    response.raise_for_status()
    return response.text


def fetch_tier_guide_items(session: requests.Session) -> list[GuideItem]:
    soup = BeautifulSoup(fetch_page_html(session, "Guide:Analysis_of_unique_item_tiers"), "html.parser")
    anchor = soup.find(id="List_of_unique_items_by_tier")
    if anchor is None or anchor.parent is None:
        raise RuntimeError("Could not locate the unique tier list on the wiki page.")

    items: list[GuideItem] = []
    current_section = ""
    current_subsection = ""
    for sibling in anchor.parent.find_next_siblings():
        if sibling.name == "h2":
            current_section = clean_node_text(sibling)
            current_subsection = ""
            continue
        if sibling.name == "h3":
            current_subsection = clean_node_text(sibling)
            continue
        if sibling.name != "table":
            continue
        if current_section not in SUPPORTED_SECTIONS:
            continue
        items.extend(parse_guide_table(sibling, current_section, current_subsection))

    if not items:
        raise RuntimeError("No eligible unique items were parsed from the tier guide.")
    return items


def fetch_breach_unique_items(session: requests.Session) -> list[GuideItem]:
    soup = BeautifulSoup(fetch_page_html(session, BREACH_UNIQUE_LIST_PAGE), "html.parser")

    target_table = None
    for table in soup.find_all("table"):
        headers = [clean_node_text(cell) for cell in table.find_all("th")]
        if "Breach Unique" in headers and "Alternate" in headers:
            target_table = table
            break

    if target_table is None:
        raise RuntimeError("Could not locate the breach unique table on the wiki page.")

    items: list[GuideItem] = []
    seen: set[str] = set()
    core_pool_breach_keys = {normalize_name(name) for name in CORE_POOL_BREACH_UNIQUE_NAMES}

    for row in target_table.find_all("tr"):
        cells = row.find_all(["th", "td"], recursive=False)
        if len(cells) != 2:
            continue

        for cell in cells:
            link = cell.find("a", href=True)
            name = clean_node_text(link) if link else clean_node_text(cell)
            if not name or name in {"Breach Unique", "Alternate"}:
                continue

            page = title_from_href(link["href"]) if link else name
            key = item_key(page, name)
            if not key or key in seen:
                continue

            seen.add(key)
            items.append(
                GuideItem(
                    name=name,
                    page=page or name,
                    guide_section="Breach",
                    guide_subsection="Breach",
                    tier="1",
                    tier_raw="T1",
                    drop_pool="core" if key in core_pool_breach_keys else "breach-only",
                    is_breach_unique=True,
                )
            )

    if not items:
        raise RuntimeError("No breach unique items were parsed from the wiki list.")
    return items


def merge_unique_items(guide_items: list[GuideItem], breach_items: list[GuideItem]) -> list[GuideItem]:
    merged: dict[str, GuideItem] = {}
    ordered_keys: list[str] = []

    for item in guide_items:
        key = item_key(item.page, item.name)
        if not key or key in merged:
            continue
        merged[key] = item
        ordered_keys.append(key)

    for item in breach_items:
        key = item_key(item.page, item.name)
        if not key:
            continue

        existing = merged.get(key)
        if existing is None:
            merged[key] = item
            ordered_keys.append(key)
            continue

        merged[key] = GuideItem(
            name=existing.name,
            page=existing.page,
            guide_section=existing.guide_section,
            guide_subsection=existing.guide_subsection,
            tier=existing.tier,
            tier_raw=existing.tier_raw,
            drop_pool=item.drop_pool,
            is_breach_unique=True,
        )

    return [merged[key] for key in ordered_keys]


def parse_guide_table(table: Tag, section: str, subsection: str) -> list[GuideItem]:
    parsed_items: list[GuideItem] = []
    for row in table.find_all("tr"):
        cells = row.find_all(["th", "td"], recursive=False)
        if len(cells) < 2:
            continue

        first_cell = cells[0]
        link = first_cell.find("a", href=True)
        name = clean_node_text(link) if link else clean_node_text(first_cell)
        if not name:
            continue
        if name == "Unique":
            continue

        page = title_from_href(link["href"]) if link else name
        tier_raw, tier = select_current_tier(clean_node_text(cell) for cell in cells[1:])

        parsed_items.append(
            GuideItem(
                name=name,
                page=page or name,
                guide_section=section,
                guide_subsection=subsection or section,
                tier=tier,
                tier_raw=tier_raw,
            )
        )
    return parsed_items


def select_current_tier(cells: Iterable[str]) -> tuple[str, str]:
    for cell in reversed([clean_text(cell) for cell in cells if clean_text(cell)]):
        tier = parse_tier_value(cell)
        if tier:
            return cell, tier
    return "", ""


def parse_tier_value(cell: str) -> str:
    compact = cell.replace(" ", "")
    compact = compact.replace("—", "-").replace("–", "-")
    if not compact or not TIER_CELL_PATTERN.fullmatch(compact):
        return ""

    dust_matches = re.findall(r"(T-1|TF|[0-5])d", compact, flags=re.IGNORECASE)
    if dust_matches:
        return dust_matches[-1].upper()

    matches = re.findall(r"(T-1|TF|[0-5])(?:[rdu])?", compact, flags=re.IGNORECASE)
    if matches:
        return matches[-1].upper()
    return ""


def fetch_unique_metadata(session: requests.Session) -> dict[str, ItemMetadata]:
    metadata: dict[str, ItemMetadata] = {}
    offset = 0
    while True:
        response = session.get(
            WIKI_API_URL,
            params={
                "action": "cargoquery",
                "tables": "items",
                "fields": (
                    "_pageName=page,"
                    "name=item_name,"
                    "class_id=item_class,"
                    "base_item=base_item,"
                    "required_level=required_level,"
                    "required_strength=required_strength,"
                    "required_dexterity=required_dexterity,"
                    "required_intelligence=required_intelligence"
                ),
                "where": 'rarity_id="unique"',
                "limit": "500",
                "offset": str(offset),
                "format": "json",
            },
            timeout=60,
        )
        response.raise_for_status()
        rows = response.json().get("cargoquery", [])
        if not rows:
            break

        for row in rows:
            title = row.get("title", {})
            item = ItemMetadata(
                page=clean_text(str(title.get("page", ""))),
                name=clean_text(str(title.get("item_name", ""))),
                item_class=humanize_class_id(clean_text(str(title.get("item_class", "")))),
                base_item=clean_text(str(title.get("base_item", ""))),
                required_level=clean_text(str(title.get("required_level", ""))),
                required_strength=clean_requirement(title.get("required_strength")),
                required_dexterity=clean_requirement(title.get("required_dexterity")),
                required_intelligence=clean_requirement(title.get("required_intelligence")),
            )

            for key in {normalize_name(item.page), normalize_name(item.name)}:
                if key:
                    metadata[key] = item

        offset += len(rows)

    if not metadata:
        raise RuntimeError("The wiki cargo query did not return any unique item metadata.")
    return metadata


def clean_numeric(value: object) -> str:
    if value is None:
        return ""
    text = clean_text(str(value))
    return "" if text.lower() == "null" else text


def clean_requirement(value: object) -> str:
    text = clean_numeric(value)
    return "" if text == "0" else text


def humanize_class_id(value: str) -> str:
    if not value:
        return ""
    if " " in value:
        return value
    return re.sub(r"(?<!^)(?=[A-Z])", " ", value).replace("  ", " ")


def fetch_foulborn_names(session: requests.Session) -> set[str]:
    response = session.get(POEDB_FOULBORN_URL, timeout=60)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    heading = None
    for candidate in soup.find_all(re.compile(r"^h[1-6]$")):
        if "Foulborn Uniques /" in clean_node_text(candidate):
            heading = candidate
            break
    if heading is None:
        raise RuntimeError("Could not locate the Foulborn uniques section on PoEDB.")

    names: set[str] = set()
    for sibling in heading.next_siblings:
        if isinstance(sibling, Tag) and re.fullmatch(r"h[1-6]", sibling.name or ""):
            if "Foulborn Uniques /" not in clean_node_text(sibling):
                break
        if not isinstance(sibling, Tag):
            continue
        for link in sibling.find_all("a", href=True):
            href = link["href"]
            text = clean_node_text(link)
            parsed_href = urlparse(href)
            is_external = bool(parsed_href.scheme or parsed_href.netloc)
            if not text:
                continue
            if is_external and "poedb.tw" not in (parsed_href.netloc or ""):
                continue
            if href.startswith("#") or href.startswith("javascript:"):
                continue
            names.add(normalize_name(text))

    if not names:
        raise RuntimeError("PoEDB Foulborn parsing did not return any unique item names.")
    return names


def format_attribute_requirements(item: ItemMetadata) -> str:
    parts: list[str] = []
    if item.required_strength:
        parts.append(f"Str {item.required_strength}")
    if item.required_dexterity:
        parts.append(f"Dex {item.required_dexterity}")
    if item.required_intelligence:
        parts.append(f"Int {item.required_intelligence}")
    return ", ".join(parts) if parts else "None"


def write_csv(
    output_path: Path,
    guide_items: list[GuideItem],
    metadata_by_key: dict[str, ItemMetadata],
    foulborn_names: set[str],
) -> tuple[int, list[str]]:
    missing_metadata: list[str] = []
    with output_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "name",
                "item_class",
                "guide_item_type",
                "drop_pool",
                "is_breach_unique",
                "base_item",
                "tier",
                "tier_raw",
                "required_level",
                "required_strength",
                "required_dexterity",
                "required_intelligence",
                "attribute_requirements",
                "has_foulborn_variant",
                "wiki_page",
            ],
        )
        writer.writeheader()

        for guide_item in guide_items:
            metadata = metadata_by_key.get(normalize_name(guide_item.page)) or metadata_by_key.get(
                normalize_name(guide_item.name)
            )
            if metadata is None:
                missing_metadata.append(guide_item.name)
                metadata = ItemMetadata(
                    page=guide_item.page,
                    name=guide_item.name,
                    item_class="",
                    base_item="",
                    required_level="",
                    required_strength="",
                    required_dexterity="",
                    required_intelligence="",
                )

            writer.writerow(
                {
                    "name": guide_item.name,
                    "item_class": metadata.item_class,
                    "guide_item_type": guide_item.guide_subsection,
                    "drop_pool": guide_item.drop_pool,
                    "is_breach_unique": "yes" if guide_item.is_breach_unique else "no",
                    "base_item": metadata.base_item,
                    "tier": guide_item.tier,
                    "tier_raw": guide_item.tier_raw,
                    "required_level": metadata.required_level,
                    "required_strength": metadata.required_strength,
                    "required_dexterity": metadata.required_dexterity,
                    "required_intelligence": metadata.required_intelligence,
                    "attribute_requirements": format_attribute_requirements(metadata),
                    "has_foulborn_variant": "yes"
                    if normalize_name(guide_item.name) in foulborn_names
                    else "no",
                    "wiki_page": f"https://www.poewiki.net/wiki/{guide_item.page.replace(' ', '_')}",
                }
            )

    return len(guide_items), missing_metadata


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Generate a CSV of Path of Exile uniques that fit the Genesis Tree unique womb pool. "
            "The script uses the PoE Wiki unique tier guide plus the Breach unique list as the item universe, "
            "PoE Wiki Cargo for requirement metadata, and PoEDB's Foulborn list for the foulborn flag."
        )
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output CSV path. Defaults to {DEFAULT_OUTPUT}.",
    )
    args = parser.parse_args()

    session = build_session()
    guide_items = merge_unique_items(fetch_tier_guide_items(session), fetch_breach_unique_items(session))
    metadata_by_key = fetch_unique_metadata(session)
    foulborn_names = fetch_foulborn_names(session)
    written_count, missing_metadata = write_csv(args.output, guide_items, metadata_by_key, foulborn_names)

    print(f"Wrote {written_count} rows to {args.output}")
    if missing_metadata:
        print(
            "Missing metadata for: " + ", ".join(sorted(set(missing_metadata))),
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())