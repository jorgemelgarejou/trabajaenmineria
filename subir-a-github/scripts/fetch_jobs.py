"""Recolecta ofertas de empleo en minería en Chile y genera site/data/jobs.json
y site/feed.xml (RSS con las últimas ofertas, para publicarlas en LinkedIn u otras redes).

Solo usa la biblioteca estándar de Python (3.9+). Fuentes:
  - Jooble API        (gratis, requiere clave: variable de entorno JOOBLE_KEY)
  - Careerjet API     (gratis, paga por clic: variable de entorno CAREERJET_AFFID)
  - Feeds RSS/Atom    (lista en scripts/sources.json)
  - Ofertas manuales  (site/data/manual.json, ofertas públicas que encuentres y agregues a mano)

Cada fuente es opcional: si falta su clave o falla, se omite y se sigue con las demás.
"""
import html
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime, parsedate_to_datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data" / "jobs.json"
FEED = ROOT / "site" / "feed.xml"
SITE_URL = os.environ.get("SITE_URL", "https://trabajaenmineria.cl").rstrip("/")
FEED_ITEMS = 50
MANUAL = ROOT / "site" / "data" / "manual.json"
SOURCES = ROOT / "scripts" / "sources.json"

UA = "trabajaenmineria.cl-bot/1.0 (+https://trabajaenmineria.cl)"
MAX_AGE_DAYS = 45
SEARCH_TERMS = ["minería", "minera", "faena minera", "operador camión extracción", "mantenedor mina", "geólogo"]

# Palabras que indican que la oferta es del rubro minero (para filtrar feeds genéricos)
MINING_WORDS = [
    "miner", "mina", "faena", "caex", "codelco", "bhp", "escondida", "antofagasta minerals",
    "anglo american", "collahuasi", "sqm", "albemarle", "kinross", "teck", "lundin", "glencore",
    "chuquicamata", "el teniente", "andina", "spence", "candelaria", "los pelambres", "centinela",
    "zaldivar", "cobre", "litio", "geolog", "chancado", "flotacion", "concentradora", "tronadura",
    "perforacion", "jumbo", "pala hidraulica", "4x3", "7x7", "14x14", "sistema de turnos",
]

# Ciudad/zona -> región, para clasificar ofertas por región
REGION_HINTS = {
    "Arica y Parinacota": ["arica", "putre"],
    "Tarapacá": ["tarapaca", "iquique", "alto hospicio", "pozo almonte", "collahuasi", "pica"],
    "Antofagasta": ["antofagasta", "calama", "mejillones", "tocopilla", "taltal", "chuquicamata",
                    "sierra gorda", "san pedro de atacama", "maria elena", "escondida", "spence"],
    "Atacama": ["atacama", "copiapo", "vallenar", "caldera", "diego de almagro", "el salvador",
                "chañaral", "chanaral", "tierra amarilla", "candelaria"],
    "Coquimbo": ["coquimbo", "la serena", "ovalle", "illapel", "salamanca", "los vilos", "andacollo", "pelambres"],
    "Valparaíso": ["valparaiso", "vina del mar", "los andes", "san felipe", "quillota", "la calera", "andina"],
    "Metropolitana": ["santiago", "metropolitana", "providencia", "las condes", "maipu", "colina", "lo barnechea", "pudahuel"],
    "O'Higgins": ["o'higgins", "ohiggins", "rancagua", "machali", "el teniente", "san fernando"],
    "Maule": ["maule", "talca", "curico", "linares"],
    "Ñuble": ["nuble", "chillan"],
    "Biobío": ["biobio", "bio bio", "concepcion", "talcahuano", "los angeles", "coronel"],
    "Araucanía": ["araucania", "temuco"],
    "Los Ríos": ["los rios", "valdivia"],
    "Los Lagos": ["los lagos", "puerto montt", "osorno"],
    "Aysén": ["aysen", "coyhaique"],
    "Magallanes": ["magallanes", "punta arenas"],
}


def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def clean(s):
    s = re.sub(r"<[^>]+>", " ", html.unescape(s or ""))
    return re.sub(r"\s+", " ", s).strip()


def detect_region(text):
    t = norm(text)
    for region, hints in REGION_HINTS.items():
        if any(re.search(r"\b" + re.escape(h) + r"\b", t) for h in hints):
            return region
    return ""


def is_mining(job):
    t = norm(" ".join([job.get("title", ""), job.get("company", ""), job.get("description", "")]))
    return any(w in t for w in MINING_WORDS)


