"""Recolecta ofertas de empleo en minería en Chile y genera site/data/jobs.json
y site/feed.xml (RSS con las últimas ofertas, para publicarlas en LinkedIn u otras redes).

Solo usa la biblioteca estándar de Python (3.9+). Fuentes:
  - Jooble API        (gratis, requiere clave: variable de entorno JOOBLE_KEY)
  - Careerjet API v4  (cuenta de publisher, paga por clic: variable de entorno CAREERJET_API_KEY)
  - Feeds RSS/Atom    (lista en scripts/sources.json)
  - Portales propios de mineras (SuccessFactors), leídos desde su sitemap.xml (career_sites en sources.json)
  - Ofertas manuales  (site/data/manual.json, ofertas públicas que encuentres y agregues a mano)

Cada fuente es opcional: si falta su clave o falla, se omite y se sigue con las demás.
"""
import base64
import html
import json
import os
import re
import sys
import time
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
MAX_JOBS = 1500
SEARCH_TERMS = ["minería", "minera", "faena minera", "operador camión extracción", "mantenedor mina", "geólogo"]

# Palabras que indican que la oferta es del rubro minero (para filtrar feeds genéricos)
# Se buscan al inicio de palabra ("mina" no calza con "termina"). Se evitan términos ambiguos en Chile:
# "jumbo" (supermercado), "andina" (embotelladora) y "4x3" (turno común en retail).
MINING_WORDS = [
    "miner", "mina", "faena", "caex", "codelco", "bhp", "escondida", "antofagasta minerals",
    "anglo american", "collahuasi", "sqm", "albemarle", "kinross", "teck", "lundin", "glencore",
    "chuquicamata", "el teniente", "division andina", "spence", "minera candelaria", "los pelambres",
    "centinela", "zaldivar", "cobre", "litio", "geolog", "chancado", "flotacion", "concentradora",
    "tronadura", "perforacion", "jumbo radial", "pala hidraulica", "7x7", "14x14",
]
MINING_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in MINING_WORDS) + r")")

