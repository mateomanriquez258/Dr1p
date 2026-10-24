/* =====================================================================
 * THE RACK — Visor de video en bucle (remera Bape)
 * Reproduce assets/videos/video-remera-vape.mp4 en bucle continuo
 * sobre fondo negro puro (#000000).
 * ===================================================================== */

(function () {
  "use strict";

  var VIDEO_URL = "./assets/videos/video-remera-vape.mp4";
  var viewport = document.getElementById("video-viewport");
  var video = document.createElement("video");

  video.src = VIDEO_URL;
  video.loop = true;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.display = "block";
  video.style.background = "#000000";
  video.style.objectFit = "contain";

  viewport.style.display = "flex";
  viewport.style.alignItems = "center";
  viewport.style.justifyContent = "center";
  viewport.appendChild(video);

  video.play().catch(function (e) {
    console.warn("Rack video: no pudo autoplayar", e);
  });

  // Clic en el video → abrir detalle de la remera Bape
  video.addEventListener("click", function () {
    abrirBape();
  });

  // Botón CTA
  var btnCta = document.querySelector(".rack-cta");
  if (btnCta) {
    btnCta.addEventListener("click", function (e) {
      e.preventDefault();
      abrirBape();
    });
  }

  function abrirBape() {
    if (typeof window.PRODUCTOS !== "undefined" && window.PRODUCTOS.length) {
      var p = window.PRODUCTOS.find(function (x) {
        var n = (x.nombre || "").toLowerCase();
        return n.includes("bathing") || n.includes("bape");
      });
      if (p && typeof window.mostrarProducto === "function") {
        window.mostrarProducto(p.id);
        return;
      }
    }
    // Fallback: ir al catálogo de remeras
    if (typeof window.Router !== "undefined" && typeof window.Router.ir === "function") {
      window.Router.ir("remeras");
    }
  }
})();
