const STORE_KEY = "recruiters";
const $ = id => document.getElementById(id);
let all = [];

async function load() {
  const data = await chrome.storage.local.get(STORE_KEY);
  all = data[STORE_KEY] || [];
  render();
}

async function save() {
  await chrome.storage.local.set({ [STORE_KEY]: all });
}

function visible() {
  const q = $("filter").value.trim().toLowerCase();
  const min = Number($("minScore").value) || 0;
  return all
    .filter(p => p.score >= min)
    .filter(p => !q || `${p.location} ${p.headline}`.toLowerCase().includes(q))
    .sort((a, b) => b.score - a.score);
}

function render() {
  const list = $("list");
  list.innerHTML = "";
  const rows = visible();
  for (const p of rows) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = p.profileUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = p.name;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `score ${p.score}`;
    a.after(badge);
    const head = document.createElement("div");
    head.textContent = p.headline;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = p.location || "Location not shown";
    li.append(a, head, meta);
    list.appendChild(li);
  }
  $("status").textContent = `${rows.length} shown · ${all.length} saved`;
}

async function scan() {
  $("status").textContent = "Scanning…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/www\.linkedin\.com\//.test(tab.url || "")) {
    $("status").textContent = "Switch to a linkedin.com tab first.";
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_PAGE" });
    if (!res || !res.ok) throw new Error(res && res.error || "No response from page");
    if (!res.onSearch) $("status").textContent = "Tip: this page is not a search page; results may be empty.";
    const seen = new Map(all.map(p => [p.profileUrl, p]));
    let added = 0;
    for (const p of res.people) {
      if (!seen.has(p.profileUrl)) added++;
      seen.set(p.profileUrl, { ...seen.get(p.profileUrl), ...p });
    }
    all = [...seen.values()];
    await save();
    render();
    $("status").textContent = `Found ${res.count} on page, ${added} new · ${all.length} saved`;
  } catch (err) {
    $("status").textContent = "Could not scan: reload the LinkedIn tab and try again. (" + err.message + ")";
  }
}

function toCsv() {
  const cols = ["name", "headline", "location", "score", "matches", "profileUrl", "scannedAt"];
  const esc = v => `"${String(Array.isArray(v) ? v.join("; ") : v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...visible().map(p => cols.map(c => esc(p[c])).join(","))].join("\n");
}

function exportCsv() {
  const blob = new Blob([toCsv()], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "recruiters.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("scan").addEventListener("click", scan);
$("csv").addEventListener("click", exportCsv);
$("clear").addEventListener("click", async () => {
  if (!confirm("Delete all saved recruiters?")) return;
  all = [];
  await save();
  render();
});
$("filter").addEventListener("input", render);
$("minScore").addEventListener("input", render);

load();
