const grid = document.getElementById("grid");
const modal = document.getElementById("modal");
const studio = document.getElementById("studio");
const toast = document.getElementById("toast");
const countEl = document.getElementById("count");
const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const DB_NAME = "blanc-studio";
const PIN_KEY = "blanc_unlocked";
const CATALOG_KEY = "blanc_public_catalog";

let filter = "all";
let current = null;
let works = [];
let pendingFile = null;
let admin = sessionStorage.getItem(PIN_KEY) === "1";

function prettyName(file) {
  return file.replace(IMG_EXT, "").replace(/[-_]+/g, " ").trim();
}
function slug(s) {
  return String(s || "plate").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "plate";
}
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("open");
  setTimeout(() => toast.classList.remove("open"), 1800);
}
function repoFromUrl() {
  if (CONFIG.github && CONFIG.github.includes("/")) return CONFIG.github;
  const host = location.hostname;
  if (!host.endsWith(".github.io")) return "";
  const user = host.split(".")[0];
  const part = location.pathname.split("/").filter(Boolean)[0];
  if (!part || part.endsWith(".html")) return user + "/" + user + ".github.io";
  return user + "/" + part;
}
function parseSidecar(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  let model = "";
  let start = 0;
  if (/^(MODEL|모델)\s*:/i.test(lines[0] || "")) {
    model = lines[0].split(":").slice(1).join(":").trim();
    start = 1;
    if (lines[1] === "") start = 2;
  }
  return { model, prompt: lines.slice(start).join("\n").trim() };
}
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("plates", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function localList() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const q = db.transaction("plates").objectStore("plates").getAll();
      q.onsuccess = () => resolve(q.result || []);
      q.onerror = () => resolve([]);
    });
  } catch (_) { return []; }
}
async function localSave(item) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const q = db.transaction("plates", "readwrite").objectStore("plates").put(item);
    q.onsuccess = resolve;
    q.onerror = () => reject(q.error);
  });
}
function readSharedCatalog() {
  try { return JSON.parse(localStorage.getItem(CATALOG_KEY) || "[]"); }
  catch (_) { return []; }
}
function writeSharedCatalog(list) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(list));
}
async function loadPrompt(url) {
  try { return (await fetch(url).then((r) => r.text())); } catch (_) { return ""; }
}
async function attachPrompts(list) {
  await Promise.all(list.map(async (w) => {
    if (w.prompt && w.model) return;
    const stem = String(w.src || "").replace(/^.*\//, "").replace(/\?.*$/, "").replace(IMG_EXT, "");
    const raw = await loadPrompt("images/" + stem + ".txt");
    const parsed = parseSidecar(raw);
    if (!w.prompt) w.prompt = parsed.prompt;
    if (!w.model) w.model = parsed.model;
  }));
  return list;
}
async function loadFromGitHub() {
  const repo = repoFromUrl();
  if (!repo) return null;
  const res = await fetch("https://api.github.com/repos/" + repo + "/contents/" + CONFIG.folder);
  if (!res.ok) throw new Error("github " + res.status);
  const files = await res.json();
  if (!Array.isArray(files)) throw new Error("not a folder");
  const prompts = {};
  files.filter((f) => f.type === "file" && /\.txt$/i.test(f.name)).forEach((f) => {
    prompts[f.name.replace(/\.txt$/i, "")] = f.download_url;
  });
  const images = files
    .filter((f) => f.type === "file" && IMG_EXT.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const list = [];
  for (const img of images) {
    const stem = img.name.replace(IMG_EXT, "");
    let model = "";
    let prompt = "";
    if (prompts[stem]) {
      const parsed = parseSidecar(await loadPrompt(prompts[stem]));
      model = parsed.model;
      prompt = parsed.prompt;
    }
    list.push({
      id: stem,
      title: prettyName(img.name),
      ratio: "9:16",
      model,
      src: CONFIG.folder + "/" + img.name + "?t=" + img.sha.slice(0, 7),
      prompt: prompt || ""
    });
  }
  return list;
}
function mergeLists() {
  const map = new Map();
  const add = (arr) => (arr || []).forEach((w) => { if (w && w.id) map.set(w.id, w); });
  add(WORKS);
  for (let i = 1; i < arguments.length; i++) add(arguments[i]);
  return [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}
function ratioFromImg(img) {
  if (!img.naturalWidth || !img.naturalHeight) return "9:16";
  return img.naturalWidth >= img.naturalHeight ? "16:9" : "9:16";
}
function cardHTML(w) {
  const badge = w.model || w.ratio;
  return `
    <article class="card" data-id="${w.id}" data-ratio="${w.ratio}">
      <img src="${w.src}" alt="${w.title}" loading="lazy" />
      <div class="shade">
        <span class="badge">${badge}</span>
        <span class="label">${w.title}</span>
      </div>
    </article>`;
}
function render() {
  const list = works.filter((w) => filter === "all" || w.ratio === filter);
  grid.innerHTML = list.map(cardHTML).join("") || '<p class="empty"></p>';
  grid.querySelectorAll(".card").forEach((el) => {
    const img = el.querySelector("img");
    const apply = () => {
      const w = works.find((x) => x.id === el.dataset.id);
      if (!w || !img.naturalWidth) return;
      w.ratio = ratioFromImg(img);
      el.dataset.ratio = w.ratio;
      if (!w.model) el.querySelector(".badge").textContent = w.ratio;
      if (filter !== "all" && w.ratio !== filter) el.remove();
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
    el.addEventListener("click", () => open(el.dataset.id));
  });
  countEl.textContent = works.length;
}
function open(id) {
  current = works.find((w) => w.id === id);
  if (!current) return;
  document.getElementById("m-img").src = current.src;
  document.getElementById("m-img").alt = current.title;
  document.getElementById("m-title").textContent = current.title;
  const bits = [current.ratio, current.model].filter(Boolean);
  document.getElementById("m-meta").textContent = bits.join("  ·  ");
  document.getElementById("m-prompt").textContent = current.prompt || "";
  document.getElementById("copy").textContent = "프롬프트 복사";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = studio.classList.contains("open") ? "hidden" : "";
  current = null;
}
function openStudio() {
  document.getElementById("gate").hidden = admin;
  document.getElementById("studio-form").hidden = !admin;
  studio.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeStudio() {
  studio.classList.remove("open");
  document.body.style.overflow = "";
}
function setAdmin(on) {
  admin = on;
  sessionStorage.setItem(PIN_KEY, on ? "1" : "");
  document.getElementById("gate").hidden = on;
  document.getElementById("studio-form").hidden = !on;
}
function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      dataUrl: reader.result,
      b64: String(reader.result).split(",")[1]
    });
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function fileToWebp(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1600;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (Math.max(w, h) > max) {
        const s = max / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const finish = async (blob, ext) => {
        if (!blob) return reject(new Error("compress"));
        const enc = await blobToB64(blob);
        resolve({ ...enc, blob, ext, ratio: w >= h ? "16:9" : "9:16" });
      };
      canvas.toBlob((webp) => {
        if (webp && webp.size > 0 && (webp.type === "image/webp" || webp.size < file.size)) {
          finish(webp, "webp");
        } else {
          canvas.toBlob((jpg) => finish(jpg, "jpg"), "image/jpeg", 0.82);
        }
      }, "image/webp", 0.8);
    };
    img.onerror = reject;
    img.src = url;
  });
}
function utf8ToB64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}
async function ghPut(path, contentB64, message) {
  const token = localStorage.getItem("blanc_gh_token") || CONFIG.publishToken || "";
  if (!token) return false;
  const repo = CONFIG.github;
  const url = "https://api.github.com/repos/" + repo + "/contents/" + path;
  const headers = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" };
  let sha;
  const existing = await fetch(url, { headers });
  if (existing.ok) sha = (await existing.json()).sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: contentB64, branch: "main", sha })
  });
  if (!res.ok) throw new Error((await res.text()).slice(0, 180));
  return true;
}
function previewFile(file) {
  pendingFile = file;
  const url = URL.createObjectURL(file);
  const img = document.getElementById("preview");
  img.src = url;
  img.hidden = false;
  document.getElementById("drop-label").hidden = true;
  if (!document.getElementById("title").value) {
    document.getElementById("title").value = prettyName(file.name);
  }
}

