let PRODUCTOS = [];
let WHATSAPP_NUMERO = "5492993244379";
let carrito = [];
let filtroActual = "todos";
let busqueda = "";
let cuponAplicado = null;

const fmt = n => n.toLocaleString("es-AR");

function nombreLimpio(n) { return (n || "").replace(/\s*\([^)]*\)\s*/g, "").trim(); }

function filtrar(cat) {
  filtroActual = cat;
  filtros.cats = cat === "todos" ? new Set() : new Set([cat]);
  if (document.getElementById("f-cats")) renderFiltros();
  mostrarProductos();
  const titulos = { todos: "[ CATÁLOGO // TODOS ]", remeras: "[ CATÁLOGO // REMERAS ]", pantalones: "[ CATÁLOGO // PANTALONES ]", gorras: "[ CATÁLOGO // GORRAS ]" };
  document.getElementById("titulo-categoria").textContent = titulos[cat] || "Productos";
  document.querySelectorAll(".filters button").forEach(b => {
    b.classList.toggle("active", b.textContent.toLowerCase().includes(cat));
  });
}

function listaFiltrada() {
  const q = busqueda.trim().toLowerCase();
  return PRODUCTOS.filter(p => {
    const okCat = filtroActual === "todos" || (p.categoria || "").toLowerCase() === filtroActual;
    const okQ = !q || (p.nombre + " " + (p.categoria || "") + " " + (p.marca || "")).toLowerCase().includes(q);
    const okSideCat = !filtros.cats.size || filtros.cats.has((p.categoria || "").toLowerCase());
    const okTalle = !filtros.talles.size || tallesPara(p).some(t => filtros.talles.has(t));
    const okMarca = !filtros.marcas.size || (p.marca && filtros.marcas.has(p.marca));
    const okMin = filtros.min === "" || p.precio >= +filtros.min;
    const okMax = filtros.max === "" || p.precio <= +filtros.max;
    return okCat && okQ && okSideCat && okTalle && okMarca && okMin && okMax;
  });
}

let filtros = { cats: new Set(), talles: new Set(), marcas: new Set(), min: "", max: "" };

function checkRow(grupo, valor, label, extra) {
  const on = filtros[grupo].has(valor) ? " checked" : "";
  return `<label class="f-check"><input type="checkbox" data-grupo="${grupo}" value="${valor}"${on}> ${label}${extra || ""}</label>`;
}

function renderFiltros() {
  const cats = [...new Set(PRODUCTOS.map(p => (p.categoria || "").toLowerCase()))];
  const talles = [...new Set(PRODUCTOS.flatMap(p => tallesPara(p)))];
  const marcas = [...new Set(PRODUCTOS.map(p => p.marca).filter(Boolean))].sort();
  const n = fn => PRODUCTOS.filter(fn).length;
  if(document.getElementById("f-cats")) {
    document.getElementById("f-cats").innerHTML = cats.map(c =>
      checkRow("cats", c, c.toUpperCase(), `<small>(${n(p => (p.categoria || "").toLowerCase() === c)})</small>`)).join("");
    document.getElementById("f-talles").innerHTML = talles.map(t => checkRow("talles", t, t)).join("");
    document.getElementById("f-marcas").innerHTML = marcas.map(m =>
      checkRow("marcas", m, m, `<small>(${n(p => p.marca === m)})</small>`)).join("");
    document.getElementById("f-min").value = filtros.min;
    document.getElementById("f-max").value = filtros.max;
    document.querySelectorAll("#panel-filtros input[type=checkbox]").forEach(ch =>
      ch.onchange = () => {
        const set = filtros[ch.dataset.grupo];
        ch.checked ? set.add(ch.value) : set.delete(ch.value);
        mostrarProductos();
      });
    document.getElementById("f-min").oninput = e => { filtros.min = e.target.value; mostrarProductos(); };
    document.getElementById("f-max").oninput = e => { filtros.max = e.target.value; mostrarProductos(); };
  }
}

function limpiarFiltros() {
  filtros = { cats: new Set(), talles: new Set(), marcas: new Set(), min: "", max: "" };
  renderFiltros();
  if (typeof Router !== "undefined") Router.ir("todos", false);
  document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
}