# Ciudad/zona -> región, para clasificar ofertas por región
REGION_HINTS = {
    "Arica y Parinacota": ["arica", "putre"],
    "Tarapacá": ["tarapaca", "iquique", "alto hospicio", "pozo almonte", "collahuasi", "pica", "cerro colorado", "quebrada blanca", "qb2"],
    "Antofagasta": ["antofagasta", "calama", "mejillones", "tocopilla", "taltal", "chuquicamata",
                    "sierra gorda", "san pedro de atacama", "maria elena", "escondida", "spence"],
    "Atacama": ["atacama", "copiapo", "vallenar", "caldera", "diego de almagro", "el salvador",
                "chañaral", "chanaral", "tierra amarilla", "candelaria"],
    "Coquimbo": ["coquimbo", "la serena", "ovalle", "illapel", "salamanca", "los vilos", "andacollo", "pelambres"],
    "Valparaíso": ["valparaiso", "vina del mar", "los andes", "san felipe", "quillota", "la calera", "division andina"],
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
    return bool(MINING_RE.search(t))


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
        "description": clean(description)[:320],
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
    # API v4 de Careerjet: clave de la cuenta de publisher como usuario de Basic auth, sin contraseña
    key = os.environ.get("CAREERJET_API_KEY")
    if not key:
        return []
    auth = "Basic " + base64.b64encode(f"{key}:".encode()).decode()
    jobs = []
    for term in SEARCH_TERMS:
        for page in (1, 2):
            # Sin "location": con locale_code es_CL la búsqueda cubre todo Chile (Opción Empleo)
            q = urllib.parse.urlencode({
                "locale_code": "es_CL", "keywords": term,
                "page_size": 50, "page": page, "sort": "date",
                # Careerjet exige IP y navegador del visitante; en una búsqueda programada se informa el del recolector
                "user_ip": os.environ.get("CAREERJET_USER_IP", "1.1.1.1"), "user_agent": UA,
            })
            data = json.loads(http(f"https://search.api.careerjet.net/v4/query?{q}", headers={"Authorization": auth}))
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
            # Algunos feeds son grandes (Chiletrabajos pesa ~18 MB): más tiempo de espera
            root = ET.fromstring(http(src["url"], timeout=src.get("timeout", 120)))
        except Exception as e:
            print(f"  ! feed {src['name']}: {e}", file=sys.stderr)
            continue
        ns = {"a": "http://www.w3.org/2005/Atom"}
        items = root.findall(".//item") or root.findall(".//a:entry", ns)
        kept = 0
        for it in items:
            g = lambda tag: (it.findtext(tag) or it.findtext(f"a:{tag}", namespaces=ns) or "")
            link = g("link")
            if not link:
                el = it.find("a:link", ns)
                link = el.get("href") if el is not None else ""
            title, location = g("title"), src.get("location", "")
            # "Mecánico A Iquique 14X14 | Iquique": la ciudad viene al final del título
            if " | " in title:
                title, city = title.rsplit(" | ", 1)
                location = location or city
            full_desc = g("description") or g("summary")
            job = make_job(title, link, src.get("company", ""), location,
                           full_desc, "", g("pubDate") or g("updated"), src["name"])
            # El filtro de minería mira la descripción completa, antes de recortarla
            if src.get("mining_only") or MINING_RE.search(norm(f"{title} {full_desc}")):
                jobs.append(job)
                kept += 1
        print(f"  {src['name']}: {kept} de {len(items)} son de minería")
    return jobs


# Regiones como las escriben los portales SuccessFactors ("2da.", "6ta.", ...)
CAREER_SITE_REGIONS = {
    "1ra": "Tarapacá", "2da": "Antofagasta", "3ra": "Atacama", "4ta": "Coquimbo", "5ta": "Valparaíso",
    "6ta": "O'Higgins", "7ma": "Maule", "8va": "Biobío", "9na": "Araucanía", "10ma": "Los Lagos",
    "11va": "Aysén", "12va": "Magallanes", "13va": "Metropolitana", "rm": "Metropolitana",
    "14va": "Los Ríos", "15va": "Arica y Parinacota", "16va": "Ñuble",
}


def from_career_sites():
    """Portales de empleo propios de mineras hechos con SAP SuccessFactors (Career Site Builder).
    Se leen desde su sitemap.xml, que publican para buscadores; solo se abren páginas /job/,
    permitidas por su robots.txt, de a una por segundo. Cada oferta enlaza a su página original."""
    if not SOURCES.exists():
        return []
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    jobs = []
    for site in json.loads(SOURCES.read_text(encoding="utf-8")).get("career_sites", []):
        if not site.get("enabled", True):
            continue
        try:
            root = ET.fromstring(http(site["sitemap"]))
        except Exception as e:
            print(f"  ! {site['name']}: {e}", file=sys.stderr)
            continue
        pattern = site.get("url_contains", "/job/")
        urls = [html.unescape(loc.text.strip()) for loc in root.iter(ns + "loc") if loc.text and pattern in loc.text]
        if site.get("chile_only"):
            # Portales con ofertas de todo el mundo: solo se abren las que en su dirección nombran una faena o ciudad de Chile
            urls = [u for u in urls if detect_region(urllib.parse.unquote(u)) or "chile" in norm(urllib.parse.unquote(u))]
        found = 0
        for url in urls[: site.get("max_jobs", 60)]:
            time.sleep(1)
            try:
                job = parse_career_site_job(http(url).decode("utf-8", "replace"), url, site)
            except Exception as e:
                print(f"  ! {url}: {e}", file=sys.stderr)
                continue
            if job:
                jobs.append(job)
                found += 1
        print(f"  {site['name']}: {found} de {len(urls)} ofertas vigentes")
    return jobs


def career_site_meta(page, name):
    m = re.search(r'itemprop="%s"\s+content="([^"]*)"' % name, page)
    return html.unescape(m.group(1)).strip() if m else ""


def career_site_date(s):
    try:
        return datetime.strptime(s, "%a %b %d %H:%M:%S UTC %Y").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def jsonld_job(page):
    """Devuelve el JobPosting en JSON-LD (formato estándar que los portales publican para Google), si existe."""
    for raw in re.findall(r'<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>', page):
        try:
            data = json.loads(raw)
        except ValueError:
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for d in items:
            if isinstance(d, dict) and d.get("@type") == "JobPosting":
                return d
    return None


def parse_jsonld_job(d, url, site):
    title = clean(d.get("title", ""))
    if not title:
        return None
    now = datetime.now(timezone.utc)
    until = parse_date(d.get("validThrough") or "")
    if until and until < now:
        return None  # postulación cerrada
    raw_desc = d.get("description", "")
    description = clean(raw_desc)
    loc = d.get("jobLocation") or {}
    loc = loc[0] if isinstance(loc, list) and loc else loc
    addr = loc.get("address", {}) if isinstance(loc, dict) else {}
    addr = addr if isinstance(addr, dict) else {}
    location = ", ".join(x for x in [addr.get("addressLocality", ""), addr.get("addressRegion", "")] if x)
    if site.get("chile_only") and addr.get("addressCountry") not in ("CL", "Chile") and not detect_region(location):
        return None
    org = d.get("hiringOrganization") or {}
    company = org.get("name", "") if isinstance(org, dict) else str(org)
    # "Empresa Confidencial": muchas ofertas nombran a la empresa en la primera línea de la descripción
    if not company or "confidencial" in company.lower():
        first = clean(re.split(r"<br\s*/?>|\n", raw_desc, maxsplit=1)[0])
        if len(first) < 90 and re.search(r"(?i)\b(ltda|s\.?a\.?|spa|minera|compa[nñ][ií]a)\b", first):
            company = first
    job = make_job(title, d.get("url") or url, company or site.get("company", ""), location, description, "",
                   parse_date(d.get("datePosted") or "") or now, site["name"])
    return job


def parse_career_site_job(page, url, site):
    d = jsonld_job(page)
    if d:
        return parse_jsonld_job(d, url, site)
    m = re.search(r'property="og:title"\s+content="([^"]*)"', page)
    title = html.unescape(m.group(1)).strip() if m else ""
    if not title:
        return None
    # Algunos portales ponen la faena en el título: "Superintendente Desarrollo Mina | Escondida"
    place = ""
    if " | " in title:
        title, place = [x.strip() for x in title.split(" | ", 1)]
    now = datetime.now(timezone.utc)
    until = career_site_date(career_site_meta(page, "validThrough"))
    if until and until < now:
        return None  # postulación cerrada
    posted = career_site_date(career_site_meta(page, "datePosted")) or now
    start = page.find('class="jobdescription">')
    description = ""
    if start >= 0:
        chunk = page[start + len('class="jobdescription">'): start + 12000]
        description = clean(chunk.split("</div>")[0])
    region = CAREER_SITE_REGIONS.get(career_site_meta(page, "addressRegion").lower().rstrip("."), "")
    if not region:
        # La faena puede venir en el título, en la dirección de la oferta (ej. ".../job/Pica-...") o en la descripción
        region = detect_region(f"{title} {place} {urllib.parse.unquote(url)} {description[:500]}")
    # Portales con ofertas de varios países (ej. BHP): solo se dejan las de Chile
    if site.get("chile_only") and not region and career_site_meta(page, "addressCountry") != "CL" \
            and "chile" not in norm(f"{place} {description[:600]}"):
        return None
    division = re.search(r"Divisi[oó]n(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]*){1,3}", description)
    location = ", ".join(x for x in [division.group(0) if division else "", place, region] if x)
    company = site.get("company") or career_site_meta(page, "hiringOrganization")
    job = make_job(title, url, company, location, description, "", posted, site["name"])
    if region:
        job["region"] = region
    return job


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
                     ("careerjet", from_careerjet), ("feeds", from_feeds),
                     ("portales de mineras", from_career_sites)]:
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
    jobs = jobs[:MAX_JOBS]  # las más recientes, para que la página cargue rápido en celular

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(), "count": len(jobs),
                               "jobs": jobs}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
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
