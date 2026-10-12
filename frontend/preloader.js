/* =====================================================================
 * PRELOADER DR1P — efecto decodificador (cifras aleatorias → marca)
 * - 4 slots (D/R/1/P) ciclando caracteres a ~50ms (alta velocidad).
 * - Congelado progresivo de izquierda a derecha en ~2.5s totales.
 * - Fade-out + slide-up, libera el scroll.
 * - sessionStorage "dr1p_preloader_seen": solo 1 vez por sesión.
 * ===================================================================== */
(function () {
  "use strict";

  var MARCA = "DR1P";
  var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&";
  var LS_KEY = "dr1p_preloader_seen";
  var TICK_MS = 50;
  var BASE_MS = 500;      // la 1ª letra fija a los 0.5s
  var STEP_MS = 550;      // cada siguiente tarda +0.55s → total ≈ 2.2s
  var OUT_MS = 450;       // pausa con marca completa antes del fade

  function cerrar(box) {
    if (!box || box.classList.contains("done")) return;
    box.classList.add("done");
    document.body.classList.remove("locked");
    setTimeout(function () { box.remove(); }, 700);
  }

  function animar(box) {
    document.body.classList.add("locked");
    var slot = document.getElementById("pre-slot");
    var bar = document.getElementById("pre-fill");
    var spans = [];
    for (var i = 0; i < MARCA.length; i++) {
      var s = document.createElement("span");
      s.textContent = "?";
      slot.appendChild(s);
      spans.push(s);
    }
    var fijas = 0;
    // barra de progreso estimada
    var total = BASE_MS + STEP_MS * (MARCA.length - 1) + OUT_MS;
    var t0 = Date.now();
    var barIv = setInterval(function () {
      var p = Math.min(100, Math.round((Date.now() - t0) / total * 100));
      if (bar) bar.style.width = p + "%";
      if (p >= 100) clearInterval(barIv);
    }, 100);

    spans.forEach(function (s, i) {
      var ticks = 0;
      var meta = Math.round((BASE_MS + STEP_MS * i) / TICK_MS);
      var iv = setInterval(function () {
        s.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
        if (++ticks >= meta) {
          clearInterval(iv);
          s.textContent = MARCA[i]; // congela la letra exacta
          s.classList.add("lock");
          if (++fijas === spans.length) setTimeout(function () { cerrar(box); }, OUT_MS);
        }
      }, TICK_MS);
    });
  }

  function init() {
    var box = document.getElementById("preloader");
    if (!box) return;
    try {
      if (sessionStorage.getItem(LS_KEY)) { box.remove(); return; } // ya visto: sin molestia
      sessionStorage.setItem(LS_KEY, "1");
    } catch (e) { /* storage bloqueado → animar igual */ }
    // click = saltar (no bloquea al usuario)
    box.addEventListener("click", function () { cerrar(box); });
    animar(box);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
