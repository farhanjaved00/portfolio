const STORE_KEY = "recruiters";
const SETTINGS_KEY = "settings";
const STATUSES = ["New", "Contacted", "Replied", "Not interested"];
const DEFAULT_TEMPLATE =
  "Hi {name}, I saw you are recruiting for {headline}. I'm interested in opportunities that match my experience. Would you be open to a quick chat?";

const $ = id => document.getElementById(id);
let all = [];
let settings = { template: DEFAULT_TEMPLATE, customTerms: "" };

// ---------- storage ----------
async function load() {
  const data = await chrome.storage.local.get([STORE_KEY, SETTINGS_KEY]);
  all = data[STORE_KEY] || [];
  settings = { ...settings, ...(data[SETTINGS_KEY] || {}) };
  $("template").value = settings.template;
  $("customTerms").value = settings.customTerms || "";
  render();
  renderPreview();
}
async function save() {
  await chrome.storage.local.set({ [STORE_KEY]: all });
  $("count").textContent = `${all.length} saved`;
}
async function saveSettings() {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

// ---------- tabs ----------
function showTab(name) {
  const panes = { list: "paneList", msg: "paneMsg", settings: "paneSettings" };
  for (const k in panes) $(panes[k]).classList.toggle("hidden", k !== name);
  $("tabList").classList.toggle("on", name === "list");
  $("tabMsg").classList.toggle("on", name === "msg");
  $("tabSettings").classList.toggle("on", name === "settings");
}
$("tabList").onclick = () => showTab("list");
$("tabMsg").onclick = () => { showTab("msg"); renderPreview(); };
$("tabSettings").onclick = () => showTab("settings");

// ---------- list ----------
function visible() {
  const q = $("filter").value.trim().toLowerCase();
  const min = Number($("minScore").value) || 0;
  const st = $("statusFilter").value;
  return all
    .filter(p => p.score >= min)
    .filter(p => !st || (p.status || "New") === st)
    .filter(p => !q || `${p.location} ${p.headline}`.toLowerCase().includes(q))
    .sort((a, b) => b.score - a.score);
}

function button(text, onClick, cls = "small") {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  const list = $("list");
  list.innerHTML = "";
  const rows = visible();
  for (const p of rows) {
    const li = document.createElement("li");

    const a = document.createElement("a");
    a.href = p.profileUrl; a.target = "_blank"; a.rel = "noopener";
    a.textContent = p.name;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `score ${p.score}`;
    a.after(badge);

    const head = document.createElement("div");
    head.textContent = p.headline;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${p.location || "Location not shown"} · ${p.status || "New"}`;

    const actions = document.createElement("div");
    actions.className = "actions";

    // Follow (one click, one profile)
    const fb = button(p.followed ? "Followed ✓" : "Follow", async () => {
      fb.disabled = true; fb.textContent = "Following…";
      try { await followOne(p); render(); }
      catch (err) { fb.disabled = false; fb.textContent = "Follow"; $("status").textContent = `Could not follow ${p.name}: ${err.message}`; }
    });
    fb.disabled = !!p.followed;

    // Copy outreach message (you paste it on LinkedIn yourself)
    const cp = button("Copy message", async () => {
      await navigator.clipboard.writeText(fill(settings.template, p));
      $("status").textContent = `Message for ${p.name} copied. Paste it on LinkedIn yourself.`;
    });

    // Status select
    const sel = document.createElement("select");
    sel.className = "small";
    for (const s of STATUSES) {
      const o = document.createElement("option");
      o.textContent = s; o.value = s;
      if ((p.status || "New") === s) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", async () => { p.status = sel.value; await save(); render(); });

    // Notes
    const note = document.createElement("input");
    note.type = "text"; note.className = "note"; note.placeholder = "Notes (e.g. spoke 3 Nov, role: backend)";
    note.value = p.notes || "";
    note.addEventListener("change", async () => { p.notes = note.value; await save(); });

    actions.append(fb, cp, sel);
    li.append(a, head, meta, actions, note);
    list.appendChild(li);
  }
  $("status").textContent = `${rows.length} shown · ${all.length} saved`;
  $("count").textContent = `${all.length} saved`;
}

// ---------- message preview ----------
function fill(template, p) {
  return template
    .replace(/\{name\}/g, p.name.split(" ")[0] || p.name)
    .replace(/\{headline\}/g, p.headline || "your roles")
    .replace(/\{location\}/g, p.location || "your region");
}
function renderPreview() {
  const first = all[0];
  $("preview").value = first ? fill($("template").value, first) : "Scan a page first to see a preview.";
}
$("template").addEventListener("input", renderPreview);
$("saveTemplate").onclick = async () => {
  settings.template = $("template").value;
  await saveSettings();
  renderPreview();
  $("statusBar").textContent = "Template saved.";
};

// ---------- settings ----------
$("saveTerms").onclick = async () => {
  settings.customTerms = $("customTerms").value;
  await saveSettings();
  $("statusBar").textContent = "Keywords saved. They apply on the next scan.";
};

// ---------- follow ----------
async function followOne(p) {
  const tab = await chrome.tabs.create({ url: p.profileUrl, active: false });
  await new Promise(resolve => {
    const done = (id, info) => {
      if (id === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(done);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(done);
    setTimeout(resolve, 15000);
  });
  await new Promise(r => setTimeout(r, 1500));
  let res;
  try { res = await chrome.tabs.sendMessage(tab.id, { type: "FOLLOW_PROFILE" }); }
  catch (err) { res = { ok: false, error: err.message }; }
  await chrome.tabs.remove(tab.id);
  if (res && res.ok) {
    p.followed = true;
    p.followedAt = new Date().toISOString();
    await save();
    return res.status;
  }
  throw new Error((res && res.error) || "Follow failed");
}

// ---------- scan ----------
function customTermList() {
  return (settings.customTerms || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

async function scan() {
  $("status").textContent = "Scanning…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/www\.linkedin\.com\//.test(tab.url || "")) {
    $("status").textContent = "Switch to a linkedin.com tab first.";
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_PAGE", terms: customTermList() });
    if (!res || !res.ok) throw new Error((res && res.error) || "No response from page");
    const seen = new Map(all.map(p => [p.profileUrl, p]));
    let added = 0;
    for (const p of res.people) {
      const prev = seen.get(p.profileUrl);
      if (!prev) added++;
      // Keep status, notes and follow state across rescans.
      seen.set(p.profileUrl, {
        ...p,
        status: prev?.status || "New",
        notes: prev?.notes || "",
        followed: prev?.followed || false,
        followedAt: prev?.followedAt
      });
    }
    all = [...seen.values()];
    await save();
    render();
    $("status").textContent = `Found ${res.count} on page, ${added} new · ${all.length} saved`;
  } catch (err) {
    $("status").textContent = "Could not scan: reload the LinkedIn tab and try again. (" + err.message + ")";
  }
}

// ---------- csv ----------
function toCsv() {
  const cols = ["name", "headline", "location", "score", "matches", "status", "notes", "followed", "profileUrl", "scannedAt"];
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

// ---------- wiring ----------
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
$("statusFilter").addEventListener("change", render);

load();