def http(url, data=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def parse_date(s):
    if not s:
        return None
    for fn in (lambda x: datetime.fromisoformat(x.replace("Z", "+00:00")), parsedate_to_datetime):
        try:
            d = fn(s.strip())
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return None


def make_job(title, url, company="", location="", description="", salary="", date=None, source=""):
    d = parse_date(date) if isinstance(date, str) else date
    return {
        "title": clean(title),
        "company": clean(company),
        "location": clean(location),
        "region": detect_region(f"{location} {title} {company}"),
        "description": clean(description)[:600],
        "salary": clean(salary),
        "url": url,
        "date": (d or datetime.now(timezone.utc)).isoformat(),
        "source": source,
    }


# ---------- Fuentes ----------

def from_jooble():
    key = os.environ.get("JOOBLE_KEY")
    if not key:
        return []
    jobs = []
    for term in SEARCH_TERMS:
        for page in (1, 2):
            body = json.dumps({"keywords": term, "location": "Chile", "page": page}).encode()
            data = json.loads(http(f"https://cl.jooble.org/api/{key}", data=body,
                                   headers={"Content-Type": "application/json"}))
            for j in data.get("jobs", []):
                jobs.append(make_job(j.get("title"), j.get("link"), j.get("company"), j.get("location"),
                                     j.get("snippet"), j.get("salary"), j.get("updated"), "Jooble"))
    return jobs


def from_careerjet():
    affid = os.environ.get("CAREERJET_AFFID")
    if not affid:
        return []
    jobs = []
    for term in SEARCH_TERMS:
        for page in (1, 2):
            q = urllib.parse.urlencode({
                "locale_code": "es_CL", "keywords": term, "location": "Chile", "affid": affid,
                "pagesize": 50, "page": page, "sort": "date",
                "user_ip": "1.1.1.1", "user_agent": UA, "url": "https://trabajaenmineria.cl/",
            })
            data = json.loads(http(f"http://public.api.careerjet.net/search?{q}"))
            for j in data.get("jobs", []):
                jobs.append(make_job(j.get("title"), j.get("url"), j.get("company"), j.get("locations"),
                                     j.get("description"), j.get("salary"), j.get("date"),
                                     j.get("site") or "Careerjet"))
    return jobs


def from_feeds():
    if not SOURCES.exists():
        return []
    jobs = []
    for src in json.loads(SOURCES.read_text(encoding="utf-8")).get("feeds", []):
        if not src.get("enabled", True):
            continue
        try:
            root = ET.fromstring(http(src["url"]))
        except Exception as e:
            print(f"  ! feed {src['name']}: {e}", file=sys.stderr)
            continue
        ns = {"a": "http://www.w3.org/2005/Atom"}
        items = root.findall(".//item") or root.findall(".//a:entry", ns)
        for it in items:
            g = lambda tag: (it.findtext(tag) or it.findtext(f"a:{tag}", namespaces=ns) or "")
            link = g("link")
            if not link:
                el = it.find("a:link", ns)
                link = el.get("href") if el is not None else ""
            job = make_job(g("title"), link, src.get("company", ""), src.get("location", ""),
                           g("description") or g("summary"), "", g("pubDate") or g("updated"), src["name"])
            if src.get("mining_only") or is_mining(job):
                jobs.append(job)
    return jobs


def from_manual():
    if not MANUAL.exists():
        return []
    jobs = []
    today = datetime.now(timezone.utc).date().isoformat()
    for j in json.loads(MANUAL.read_text(encoding="utf-8")):
        if j.get("expires") and j["expires"] < today:
            continue
        jobs.append(make_job(j["title"], j["url"], j.get("company"), j.get("location"),
                             j.get("description"), j.get("salary"), j.get("date"), j.get("source", "Manual")))
    return jobs


def main():
    collected = []
    for name, fn in [("manual", from_manual), ("jooble", from_jooble),
                     ("careerjet", from_careerjet), ("feeds", from_feeds)]:
        try:
            got = fn()
            print(f"{name}: {len(got)} ofertas")
            collected += got
        except Exception as e:
            print(f"  ! {name} falló: {e}", file=sys.stderr)

    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    seen, jobs = set(), []
    for j in collected:
        if not j["title"] or not j["url"].startswith("http"):
            continue
        if parse_date(j["date"]) < cutoff:
            continue
        key = (norm(j["title"]), norm(j["company"]), norm(j["location"]))
        if key in seen or j["url"] in seen:
            continue
        seen.update([key, j["url"]])
        jobs.append(j)

    jobs.sort(key=lambda j: j["date"], reverse=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(), "count": len(jobs),
                               "jobs": jobs}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Total: {len(jobs)} ofertas -> {OUT.relative_to(ROOT)}")
    write_feed(jobs)


def write_feed(jobs):
    """RSS con las últimas ofertas. Cada enlace lleva a la búsqueda de esa oferta en el sitio
    (así quien llega desde LinkedIn o redes ve el sitio, sus otras ofertas y los anuncios)."""
    items = []
    for j in jobs[:FEED_ITEMS]:
        d = parse_date(j["date"]) or datetime.now(timezone.utc)
        detail = " · ".join(x for x in [j["company"], j["location"], j["salary"]] if x)
        link = f"{SITE_URL}/?q={urllib.parse.quote(j['title'])}"
        items.append(
            "<item>"
            f"<title>{escape(j['title'])}</title>"
            f"<link>{escape(link)}</link>"
            f'<guid isPermaLink="false">{escape(j["url"])}</guid>'
            f"<pubDate>{format_datetime(d)}</pubDate>"
            f"<description>{escape(detail)}</description>"
            "</item>"
        )
    FEED.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
        "<title>Trabaja en Minería: ofertas de empleo minero en Chile</title>"
        f"<link>{SITE_URL}/</link>"
        "<description>Ofertas de trabajo en minería en Chile, actualizadas cada 4 horas.</description>"
        "<language>es-cl</language>" + "".join(items) + "</channel></rss>\n",
        encoding="utf-8",
    )
    print(f"Feed: {len(items)} ofertas -> {FEED.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
