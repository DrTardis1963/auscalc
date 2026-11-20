# AusCalc

Free Australian pay, tax and cost calculators, funded by AdSense.
Live address (once DNS is set): https://calc.primemoverindustries.com

Static site: no server, no database, no npm packages. Python builds it, Node tests the maths,
GitHub Pages hosts it for free.

## Run it

```bash
node tests/check.js     # formula checks, incl. every worked example on the pages
py build.py             # src/ -> dist/
py -m http.server 8064 --directory dist
```

## Layout

- `site.json`: name, address, contact, AdSense switch.
- `src/assets/formulas.js`: all the maths and all the rates (`RATES`). One place to update each year.
- `src/assets/ui.js`: wires a form to its result box.
- `src/pages/*.html`: one file per page. A JSON header comment gives the title, description and
  home-page card; a `<script>` at the end is moved below the layout. `{{ad}}` marks an ad spot.
- `build.py`: writes `dist/` plus `sitemap.xml`, `robots.txt`, `ads.txt`, `CNAME`.
- `.github/workflows/deploy.yml`: on push to `main`, tests, builds and deploys to Pages.

## Adding a calculator

1. Add a pure function to `formulas.js` and checks for it in `tests/check.js`.
2. Copy a page in `src/pages/`, change the header, form and render function.
3. Write a real explainer: the formula, a worked example with numbers from the checks,
   what it leaves out, and sources with a checked date. No thin pages (AdSense rejects them).

## Yearly refresh (each July, after the Budget)

1. Update `RATES` in `formulas.js` from the ATO pages named in each page's sources line.
2. Update worked examples and the "checked" dates; `node tests/check.js` must pass.

## Going live

1. DNS at Namecheap (primemoverindustries.com): add a CNAME record `calc` -> `drtardis1963.github.io`.
2. Repo Settings -> Pages -> Source: GitHub Actions. Custom domain: `calc.primemoverindustries.com`, tick Enforce HTTPS.
3. Google Search Console: add the domain, submit `/sitemap.xml`.

## AdSense

1. Put this line in `ads.txt` at the ROOT site, https://primemoverindustries.com/ads.txt
   (AdSense checks the root domain, not the subdomain):
   `google.com, pub-3886111503622765, DIRECT, f08c47fec0942fa0`
2. Set `"enabled": true` in `site.json` and push. That adds the AdSense script (Auto ads) and
   the in-page ad spots; they stay blank until approval.
3. In AdSense (publisher pub-3886111503622765), Sites -> Add site -> `primemoverindustries.com`.
   AdSense says which check it wants (code snippet, ads.txt or meta tag); the root site may need
   the snippet too. Link to the calculators from the root site's home page so the reviewer finds them.
4. Turn on AdSense's own consent message (Privacy & messaging -> European regulations) for EEA/UK visitors.
