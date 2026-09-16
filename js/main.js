const items = [...document.querySelectorAll("[data-full]")];
const lb = document.querySelector(".lb");
const lbImg = lb.querySelector("img");
const lbCap = lb.querySelector(".lb-cap");
let i = 0;

function open(n) {
  i = n;
  const el = items[i];
  lbImg.src = el.dataset.full;
  lbImg.alt = el.querySelector("img")?.alt || "";
  lbCap.textContent = el.querySelector("figcaption")?.textContent.trim() || "";
  lb.hidden = false;
  document.body.style.overflow = "hidden";
}

function close() {
  lb.hidden = true;
  document.body.style.overflow = "";
}

items.forEach((el, n) => el.addEventListener("click", () => open(n)));
lb.querySelector(".lb-close").addEventListener("click", close);
lb.querySelector(".lb-prev").addEventListener("click", () => open((i - 1 + items.length) % items.length));
lb.querySelector(".lb-next").addEventListener("click", () => open((i + 1) % items.length));
lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
window.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") close();
  if (e.key === "ArrowLeft") open((i - 1 + items.length) % items.length);
  if (e.key === "ArrowRight") open((i + 1) % items.length);
});
