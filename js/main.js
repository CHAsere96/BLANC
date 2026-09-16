const grid = document.getElementById("grid");
const modal = document.getElementById("modal");
const toast = document.getElementById("toast");
const countEl = document.getElementById("count");

let filter = "all";
let current = null;

countEl.textContent = WORKS.length;

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
  const list = WORKS.filter((w) => filter === "all" || w.ratio === filter);
  grid.innerHTML = list.map(cardHTML).join("");
  grid.querySelectorAll(".card").forEach((el) => {
    el.addEventListener("click", () => open(el.dataset.id));
  });
}

function open(id) {
  current = WORKS.find((w) => w.id === id);
  if (!current) return;
  document.getElementById("m-img").src = current.src;
  document.getElementById("m-img").alt = current.title;
  document.getElementById("m-title").textContent = current.title;
  document.getElementById("m-meta").textContent = current.ratio + "  ·  " + current.src.replace("images/", "");
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

modal.addEventListener("click", (e) => {
  if (e.target === modal) close();
});
document.querySelector(".x").addEventListener("click", close);
document.getElementById("copy").addEventListener("click", copyPrompt);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) close();
});

render();
