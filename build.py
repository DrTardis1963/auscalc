"""Build the static site: src/ -> dist/. Standard library only.

Each file in src/pages/ starts with a JSON header in an HTML comment:
    <!--{"title": "...", "description": "...", "card": "short text for the home grid"}-->
followed by the page body. A <script> block at the end of a page is moved to
the bottom of the layout. Pages with "card" are listed on the home page.

Usage:  py build.py            (writes dist/)
"""
import datetime
import html
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

HEADER = re.compile(r"^\s*<!--(\{.*?\})-->\s*", re.S)
SCRIPT = re.compile(r"<script>.*?</script>\s*$", re.S)


def load_pages():
    pages = []
    for path in sorted((SRC / "pages").glob("*.html")):
        text = path.read_text(encoding="utf-8")
        m = HEADER.match(text)
        if not m:
            raise SystemExit(f"{path.name}: missing JSON header comment")
        meta = json.loads(m.group(1))
        body = text[m.end():]
        script = ""
        s = SCRIPT.search(body)
        if s:
            script, body = s.group(0), body[: s.start()]
        slug = path.stem
        meta.setdefault("order", 99)
        pages.append({"slug": slug, "meta": meta, "body": body, "script": script, "path": path})
    return pages


def page_url(site, slug):
    if slug == "index":
        return site["url"] + "/"
    if slug == "404":
        return site["url"] + "/404.html"
    return f"{site['url']}/{slug}/"


def last_changed(path):
    """Date of the last commit that touched `path` (YYYY-MM-DD), for sitemap lastmod.
    Google only trusts lastmod when it tracks real content changes, so a build date won't do.
    Uncommitted or untracked files get today's date."""
    try:
        if subprocess.run(["git", "diff", "--quiet", "HEAD", "--", str(path)], cwd=ROOT,
                          stderr=subprocess.DEVNULL).returncode:
            return datetime.date.today().isoformat()
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", str(path)],
                             cwd=ROOT, capture_output=True, text=True).stdout.strip()
        return out or datetime.date.today().isoformat()
    except OSError:
        return datetime.date.today().isoformat()


def crumb_name(meta):
    if "short" in meta:
        return meta["short"]
    if "state" in meta:
        return f'{meta["state"]} stamp duty'
    return meta["title"].split(":")[0].split(" (")[0]


def breadcrumbs(site, p, by_slug):
    """Visible trail plus BreadcrumbList data: Home > [parent] > page."""
    if p["slug"] in ("index", "404"):
        return "", None
    trail = [("Home", page_url(site, "index"), "/")]
    parent = by_slug.get(p["meta"].get("parent") or ("car-stamp-duty" if "state" in p["meta"] else ""))
    if parent:
        trail.append((crumb_name(parent["meta"]), page_url(site, parent["slug"]), f'/{parent["slug"]}/'))
    trail.append((crumb_name(p["meta"]), page_url(site, p["slug"]), None))
    items = "".join(
        f'<li><a href="{href}">{html.escape(name)}</a></li>' if href else f'<li aria-current="page">{html.escape(name)}</li>'
        for name, _, href in trail)
    data = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        dict({"@type": "ListItem", "position": i + 1, "name": name}, **({"item": url} if i < len(trail) - 1 else {}))
        for i, (name, url, _) in enumerate(trail)]}
    return f'<nav class="crumbs" aria-label="Breadcrumb"><ol>{items}</ol></nav>', data


def ad_slot(site):
    # Auto ads (the head script) place ads by themselves. A fixed spot here needs an
    # ad unit's slot id from AdSense ("slot" in site.json); without one, leave it out.
    ads = site["adsense"]
    if not ads["enabled"] or not ads.get("slot"):
        return ""
    return (f'<div class="ad-slot"><ins class="adsbygoogle" style="display:block" '
            f'data-ad-client="{ads["client"]}" data-ad-slot="{ads["slot"]}" '
            f'data-ad-format="auto" data-full-width-responsive="true"></ins>'
            f'<script>(adsbygoogle=window.adsbygoogle||[]).push({{}});</script></div>')


