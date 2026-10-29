/* =====================================================================
 * SPIN-TO-WIN — Ruleta de captación (Vanilla JS, modularizado)
 *
 * 6 segmentos (60° c/u): 10% OFF | PRÓXIMA | 15% OFF |
 *   SEGUÍ | 20% OFF | $5000 (fondo ROJO)
 * LÓGICA ARREGLADA: 'PRÓXIMA'/'SEGUÍ' son estrictamente decorativos,
 * la ruleta NUNCA frena ahí. Sorteo uniforme entre los 4 premios válidos.
 *
 * LÍMITE 24 HS por dispositivo (localStorage dr1p_spin_ts).
 * Si intenta antes → vista "[ VUELVE EN 24HS PARA OTRA OPORTUNIDAD ]".
 * Botón flotante "GIRÁ Y GANÁ" permite reabrir el modal manualmente.
 *
 * El SERVIDOR genera el cupón único (POST /api/leads → {cupon}).
 * Formspree → https://formspree.io/f/xaeqdvol (background, sin recarga).
 * ===================================================================== */

(function () {
  "use strict";

  // ---- 1. Configuración ----
  var SEGMENTOS = 6;
  var GRADOS_SEG = 360 / SEGMENTOS;
  // Mapa de segmentos (debe coincidir con el conic-gradient del CSS):
  // 0:10% gana | 1:PRÓXIMA deco | 2:15% gana | 3:SEGUÍ deco | 4:20% gana | 5:$5000 gana
  var PREMIOS = [
    { tipo: "10OFF", titulo: "10% OFF en tu próxima compra", color: "10% OFF" },
    { tipo: "NONE", titulo: "Próxima", color: "PRÓXIMA" },
    { tipo: "15OFF", titulo: "15% OFF en tu próxima compra", color: "15% OFF" },
    { tipo: "NONE", titulo: "Seguí", color: "SEGUÍ" },
    { tipo: "20OFF", titulo: "20% OFF en tu próxima compra", color: "20% OFF" },
    { tipo: "5000", titulo: "$5.000 de regalo", color: "$5000" }
  ];
  var LS_TS = "dr1p_spin_ts";        // timestamp del último giro (24hs)
  var LS_CLOSED = "dr1p_spin_closed"; // lo cerró → no insistir en sesión
  var MS_24H = 24 * 3600 * 1000;
  var VUELTAS = 5;
  var DURACION_MS = 4200;            // debe coincidir con el CSS (4.2s)
  var FORMSPREE_URL = "https://formspree.io/f/xaeqdvol";

  var rotacionAcumulada = 0;
  var girando = false;
  var premioActual = null;
  var leadCupon = null;

  // ---- 2. Referencias DOM ----
  function $(id) { return document.getElementById(id); }
  var overlay, wheel, emailInput, errorMsg, btnSpin, winBox, coolBox, formBox, stageBox;

  function modoTest() {
    try { return new URLSearchParams(location.search).get("spin") === "test"; }
    catch (e) { return false; }
  }
  function ultimoGiro() {
    try {
      // Migración: el flag permanente anterior equivale a "giró recién"
      if (!localStorage.getItem(LS_TS) && localStorage.getItem("dr1p_spin_done")) {
        localStorage.setItem(LS_TS, String(Date.now()));
      }
      return parseInt(localStorage.getItem(LS_TS) || "0", 10);
    } catch (e) { return 0; }
  }
  function msRestantes() { return ultimoGiro() + MS_24H - Date.now(); }
  function enCooldown() { return !modoTest() && msRestantes() > 0; }
  function debeMostrar() {
    if (modoTest()) return true;
    try { if (sessionStorage.getItem(LS_CLOSED)) return false; } catch (e) {}
    return !enCooldown();
  }
  function textoRestante() {
    var ms = Math.max(0, msRestantes());
    var h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60;
    return "Volvé en " + h + "h " + m + "m";
  }

  // ---- 3. Vistas del modal: formulario / victoria / cooldown ----
  function vistaFormulario() {
    formBox.style.display = "";
    stageBox.style.display = "";
    winBox.classList.remove("show");
    coolBox.classList.remove("show");
    $("spin-title").textContent = "¡Girá y ganá!";
    $("spin-sub").textContent = "Dejanos tu email y probá suerte: hasta 20% OFF o $5.000.";
  }
  function vistaCooldown() {
    formBox.style.display = "none";
    stageBox.style.display = "none";
    winBox.classList.remove("show");
    $("spin-title").textContent = "Ruleta en pausa";
    $("spin-sub").textContent = textoRestante();
    $("cool-msg").textContent = "[ VUELVE EN 24HS PARA OTRA OPORTUNIDAD ]";
    coolBox.classList.add("show");
  }
  function mostrar() {
    vistaFormulario();
    overlay.classList.add("show");
    posicionarEtiquetas();
  }
  function ocultar(marcarCierre) {
    overlay.classList.remove("show");
    if (marcarCierre) {
      try { sessionStorage.setItem(LS_CLOSED, "1"); } catch (e) {}
    }
  }
  // Apertura manual (botón flotante): si está en cooldown, lo informa
  function abrir() {
    if (enCooldown()) {
      overlay.classList.add("show");
      vistaCooldown();
    } else {
      mostrar();
    }
  }

  // ---- 4. Etiquetas sobre la ruleta ----
  function posicionarEtiquetas() {
    var stage = $("spin-labels");
    if (!stage || stage.children.length) return;
    for (var i = 0; i < SEGMENTOS; i++) {
      var el = document.createElement("div");
      el.className = "spin-label";
      el.innerText = PREMIOS[i].color;
      var ang = (i * GRADOS_SEG + GRADOS_SEG / 2) * Math.PI / 180;
      var r = 78;
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

  // ---- 7. Grados exactos de parada (flecha fija arriba = 0°) ----
  function gradosDeParada(indice) {
    var centro = indice * GRADOS_SEG + GRADOS_SEG / 2;
    var actual = rotacionAcumulada % 360;
    var jitter = (Math.random() * 2 - 1) * (GRADOS_SEG / 2 - 6);
    var delta = (360 - ((actual + centro) % 360) + jitter + 360) % 360;
    return rotacionAcumulada + VUELTAS * 360 + delta;
  }

  // ---- 8. Giro ----
  function girar() {
    if (girando) return;
    if (!emailValido(emailInput.value)) { validarEnVivo(); return; }
    girando = true;
    btnSpin.disabled = true;
    errorMsg.textContent = "";
    guardarLead(emailInput.value.trim()).then(function (resultado) {
      if (!resultado.ok) {
        girando = false;
        if (resultado.cooldown) {
          guardarCooldown(resultado.reintentarEn);
          vistaCooldown();
          return;
        }
        validarEnVivo();
        errorMsg.textContent = "No se pudo confirmar el giro. Revisá tu conexión e intentá de nuevo.";
        return;
      }

      var data = resultado.data;
      premioActual = PREMIOS[data.segmento];
      if (!premioActual || premioActual.tipo !== data.premio) {
        girando = false;
        validarEnVivo();
        errorMsg.textContent = "No se pudo confirmar el premio. Intentá de nuevo.";
        return;
      }
      premioActual = Object.assign({}, premioActual, { indice: data.segmento, gana: data.premio !== "NONE", cupon: data.cupon || null });
      leadCupon = data.cupon || null;
      var destino = gradosDeParada(premioActual.indice);
      rotacionAcumulada = destino;
      wheel.style.transform = "rotate(" + destino + "deg)";
      setTimeout(function () { mostrarVictoria({ ok: true, data: data }); }, DURACION_MS + 150);
    });
  }

  // ---- 8. Pedir al servidor el premio y luego guardar en Formspree ----
  function guardarLead(email) {
    var p = fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (r.status === 429 && d && d.error === "cooldown") {
          return { ok: false, cooldown: true, reintentarEn: d.reintentarEn };
        }
        if (!r.ok || !d || !d.ok || !Number.isInteger(d.segmento) || !PREMIOS[d.segmento] || PREMIOS[d.segmento].tipo !== d.premio || (d.premio !== "NONE" && !d.cupon)) return { ok: false };
        if (!d.repetido) {
          fetch(FORMSPREE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              email: email,
              premio: PREMIOS[d.segmento].titulo,
              _subject: "Nuevo lead ruleta DR1P"
            })
          }).catch(function () {});
        }
        return { ok: true, data: d };
      });
    }).catch(function () { return { ok: false }; });
    return p;
  }

  function guardarCooldown(reintentarEn) {
    var siguienteGiro = Date.parse(reintentarEn || "");
    if (!Number.isFinite(siguienteGiro)) siguienteGiro = Date.now() + MS_24H;
    try { localStorage.setItem(LS_TS, String(siguienteGiro - MS_24H)); } catch (e) {}
  }

  // ---- 9. Pantalla de victoria (según premio confirmado por el servidor) ----
  function mostrarVictoria(resultado) {
    girando = false;
    formBox.style.display = "none";
    stageBox.style.display = "none";
    $("btn-copy").style.display = "";
    $("btn-copy").disabled = false;
    $("btn-copy").textContent = "Copiar mi cupón";

    if (!resultado || !resultado.ok) {
      $("spin-title").textContent = "No se pudo generar el cupón";
      $("spin-sub").textContent = "El servidor no confirmó el resultado.";
      $("win-prize").textContent = premioActual.titulo;
      $("win-coupon").textContent = "";
      $("win-info").textContent = "No se mostró ningún código. Cerrá esta ventana e intentá de nuevo cuando la tienda esté conectada.";
      $("btn-copy").style.display = "none";
      winBox.classList.add("show");
      return;
    }

    var data = resultado.data;
    guardarCooldown(data.reintentarEn);
    if (leadCupon) premioActual.cupon = leadCupon;
    $("spin-title").textContent = premioActual.gana ? "¡Felicitaciones!" : "Ruleta en pausa";
    $("spin-sub").textContent = premioActual.gana ? "Ganaste:" : "Esta vez no hubo premio.";
    $("win-prize").textContent = premioActual.gana ? premioActual.titulo : "Volvé a intentarlo en 24 horas.";
    $("win-coupon").textContent = leadCupon || "";
    $("win-info").textContent = premioActual.gana
      ? (premioActual.tipo === "5000"
        ? "Código válido por 24 horas. Copialo y pegalo en CUPÓN antes de finalizar por WhatsApp; se descuentan $5.000."
        : "Código válido por 24 horas. Copialo y pegalo en CUPÓN antes de finalizar por WhatsApp; se descuenta el porcentaje ganado.")
      : "";
    if (!premioActual.gana) $("btn-copy").style.display = "none";
    winBox.classList.add("show");
  }

  function copiarCupon() {
    var cupon = premioActual ? premioActual.cupon : "";
    if (!cupon) return;
    function ok() { $("btn-copy").textContent = "¡Copiado!"; }
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
    coolBox = $("spin-cool");
    formBox = $("spin-form-box");
    stageBox = $("spin-stage");
    if (!overlay) return;

    emailInput.addEventListener("input", validarEnVivo);
    btnSpin.addEventListener("click", girar);
    $("spin-close").addEventListener("click", function () { ocultar(true); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) ocultar(true); });
    $("btn-copy").addEventListener("click", copiarCupon);
    $("btn-win-close").addEventListener("click", function () { ocultar(false); });
    $("btn-cool-close").addEventListener("click", function () { ocultar(false); });
    var fab = $("spin-fab");
    if (fab) fab.addEventListener("click", abrir);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") ocultar(true); });

    validarEnVivo();
    if (!debeMostrar()) return;
    var pre = document.getElementById("preloader");
    if (pre) {
      var obs = new MutationObserver(function () {
        if (!document.getElementById("preloader")) {
          obs.disconnect();
          setTimeout(mostrar, 800);
        }
      });
      obs.observe(document.body, { childList: true });
      setTimeout(function () {
        if (document.getElementById("spin-overlay").classList.contains("show")) return;
        obs.disconnect(); mostrar();
      }, 5000);
    } else {
      setTimeout(mostrar, 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }

  window.SpinWin = { abrir: abrir };
})();
