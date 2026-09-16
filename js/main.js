const grid = document.getElementById("grid");
const modal = document.getElementById("modal");
const toast = document.getElementById("toast");
const countEl = document.getElementById("count");
const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

let filter = "all";
let current = null;
let works = [];

function prettyName(file) {
  return file.replace(IMG_EXT, "").replace(/[-_]+/g, " ").trim();
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
    let prompt = "";
    if (prompts[stem]) {
      try { prompt = (await fetch(prompts[stem]).then((r) => r.text())).trim(); } catch (_) {}
    }
    list.push({
      id: stem,
      title: prettyName(img.name),
      ratio: "9:16",
      src: CONFIG.folder + "/" + img.name,
      prompt: prompt || "(프롬프트 없음 — 같은 이름의 .txt를 images 폴더에 올리면 여기에 표시됩니다)"
    });
  }
  return list;
}

function ratioFromImg(img) {
  if (!img.naturalWidth || !img.naturalHeight) return "9:16";
  return img.naturalWidth >= img.naturalHeight ? "16:9" : "9:16";
}

function cardHTML(w) {
  return `
    <article class="card" data-id="${w.id}" data-ratio="${w.ratio}">
      <img src="${w.src}" alt="${w.title}" loading="lazy" />
      <div class="shade">
        <span class="badge">${w.ratio}</span>
        <span class="label">${w.title}</span>
      </div>
    </article>`;
}

function render() {
  const list = works.filter((w) => filter === "all" || w.ratio === filter);
  grid.innerHTML = list.map(cardHTML).join("");
  grid.querySelectorAll(".card").forEach((el) => {
    const img = el.querySelector("img");
    const apply = () => {
      const w = works.find((x) => x.id === el.dataset.id);
      if (!w) return;
      w.ratio = ratioFromImg(img);
      el.dataset.ratio = w.ratio;
      el.querySelector(".badge").textContent = w.ratio;
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
  document.getElementById("m-meta").textContent = current.ratio + "  ·  " + current.src.replace(/^images\//, "");
  document.getElementById("m-prompt").textContent = current.prompt;
  document.getElementById("copy").textContent = "프롬프트 복사";
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function close() {
  modal.hidden = true;
  document.body.style.overflow = "";
  current = null;
}

async function copyPrompt() {
  if (!current) return;
  const btn = document.getElementById("copy");
  try {
    await navigator.clipboard.writeText(current.prompt);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("m-prompt"));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand("copy");
    sel.removeAllRanges();
  }
  btn.textContent = "복사됨";
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
    btn.textContent = "프롬프트 복사";
  }, 1400);
}

document.querySelectorAll(".filters button").forEach((btn) => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filters button").forEach((b) => b.classList.toggle("on", b === btn));
    render();
  });
});
modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
document.querySelector(".x").addEventListener("click", close);
document.getElementById("copy").addEventListener("click", copyPrompt);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) close();
});

(async function start() {
  try {
    const remote = await loadFromGitHub();
    works = remote && remote.length ? remote : (WORKS || []);
  } catch (_) {
    works = WORKS || [];
  }
  if (!works.length) {
    grid.innerHTML = '<p class="empty">images 폴더에 jpg/png를 올리면 여기에 나타납니다.</p>';
    countEl.textContent = "0";
    return;
  }
  render();
})();
