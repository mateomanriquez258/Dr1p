/* =====================================================================
 * DR1P — Animaciones GSAP (complementan a y2k.js / Motion)
 * Solo anima lo que Motion NO toca. Respeta prefers-reduced-motion.
 * ===================================================================== */

(function () {
  "use strict";

  if (typeof gsap === "undefined") return; // GSAP no cargó: no hacer nada
  if (typeof ScrollTrigger !== "undefined") gsap.registerPlugin(ScrollTrigger);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- 1. Feedback al agregar al carrito ----
  // Pulso del contador #count + destello cromado en el botón del carrito.
  function cartPulse() {
    const countEl = document.getElementById("count");
    const cartBtn = document.querySelector(".cart-btn");
    if (!countEl || !cartBtn) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.to(countEl, { scale: 1.6, duration: 0.18 }, 0)
      .to(countEl, { scale: 1, duration: 0.25 }, 0.18)
      .to(cartBtn, { boxShadow: "0 0 0 0 rgba(255,255,255,0)", duration: 0 }, 0)
      .to(cartBtn, { boxShadow: "0 0 18px 4px rgba(255,255,255,0.6)", duration: 0.25 }, 0)
      .to(cartBtn, { boxShadow: "0 0 0 0 rgba(255,255,255,0)", duration: 0.35 }, 0.25);
  }

  // ---- 2. Entrada de la ficha de producto (PDP) ----
  // Imagen y bloque de info con stagger suave, sin retrasar botones.
  function pdpReveal() {
    const pd = document.getElementById("producto");
    if (!pd) return;
    const img = pd.querySelector("#pd-img");
    const info = pd.querySelector(".pd-info");
    if (!img || !info) return;
    gsap.fromTo(img, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" });
    gsap.fromTo(info.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power3.out", delay: 0.1 });
  }

  // ---- 3. Marquesina: acelera con el scroll, vuelve al ritmo ----
  // Usa ScrollTrigger velocity para modular la duración de la animación CSS.
  function marqueeScrollSpeed() {
    if (typeof ScrollTrigger === "undefined") return;
    const marquee = document.getElementById("marquee");
    if (!marquee) return;
    const track = marquee.querySelector(".marquee-track");
    if (!track) return;
    let baseDuration = 22; // segundos (coincide con CSS)
    ScrollTrigger.create({
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        const vel = Math.abs(self.getVelocity()) / 1000; // normalizado
        const factor = gsap.utils.clamp(0.3, 1, 1 - vel * 0.5);
        const newDuration = baseDuration * factor;
        track.style.animationDuration = newDuration + "s";
      }
    });
  }

  // ---- 4. Parallax suave del logo gótico del hero ----
  // ScrollTrigger scrub, liviano en celular (solo transform).
  function markParallax() {
    if (typeof ScrollTrigger === "undefined") return;
    const mark = document.querySelector(".y2k-mark");
    if (!mark) return;
    const hero = document.querySelector(".y2k-hero");
    if (!hero) return;
    gsap.to(mark, {
      y: -80,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: true,
        invalidateOnRefresh: true
      }
    });
  }

  // ---- 5. Entrada sutil al actualizar el catálogo ----
  function filterGridFeedback() {
    const grid = document.getElementById("productos");
    if (!grid) return;
    const obs = new MutationObserver(() => {
      if (!grid.querySelector(".card")) return;
      gsap.fromTo(grid,
        { autoAlpha: 0.88, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.32, ease: "power3.out", overwrite: "auto" }
      );
    });
    obs.observe(grid, { childList: true });
  }

  // ---- Inicialización ----
  // Solo animar si no hay prefers-reduced-motion
  if (!reduced) {
    // Scroll-linked animations only run when ScrollTrigger loaded correctly.
    if (typeof ScrollTrigger !== "undefined") {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", markParallax);
      marqueeScrollSpeed();
    }

    filterGridFeedback();

    // Escuchar eventos personalizados de app.js
    document.addEventListener("dr1p:cart-add", cartPulse);
    document.addEventListener("dr1p:pdp-open", pdpReveal);
  }

  // Exponer funciones globales para que app.js las pueda llamar
  window.GSAPAnim = {
    cartPulse: cartPulse,
    pdpReveal: pdpReveal
  };
})();
