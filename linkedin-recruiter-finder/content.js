// LinkedIn Recruiter Finder - content script.
// Runs ONLY when the popup asks for a scan of the page the user is already viewing.
// It reads visible search-result cards; it does not crawl, paginate or message anyone.

(() => {
  const RECRUITER_TERMS = [
    "recruiter", "recruiting", "recruitment", "talent acquisition", "talent partner",
    "talent lead", "talent manager", "sourcer", "sourcing", "headhunter", "staffing",
    "hiring", "we are hiring", "people operations", "hr business partner", "hr manager",
    "human resources", "executive search", "technical recruiter", "tech recruiter"
  ];

  // Profile links look like https://www.linkedin.com/in/some-name-123/
  const PROFILE_RE = /^https?:\/\/(www\.)?linkedin\.com\/in\/[^/?#]+/i;

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function firstText(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && clean(el.innerText)) return clean(el.innerText);
    }
    return "";
  }

  function scoreHeadline(text) {
    const t = text.toLowerCase();
    const hits = RECRUITER_TERMS.filter(term => t.includes(term));
    return { score: hits.length, hits };
  }

  function extractCards() {
    // Find every link to a profile, then climb to its result card.
    const links = Array.from(document.querySelectorAll('a[href*="/in/"]'));
    const seen = new Set();
    const results = [];

    for (const a of links) {
      const url = (a.href || "").split("?")[0].replace(/\/$/, "") + "/";
      if (!PROFILE_RE.test(url) || seen.has(url)) continue;

      const card = a.closest("li") || a.closest("[data-chameleon-result-urn]") || a.parentElement;
      if (!card) continue;

      const name = clean(a.innerText).split("\n")[0] ||
        firstText(card, ['span[aria-hidden="true"]']);
      if (!name || name.length > 80) continue;

      const headline = firstText(card, [
        ".entity-result__primary-subtitle",
        '[class*="subtitle"]',
        '[class*="headline"]'
      ]);
      const location = firstText(card, [
        ".entity-result__secondary-subtitle",
        '[class*="secondary-subtitle"]'
      ]);

      const { score, hits } = scoreHeadline(`${headline} ${name}`);
      seen.add(url);
      results.push({
        name,
        headline,
        location,
        profileUrl: url,
        score,
        matches: hits,
        scannedAt: new Date().toISOString()
      });
    }
    return results;
  }

  // Clicks the profile's own "Follow" button once. Only runs when the user clicks
  // Follow for a specific recruiter in the popup. Never loops or follows others.
  function followThisProfile() {
    if (!/linkedin\.com\/in\//.test(location.href)) {
      return { ok: false, error: "Not a profile page" };
    }
    const buttons = Array.from(document.querySelectorAll("button"));
    const already = buttons.some(b => clean(b.innerText) === "Following");
    if (already) return { ok: true, status: "already-following" };
    const btn = buttons.find(b => clean(b.innerText) === "Follow" || b.getAttribute("aria-label") === "Follow");
    if (!btn) return { ok: false, error: "No Follow button found (profile may not allow following)" };
    btn.click();
    return { ok: true, status: "followed" };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "FOLLOW_PROFILE") {
      try {
        sendResponse(followThisProfile());
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
      return true;
    }
    if (msg && msg.type === "SCAN_PAGE") {
      try {
        const onSearch = /linkedin\.com\/search\//.test(location.href);
        const people = extractCards();
        sendResponse({ ok: true, onSearch, count: people.length, people });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
      return true;
    }
    return false;
  });
})();
