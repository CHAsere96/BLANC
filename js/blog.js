const API = () => String((window.CONFIG && CONFIG.api) || "https://prom-gallery-api.cbmen100.workers.dev").replace(/\/$/, "");
const TOKEN_KEY = "admin_token";
const PIN_KEY = "blanc_unlocked";
const toast = document.getElementById("toast");

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("open");
  setTimeout(() => toast.classList.remove("open"), 1800);
}
function mediaUrl(key) {
  if (!key) return "";
  if (/^https?:/i.test(key)) return key;
  return API() + "/api/images/url?key=" + encodeURIComponent(key);
}
function slugify(s) {
  return String(s || "post").toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post";
}
function when(iso) {
  const n = Date.parse(iso || "");
  if (!Number.isFinite(n)) return "";
  return new Date(n).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
function parseDoc(raw) {
  if (!raw) return { type: "doc", content: [] };
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch (_) { return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: String(raw) }] }] }; }
}
function textOf(node) {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.content || []).map(textOf).join("");
}
function youtubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}
function isVideo(url) {
  return /youtu\.?be|vimeo\.com|\.(mp4|webm|mov)(\?|$)/i.test(url);
}
function collect(doc, coverKey) {
  const media = [];
  const paras = [];
  if (coverKey) media.push({ type: "image", src: mediaUrl(coverKey) });
  const walk = (node) => {
    if (!node) return;
    if (node.type === "figureImage") {
      const key = (node.attrs && (node.attrs.r2Key || node.attrs.src)) || "";
      if (key) media.push({ type: "image", src: mediaUrl(key), caption: (node.attrs && node.attrs.caption) || "" });
      return;
    }
    if (node.type === "paragraph") {
      const t = textOf(node).trim();
      if (t && isVideo(t) && t.split(/\s+/).length === 1) media.push({ type: "video", src: t });
      else if (t) paras.push(t);
      return;
    }
    (node.content || []).forEach(walk);
  };
  walk(doc);
  (doc.blanc && doc.blanc.videos || []).forEach((url) => {
    if (url) media.push({ type: "video", src: url });
  });
  const seen = new Set();
  return {
    media: media.filter((m) => (seen.has(m.src) ? false : seen.add(m.src))),
    paras
  };
}
function embed(url) {
  const id = youtubeId(url);
  if (id) return `<iframe src="https://www.youtube.com/embed/${id}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video src="${url}" controls playsinline></video>`;
  return `<a class="video-link" href="${url}" target="_blank" rel="noopener">영상 열기</a>`;
}
function carousel(media) {
  if (!media.length) return "";
  const slides = media.map((m, i) => {
    const inner = m.type === "video" ? embed(m.src) : `<img src="${m.src}" alt="${m.caption || ""}" />`;
    return `<div class="slide${i === 0 ? " on" : ""}">${inner}${m.caption ? `<p>${m.caption}</p>` : ""}</div>`;
  }).join("");
  const dots = media.map((_, i) => `<button type="button" class="${i === 0 ? "on" : ""}" data-i="${i}"></button>`).join("");
  return `<div class="carousel" data-i="0">
    <button class="car-btn prev" type="button" aria-label="이전">‹</button>
    <div class="slides">${slides}</div>
    <button class="car-btn next" type="button" aria-label="다음">›</button>
    <div class="dots">${dots}</div>
  </div>`;
}
function bindCarousel(root) {
  const box = root.querySelector(".carousel");
  if (!box) return;
  const slides = [...box.querySelectorAll(".slide")];
  const dots = [...box.querySelectorAll(".dots button")];
  const go = (n) => {
    const i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    box.dataset.i = String(i);
  };
  box.querySelector(".prev").addEventListener("click", () => go(Number(box.dataset.i) - 1));
  box.querySelector(".next").addEventListener("click", () => go(Number(box.dataset.i) + 1));
  dots.forEach((d) => d.addEventListener("click", () => go(Number(d.dataset.i))));
}
async function loadBlogs() {
  const list = [];
  let cursor = "";
  for (let i = 0; i < 10; i++) {
    const q = new URLSearchParams({ limit: "24" });
    if (cursor) q.set("cursor", cursor);
    const res = await fetch(API() + "/api/blogs?" + q);
    if (!res.ok) throw new Error("blog " + res.status);
    const data = await res.json();
    (data.blogs || []).forEach((b) => list.push(b));
    cursor = data.next_cursor || "";
    if (!cursor) break;
  }
  return list;
}
function renderList(blogs) {
  const el = document.getElementById("list");
  document.getElementById("count").textContent = blogs.length;
  if (!blogs.length) {
    el.innerHTML = '<p class="empty">아직 글이 없습니다.</p>';
    return;
  }
  el.innerHTML = blogs.map((b) => {
    const cover = b.cover_key ? mediaUrl(b.cover_key) : "";
    const href = "post.html?slug=" + encodeURIComponent(b.slug || b.id);
    return `<a class="bcard" href="${href}">
      <div class="bcover">${cover ? `<img src="${cover}" alt="" loading="lazy" />` : ""}</div>
      <div class="bmeta">
        <strong>${b.title || "untitled"}</strong>
        <span>BLANC · ${when(b.published_at || b.created_at)}</span>
      </div>
    </a>`;
  }).join("");
}
async function renderPost() {
  const root = document.getElementById("post");
  if (!root) return;
  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug) { root.innerHTML = '<p class="empty">글을 찾을 수 없습니다.</p>'; return; }
  const res = await fetch(API() + "/api/blogs/" + encodeURIComponent(slug));
  if (!res.ok) { root.innerHTML = '<p class="empty">글을 찾을 수 없습니다.</p>'; return; }
  const post = await res.json();
  const doc = parseDoc(post.content);
  const { media, paras } = collect(doc, post.cover_key);
  document.title = (post.title || "Blog") + " — BLANC";
  root.innerHTML = `
    <p class="crumb"><a href="blog.html">Blog</a> / ${post.title || ""}</p>
    <h1>${post.title || ""}</h1>
    <p class="by">BLANC · ${when(post.published_at || post.created_at)}</p>
    ${carousel(media)}
    <div class="prose">${paras.map((p) => `<p>${p.replace(/</g, "&lt;")}</p>`).join("")}</div>
    <p class="back"><a href="blog.html">← 목록</a></p>`;
  bindCarousel(root);
}
function fileToWebp(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const max = 1600;
      if (Math.max(w, h) > max) {
        const s = max / Math.max(w, h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
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
  token = (await res.json()).token || "";
  if (!token) throw new Error("로그인 실패");
  localStorage.setItem(TOKEN_KEY, token);
  document.getElementById("otp").hidden = true;
  document.getElementById("otp-hint").hidden = true;
  return token;
}
async function uploadImage(blob, token) {
  const key = "blog/" + crypto.randomUUID() + ".webp";
  const res = await fetch(API() + "/api/upload?key=" + encodeURIComponent(key), {
    method: "POST",
    headers: { "Content-Type": "image/webp", Authorization: "Bearer " + token },
    body: blob
  });
  if (!res.ok) throw new Error("이미지 업로드 실패");
  return key;
}
function bindWriter() {
  const writer = document.getElementById("writer");
  if (!writer) return;
  const gate = document.getElementById("gate");
  const form = document.getElementById("write-form");
  let admin = sessionStorage.getItem(PIN_KEY) === "1";
  const sync = () => {
    gate.hidden = admin;
    form.hidden = !admin;
    const has = !!localStorage.getItem(TOKEN_KEY);
    document.getElementById("otp").hidden = has;
    document.getElementById("otp-hint").hidden = has;
  };
  document.getElementById("write-btn").addEventListener("click", () => {
    sync();
    writer.classList.add("open");
  });
  document.getElementById("writer-x").addEventListener("click", () => writer.classList.remove("open"));
  writer.addEventListener("click", (e) => { if (e.target === writer) writer.classList.remove("open"); });
  document.getElementById("unlock").addEventListener("click", () => {
    if (document.getElementById("pin").value.trim() === String(CONFIG.adminPin || "")) {
      admin = true;
      sessionStorage.setItem(PIN_KEY, "1");
      sync();
    } else showToast("PIN이 달랍니다");
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("publish");
    btn.disabled = true;
    try {
      const token = await ensureToken();
      const headers = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
      const title = document.getElementById("title").value.trim();
      const created = await (await fetch(API() + "/api/blogs", { method: "POST", headers, body: "{}" })).json();
      const id = created.id;
      if (!id) throw new Error("글 생성 실패");
      let cover = "";
      const coverFile = document.getElementById("cover").files[0];
      if (coverFile) cover = await uploadImage(await fileToWebp(coverFile), token);
      const images = [];
      for (const file of document.getElementById("slides").files) {
        images.push(await uploadImage(await fileToWebp(file), token));
      }
      const videos = document.getElementById("videos").value.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      const body = document.getElementById("body").value.trim();
      const content = {
        type: "doc",
        content: []
      };
      body.split(/\n\s*\n/).filter(Boolean).forEach((para) => {
        content.content.push({ type: "paragraph", content: [{ type: "text", text: para }] });
      });
      images.forEach((key) => content.content.push({ type: "figureImage", attrs: { r2Key: key } }));
      videos.forEach((url) => content.content.push({ type: "paragraph", content: [{ type: "text", text: url }] }));
      content.blanc = { videos };
      const saved = await fetch(API() + "/api/blogs/" + id, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title, slug: slugify(title), cover_key: cover || null, tags: ["Blog"], content: JSON.stringify(content) })
      });
      if (!saved.ok) throw new Error(await saved.text());
      const pub = await fetch(API() + "/api/blogs/" + id + "/publish", { method: "POST", headers, body: "{}" });
      if (!pub.ok) throw new Error(await pub.text());
      showToast("올렸습니다");
      writer.classList.remove("open");
      renderList(await loadBlogs());
    } catch (err) {
      showToast(err.message || String(err));
    } finally {
      btn.disabled = false;
    }
  });
}

if (document.getElementById("list")) {
  loadBlogs().then(renderList).catch(() => {
    document.getElementById("list").innerHTML = '<p class="empty">목록을 불러오지 못했습니다.</p>';
  });
  bindWriter();
}
if (document.getElementById("post") && !document.getElementById("list")) {
  renderPost().catch(() => {
    document.getElementById("post").innerHTML = '<p class="empty">글을 불러오지 못했습니다.</p>';
  });
}
