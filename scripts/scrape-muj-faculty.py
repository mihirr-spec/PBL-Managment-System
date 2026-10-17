"""
Scrape the public MUJ faculty directory into scripts/data/muj-faculty.json.

    python scripts/scrape-muj-faculty.py

The listing page already contains every faculty card (with department), so
only the "View more" detail pages are fetched for email and area of
expertise. Requests are throttled; robots.txt allows these pages and the
/admin/ photo folder is never fetched.
"""

import codecs
import html
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "https://jaipur.manipal.edu/"
LISTING = BASE + "muj-faculties.php"
OUT = Path(__file__).parent / "data" / "muj-faculty.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (PBL portal faculty directory; student project)"}
WORKERS = 3
PAUSE = 0.4  # seconds between requests, per worker

# Pages are served as UTF-8 but contain stray Windows-1252 bytes (nbsp, quotes).
codecs.register_error("cp1252", lambda e: (e.object[e.start:e.end].decode("cp1252", "replace"), e.end))

SECTION_HEADINGS = (
    "Educational Qualifications", "Area of Expertise", "Achievements", "Responsibility",
    "Professional Memberships", "Publication", "Publications", "Research", "Awards",
    "Experience", "Projects", "Patents", "Book",
)


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "cp1252")


def clean(text: str) -> str:
    text = html.unescape(text).replace("\xa0", " ").replace("�", " ")
    return re.sub(r"\s+", " ", text).strip()


def text_lines(page: str) -> list[str]:
    page = re.sub(r"<(script|style)\b.*?</\1>", "", page, flags=re.S | re.I)
    page = re.sub(r"<[^>]+>", "\n", page)
    return [clean(line) for line in page.split("\n") if clean(line)]


def parse_listing(page: str) -> list[dict]:
    departments = {
        value: clean(label)
        for value, label in re.findall(r'<option value="(\d+)">([^<]+)', page)
    }
    cards = re.findall(
        r'class="col-md-3 col-6 box all (\d+)\s*">.*?href="(faculty-details\.php\?url=([^"]+))".*?'
        r"<h2>(.*?)</h2>\s*<h3>(.*?)</h3>\s*<p>(.*?)</p>",
        page,
        flags=re.S,
    )
    people, seen = [], set()
    for dept_id, href, slug, name, designation, department in cards:
        muj_id = slug.split("/")[0]
        if muj_id in seen:
            continue
        seen.add(muj_id)
        people.append({
            "muj_id": muj_id,
            "name": clean(name),
            "designation": clean(designation),
            "department": clean(department) or departments.get(dept_id, ""),
            "profile_url": BASE + href,
        })
    return people


def parse_detail(page: str) -> dict:
    emails = [
        e for e in re.findall(r"[\w.\-]+@[\w.\-]+\.\w+", page)
        if not e.startswith(("admissions@", "info@"))
    ]
    lines = text_lines(page)
    expertise: list[str] = []
    if "Area of Expertise" in lines:
        start = lines.index("Area of Expertise") + 1
        for line in lines[start:]:
            if line in SECTION_HEADINGS:
                break
            expertise.append(line)
    return {
        "email": emails[0] if emails else "",
        "expertise": "; ".join(expertise)[:600],
    }


def enrich(person: dict) -> dict:
    for attempt in range(3):
        try:
            time.sleep(PAUSE)
            return {**person, **parse_detail(fetch(person["profile_url"]))}
        except Exception as error:  # network hiccup - back off and retry
            if attempt == 2:
                print(f"  ! {person['name']}: {error}")
            time.sleep(2 * (attempt + 1))
    return {**person, "email": "", "expertise": ""}


def main() -> None:
    people = parse_listing(fetch(LISTING))
    print(f"{len(people)} faculty on the listing page")
    with ThreadPoolExecutor(WORKERS) as pool:
        results = []
        for i, person in enumerate(pool.map(enrich, people), 1):
            results.append(person)
            if i % 100 == 0:
                print(f"  {i}/{len(people)}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    with_email = sum(1 for p in results if p["email"])
    with_expertise = sum(1 for p in results if p["expertise"])
    print(f"saved {len(results)} -> {OUT} ({with_email} with email, {with_expertise} with expertise)")


if __name__ == "__main__":
    main()