def build():
    site = json.loads((ROOT / "site.json").read_text(encoding="utf-8"))
    layout = (SRC / "layout.html").read_text(encoding="utf-8")
    pages = load_pages()
    version = datetime.datetime.now().strftime("%Y%m%d%H%M")

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SRC / "assets", DIST / "assets")

    cards = sorted((p for p in pages if "card" in p["meta"]), key=lambda p: (p["meta"]["order"], p["meta"]["title"]))
    grid = '<ul class="grid">' + "".join(
        f'<li><a href="/{p["slug"]}/"><strong>{html.escape(p["meta"].get("short", p["meta"]["title"]))}</strong>'
        f'<span>{html.escape(p["meta"]["card"])}</span></a></li>' for p in cards) + "</ul>"

    ads_head = ""
    if site["adsense"]["enabled"]:
        ads_head = ('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
                    f'?client={site["adsense"]["client"]}" crossorigin="anonymous"></script>')

    # Links to every state's car stamp duty page ("state" in the header), for {{duty_states}}.
    states = sorted((p for p in pages if "state" in p["meta"]), key=lambda p: p["meta"]["order"])
    duty_states = '<ul class="chips">' + "".join(
        f'<li><a href="/{p["slug"]}/">{html.escape(p["meta"]["state"])}</a></li>' for p in states) + "</ul>"

    by_slug = {p["slug"]: p for p in pages}
    for p in pages:
        meta = p["meta"]
        url = page_url(site, p["slug"])
        title = meta["title"] if p["slug"] == "index" else f'{meta["title"]} | {site["name"]}'
        data = []
        if "card" in meta or meta.get("app"):
            data.append({
                "@context": "https://schema.org", "@type": "WebApplication",
                "name": meta["title"], "url": url, "description": meta["description"],
                "applicationCategory": "FinanceApplication", "operatingSystem": "Any",
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "AUD"},
            })
        if p["slug"] == "index":
            # Site name in Google results (supported for subdomains; markup on the home page).
            host = site["url"].split("://", 1)[1]
            data.append({"@context": "https://schema.org", "@type": "WebSite",
                         "name": site["name"], "alternateName": [host], "url": site["url"] + "/"})
        crumbs, crumb_data = breadcrumbs(site, p, by_slug)
        if crumb_data:
            data.append(crumb_data)
        jsonld = "".join('<script type="application/ld+json">' + json.dumps(d) + "</script>" for d in data)
        # data-nosnippet keeps Google from quoting a calculator's live result box in search snippets.
        body = (p["body"].replace('<div class="calc-card">', '<div class="calc-card" data-nosnippet>')
                .replace("{{calc_list}}", grid)
                .replace("{{duty_states}}", duty_states)
                .replace("{{ad}}", ad_slot(site))
                .replace("{{contact}}", site["contact"])
                .replace("{{site_name}}", site["name"]))
        out = layout
        for key, val in {
            "title": html.escape(title), "description": html.escape(meta["description"]),
            "canonical": url, "site_name": html.escape(site["name"]), "owner": html.escape(site["owner"]),
            "year": str(datetime.date.today().year), "version": version, "ads_head": ads_head,
            "jsonld": jsonld, "scripts": p["script"], "content": crumbs + body,
        }.items():
            out = out.replace("{{" + key + "}}", val)
        if "{{" in out:
            raise SystemExit(f"{p['slug']}: unreplaced placeholder near: {out[out.index('{{'):][:40]}")
        if p["slug"] in ("index", "404"):
            dest = DIST / f"{p['slug']}.html"
        else:
            dest = DIST / p["slug"] / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(out, encoding="utf-8")

    entries = [(page_url(site, p["slug"]), last_changed(p["path"])) for p in pages if p["slug"] != "404"]
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc><lastmod>{d}</lastmod></url>\n" for u, d in entries)
        + "</urlset>\n", encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site['url']}/sitemap.xml\n", encoding="utf-8")
    pub = site["adsense"]["client"].replace("ca-", "")
    (DIST / "ads.txt").write_text(f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n", encoding="utf-8")
    host = site["url"].split("://", 1)[1]
    (DIST / "CNAME").write_text(host + "\n", encoding="utf-8")
    (DIST / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Built {len(pages)} pages into {DIST}")


if __name__ == "__main__":
    build()
