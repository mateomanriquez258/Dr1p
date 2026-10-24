/* =====================================================================
 * THE RACK — Visor de secuencia de fotogramas (sprite sheet)
 * Liviano, sin WebGL. Carga una tira de 72 frames de una prenda girando
 * y permite arrastrar/deslizar para rotar suavemente.
 * ===================================================================== */

(function () {
  "use strict";

  // ---- Configuración ----
  var TOTAL_FRAMES = 72;          // cantidad de frames del sprite
  var FRAME_WIDTH  = 400;         // ancho de cada frame (ajustá según tu sprite)
  var FRAME_HEIGHT = 400;         // alto de cada frame
  var SPRITE_URL   = "assets/rack-sprite.png"; // ruta a tu tira de frames
  var VIEWPORT_MAX_W = 520;       // ancho máximo del visor
  var VIEWPORT_MAX_H = 520;       // alto máximo del visor

  var viewport = document.getElementById("sprite-viewport");
  var canvas   = document.getElementById("sprite-canvas");
  var ctx      = canvas.getContext("2d");

  var img = new Image();
  var currentFrame = 0;
  var targetFrame  = 0;
  var isDown       = false;
  var pointerX     = 0;
  var pointerXOnDown = 0;
  var frameOnDown  = 0;
  var DRAG_SPEED   = 0.05;   // cuántos frames por píxel de arrastre
  var SMOOTH       = 0.15;   // suavizado de interpolación (0-1)

  // Estado del producto mostrado (para abrir modal)
  var productoActual = null;

  // ---- Carga del sprite ----
  img.onload = function () {
    ajustarTamanio();
    dibujarFrame(Math.round(currentFrame));
  };
  img.onerror = function () {
    // Si no hay sprite, dibujamos un placeholder oscuro
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "14px 'Space Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Sprite no cargado", canvas.width/2, canvas.height/2);
    ctx.fillText("assets/rack-sprite.png", canvas.width/2, canvas.height/2 + 20);
  };
  img.src = SPRITE_URL;

  // ---- Ajuste de tamaño del canvas al viewport ----
  function ajustarTamanio() {
    var w = Math.min(viewport.clientWidth, VIEWPORT_MAX_W);
    var h = Math.min(viewport.clientHeight, VIEWPORT_MAX_H);
    // Mantener proporción 1:1 del sprite
    var lado = Math.min(w, h, VIEWPORT_MAX_W);
    canvas.width = lado;
    canvas.height = lado;
    viewport.style.width = lado + "px";
    viewport.style.height = lado + "px";
    dibujarFrame(Math.round(currentFrame));
  }

  // ---- Dibujo de frame ----
  function dibujarFrame(frameIndex) {
    if (!img.complete || !img.naturalWidth) return;

    var frameIdx = ((frameIndex % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
    var sx = frameIdx * FRAME_WIDTH;
    var sy = 0;
    var sW = FRAME_WIDTH;
    var sH = FRAME_HEIGHT;

    var dW = canvas.width;
    var dH = canvas.height;

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, dW, dH);
    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, dW, dH);
  }

  // ---- Actualización de frame según rotación ----
  function actualizarFrameDesdeRotacion() {
    // targetRotation es un ángulo 0..2π; lo mapeamos a 0..71 frames
    var giro = (targetRotation % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    var fraccion = giro / (Math.PI * 2);
    var frame = fraccion * TOTAL_FRAMES;
    targetFrame = frame;
  }

  // ---- Loop de animación ----
  function loop() {
    // Interpolación suave hacia el frame objetivo
    currentFrame += (targetFrame - currentFrame) * SMOOTH;
    dibujarFrame(Math.round(currentFrame));
    requestAnimationFrame(loop);
  }

  if (img.complete && img.naturalWidth) {
    ajustarTamanio();
  }
  loop();

  // ---- Eventos de arrastre (mouse y touch) ----
  function empezarArrastre(e) {
    isDown = true;
    pointerX = obtenerX(e);
    pointerXOnDown = pointerX;
    frameOnDown = currentFrame;
    viewport.style.cursor = "grabbing";
  }

  function moverArrastre(e) {
    if (!isDown) return;
    pointerX = obtenerX(e);
    var delta = pointerX - pointerXOnDown;
    var framesDelta = delta * DRAG_SPEED;
    targetFrame = frameOnDown + framesDelta;
    // Actualizamos la rotación subyacente para mantener consistencia
    targetRotation = (targetFrame / TOTAL_FRAMES) * Math.PI * 2;
  }

  function terminarArrastre() {
    isDown = false;
    viewport.style.cursor = "grab";
  }

  function obtenerX(e) {
    return (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
  }

  var canvasEl = document.getElementById("sprite-canvas");

  // Mouse
  canvasEl.addEventListener("mousedown", empezarArrastre, false);
  window.addEventListener("mousemove", moverArrastre, false);
  window.addEventListener("mouseup", terminarArrastre, false);

  // Touch (móvil)
  canvasEl.addEventListener("touchstart", function (e) {
    empezarArrastre(e);
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", function (e) {
    moverArrastre(e);
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchend", terminarArrastre, false);

  // Redimensionar ventana
  window.addEventListener("resize", ajustarTamanio, false);

  // ---- Clic / tap en prenda -> abrir modal de producto ----
  canvasEl.addEventListener("click", function (e) {
    if (isDown) return; // no abrir si acabamos de soltar tras arrastrar
    if (!productoActual) return;
    abrirProducto(productoActual);
  }, false);

  // ---- Integración con productos del catálogo ----
  // Se llama desde router.js / app.js cuando se selecciona una prenda
  // Asigna el producto y muestra su frame correspondiente si corresponde
  window.abrirProductoRackSprite = function (producto) {
    productoActual = producto;
    // Si el producto tiene un frame asociado, lo mostramos
    if (producto.frame != null) {
      currentFrame = producto.frame;
      targetFrame = producto.frame;
    }
    // Abrir modal de producto (función global definida en app.js)
    if (typeof window.mostrarProducto === "function") {
      window.mostrarProducto(producto.id);
    }
  };

  // Fallback si no existe mostrarProducto global
  if (typeof window.mostrarProducto !== "function") {
    window.mostrarProducto = function (id) {
      console.log("Producto id:", id);
    };
  }

  // Variable global de rotación (para sincronizar con el arrastre)
  var targetRotation = 0;

})();
