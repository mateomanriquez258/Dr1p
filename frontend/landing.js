/* =====================================================================
 * DR1P STORE — Landing JS
 * 1) Preloader slot-machine que deletrea la marca con ease-out
 * 2) Destacados desde /api/productos (precio lista + transferencia)
 * 3) Buscador + selector de categorías (redirigen a la tienda /?cat=)
 * 4) Countdown del próximo drop + suscripción (POST /api/leads)
 * ===================================================================== */
(function () {
  "use strict";

  var MARCA = "DR1P STORE";           // nombre que fija el slot machine
  var DROP_DATE = new Date("2026-12-01T20:00:00-03:00").getTime(); // próximo drop
  var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@";
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return n.toLocaleString("es-AR"); };

  /* ---------- 1. PRELOADER SLOT MACHINE ---------- */
  function preloader() {
    var box = $("preloader"), slot = $("slot-name");
    document.body.classList.add("locked");
    // click = saltar
    box.addEventListener("click", function () { cerrar(); });

    // crea un slot por letra
    var spans = [];
    for (var i = 0; i < MARCA.length; i++) {
      var s = document.createElement("span");
      s.textContent = MARCA[i] === " " ? "\u00A0" : "?";
      slot.appendChild(s);
      spans.push(s);
    }
    // cada letra gira caracteres al azar y se fija con delay progresivo
    // (ease-out: las primeras fijan rápido, las últimas tardan más)
    var fijas = 0;
    function cerrar() {
      if (box.classList.contains("done")) return;
      box.classList.add("done");
      document.body.classList.remove("locked");
      setTimeout(function () { box.remove(); }, 700);
    }
    spans.forEach(function (s, i) {
      if (MARCA[i] === " ") { s.classList.add("lock"); fijas++; return; }
      var ticks = 0;
      var totalTicks = 8 + i * 4; // progresivo → desaceleración natural
      var iv = setInterval(function () {
        s.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
        if (++ticks >= totalTicks) {
          clearInterval(iv);
          s.textContent = MARCA[i];
          s.classList.add("lock");
          if (++fijas === spans.length) setTimeout(cerrar, 450);
        }
      }, 55);
    });
  }

  /* ---------- 2. DESTACADOS ---------- */
  var productos = [];
  function transferencia(p) {
    // precio con descuento por transferencia = base original (pre-aumento)
    return p.precio_base || Math.round(p.precio / 1.2);
  }
  async function cargarDestacados() {
    try {
      var r = await fetch("/api/productos");
      productos = await r.json();
    } catch (e) { return; }
    // curaduría: 1 remera + 1 pantalón + 1 gorra + 1 extra
    var pick = ["remeras", "pantalones", "gorras"].map(function (c) {
      return productos.find(function (p) { return p.categoria === c; });
    }).filter(Boolean);
    if (productos[5] && pick.indexOf(productos[5]) < 0) pick.push(productos[5]);
    renderDestacados(pick.length ? pick : productos.slice(0, 4));
  }
  function renderDestacados(lista) {
    $("drop-grid").innerHTML = lista.map(function (p) {
      return '<article class="prod">' +
        '<img src="' + p.imagen + '" alt="' + p.nombre + '" loading="lazy">' +
        '<div class="prod-body"><span class="prod-brand">DR1P</span>' +
        '<h3 class="prod-name">' + p.nombre + "</h3>" +
        '<div class="prod-price">$' + fmt(p.precio) + "</div>" +
        '<div class="prod-tx">TRANSF: $' + fmt(transferencia(p)) + "</div>" +
        "</div></article>";
    }).join("");
  }

  /* ---------- 3. BUSCADOR + CATEGORÍAS → tienda ---------- */
  function wiringNav() {
    $("nav-cat").addEventListener("change", function (e) {
      window.location.href = "/?cat=" + e.target.value;
    });
    $("nav-search").addEventListener("input", function (e) {
      var q = e.target.value.trim().toLowerCase();
      if (!q) { cargarDestacados(); return; }
      renderDestacados(productos.filter(function (p) {
        return (p.nombre + " " + p.categoria).toLowerCase().indexOf(q) >= 0;
      }));
    });
  }

  /* ---------- 4. COUNTDOWN + SUSCRIPCIÓN ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function countdown() {
    var diff = DROP_DATE - Date.now();
    if (diff <= 0) {
      document.querySelector(".drop-title").textContent = "DROP 003 — DISPONIBLE AHORA";
      $("cd-d").textContent = $("cd-h").textContent = $("cd-m").textContent = $("cd-s").textContent = "00";
      return;
    }
    $("cd-d").textContent = pad(Math.floor(diff / 864e5));
    $("cd-h").textContent = pad(Math.floor(diff / 36e5) % 24);
    $("cd-m").textContent = pad(Math.floor(diff / 6e4) % 60);
    $("cd-s").textContent = pad(Math.floor(diff / 1e3) % 60);
  }
  function wiringDrop() {
    setInterval(countdown, 1000); countdown();
    $("drop-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("drop-email").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
      // ENDPOINT MARKETING: mismo /api/leads (premio "DROP" = early access)
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, premio: "DROP", cupon: "-" })
      }).catch(function () {});
      $("drop-ok").hidden = false;
      e.target.reset();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    preloader();
    cargarDestacados();
    wiringNav();
    wiringDrop();
  });
})();