document.querySelectorAll(".filters button").forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filters button").forEach((b) => b.classList.toggle("on", b === btn));
    render();
  });
});
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.querySelector("#modal .x").addEventListener("click", (e) => { e.stopPropagation(); closeModal(); });
document.getElementById("copy").addEventListener("click", async () => {
  if (!current) return;
  const btn = document.getElementById("copy");
  try { await navigator.clipboard.writeText(current.prompt || ""); }
  catch {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("m-prompt"));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
  }
  btn.textContent = "복사됨";
  showToast("복사했습니다");
  setTimeout(() => { btn.textContent = "프롬프트 복사"; }, 1400);
});

document.getElementById("add-btn").addEventListener("click", openStudio);
document.getElementById("studio-x").addEventListener("click", closeStudio);
studio.addEventListener("click", (e) => { if (e.target === studio) closeStudio(); });
document.getElementById("unlock").addEventListener("click", () => {
  const pin = document.getElementById("pin").value.trim();
  if (pin === String(CONFIG.adminPin || "")) {
    setAdmin(true);
    showToast("인증되었습니다");
  } else showToast("PIN이 달랍니다");
});
document.getElementById("pin").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("unlock").click();
});
document.getElementById("lock").addEventListener("click", () => { setAdmin(false); closeStudio(); });

