const API = () => String((window.CONFIG && CONFIG.api) || "https://prom-gallery-api.cbmen100.workers.dev").replace(/\/$/, "");
function mediaUrl(key) {
  if (!key) return "";
  if (/^https?:/i.test(key)) return key;
  return API() + "/api/images/url?key=" + encodeURIComponent(key);
}
function when(iso) {
  const n = Date.parse(iso || "");
  if (!Number.isFinite(n)) return "";
  return new Date(n).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
function parseDoc(raw) {
  if (!raw) return { type: "doc", content: [] };
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch (_) { return { type: "doc", content: [] }; }
}
function youtubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}
function embed(url) {
  const id = youtubeId(url);
  if (id) return `<iframe src="https://www.youtube.com/embed/${id}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url || "")) return `<video src="${url}" controls playsinline></video>`;
  return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
}
function carousel(media) {
  if (!media.length) return "";
  const slides = media.map((m, i) => `<div class="slide${i === 0 ? " on" : ""}">${m.type === "video" ? embed(m.src) : `<img src="${m.src}" alt="" />`}</div>`).join("");
  const dots = media.map((_, i) => `<button type="button" class="${i === 0 ? "on" : ""}" data-i="${i}"></button>`).join("");
  return `<div class="carousel" data-i="0"><button class="car-btn prev" type="button">‹</button><div class="slides">${slides}</div><button class="car-btn next" type="button">›</button><div class="dots">${dots}</div></div>`;
}
function bindCarousel(root) {
  root.querySelectorAll(".carousel").forEach((box) => {
    const slides = [...box.querySelectorAll(".slide")];
    const dots = [...box.querySelectorAll(".dots button")];
    const go = (n) => {
      const i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("on", k === i));
      dots.forEach((d, k) => d.classList.toggle("on", k === i));
      box.dataset.i = String(i);
    };
    const prev = box.querySelector(".prev");
    const next = box.querySelector(".next");
    if (prev) prev.addEventListener("click", () => go(Number(box.dataset.i) - 1));
    if (next) next.addEventListener("click", () => go(Number(box.dataset.i) + 1));
    dots.forEach((d) => d.addEventListener("click", () => go(Number(d.dataset.i))));
  });
}
function renderBlocks(doc) {
  return (doc.blocks || []).map((b) => {
    const t = String(b.text || "").replace(/</g, "<");
    if (b.type === "h2") return `<h2>${t}</h2>`;
    if (b.type === "h3") return `<h3>${t}</h3>`;
    if (b.type === "quote") return `<blockquote>${t}</blockquote>`;
    if (b.type === "callout") return `<div class="callout">${t}</div>`;
    if (b.type === "code") return `<pre class="code">${t}</pre>`;
    if (b.type === "hr") return "<hr />";
    if (b.type === "bullet") return `<ul><li>${t}</li></ul>`;
    if (b.type === "number") return `<ol><li>${t}</li></ol>`;
    if (b.type === "todo") return `<ul class="todo"><li><input type="checkbox" disabled ${b.checked ? "checked" : ""} /> <span>${t}</span></li></ul>`;
    if (b.type === "toggle") return `<details class="toggle"><summary>${t || "더 보기"}</summary></details>`;
    if (b.type === "image" && b.src) return `<figure><img src="${b.src}" alt="" /></figure>`;
    if (b.type === "gallery") return carousel((b.images || []).map((src) => ({ type: "image", src })));
    if ((b.type === "video" || b.type === "embed") && b.url) return embed(b.url);
    if (b.type === "table") {
      const rows = String(b.text || "").split("\n").filter(Boolean).map((line) => `<tr>${line.split("|").map((c) => `<td>${c.replace(/</g, "<")}</td>`).join("")}</tr>`).join("");
      return `<div class="table-wrap"><table class="nt">${rows}</table></div>`;
    }
    return `<p>${t}</p>`;
  }).join("");
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
  el.innerHTML = blogs.length ? blogs.map((b) => {
    const cover = b.cover_key ? mediaUrl(b.cover_key) : "";
    return `<a class="bcard" href="post.html?slug=${encodeURIComponent(b.slug || b.id)}"><div class="bcover">${cover ? `<img src="${cover}" alt="" loading="lazy" />` : ""}</div><div class="bmeta"><strong>${b.title || "untitled"}</strong><span>BLANC · ${when(b.published_at || b.created_at)}</span></div></a>`;
  }).join("") : '<p class="empty">아직 글이 없습니다. + 글로 직접 쓸 수 있습니다.</p>';
}
async function renderPost() {
  const root = document.getElementById("post");
  const slug = new URLSearchParams(location.search).get("slug");
  if (!slug) { root.innerHTML = '<p class="empty">글을 찾을 수 없습니다.</p>'; return; }
  const res = await fetch(API() + "/api/blogs/" + encodeURIComponent(slug));
  if (!res.ok) { root.innerHTML = '<p class="empty">글을 찾을 수 없습니다.</p>'; return; }
  const post = await res.json();
  const doc = parseDoc(post.content);
  document.title = (post.title || "Blog") + " — BLANC";
  const body = doc.type === "blanc-doc" ? renderBlocks(doc) : "<p></p>";
  const cover = post.cover_key ? `<img src="${mediaUrl(post.cover_key)}" alt="" />` : "";
  root.innerHTML = `<p class="crumb"><a href="blog.html">Blog</a> / ${post.title || ""}</p><h1>${post.title || ""}</h1><p class="by">BLANC · ${when(post.published_at || post.created_at)}</p>${cover}<div class="block-view">${body}</div><p class="back"><a href="blog.html">← 목록</a></p>`;
  bindCarousel(root);
}
if (document.getElementById("list")) {
  loadBlogs().then(renderList).catch(() => { document.getElementById("list").innerHTML = '<p class="empty">목록을 불러오지 못했습니다.</p>'; });
}
if (document.getElementById("post") && !document.getElementById("list")) {
  renderPost().catch(() => { document.getElementById("post").innerHTML = '<p class="empty">글을 불러오지 못했습니다.</p>'; });
}
