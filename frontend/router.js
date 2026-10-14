/* =====================================================================
 * ROUTER SPA — Navegación sin recarga (history.pushState + popstate)
 *
 * Rutas:  / (todos)  |  /?cat=remeras  |  /?cat=remeras&prod=3 ...
 * - Categoría: cambia la URL con pushState y re-renderiza el catálogo
 *   SIN recargar → se mantiene layout, header, footer y scroll.
 * - Producto (?prod=ID): muestra la vista individual dinámica y oculta
 *   las secciones de tienda (se reconstruyen al volver).
 * - "Inicio"/logo: limpia filtros y vuelve arriba. Atrás/Adelante del
 *   navegador: evento popstate re-aplica la ruta.
 * ===================================================================== */
(function () {
  "use strict";

  var VALIDAS = ["todos", "remeras", "pantalones", "gorras"];
  var TITULOS = { todos: "[ CATÁLOGO // TODOS ]", remeras: "[ CATÁLOGO // REMERAS ]", pantalones: "[ CATÁLOGO // PANTALONES ]", gorras: "[ CATÁLOGO // GORRAS ]" };

  // Lee la ruta actual: { cat, prod } (prod = id o null)
  function rutaActual() {
    var cat = "todos", prod = null;
    try {
      var q = new URLSearchParams(location.search);
      var c = q.get("cat") || "todos";
      if (VALIDAS.indexOf(c) >= 0) cat = c;
      var p = parseInt(q.get("prod") || "", 10);
      if (!isNaN(p)) prod = p;
    } catch (e) {}
    return { cat: cat, prod: prod };
  }

  function urlDe(cat, prod) {
    var u = location.pathname;
    var parts = [];
    if (cat && cat !== "todos") parts.push("cat=" + cat);
    if (prod != null) parts.push("prod=" + prod);
    return parts.length ? u + "?" + parts.join("&") : u;
  }

  // Aplica una ruta a la UI (requiere datos ya cargados en app.js)
  function aplicarRuta(ruta, conScroll) {
    if (typeof window.filtrar === "function") window.filtrar(ruta.cat);
    var t = document.getElementById("titulo-categoria");
    if (t) t.textContent = TITULOS[ruta.cat];
    document.querySelectorAll("[data-cat]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-cat") === ruta.cat);
    });
    if (ruta.prod != null && typeof window.mostrarProducto === "function") {
      window.mostrarProducto(ruta.prod);
      if (conScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      if (typeof window.vistaProductoVisible === "function") window.vistaProductoVisible(false);
      if (conScroll) {
        if (ruta.cat === "todos") window.scrollTo({ top: 0, behavior: "smooth" });
        else {
          var dest = document.getElementById("catalogo");
          if (dest) dest.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }

  // Re-aplica la URL actual (la llama app.js cuando llegan los datos,
  // y el evento popstate). Sin datos aún, no hace nada.
  function refrescar(conScroll) {
    if (!window.__datosOK) return;
    aplicarRuta(rutaActual(), conScroll);
  }

  function ir(cat, conScroll) {
    if (VALIDAS.indexOf(cat) < 0) cat = "todos";
    history.pushState({ cat: cat, prod: null }, "", urlDe(cat, null));
    aplicarRuta({ cat: cat, prod: null }, conScroll !== false);
  }

  function inicio() { ir("todos"); }

  // Vista individual: /?cat=remeras&prod=3 (conserva la categoría)
  function irProd(id) {
    var cat = rutaActual().cat;
    history.pushState({ cat: cat, prod: id }, "", urlDe(cat, id));
    aplicarRuta({ cat: cat, prod: id }, true);
  }

  // Volver desde el producto → atrás del navegador si hay historial,
  // sino a la categoría actual
  function volver() {
    if (history.length > 1) history.back();
    else ir(rutaActual().cat);
  }

  // "Ver catálogo": limpia filtros y muestra TODO el inventario
  function catalogo() {
    try { var s = document.getElementById("nav-search"); if (s) s.value = ""; } catch (e) {}
    if (typeof window.limpiarBusqueda === "function") window.limpiarBusqueda();
    ir("todos");
    var dest = document.getElementById("catalogo");
    if (dest) dest.scrollIntoView({ behavior: "smooth" });
  }

  // Logo = home absoluto: recarga / reseteando estados y filtros
  function home() { location.href = "/"; }

  window.addEventListener("popstate", function () {
    refrescar(true);
  });

  // Carga inicial: normaliza la URL sin scroll (app.js refresca al cargar datos)
  document.addEventListener("DOMContentLoaded", function () {
    var r = rutaActual();
    history.replaceState({ cat: r.cat, prod: r.prod }, "", urlDe(r.cat, r.prod));
  });

  window.Router = { ir: ir, inicio: inicio, irProd: irProd, volver: volver, catalogo: catalogo, home: home, actual: rutaActual, refrescar: refrescar };
})();
