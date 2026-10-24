/* =====================================================================
 * THE RACK — Perchero digital interactivo (Three.js + GSAP)
 * - Carga productos desde /api/productos
 * - Muestra shorts Jordan y remeras en un carrusel 3D rotativo
 * - Arrastre para rotar (PC y móvil)
 * - Clic en prenda → modal con precio, talles y agregar al carrito
 * ===================================================================== */

(function () {
  "use strict";

  // ---- Config ----
  var PRODUCTOS_URL = "/api/productos";
  var RADIO = 4.2; // radio del círculo del perchero
  var AUTO_ROT_SPEED = 0.0004;
  var DRAG_SPEED = 0.005;

  var scene, camera, renderer, group, raycaster, mouse;
  var prendas = []; // objetos { mesh, producto, angle }
  var targetRotation = 0;
  var currentRotation = 0;
  var isDown = false;
  var pointerX = 0;
  var pointerXOnDown = 0;
  var targetRotationOnDown = 0;

  var modal = document.getElementById("product-modal");
  var modalImg = document.getElementById("modal-img");
  var modalNombre = document.getElementById("modal-nombre");
  var modalPrecio = document.getElementById("modal-precio");
  var modalStock = document.getElementById("modal-stock");
  var modalTalle = document.getElementById("modal-talle");
  var modalAdd = document.getElementById("modal-add");
  var modalWsp = document.getElementById("modal-wsp");
  var modalOverlay = modal.querySelector(".modal-overlay");
  var modalClose = modal.querySelector(".modal-close");

  var productoSeleccionado = null;

  // ---- Inicialización ----
  function init() {
    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 2, 12);

    // Cámara
    var aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 0.5, 7);

    // Renderer
    var canvasEl = document.getElementById("rack-canvas");
    var wrapW = canvasEl.parentElement.clientWidth || 600;
    var wrapH = canvasEl.parentElement.clientHeight || 400;
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
    renderer.setSize(wrapW, wrapH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;

    // Luces
    var luzAmbiente = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(luzAmbiente);
    var luzPuntual = new THREE.PointLight(0xffffff, 1);
    luzPuntual.position.set(5, 5, 5);
    scene.add(luzPuntual);

    // Raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Grupo del perchero
    group = new THREE.Group();
    scene.add(group);

    // Cargar productos
    fetch(PRODUCTOS_URL)
      .then(function (r) { return r.json(); })
      .then(function (lista) {
        // Filtrar para el rack: remeras + pantalones Jordan (shorts)
        var seleccion = lista.filter(function (p) {
          var c = (p.categoria || "").toLowerCase();
          return c === "remeras" || c === "pantalones";
        }).slice(0, 8);
        crearPerchero(seleccion);
      })
      .catch(function (e) { console.error("Rack: error cargando productos", e); });

    // Eventos
    window.addEventListener("resize", onResize, false);
    document.getElementById("rack-canvas").addEventListener("pointerdown", onPointerDown, false);
    document.getElementById("rack-canvas").addEventListener("pointermove", onPointerMove, false);
    document.getElementById("rack-canvas").addEventListener("pointerup", onPointerUp, false);
    document.getElementById("rack-canvas").addEventListener("pointerleave", onPointerUp, false);

    // Modal events
    modalClose.addEventListener("click", closeProductModal);
    modalOverlay.addEventListener("click", closeProductModal);
    modalAdd.addEventListener("click", function () {
      if (!productoSeleccionado) return;
      var talle = modalTalle.value;
      if (!talle) { alert("Elegí un talle"); return; }
      agregarCantidad(productoSeleccionado.id, talle, 1);
      openCart();
      closeProductModal();
    });
    modalWsp.addEventListener("click", function () {
      if (!productoSeleccionado) return;
      var texto = "Hola DR1P! Quiero comprar: " + productoSeleccionado.nombre + " - $" + productoSeleccionado.precio + " (Talle: " + modalTalle.value + ")";
      location.href = "https://wa.me/5492993244379?text=" + encodeURIComponent(texto);
    });

    // Loop
    animate();
  }

  function crearPerchero(lista) {
    // Material base
    var loader = new THREE.TextureLoader();
    var anguloInicio = 0;

    lista.forEach(function (p, i) {
      var angulo = (i / lista.length) * Math.PI * 2;
      var x = Math.sin(angulo) * RADIO;
      var z = Math.cos(angulo) * RADIO;

      // Plano para la prenda
      var geometry = new THREE.PlaneGeometry(1.6, 2.2);
      var material = new THREE.MeshStandardMaterial({ map: null, color: 0x222222, roughness: 0.7, metalness: 0.2 });
      var mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = -angulo;
      mesh.lookAt(new THREE.Vector3(0, 0, 0));
      mesh.producto = p;
      mesh.name = "prenda-" + p.id;

      // Cargar imagen como textura
      loader.load(
        p.imagen,
        function (texture) {
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        function () {
          // si falla la imagen, deja color sólido
        }
      );

      group.add(mesh);
      prendas.push({ mesh: mesh, producto: p, angle: angulo });
    });
  }

  // ---- Eventos de interacción ----
  function onPointerDown(event) {
    isDown = true;
    pointerX = event.clientX;
    pointerXOnDown = pointerX;
    targetRotationOnDown = targetRotation;
    document.getElementById("rack-canvas").style.cursor = "grabbing";
  }

  function onPointerMove(event) {
    if (!isDown) return;
    pointerX = event.clientX;
    var deltaX = pointerX - pointerXOnDown;
    targetRotation = targetRotationOnDown + deltaX * DRAG_SPEED;
  }

  function onPointerUp() {
    isDown = false;
    document.getElementById("rack-canvas").style.cursor = "grab";
  }

  function onResize() {
    var canvasEl = document.getElementById("rack-canvas");
    if (!canvasEl) return;
    var wrapW = canvasEl.parentElement.clientWidth || 600;
    var wrapH = canvasEl.parentElement.clientHeight || 400;
    camera.aspect = wrapW / wrapH;
    camera.updateProjectionMatrix();
    renderer.setSize(wrapW, wrapH);
  }

  // ---- Animación ----
  function animate() {
    requestAnimationFrame(animate);

    // Suavizado de rotación
    currentRotation += (targetRotation - currentRotation) * 0.08;
    group.rotation.y = currentRotation;

    // Hacer que las prendas siempre miren al centro (billboard suave)
    prendas.forEach(function (item) {
      // rotación base del grupo ya aplica, solo ajustamos para mirar al centro
    });

    raycaster.setFromCamera(mouse, camera);
    var intersectos = raycaster.intersectObjects(prendas.map(function (p) { return p.mesh; }));

    prendas.forEach(function (item) {
      var sobre = intersectos.some(function (i) { return i.object === item.mesh; });
      item.mesh.scale.setScalar(sobre ? 1.12 : 1);
      item.mesh.material.emissive.setHex(sobre ? 0x222222 : 0x000000);
    });

    renderer.render(scene, camera);
  }

  document.getElementById("rack-canvas").addEventListener("pointermove", function (event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }, false);

  // ---- Modal producto ----
  function abrirProducto(producto) {
    productoSeleccionado = producto;
    modalImg.src = producto.imagen;
    modalImg.alt = producto.nombre;
    modalNombre.textContent = producto.nombre;
    modalPrecio.textContent = "$" + producto.precio.toLocaleString("es-AR");
    modalStock.textContent = "Stock: " + producto.stock + " unidades";

    // Talles
    var talles = producto.talles || (producto.categoria === "gorras" ? ["Único / 7 3/8"] : ["S", "M", "L", "XL", "XXL"]);
    modalTalle.innerHTML = "";
    talles.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      modalTalle.appendChild(o);
    });
    modalTalle.value = talles[0];

    // Link WhatsApp con producto
    var texto = "Hola DR1P! Quiero comprar: " + producto.nombre + " - $" + producto.precio + " (Talle: " + talles[0] + ")";
    modalWsp.href = "https://wa.me/5492993244379?text=" + encodeURIComponent(texto);

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeProductModal() {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    productoSeleccionado = null;
  }

  // Clic en el canvas para detectar prenda
  document.getElementById("rack-canvas").addEventListener("pointerup", function (event) {
    if (isDown) {
      // solo es clic si no hubo arrastre significativo
      if (Math.abs(pointerX - pointerXOnDown) < 5) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        var intersectos = raycaster.intersectObjects(prendas.map(function (p) { return p.mesh; }));
        if (intersectos.length > 0) {
          var mesh = intersectos[0].object;
          var p = prendas.find(function (item) { return item.mesh === mesh; }).producto;
          abrirProducto(p);
        }
      }
    }
  });

  // Exponer globalmente para el botón del banner si se necesita
  window.abrirProductoRack = abrirProducto;

  init();
})();