const drop = document.getElementById("drop");
drop.addEventListener("click", () => document.getElementById("file").click());
document.getElementById("file").addEventListener("change", (e) => {
  if (e.target.files[0]) previewFile(e.target.files[0]);
});
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("on"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("on"); }));
drop.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) previewFile(file);
});

document.getElementById("studio-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!pendingFile) return showToast("사진을 먼저 넣어주세요");
  const title = document.getElementById("title").value.trim() || prettyName(pendingFile.name);
  const model = document.getElementById("model").value;
  if (!model) return showToast("모델을 선택해주세요");
  const prompt = document.getElementById("prompt").value.trim();
  const saveBtn = document.getElementById("save");
  saveBtn.textContent = "WebP 변환 중...";
  saveBtn.disabled = true;
  try {
    const img = await fileToWebp(pendingFile);
    const id = Date.now().toString().slice(-6) + "-" + slug(title);
    const sidecar = "MODEL: " + model + "\n\n" + (prompt || "");
    const item = { id, title, ratio: img.ratio, model, src: img.dataUrl, prompt };
    await localSave(item);
    const shared = readSharedCatalog().filter((x) => x.id !== id).concat([{ ...item }]);
    writeSharedCatalog(shared);
    let published = false;
    try {
      published = await ghPut(CONFIG.folder + "/" + id + "." + img.ext, img.b64, "Add " + id);
      if (published) {
        await ghPut(CONFIG.folder + "/" + id + ".txt", utf8ToB64(sidecar), "Add prompt " + id);
        item.src = CONFIG.folder + "/" + id + "." + img.ext + "?t=" + Date.now();
      }
    } catch (_) {
      published = false;
    }
    works = mergeLists(WORKS, works, [item]);
    render();
    pendingFile = null;
    document.getElementById("preview").hidden = true;
    document.getElementById("drop-label").hidden = false;
    document.getElementById("title").value = "";
    document.getElementById("prompt").value = "";
    document.getElementById("model").selectedIndex = 0;
    document.getElementById("file").value = "";
    showToast(published ? "올렸습니다." : "저장했습니다. 배포를 기다리면 모두에게 보입니다.");
    closeStudio();
  } catch (err) {
    showToast("저장 실패: " + (err.message || err));
  } finally {
    saveBtn.textContent = "저장";
    saveBtn.disabled = false;
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (modal.classList.contains("open")) closeModal();
  else if (studio.classList.contains("open")) closeStudio();
});

(async function start() {
  let remote = [];
  if (CONFIG.useRemoteFolder) {
    try { remote = (await loadFromGitHub()) || []; } catch (_) { remote = []; }
  }
  const local = await localList();
  works = mergeLists(WORKS, remote, readSharedCatalog(), local);
  await attachPrompts(works.filter((w) => !String(w.src || "").startsWith("data:")));
  render();
})();
