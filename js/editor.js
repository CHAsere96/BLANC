const API = () => String((window.CONFIG && CONFIG.api) || "https://prom-gallery-api.cbmen100.workers.dev").replace(/\/$/, "");
const TOKEN_KEY = "admin_token";
const PIN_KEY = "blanc_unlocked";
const toast = document.getElementById("toast");
const TYPES = [
  ["p", "텍스트"], ["h2", "제목 2"], ["h3", "제목 3"],
  ["bullet", "글머리 목록"], ["number", "번호 목록"], ["todo", "할 일"],
  ["toggle", "토글"], ["quote", "인용"], ["callout", "콜아웃"],
  ["code", "코드"], ["hr", "구분선"], ["image", "이미지"],
  ["gallery", "갤러리"], ["video", "영상"], ["embed", "임베드"], ["table", "표"]
];
let blocks = [{ id: uid(), type: "p", text: "" }];
let coverKey = "";
function uid() { return Math.random().toString(36).slice(2, 9); }
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("open");
  setTimeout(() => toast.classList.remove("open"), 1800);
}
function esc(s) { return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&", "<": "<", ">": ">" }[c])); }
function render() {
  const root = document.getElementById("blocks");
  root.innerHTML = blocks.map((b, i) => `<div class="block" data-i="${i}"><button class="handle" type="button" title="위로">↑</button>${blockBody(b)}</div>`).join("");
  root.querySelectorAll(".block").forEach((el) => {
    const i = Number(el.dataset.i);
    el.querySelector(".handle").addEventListener("click", () => move(i, -1));
    el.querySelectorAll("[data-text]").forEach((node) => {
      node.addEventListener("input", () => { blocks[i].text = node.tagName === "TEXTAREA" ? node.value : node.innerText; });
      node.addEventListener("keydown", (e) => onKey(e, i, node));
    });
    const del = el.querySelector("[data-del]");
    if (del) del.addEventListener("click", () => { blocks.splice(i, 1); if (!blocks.length) blocks.push({ id: uid(), type: "p", text: "" }); render(); });
    const file = el.querySelector("input[type=file]");
    if (file) file.addEventListener("change", () => onFile(i, file));
    const url = el.querySelector("[data-url]");
    if (url) url.addEventListener("input", () => { blocks[i].url = url.value.trim(); });
    const check = el.querySelector("[data-check]");
    if (check) check.addEventListener("change", () => { blocks[i].checked = check.checked; });
  });
}
function blockBody(b) {
  const text = `<div contenteditable="true" data-text data-ph="입력하거나 / 로 블록">${esc(b.text)}</div>`;
  const del = `<button class="mini" data-del type="button">삭제</button>`;
  if (b.type === "hr") return `<div class="bbody"><hr />${del}</div>`;
  if (b.type === "image") return `<div class="bbody">${b.src ? `<img src="${b.src}" alt="" />` : ""}<input type="file" accept="image/*" />${del}</div>`;
  if (b.type === "gallery") return `<div class="bbody"><div class="media-row">${(b.images || []).map((s) => `<img src="${s}" alt="" />`).join("")}</div><input type="file" accept="image/*" multiple />${del}</div>`;
  if (b.type === "video" || b.type === "embed") return `<div class="bbody"><input data-url placeholder="URL" value="${esc(b.url)}" />${del}</div>`;
  if (b.type === "todo") return `<div class="bbody"><label><input data-check type="checkbox" ${b.checked ? "checked" : ""} /> ${text}</label>${del}</div>`;
  if (b.type === "table") return `<div class="bbody"><textarea data-text rows="4" placeholder="칸은 | 로, 줄은 엔터">${esc(b.text)}</textarea>${del}</div>`;
  return `<div class="bbody">${text}${del}</div>`;
}
function onKey(e, i, node) {
  if (e.key === "/" && !(node.innerText || "").trim()) {
    e.preventDefault();
    openSlash(node, i);
  } else if (e.key === "Enter" && !e.shiftKey && blocks[i].type === "p") {
    e.preventDefault();
    blocks.splice(i + 1, 0, { id: uid(), type: "p", text: "" });
    render();
    const next = document.querySelectorAll("[data-text]")[i + 1];
    if (next) next.focus();
  } else if (e.key === "Backspace" && !(node.innerText || "").trim() && blocks.length > 1) {
    e.preventDefault();
    blocks.splice(i, 1);
    render();
  }
}
function openSlash(anchor, i) {
  document.querySelectorAll(".slash").forEach((n) => n.remove());
  const menu = document.createElement("div");
  menu.className = "slash";
  menu.innerHTML = TYPES.map(([type, label]) => `<button type="button" data-type="${type}">${label}</button>`).join("");
  anchor.parentElement.appendChild(menu);
  menu.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
    blocks[i] = { id: blocks[i].id, type: btn.dataset.type, text: "", images: [], url: "" };
    menu.remove();
    render();
  }));
}
function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= blocks.length) return;
  const [item] = blocks.splice(i, 1);
  blocks.splice(j, 0, item);
  render();
}
async function ensureToken() {
  let token = localStorage.getItem(TOKEN_KEY) || "";
  if (token) return token;
  const code = document.getElementById("otp").value.trim();
  if (!code) throw new Error("관리자 6자리 코드를 입력해주세요");
  const res = await fetch(API() + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
  if (!res.ok) throw new Error("관리자 코드가 잘못되었습니다");
  token = (await res.json()).token || "";
  if (!token) throw new Error("로그인 실패");
  localStorage.setItem(TOKEN_KEY, token);
  return token;
}
function fileToWebp(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, max = 1600;
      if (Math.max(w, h) > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("webp")), "image/webp", 0.82);
    };
    img.onerror = reject;
    img.src = url;
  });
}
async function upload(file, token) {
  const key = "blog/" + crypto.randomUUID() + ".webp";
  const res = await fetch(API() + "/api/upload?key=" + encodeURIComponent(key), {
    method: "POST", headers: { "Content-Type": "image/webp", Authorization: "Bearer " + token }, body: await fileToWebp(file)
  });
  if (!res.ok) throw new Error("이미지 업로드 실패");
  return key;
}
async function onFile(i, input) {
  try {
    const token = await ensureToken();
    const keys = [];
    for (const file of input.files) keys.push(await upload(file, token));
    const urls = keys.map((k) => API() + "/api/images/url?key=" + encodeURIComponent(k));
    if (blocks[i].type === "gallery") blocks[i].images = (blocks[i].images || []).concat(urls);
    else blocks[i].src = urls[0];
    render();
  } catch (err) { showToast(err.message || String(err)); }
}
function slugify(s) {
  return String(s || "post").toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post";
}
document.getElementById("tools").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.link) { const href = prompt("링크 주소"); if (href) document.execCommand("createLink", false, href); }
  else document.execCommand(btn.dataset.cmd, false, null);
});
document.getElementById("cover").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const token = await ensureToken();
    coverKey = await upload(file, token);
    const img = document.createElement("img");
    img.src = API() + "/api/images/url?key=" + encodeURIComponent(coverKey);
    document.getElementById("cover-pick").textContent = "";
    document.getElementById("cover-pick").appendChild(img);
  } catch (err) { showToast(err.message || String(err)); }
});
document.getElementById("unlock").addEventListener("click", async () => {
  if (document.getElementById("pin").value.trim() !== String(CONFIG.adminPin || "")) return showToast("PIN이 달랍니다");
  try {
    await ensureToken();
    sessionStorage.setItem(PIN_KEY, "1");
    document.getElementById("gate").hidden = true;
    document.getElementById("desk").hidden = false;
    render();
  } catch (err) { showToast(err.message || String(err)); }
});
document.getElementById("publish").addEventListener("click", async () => {
  if (document.getElementById("desk").hidden) return showToast("먼저 인증해주세요");
  try {
    const token = await ensureToken();
    const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    const title = document.getElementById("title").value.trim() || "untitled";
    const created = await (await fetch(API() + "/api/blogs", { method: "POST", headers, body: "{}" })).json();
    if (!created.id) throw new Error("글 생성 실패");
    const saved = await fetch(API() + "/api/blogs/" + created.id, {
      method: "PATCH", headers,
      body: JSON.stringify({ title, slug: slugify(title), cover_key: coverKey || null, tags: ["Blog"], content: JSON.stringify({ type: "blanc-doc", blocks }) })
    });
    if (!saved.ok) throw new Error(await saved.text());
    const pub = await fetch(API() + "/api/blogs/" + created.id + "/publish", { method: "POST", headers, body: "{}" });
    if (!pub.ok) throw new Error(await pub.text());
    location.href = "blog.html";
  } catch (err) { showToast(err.message || String(err)); }
});
if (sessionStorage.getItem(PIN_KEY) === "1" && localStorage.getItem(TOKEN_KEY)) {
  document.getElementById("gate").hidden = true;
  document.getElementById("desk").hidden = false;
  render();
}
