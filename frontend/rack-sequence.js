/* =====================================================================
 * THE RACK — Visor de secuencia de fotogramas (imágenes sueltas)
 * Carga assets/frames_corteiz/ezgif-frame-001.png … ezgif-frame-270.png
 * Arrastre horizontal (mouse o touch) para rotar 360° fluido.
 * Fondo negro puro #000000 y mix-blend-mode: screen para fusionarse
 * con el diseño oscuro de DR1P sin desbordar el layout.
 * ===================================================================== */

(function () {
  "use strict";

  // ---- Configuración ----
  var TOTAL_FRAMES = 270;
  var FRAMES_DIR = "assets/frames_corteiz/";
  var FRAME_PREFIX = "ezgif-frame-";
  var FRAME_EXT = ".png";
  var VIEWPORT_MAX_W = 520;
  var VIEWPORT_MAX_H = 520;
  var DRAG_SPEED = 0.06;   // frames por píxel de arrastre
  var SMOOTH = 0.16;       // suavizado de interpolación (0-1)

  var canvas = document.getElementById("sequence-canvas");
  var ctx = canvas.getContext("2d");

  var images = [];           // imágenes precargadas
  var loadedCount = 0;
  var currentFrame = 0;
  var targetFrame = 0;
  var isDown = false;
  var pointerX = 0;
  var pointerXOnDown = 0;
  var frameOnDown = 0;
  var productoActual = null;

  // ---- Precargar imágenes ----
  function cargarImagenes() {
    var promesas = [];
    for (var i = 1; i <= TOTAL_FRAMES; i++) {
      var nombre = FRAME_PREFIX + String(i).padStart(3, "0") + FRAME_EXT;
      var url = FRAMES_DIR + nombre;
      var img = new Image();
      var p = new Promise(function (resolve, reject) {
        img.onload = resolve;
        img.onerror = reject;
      });
      img.src = url;
      images.push(img);
      promesas.push(p);
    }
    Promise.all(promesas).then(iniciar).catch(function (e) {
      console.error("Rack: error cargando frames", e);
      // fallback: dibujar placeholder
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "14px 'Space Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("Frames no cargados", canvas.width / 2, canvas.height / 2);
      ctx.fillText("assets/frames_corteiz/", canvas.width / 2, canvas.height / 2 + 20);
    });
  }

  // ---- Iniciar visor ----
  function iniciar() {
    var lado = Math.min(
      document.getElementById("sprite-viewport").clientWidth,
      VIEWPORT_MAX_W
    );
    canvas.width = lado;
    canvas.height = lado;
    document.getElementById("sprite-viewport").style.width = lado + "px";
    document.getElementById("sprite-viewport").style.height = lado + "px";

    dibujarFrame(Math.round(currentFrame));
    loop();
  }

  // ---- Dibujar frame ----
  function dibujarFrame(frameIndex) {
    if (!images.length) return;

    var idx = ((Math.round(frameIndex) % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
    var img = images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var escala = Math.min(canvas.width / img.width, canvas.height / img.height);
    var dw = img.width * escala;
    var dh = img.height * escala;
    var dx = (canvas.width - dw) / 2;
    var dy = (canvas.height - dh) / 2;

    // Fusión con fondo negro (sin halo blanco alrededor)
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalCompositeOperation = "source-over";
  }

  // ---- Bucle de animación (suavizado) ----
  function loop() {
    currentFrame += (targetFrame - currentFrame) * SMOOTH;
    dibujarFrame(currentFrame);
    requestAnimationFrame(loop);
  }

  // ---- Eventos de arrastre ----
  function empezar(e) {
    isDown = true;
    pointerX = obtenerX(e);
    pointerXOnDown = pointerX;
    frameOnDown = currentFrame;
    canvas.style.cursor = "grabbing";
  }

  function mover(e) {
    if (!isDown) return;
    pointerX = obtenerX(e);
    var delta = pointerX - pointerXOnDown;
    var framesDelta = Math.round(delta * DRAG_SPEED);
    targetFrame = frameOnDown + framesDelta;
  }

  function terminar() {
    isDown = false;
    canvas.style.cursor = "grab";
  }

  function obtenerX(e) {
    return (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
  }

  canvas.addEventListener("mousedown", empezar, false);
  window.addEventListener("mousemove", mover, false);
  window.addEventListener("mouseup", terminar, false);

  canvas.addEventListener("touchstart", function (e) {
    empezar(e);
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", function (e) {
    mover(e);
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchend", terminar, false);

  window.addEventListener("resize", function () {
    var lado = Math.min(
      document.getElementById("sprite-viewport").clientWidth,
      VIEWPORT_MAX_W
    );
    canvas.width = lado;
    canvas.height = lado;
    dibujarFrame(Math.round(currentFrame));
  }, false);

  // ---- Clic en prenda -> abrir modal de producto ----
  canvas.addEventListener("click", function (e) {
    if (isDown) return;
    if (!productoActual) return;
    if (typeof window.mostrarProducto === "function") {
      window.mostrarProducto(productoActual.id);
    }
  }, false);

  // ---- API pública ----
  window.abrirProductoRackSequence = function (producto) {
    productoActual = producto;
    if (typeof window.mostrarProducto === "function") {
      window.mostrarProducto(producto.id);
    }
  };

  if (typeof window.mostrarProducto !== "function") {
    window.mostrarProducto = function (id) {
      console.log("Producto id:", id);
    };
  }

  // Asociación automática: si hay productos cargados, vincular el primero de remeras
  if (typeof window.PRODUCTOS !== "undefined" && window.PRODUCTOS.length) {
    var p = window.PRODUCTOS.find(function (x) {
      return (x.categoria || "").toLowerCase() === "remeras";
    }) || window.PRODUCTOS[0];
    productoActual = p;
  }

  cargarImagenes();
})();
