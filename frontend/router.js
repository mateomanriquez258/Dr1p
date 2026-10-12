/* =====================================================================
 * ROUTER SPA — Navegación sin recarga (history.pushState + popstate)
 *
 * Rutas:  / (todos)  |  /?cat=remeras | /?cat=pantalones | /?cat=gorras
 * - Click en categoría: cambia la URL con pushState y re-renderiza el
 *   catálogo SIN recargar → se mantiene layout, header, footer y scroll.
 * - "Inicio": limpia el filtro (?cat= desaparece) y vuelve arriba.
 * - Atrás/Adelante del navegador: evento popstate re-aplica la ruta.
 * ===================================================================== */
(function () {
  "use strict";

  var VALIDAS = ["todos", "remeras", "pantalones", "gorras"];
  var TITULOS = { todos: "Catálogo completo", remeras: "Remeras", pantalones: "Pantalones", gorras: "Gorras" };

  function rutaActual() {
    try {
      var c = new URLSearchParams(location.search).get("cat") || "todos";
      return VALIDAS.indexOf(c) >= 0 ? c : "todos";
    } catch (e) { return "todos"; }
  }

  // Aplica una ruta a la UI: filtra, marca link activo y hace scroll.
  function aplicarRuta(cat, conScroll) {
    if (typeof window.filtrar === "function") window.filtrar(cat);
    var t = document.getElementById("titulo-categoria");
    if (t) t.textContent = TITULOS[cat];
    document.querySelectorAll("[data-cat]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-cat") === cat);
    });
    if (conScroll) {
      var dest = cat === "todos"
        ? document.body
        : document.getElementById("catalogo");
      (cat === "todos"
        ? window.scrollTo({ top: 0, behavior: "smooth" })
        : dest && dest.scrollIntoView({ behavior: "smooth" }));
    }
  }

  // Navegación pública: usar en onclick="Router.ir('remeras')"
  function ir(cat) {
    if (VALIDAS.indexOf(cat) < 0) cat = "todos";
    var url = cat === "todos" ? location.pathname : location.pathname + "?cat=" + cat;
    history.pushState({ cat: cat }, "", url);
    aplicarRuta(cat, true);
  }

  function inicio() { ir("todos"); }

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

  // Atrás / Adelante del navegador → re-render sin recarga
  window.addEventListener("popstate", function () {
    aplicarRuta(rutaActual(), true);
  });

  // Carga inicial: normaliza la URL (?cat= inválido → /) sin scroll
  document.addEventListener("DOMContentLoaded", function () {
    var cat = rutaActual();
    history.replaceState({ cat: cat }, "", cat === "todos" ? location.pathname : location.pathname + "?cat=" + cat);
    aplicarRuta(cat, false);
  });

  window.Router = { ir: ir, inicio: inicio, catalogo: catalogo, home: home, actual: rutaActual };
})();
