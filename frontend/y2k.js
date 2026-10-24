/* =====================================================================
 * DR1P — Animaciones Y2K con Motion (la librería de Framer Motion
 * para JS vanilla: mismo motor de springs/easings, sin React).
 * ===================================================================== */
import { animate, inView, stagger } from "https://cdn.jsdelivr.net/npm/motion@11.18.2/+esm";

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = [0.16, 1, 0.3, 1];

/* Devuelve el control del transform al CSS para que funcionen los :hover. */
function releaseTransform(els) {
  els.forEach((el) => { el.style.transform = ""; });
}

function splitTitle() {
  document.querySelectorAll(".y2k-title .line").forEach((line) => {
    const text = line.textContent;
    line.textContent = "";
    line.setAttribute("aria-hidden", "true");
    for (const char of text) {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = char === " " ? "\u00A0" : char;
      line.appendChild(span);
    }
  });
}

function whenPreloaderDone(cb) {
  const pre = document.getElementById("preloader");
  if (!pre || pre.classList.contains("done") || getComputedStyle(pre).display === "none") return cb();
  const obs = new MutationObserver(() => {
    if (!document.body.contains(pre) || pre.classList.contains("done")) {
      obs.disconnect();
      cb();
    }
  });
  obs.observe(pre, { attributes: true, attributeFilter: ["class"] });
  obs.observe(document.body, { childList: true });
}

function heroIntro() {
  animate(
    ".thorn",
    { opacity: [0, 1], filter: ["blur(14px) brightness(2)", "blur(0px) brightness(1)"] },
    { duration: 1.4, delay: stagger(0.08), ease: EASE }
  );
  animate(
    ".y2k-title .ch",
    {
      opacity: [0, 1],
      y: ["0.6em", "0em"],
      rotateX: [-80, 0],
      filter: ["blur(10px)", "blur(0px)"],
    },
    { duration: 0.9, delay: stagger(0.035, { startDelay: 0.25 }), ease: EASE }
  ).then(() => releaseTransform(document.querySelectorAll(".y2k-title .ch")));
  animate(
    ".y2k-hero [data-reveal]",
    { opacity: [0, 1], y: [18, 0] },
    { duration: 0.8, delay: stagger(0.12, { startDelay: 0.55 }), ease: EASE }
  );
}

function scrollReveals() {
  const targets = document.querySelectorAll(
    ".ruleta-banner .rb-grid > *, #categorias .idx, .cat-card, .section-head, .show-card, .contacto-grid > *"
  );
  targets.forEach((el) => { el.style.opacity = "0"; });
  inView(
    targets,
    (el) => {
      animate(el, { opacity: [0, 1], y: [40, 0] }, { duration: 0.9, ease: EASE })
        .then(() => releaseTransform([el]));
    },
    { amount: 0.2 }
  );
}

/* Las tarjetas las genera app.js; se animan cada vez que se re-renderiza la grilla. */
function revealProductCards() {
  const grids = document.querySelectorAll("#productos, #pd-similares");
  const run = (grid) => {
    const cards = grid.querySelectorAll(".card:not([data-in])");
    if (!cards.length) return;
    cards.forEach((c) => { c.dataset.in = "1"; c.style.opacity = "0"; });
    inView(
      grid,
      () => {
        animate(
          cards,
          { opacity: [0, 1], y: [50, 0], scale: [0.96, 1] },
          { duration: 0.8, delay: stagger(0.06), ease: EASE }
        ).then(() => releaseTransform(cards));
      },
      { amount: 0.05 }
    );
  };
  grids.forEach((grid) => {
    run(grid);
    new MutationObserver(() => run(grid)).observe(grid, { childList: true });
  });
}

/* Parallax suave de las espinas siguiendo el puntero (solo desktop). */
function thornParallax() {
  if (!matchMedia("(pointer: fine)").matches) return;
  const hero = document.querySelector(".y2k-hero");
  const thorns = [...hero.querySelectorAll(".thorn")];
  let frame = 0;
  hero.addEventListener("pointermove", (e) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      thorns.forEach((t) => {
        const d = Number(t.dataset.depth || 10);
        t.style.setProperty("--px", `${(-nx * d).toFixed(1)}px`);
        t.style.setProperty("--py", `${(-ny * d).toFixed(1)}px`);
      });
    });
  });
  hero.addEventListener("pointerleave", () => {
    thorns.forEach((t) => { t.style.setProperty("--px", "0px"); t.style.setProperty("--py", "0px"); });
  });
}

/* Botones magnéticos del hero. */
function magnetic() {
  if (!matchMedia("(pointer: fine)").matches) return;
  document.querySelectorAll(".btn-chrome, .btn-ghost, .rb-btn").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.18;
      const y = (e.clientY - r.top - r.height / 2) * 0.3;
      animate(btn, { x, y }, { type: "spring", stiffness: 300, damping: 20 });
    });
    btn.addEventListener("pointerleave", () => {
      animate(btn, { x: 0, y: 0 }, { type: "spring", stiffness: 260, damping: 16 });
    });
  });
}

splitTitle();
root.classList.add("motion-ready");

if (!reduced) {
  whenPreloaderDone(heroIntro);
  scrollReveals();
  revealProductCards();
  thornParallax();
  magnetic();
}
