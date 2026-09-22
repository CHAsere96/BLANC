const grid = document.getElementById("grid");
const modal = document.getElementById("modal");
const studio = document.getElementById("studio");
const toast = document.getElementById("toast");
const countEl = document.getElementById("count");
const PIN_KEY = "blanc_unlocked";
const TOKEN_KEY = "admin_token";
const API = () => String(CONFIG.api || "").replace(/\/$/, "");

let filter = "all";
let current = null;
let works = [];
let pendingFile = null;
let admin = sessionStorage.getItem(PIN_KEY) === "1";

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("open");
  setTimeout(() => toast.classList.remove("open"), 1800);
}
function prettyName(file) {
  return String(file || "plate").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
}
function mediaUrl(key) {
  if (!key) return "";
  return API() + "/api/images/url?key=" + encodeURIComponent(key);
}
function bucketRatio(item) {
  if (item.ratio === "16:9" || item.ratio === "9:16") return item.ratio;
  const w = Number(item.width) || 0, h = Number(item.height) || 0;
  if (w && h) return w >= h ? "16:9" : "9:16";
  return "9:16";
}
function apiModel(name) {
  const map = {
    "GPT Image2": "GPT Image 2",
    "Nano Banana2": "Nano Banana 2",
    "Nano Banana Pro": "Nano Banana Pro",
    "Seedream V5 Pro": "Seedream V5 Pro"
  };
  return map[name] || name;
}
function mapApiItem(item) {
  return {
    id: item.id,
    title: item.title || item.model_name || "plate",
    ratio: bucketRatio(item),
    model: item.model_name || "",
    src: mediaUrl(item.thumb_key || item.original_key),
    full: mediaUrl(item.original_key || item.thumb_key),
    prompt: item.prompt || ""
  };
}
async function loadFromApi() {
  const list = [];
  let cursor = "";
  for (let i = 0; i < 20; i++) {
    const q = new URLSearchParams({ limit: "50" });
    if (cursor) q.set("cursor", cursor);
    const res = await fetch(API() + "/api/images?" + q);
    if (!res.ok) throw new Error("api " + res.status);
    const data = await res.json();
    (data.images || []).forEach((item) => {
      if (item.format && item.format !== "image") return;
      list.push(mapApiItem(item));
    });
    cursor = data.next_cursor || "";
    if (!cursor) break;
  }
  return list;
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
      if (!w.model) {
        w.ratio = ratioFromImg(img);
        el.dataset.ratio = w.ratio;
        el.querySelector(".badge").textContent = w.ratio;
      } else {
        w.ratio = ratioFromImg(img);
        el.dataset.ratio = w.ratio;
      }
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
  document.getElementById("m-img").src = current.full || current.src;
  document.getElementById("m-img").alt = current.title;
  document.getElementById("m-title").textContent = current.title;
  document.getElementById("m-meta").textContent = [current.ratio, current.model].filter(Boolean).join("  ·  ");
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
function syncOtpField() {
  const has = !!localStorage.getItem(TOKEN_KEY);
  document.getElementById("otp").hidden = has;
  document.getElementById("otp-hint").hidden = has;
}
function openStudio() {
  document.getElementById("gate").hidden = admin;
  document.getElementById("studio-form").hidden = !admin;
  syncOtpField();
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
  if (on) syncOtpField();
}
function canvasWebp(source, max, quality) {
  return new Promise((resolve, reject) => {
    let w = source.naturalWidth || source.width;
    let h = source.naturalHeight || source.height;
    if (Math.max(w, h) > max) {
      const s = max / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(source, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("webp"));
      resolve({ blob, width: w, height: h, ratio: w >= h ? "16:9" : "9:16" });
    }, "image/webp", quality);
  });
}
function fileToPair(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const original = await canvasWebp(img, 1600, 0.82);
        const thumb = await canvasWebp(img, 900, 0.75);
        URL.revokeObjectURL(url);
        resolve({ original, thumb });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}
async function ensureToken() {
  let token = localStorage.getItem(TOKEN_KEY) || "";
  if (token) return token;
  const code = document.getElementById("otp").value.trim();
  if (!code) throw new Error("관리자 6자리 코드를 입력해주세요");
  const res = await fetch(API() + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  if (!res.ok) throw new Error("관리자 코드가 잘못되었습니다");
  const data = await res.json();
  token = data.token || "";
  if (!token) throw new Error("로그인 실패");
  localStorage.setItem(TOKEN_KEY, token);
  syncOtpField();
  return token;
}
async function uploadKey(key, blob, token) {
  const res = await fetch(API() + "/api/upload?key=" + encodeURIComponent(key), {
    method: "POST",
    headers: { "Content-Type": "image/webp", Authorization: "Bearer " + token },
    body: blob
  });
  if (!res.ok) throw new Error("이미지 업로드 실패");
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
document.getElementById("lock").addEventListener("click", () => {
  setAdmin(false);
  localStorage.removeItem(TOKEN_KEY);
  closeStudio();
});

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
  if (!prompt) return showToast("프롬프트를 넣어주세요");
  const saveBtn = document.getElementById("save");
  saveBtn.textContent = "WebP 변환 중...";
  saveBtn.disabled = true;
  try {
    const token = await ensureToken();
    const pair = await fileToPair(pendingFile);
    const id = crypto.randomUUID();
    const originalKey = "orig/" + id + ".webp";
    const thumbKey = "thumb/" + id + ".webp";
    saveBtn.textContent = "올리는 중...";
    await Promise.all([
      uploadKey(originalKey, pair.original.blob, token),
      uploadKey(thumbKey, pair.thumb.blob, token)
    ]);
    saveBtn.textContent = "저장 중...";
    const res = await fetch(API() + "/api/images", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        original_key: originalKey,
        thumb_key: thumbKey,
        width: pair.original.width,
        height: pair.original.height,
        format: "image",
        model_name: apiModel(model),
        prompt,
        tags: ["Lookbook"],
        ratio: pair.original.ratio,
        title
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const created = await res.json().catch(() => null);
    const item = created && created.id ? mapApiItem(created) : {
      id,
      title,
      ratio: pair.original.ratio,
      model: apiModel(model),
      src: mediaUrl(thumbKey),
      full: mediaUrl(originalKey),
      prompt
    };
    works = [item].concat(works.filter((w) => w.id !== item.id));
    render();
    pendingFile = null;
    document.getElementById("preview").hidden = true;
    document.getElementById("drop-label").hidden = false;
    document.getElementById("title").value = "";
    document.getElementById("prompt").value = "";
    document.getElementById("model").selectedIndex = 0;
    document.getElementById("file").value = "";
    document.getElementById("otp").value = "";
    showToast("올렸습니다. 모든 방문객에게 보입니다.");
    closeStudio();
  } catch (err) {
    showToast(err.message || String(err));
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
  try {
    works = await loadFromApi();
  } catch (_) {
    works = (WORKS || []).slice();
  }
  render();
})();
