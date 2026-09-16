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

function open(id) {
  current = works.find((w) => w.id === id);
  if (!current) return;
  document.getElementById("m-img").src = current.src;
  document.getElementById("m-img").alt = current.title;
  document.getElementById("m-title").textContent = current.title;
  document.getElementById("m-meta").textContent = current.ratio + "  ·  " + current.id;
  document.getElementById("m-prompt").textContent = current.prompt;
  document.getElementById("copy").textContent = "프롬프트 복사";
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function close(e) {
  if (e) e.preventDefault();
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  current = null;
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
    };
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
    el.addEventListener("click", () => open(el.dataset.id));
  });
  countEl.textContent = works.length;
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
  toast.classList.add("open");
  setTimeout(() => {
    toast.classList.remove("open");
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
modal.addEventListener("click", (e) => { if (e.target === modal) close(e); });
document.querySelector(".x").addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  close(e);
});
document.getElementById("copy").addEventListener("click", copyPrompt);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("open")) close();
});

close();
works = (typeof WORKS !== "undefined" && WORKS.length) ? WORKS : [];
if (!works.length) {
  grid.innerHTML = '<p class="empty"></p>';
  countEl.textContent = "0";
} else {
  render();
}
