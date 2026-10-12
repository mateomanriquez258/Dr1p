/* =====================================================================
 * SPIN-TO-WIN — Ruleta de captación (Vanilla JS, modularizado)
 *
 * Premios visibles: A=20% OFF | B=$5000 | C=No ganaste
 * LÓGICA ARREGLADA: nunca cae en C. El resultado se decide ANTES de
 * animar (50/50 entre A y B) y se calculan los grados exactos de parada.
 *
 * ENDPOINT MARKETING: ver función `guardarLead()` → POST /api/leads
 * Para conectar Mailchimp/Brevo/Klaviyo: agregar el reenvío en
 * backend/server.js bloque "/api/leads" (marcado con TODO).
 * ===================================================================== */

(function () {
  "use strict";

  // ---- 1. Configuración ----
  var SEGMENTOS = 6;                 // 6 porciones de 60°
  var GRADOS_SEG = 360 / SEGMENTOS;
  // Mapa de segmentos del conic-gradient (debe coincidir con el CSS):
  // 0:A gana | 1:C pierde | 2:B gana | 3:C pierde | 4:A gana | 5:B gana
  var TIPO = ["A", "C", "B", "C", "A", "B"];
  var GANADORES_A = [0, 4];          // índices válidos para Premio A
  var GANADORES_B = [2, 5];          // índices válidos para Premio B
  var LS_DONE = "dr1p_spin_done";    // ya giró → no mostrar más
  var LS_CLOSED = "dr1p_spin_closed"; // lo cerró → no insistir en sesión
  var VUELTAS = 5;                   // giros completos antes de frenar
  var DURACION_MS = 4200;            // debe coincidir con el CSS (4.2s)

  var rotacionAcumulada = 0;
  var girando = false;
  var premioActual = null;

  // ---- 2. Referencias DOM ----
  function $(id) { return document.getElementById(id); }
  var overlay, wheel, emailInput, errorMsg, btnSpin, winBox, formBox;

  // ---- 3. Disparador: auto-show apenas ingresa (delay 1s) ----
  // ?spin=test en la URL fuerza la aparición (para probar aunque ya haya flags)
  function modoTest() {
    try { return new URLSearchParams(location.search).get("spin") === "test"; }
    catch (e) { return false; }
  }
  function debeMostrar() {
    if (modoTest()) return true;
    try {
      if (localStorage.getItem(LS_DONE)) return false;      // ya ganó
      if (sessionStorage.getItem(LS_CLOSED)) return false;   // ya lo cerró
    } catch (e) { /* storage no disponible → mostrar igual */ }
    return true;
  }

  function mostrar() {
    overlay.classList.add("show");
    posicionarEtiquetas();
  }
  function ocultar(marcarCierre) {
    overlay.classList.remove("show");
    if (marcarCierre) {
      try { sessionStorage.setItem(LS_CLOSED, "1"); } catch (e) {}
    }
  }

  // ---- 4. Etiquetas sobre la ruleta (posicionadas por ángulo) ----
  var NOMBRES = ["20% OFF", "SUERTE\nPRÓXIMA", "$5000", "SUERTE\nPRÓXIMA", "20% OFF", "$5000"];
  function posicionarEtiquetas() {
    var stage = $("spin-labels");
    if (!stage || stage.children.length) return;
    for (var i = 0; i < SEGMENTOS; i++) {
      var el = document.createElement("div");
      el.className = "spin-label";
      el.innerText = NOMBRES[i];
      var ang = (i * GRADOS_SEG + GRADOS_SEG / 2) * Math.PI / 180;
      var r = 78; // radio en px (stage 260px)
      var x = Math.sin(ang) * r, y = -Math.cos(ang) * r;
      el.style.transform =
        "translate(-50%,-50%) translate(" + x + "px," + y + "px) rotate(" + (i * GRADOS_SEG + GRADOS_SEG / 2) + "deg)";
      el.style.left = "50%"; el.style.top = "50%";
      stage.appendChild(el);
    }
  }

  // ---- 5. Validación de email en tiempo real ----
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function emailValido(v) { return EMAIL_RE.test((v || "").trim()); }

  function validarEnVivo() {
    var v = emailInput.value;
    if (!v) { errorMsg.textContent = ""; emailInput.classList.remove("invalid"); btnSpin.disabled = true; return; }
    if (emailValido(v)) {
      errorMsg.textContent = "";
      emailInput.classList.remove("invalid");
      btnSpin.disabled = girando;
    } else {
      errorMsg.textContent = "Ingresá un email válido (ej: nombre@mail.com)";
      emailInput.classList.add("invalid");
      btnSpin.disabled = true;
    }
  }

  // ---- 6. Algoritmo arreglado: elegir ganador ANTES de animar ----
  function elegirPremio() {
    // 50/50 entre A y B. C queda excluido por diseño.
    var esA = Math.random() < 0.5;
    var bolsa = esA ? GANADORES_A : GANADORES_B;
    var idx = bolsa[Math.floor(Math.random() * bolsa.length)];
    return {
      tipo: esA ? "A" : "B",
      indice: idx,
      titulo: esA ? "20% OFF en tu próxima compra" : "$5.000 de regalo",
      cupon: (esA ? "DR1P-20OFF-" : "DR1P-5000-") + Math.random().toString(36).slice(2, 6).toUpperCase()
    };
  }

  // ---- 7. Cálculo de grados exactos de parada ----
  // La flecha está fija arriba (= ángulo 0°). El centro del segmento
  // ganador está en (indice*60 + 30)°. Hay que rotar la rueda para que
  // ese centro quede justo bajo la flecha, más N vueltas completas.
  function gradosDeParada(indice) {
    var centro = indice * GRADOS_SEG + GRADOS_SEG / 2;
    var actual = rotacionAcumulada % 360;
    var jitter = (Math.random() * 2 - 1) * (GRADOS_SEG / 2 - 6); // ±24° para naturalidad
    var delta = (360 - ((actual + centro) % 360) + jitter + 360) % 360;
    return rotacionAcumulada + VUELTAS * 360 + delta;
  }

  // ---- 8. Giro ----
  function girar() {
    if (girando) return;
    if (!emailValido(emailInput.value)) { validarEnVivo(); return; }
    girando = true;
    btnSpin.disabled = true;

    premioActual = elegirPremio();                    // (a) decidir primero
    var destino = gradosDeParada(premioActual.indice); // (b) calcular ángulo
    rotacionAcumulada = destino;
    wheel.style.transform = "rotate(" + destino + "deg)"; // (c) animar (CSS transition)

    leadCupon = null;
    guardarLead(emailInput.value.trim(), premioActual); // (d) el servidor crea el cupón único (background)

    setTimeout(mostrarVictoria, DURACION_MS + 150);    // (e) al frenar → victoria
  }

  // ---- 9. Guardar lead (backend propio + Formspree) ----
  // El SERVIDOR genera el cupón único (POST /api/leads → {cupon}).
  // Devuelve promesa con el cupón oficial; si falla, se usa el candidato.
  // Endpoint oficial Formspree → https://formspree.io/f/xaeqdvol
  var FORMSPREE_URL = "https://formspree.io/f/xaeqdvol";
  var leadCupon = null; // cupón confirmado por el servidor
  function guardarLead(email, premio) {
    var payload = { email: email, premio: premio.tipo, cupon: premio.cupon };
    // (a) Backend propio → genera y devuelve el cupón único
    var p = fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.cupon) leadCupon = d.cupon; })
      .catch(function () { /* fallback: candidato local */ });
    // (b) Formspree (gratuito) → te avisa por email cada lead, sin recargar
    fetch(FORMSPREE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        email: email,
        premio: premio.titulo,
        cupon: premio.cupon,
        _subject: "Nuevo lead ruleta DR1P"
      })
    }).catch(function () { /* idem: la ruleta sigue igual */ });
    return p;
  }

  // ---- 10. Pantalla de victoria + copiar cupón ----
  // Usa el cupón confirmado por el servidor (llegó durante la animación);
  // si la red falló, usa el candidato local como respaldo.
  function mostrarVictoria() {
    girando = false;
    if (leadCupon) premioActual.cupon = leadCupon;
    formBox.style.display = "none";
    $("spin-stage").style.display = "none";
    $("spin-title").textContent = "¡Felicitaciones!";
    $("spin-sub").textContent = "Ganaste:";
    $("win-prize").textContent = premioActual.titulo;
    $("win-coupon").textContent = premioActual.cupon;
    // Instrucciones de canje en checkout (WhatsApp):
    $("win-info").textContent = premioActual.tipo === "A"
      ? "Copiá el código y pegalo en el campo CUPÓN del carrito antes de finalizar por WhatsApp. Se descuenta 20% del total."
      : "Copiá el código y pegalo en el campo CUPÓN del carrito antes de finalizar por WhatsApp. Se descuentan $5.000 del total.";
    winBox.classList.add("show");
    try { localStorage.setItem(LS_DONE, JSON.stringify({ email: emailInput.value, premio: premioActual })); } catch (e) {}
  }

  function copiarCupon() {
    var cupon = premioActual ? premioActual.cupon : "";
    function ok() { $("btn-copy").textContent = "¡Copiado! ✓"; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cupon).then(ok).catch(ok);
    } else {
      var ta = document.createElement("textarea");
      ta.value = cupon; document.body.appendChild(ta);
      ta.select(); try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); ok();
    }
  }

  // ---- 11. Init / wiring ----
  function init() {
    overlay = $("spin-overlay");
    wheel = $("spin-wheel");
    emailInput = $("spin-email");
    errorMsg = $("spin-error");
    btnSpin = $("btn-spin");
    winBox = $("spin-win");
    formBox = $("spin-form-box");
    if (!overlay) return;

    emailInput.addEventListener("input", validarEnVivo);
    btnSpin.addEventListener("click", girar);
    $("spin-close").addEventListener("click", function () { ocultar(true); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) ocultar(true); });
    $("btn-copy").addEventListener("click", copiarCupon);
    $("btn-win-close").addEventListener("click", function () { ocultar(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") ocultar(true); });

    validarEnVivo();
    if (!debeMostrar()) return;
    // Espera a que el preloader termine para no montarse encima
    var pre = document.getElementById("preloader");
    if (pre) {
      var obs = new MutationObserver(function () {
        if (!document.getElementById("preloader")) {
          obs.disconnect();
          setTimeout(mostrar, 800);
        }
      });
      obs.observe(document.body, { childList: true });
      // seguridad: si el preloader tarda, mostrar igual a los 5s
      setTimeout(function () {
        if (document.getElementById("spin-overlay").classList.contains("show")) return;
        obs.disconnect(); mostrar();
      }, 5000);
    } else {
      setTimeout(mostrar, 1000); // aparece apenas ingresa (~1s)
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