function initPanelFiltros() {
  const btn = document.getElementById("btn-filtros");
  const panel = document.getElementById("panel-filtros");
  const overlay = document.getElementById("overlay-filtros");
  const cerrar = document.getElementById("btn-cerrar-filtros");
  const aplicar = document.getElementById("btn-aplicar-filtros");
  const limpiar = document.getElementById("btn-limpiar-filtros");
  if (!btn || !panel) return;

  function abrir() {
    panel.classList.add("open");
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }
  function cerrarPanel() {
    panel.classList.remove("open");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  btn.addEventListener("click", abrir);
  cerrar.addEventListener("click", cerrarPanel);
  overlay.addEventListener("click", cerrarPanel);
  limpiar.addEventListener("click", () => limpiarFiltros());
  aplicar.addEventListener("click", () => { cerrarPanel(); mostrarProductos(); });
}

function mostrarProductos() {
  const contenedor = document.getElementById("productos");
  if (!contenedor) return;
  contenedor.innerHTML = listaFiltrada().map(p => `
    <div class="card">
      <img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onclick="Router.irProd(${p.id})" style="cursor:pointer">
      <div class="card-body">
        <h3 onclick="Router.irProd(${p.id})" style="cursor:pointer">${nombreLimpio(p.nombre)}</h3>
        <span class="price">$${fmt(p.precio)},00</span>
        <span class="stock">¡Solo quedan ${p.stock} en stock!</span>
        <button onclick="agregar(${p.id})">CONSEGUIR DR1P</button>
      </div>
    </div>`).join("") || "Sin productos con esos filtros.";
}

function tallesPara(p) {
  if (Array.isArray(p.talles) && p.talles.length) return p.talles;
  return (p.categoria || "").toLowerCase() === "gorras" ? ["Único / 7 3/8"] : ["S", "M", "L", "XL", "XXL"];
}
function talleDefault(p) {
  const t = tallesPara(p);
  return t.includes("L") ? "L" : t[0];
}

function agregar(id) {
  const p = PRODUCTOS.find(x => x.id == id);
  agregarCantidad(id, talleDefault(p), 1);
  openCart();
}

function agregarCantidad(id, talle, cant) {
  const p = PRODUCTOS.find(x => x.id == id);
  if (!p) return;
  if (lineasCarrito(id) + cant > p.stock) return alert("No hay más stock de este producto.");
  const linea = carrito.find(l => l.id == id && l.talle === talle);
  if (linea) linea.cant += cant;
  else carrito.push({ id, talle, cant });
  mostrarCarrito();
}

function lineasCarrito(id, talle) {
  return carrito.filter(l => l.id == id && (!talle || l.talle === talle)).reduce((a, l) => a + l.cant, 0);
}

function quitar(i) { carrito.splice(i, 1); mostrarCarrito(); }

function cambiar(i, d) {
  const l = carrito[i];
  const p = PRODUCTOS.find(x => x.id == l.id);
  const next = l.cant + d;
  if (next <= 0) return quitar(i);
  if (lineasCarrito(l.id) + d > p.stock) return alert("No hay más stock.");
  l.cant = next;
  mostrarCarrito();
}

let pdId = null, pdCant = 1;
const DESC_CAT = { remeras: "calce oversize que cae perfecto", pantalones: "calce baggy cómodo para todos los días", gorras: "ajuste fitted que se adapta a tu cabeza" };

function descripcionProd(p) {
  const cat = (p.categoria || "").toLowerCase();
  const tela = cat === "gorras" ? "materiales premium de alta durabilidad" : "tela suave que garantiza confort y durabilidad";
  return `Elegí ${nombreLimpio(p.nombre)}, una prenda confeccionada con ${tela}. Stock limitado: ¡solo quedan ${p.stock} unidades!`;
}

function vistaProductoVisible(on) {
  const prodEl = document.getElementById("producto");
  if(prodEl) prodEl.style.display = on ? "" : "none";
  ["hero", "marquee", "categorias", "catalogo", "probarte", "contacto"].forEach(id => {
    const s = document.getElementById(id);
    if (s) s.style.display = on ? "none" : "";
  });
}

function mostrarProducto(id) {
  const p = PRODUCTOS.find(x => x.id == id);
  if (!p) { vistaProductoVisible(false); return; }
  pdId = id; pdCant = 1;
  document.getElementById("pd-img").src = p.imagen;
  document.getElementById("pd-img").alt = p.nombre;
  document.getElementById("pd-cat").textContent = "[ " + (p.categoria || "").toUpperCase() + " ]";
  document.getElementById("pd-nombre").textContent = nombreLimpio(p.nombre);
  document.getElementById("pd-precio").textContent = "$" + fmt(p.precio);
  document.getElementById("pd-stock").textContent = "¡Solo quedan " + p.stock + " en stock!";
  document.getElementById("pd-talle").innerHTML = tallesPara(p).map(t => `<option>${t}</option>`).join("");
  document.getElementById("pd-cant").textContent = "1";
  document.getElementById("pd-desc").textContent = descripcionProd(p);
  vistaProductoVisible(true);
}

function pdQty(d) {
  const p = PRODUCTOS.find(x => x.id == pdId);
  if (!p) return;
  pdCant = Math.min(p.stock, Math.max(1, pdCant + d));
  document.getElementById("pd-cant").textContent = pdCant;
}

function pdAgregar() {
  if (pdId == null) return;
  agregarCantidad(pdId, document.getElementById("pd-talle").value, pdCant);
  openCart();
}

function setTalle(i, nuevoTalle) {
  const l = carrito[i];
  l.talle = nuevoTalle;
  mostrarCarrito();
}

function total() {
  return carrito.reduce((a, l) => {
    const p = PRODUCTOS.find(x => x.id == l.id);
    return a + (p ? p.precio * l.cant : 0);
  }, 0);
}

function descuento() { return 0; }
function totalFinal() { return total(); }

function aplicarCupon() {
  document.getElementById("cupon-msg").style.display = "block";
  document.getElementById("cupon-msg").textContent = "✓ Cupón aplicado";
  mostrarCarrito();
}

function quitarCupon() {
  cuponAplicado = null;
  document.getElementById("cupon").value = "";
  document.getElementById("cupon-msg").textContent = "Cupón quitado";
  mostrarCarrito();
}

function mostrarCarrito() {
  const count = carrito.reduce((a, l) => a + l.cant, 0);
  if(document.getElementById("count")) document.getElementById("count").textContent = count;
  if(document.getElementById("total")) document.getElementById("total").textContent = fmt(total());
  if(document.getElementById("total-final")) document.getElementById("total-final").textContent = fmt(totalFinal());
  
  const carritoEl = document.getElementById("carrito");
  if(carritoEl) {
    carritoEl.innerHTML = carrito.length ? carrito.map((l, i) => {
      const p = PRODUCTOS.find(x => x.id == l.id) || {};
      const opts = tallesPara(p).map(t => `<option value="${t}"${t === l.talle ? " selected" : ""}>${t}</option>`).join("");
      return `<div class="item">
        <img src="${p.imagen || ''}">
        <div style="flex:1">
          <div>${p.nombre || ''}</div>
          <small>$${fmt(p.precio || 0)} c/u</small>
          <select onchange="setTalle(${i},this.value)">${opts}</select>
          <div><button onclick="cambiar(${i},-1)">-</button> ${l.cant} <button onclick="cambiar(${i},1)">+</button></div>
        </div>
        <button onclick="quitar(${i})">✕</button>
      </div>`;
    }).join("") : "Tu carrito está vacío";
  }
}

function toggleCart() {
  document.getElementById("cart-drawer").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function openCart() {
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("overlay").classList.add("show");
}
function toggleMenu() { document.getElementById("side-menu")?.classList.toggle("open"); }
function closeMenu() { document.getElementById("side-menu")?.classList.remove("open"); }

function enviarWhatsApp() {
  if (!carrito.length) return alert("Tu carrito está vacío");
  const nombre = document.getElementById("nombre")?.value || "Sin nombre";
  const sub = total();

  const lineas = [`Hola Dr1p.tm! Soy ${nombre}, quiero comprar:`, ""];
  for (const l of carrito) {
    const p = PRODUCTOS.find(x => x.id == l.id);
    lineas.push(`- ${p.nombre} (${l.talle}) x${l.cant} = $${fmt(p.precio * l.cant)}`);
  }
  lineas.push("", `Total: $${fmt(sub)}`);
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(lineas.join("\n"))}`, "_blank");
}

function init() {
  fetch("./productos.json")
    .then(r => r.json())
    .then(data => {
      PRODUCTOS = data;
      mostrarCarrito();
      renderFiltros();
      if (window.Router) window.Router.refrescar(false);
      else if (typeof window.filtrar === "function") window.filtrar(filtroActual);
      initPanelFiltros();
    })
    .catch(err => console.log("Error cargando productos:", err));

  const search = document.getElementById("nav-search");
  if (search) search.addEventListener("input", e => {
    busqueda = e.target.value;
    if (typeof window.filtrar === "function") window.filtrar(filtroActual);
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
  });
}

init();
