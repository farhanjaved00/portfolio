# LinkedIn Recruiter Finder (Chrome extension)

Finds recruiters and talent-acquisition people from LinkedIn **search results you are viewing**, scores how strongly each one looks like a hiring contact, filters by location, and exports a CSV.

## How it works

1. Open LinkedIn → search **People** (e.g. `Technical Recruiter`, `Talent Acquisition`, `hiring`), and set the location filter to a country or *Worldwide*.
2. Click the extension → **Scan this LinkedIn page**. It reads the visible result cards and stores name, headline, location and profile URL.
3. Scroll/page through results yourself and scan again. Duplicates are merged by profile URL.
4. Filter by country/city or by minimum score, then **Export CSV**.

The score counts recruiting terms in the headline (e.g. "recruiter", "talent acquisition", "we are hiring", "sourcer").

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this `linkedin-recruiter-finder` folder.
3. Pin the extension and use it on any linkedin.com tab.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest; permissions limited to `activeTab`, `scripting`, `storage`, and linkedin.com |
| `content.js` | Reads result cards on the current page when asked by the popup |
| `popup.html` / `popup.js` | UI, storage, filtering, CSV export |

## Limits and responsible use

- **LinkedIn's User Agreement restricts automated scraping.** This tool is deliberately manual: it reads only the page you are looking at on each click, with no crawling, auto-pagination, or messaging. Keep it that way, and use it at a human pace.
- LinkedIn changes its markup often. If scans return nothing, the selectors in `content.js` (`.entity-result__primary-subtitle`, `a[href*="/in/"]`, etc.) need updating.
- Data stays in `chrome.storage.local` on your machine. Respect candidates' privacy when you contact them.
- Location is shown as LinkedIn displays it; "worldwide" means the search itself is unfiltered by country.

## Ideas for next steps

- Keyword presets per country (e.g. "recruiter India", "talent acquisition Germany").
- Dedupe against a CRM/Google Sheet.
- Options page for custom recruiter terms.
