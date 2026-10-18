let PRODUCTOS = [];
let WHATSAPP_NUMERO = "5492993244379";
let carrito = []; // líneas independientes: [{ id, talle, cant }]
let filtroActual = "todos";
let busqueda = ""; // buscador del header (filtra en vivo, sin recargar)
let cuponAplicado = null; // { codigo, premio: "A"|"B" }
const DROP_DATE = new Date("2026-12-01T20:00:00-03:00").getTime(); // [03] DROP 003 = hoy + 50 días

const fmt = n => n.toLocaleString("es-AR");

// Nombres limpios para vidriera: quita "(M-XL)" o cualquier rango entre paréntesis.
// En carrito y WhatsApp se conserva el nombre completo para identificar la prenda.
function nombreLimpio(n) { return (n || "").replace(/\s*\([^)]*\)\s*/g, "").trim(); }

function filtrar(cat) {
  filtroActual = cat;
  // El sidebar refleja la categoría del router (el usuario puede sumar más)
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

// ---- Panel lateral de filtros (categoría / talle / marca / precio) ----
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
  document.getElementById("f-cats").innerHTML = cats.map(c =>
    checkRow("cats", c, c.toUpperCase(), `<small>(${n(p => (p.categoria || "").toLowerCase() === c)})</small>`)).join("");
  document.getElementById("f-talles").innerHTML = talles.map(t => checkRow("talles", t, t)).join("");
  document.getElementById("f-marcas").innerHTML = marcas.map(m =>
    checkRow("marcas", m, m, `<small>(${n(p => p.marca === m)})</small>`)).join("");
  document.getElementById("f-min").value = filtros.min;
  document.getElementById("f-max").value = filtros.max;
  document.querySelectorAll(".filters-side input[type=checkbox]").forEach(ch =>
    ch.onchange = () => {
      const set = filtros[ch.dataset.grupo];
      ch.checked ? set.add(ch.value) : set.delete(ch.value);
      mostrarProductos();
    });
  document.getElementById("f-min").oninput = e => { filtros.min = e.target.value; mostrarProductos(); };
  document.getElementById("f-max").oninput = e => { filtros.max = e.target.value; mostrarProductos(); };
}

function limpiarFiltros() {
  filtros = { cats: new Set(), talles: new Set(), marcas: new Set(), min: "", max: "" };
  renderFiltros();
  Router.ir("todos", false);
  document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
}

// Botón FILTROS colapsable (sidebar izquierdo)
function initFiltrosToggle() {
  const btn = document.getElementById("filters-toggle");
  const panel = document.getElementById("filters-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
}

// Limpia el buscador (lo usa Router.catalogo antes de mostrar todo)
function limpiarBusqueda() {
  busqueda = "";
  if (typeof window.filtrar === "function") window.filtrar(filtroActual);
}

function mostrarProductos() {
  document.getElementById("productos").innerHTML = listaFiltrada().map(p => `
    <div class="card">
      <img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onclick="Router.irProd(${p.id})" style="cursor:pointer">
      <div class="card-body">
        <h3 onclick="Router.irProd(${p.id})" style="cursor:pointer">${nombreLimpio(p.nombre)}</h3>
        <span class="price">$${fmt(p.precio)},00</span>
        <span class="stock">¡Solo quedan ${p.stock} en stock!</span>
        <button onclick="agregar(${p.id})">CONSEGUIR DR1P</button>
      </div>
    </div>`).join("") || "Sin productos con esos filtros. Probá limpiar el sidebar.";
}

// Talles: si el producto trae `talles` propios se usan esos;
// sino, aislados por categoría (gorras solo Único, el resto S–XXL)
function tallesPara(p) {
  if (Array.isArray(p.talles) && p.talles.length) return p.talles;
  return (p.categoria || "").toLowerCase() === "gorras"
    ? ["Único / 7 3/8"]
    : ["S", "M", "L", "XL", "XXL"];
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

// Agrega N unidades con talle elegido (usado por la vista individual)
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
  return carrito.filter(l => l.id == id && (!talle || l.talle === talle))
    .reduce((a, l) => a + l.cant, 0);
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

// ---- Vista individual de producto (ruta ?prod=ID) ----
let pdId = null, pdCant = 1;

const DESC_CAT = {
  remeras: "calce oversize que cae perfecto",
  pantalones: "calce baggy cómodo para todos los días",
  gorras: "ajuste fitted que se adapta a tu cabeza"
};
function descripcionProd(p) {
  const cat = (p.categoria || "").toLowerCase();
  const tela = cat === "gorras" ? "materiales premium de alta durabilidad"
    : "tela suave que garantiza confort y durabilidad";
  return `Elegí ${nombreLimpio(p.nombre)}, una prenda de máxima calidad confeccionada con ${tela}, con ${DESC_CAT[cat] || "calce pensado para el día a día"}. Stock limitado: ¡solo quedan ${p.stock} unidades!`;
}

function vistaProductoVisible(on) {
  document.getElementById("producto").style.display = on ? "" : "none";
  // En PDP solo quedan header + ficha (+contacto/footer): se oculta hero,
  // marquesina y secciones de tienda
  ["hero", "marquee", "categorias", "catalogo", "drop", "probarte", "contacto"].forEach(id => {
    const s = document.getElementById(id);
    if (s) s.style.display = on ? "none" : "";
  });
}

function mostrarProducto(id) {
  const p = PRODUCTOS.find(x => x.id == id);
  if (!p) { vistaProductoVisible(false); return; }
  pdId = id; pdCant = 1;
  const fotos = [p.imagen]; // galería: fotos del producto
  document.getElementById("pd-img").src = fotos[0];
  document.getElementById("pd-img").alt = p.nombre;
  document.getElementById("pd-thumbs").innerHTML = fotos.map((f, i) =>
    `<img src="${f}" class="${i === 0 ? "sel" : ""}" onclick="pdFoto(${i})">`).join("");
  document.getElementById("pd-cat").textContent = "[ " + (p.categoria || "").toUpperCase() + " ]";
  document.getElementById("pd-nombre").textContent = nombreLimpio(p.nombre);
  document.getElementById("pd-precio").textContent = "$" + fmt(p.precio);
  document.getElementById("pd-stock").textContent = "¡Solo quedan " + p.stock + " en stock!";
  document.getElementById("pd-talle").innerHTML =
    tallesPara(p).map(t => `<option>${t}</option>`).join("");
  // Color: selector solo si el producto trae opciones, sino texto fijo
  const colores = p.colores || [];
  document.getElementById("pd-color-sel").style.display = colores.length > 1 ? "" : "none";
  document.getElementById("pd-color-fijo").style.display = colores.length > 1 ? "none" : "";
  if (colores.length > 1) {
    document.getElementById("pd-color-sel").innerHTML =
      colores.map(c => `<option>${c}</option>`).join("");
  } else {
    document.getElementById("pd-color-fijo").textContent = colores[0] || "Color de foto";
  }
  document.getElementById("pd-cant").textContent = "1";
  document.getElementById("pd-desc").textContent = descripcionProd(p);
  // Similares: misma categoría, sin el actual
  const sim = PRODUCTOS.filter(x => x.id != id && (x.categoria || "") === (p.categoria || "")).slice(0, 4);
  document.getElementById("pd-similares").innerHTML = sim.map(s => `
    <div class="card">
      <img src="${s.imagen}" alt="${s.nombre}" loading="lazy" onclick="Router.irProd(${s.id})" style="cursor:pointer">
      <div class="card-body">
        <h3 onclick="Router.irProd(${s.id})" style="cursor:pointer">${nombreLimpio(s.nombre)}</h3>
        <span class="price">$${fmt(s.precio)},00</span>
        <button onclick="agregar(${s.id})">CONSEGUIR DR1P</button>
      </div>
    </div>`).join("") || "Sin similares por ahora";
  vistaProductoVisible(true);
}

function pdFoto(i) {
  const p = PRODUCTOS.find(x => x.id == pdId);
  if (!p) return;
  document.getElementById("pd-img").src = [p.imagen][i] || p.imagen;
  document.querySelectorAll("#pd-thumbs img").forEach((t, j) =>
    t.classList.toggle("sel", j === i));
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
  const otra = carrito.find((o, j) => j !== i && o.id == l.id && o.talle === nuevoTalle);
  if (otra) {
    const p = PRODUCTOS.find(x => x.id == l.id);
    if (otra.cant + l.cant > p.stock) return alert("No hay más stock.");
    otra.cant += l.cant;
    carrito.splice(i, 1);
  } else {
    l.talle = nuevoTalle;
  }
  mostrarCarrito();
}

function total() {
  return carrito.reduce((a, l) => {
    const p = PRODUCTOS.find(x => x.id == l.id);
    return a + p.precio * l.cant;
  }, 0);
}

// Descuento según cupón de ruleta: % OFF o $5.000 fijos (tope: subtotal)
const PCT = { "10OFF": 0.10, "15OFF": 0.15, "20OFF": 0.20, "A": 0.20 };
function descuento() {
  if (!cuponAplicado) return 0;
  const sub = total();
  if (cuponAplicado.premio in PCT) return Math.round(sub * PCT[cuponAplicado.premio]);
  return Math.min(5000, sub); // "5000" / "B"
}
function totalFinal() { return total() - descuento(); }

const CUPON_TXT = {
  "10OFF": "✓ Cupón 10% OFF aplicado",
  "15OFF": "✓ Cupón 15% OFF aplicado",
  "20OFF": "✓ Cupón 20% OFF aplicado",
  "A": "✓ Cupón 20% OFF aplicado",
  "5000": "✓ Cupón $5.000 aplicado",
  "B": "✓ Cupón $5.000 aplicado"
};

// REGLA: 1 solo cupón por carrito. Aplicar uno nuevo REEMPLAZA al anterior,
// nunca se suman. Input vacío + Aplicar (o botón ✕) quita el cupón.
async function aplicarCupon() {
  const input = document.getElementById("cupon");
  const msg = document.getElementById("cupon-msg");
  const codigo = (input.value || "").trim().toUpperCase();
  if (!codigo) { quitarCupon(); return; }
  const previo = cuponAplicado ? cuponAplicado.codigo : null;
  try {
    const r = await fetch("/api/validar-cupon?codigo=" + encodeURIComponent(codigo));
    const data = await r.json();
    if (data.ok) {
      cuponAplicado = { codigo, premio: data.premio }; // reemplazo, no suma
      msg.style.display = "block";
      msg.textContent = (CUPON_TXT[data.premio] || "✓ Cupón aplicado") +
        (previo && previo !== codigo ? " (reemplaza a " + previo + ")" : "");
    } else {
      cuponAplicado = null;
      msg.style.display = "block";
      msg.textContent = data.motivo === "usado" ? "✕ Cupón ya usado" : "✕ Cupón inválido";
    }
  } catch {
    cuponAplicado = null;
    msg.style.display = "block";
    msg.textContent = "✕ No se pudo validar el cupón";
  }
  mostrarCarrito();
}

function quitarCupon() {
  cuponAplicado = null;
  document.getElementById("cupon").value = "";
  const msg = document.getElementById("cupon-msg");
  msg.style.display = "block";
  msg.textContent = "Cupón quitado";
  mostrarCarrito();
}

function mostrarCarrito() {
  const count = carrito.reduce((a, l) => a + l.cant, 0);
  document.getElementById("count").textContent = count;
  document.getElementById("total").textContent = fmt(total());
  const desc = descuento();
  document.getElementById("descuento-line").style.display = desc ? "block" : "none";
  document.getElementById("descuento").textContent = fmt(desc);
  document.getElementById("total-final").textContent = fmt(totalFinal());
  document.getElementById("carrito").innerHTML = carrito.length ? carrito.map((l, i) => {
    const p = PRODUCTOS.find(x => x.id == l.id);
    const opts = tallesPara(p).map(t =>
      `<option value="${t}"${t === l.talle ? " selected" : ""}>${t}</option>`).join("");
    return `<div class="item">
      <img src="${p.imagen}">
      <div style="flex:1">
        <div>${p.nombre}</div>
        <small>$${fmt(p.precio)} c/u</small>
        <select onchange="setTalle(${i},this.value)">${opts}</select>
        <div>
          <button onclick="cambiar(${i},-1)">-</button>
          ${l.cant}
          <button onclick="cambiar(${i},1)">+</button>
        </div>
      </div>
      <button onclick="quitar(${i})">✕</button>
    </div>`;
  }).join("") : "Tu carrito está vacío";
}

function toggleCart() {
  document.getElementById("cart-drawer").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("show");
}
function openCart() {
  document.getElementById("cart-drawer").classList.add("open");
  document.getElementById("overlay").classList.add("show");
}
function toggleMenu() {
  const m = document.getElementById("side-menu");
  if (m) m.classList.toggle("open");
}
function closeMenu() {
  const m = document.getElementById("side-menu");
  if (m) m.classList.remove("open");
}

async function enviarWhatsApp() {
  if (!carrito.length) return alert("Tu carrito está vacío");
  const nombre = document.getElementById("nombre").value || "Sin nombre";
  const sub = total(), desc = descuento(), tot = totalFinal();

  const r = await fetch("/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre,
      items: carrito.map(l => {
        const p = PRODUCTOS.find(x => x.id == l.id);
        return { id: l.id, nombre: p.nombre, talle: l.talle, cant: l.cant, precio: p.precio };
      }),
      cupon: cuponAplicado // el servidor revalida y recalcula (no confía en estos totales)
    }),
  });
  if (!r.ok) {
    // Cupón inválido/usado al momento del pedido → se limpia y no se envía
    cuponAplicado = null;
    mostrarCarrito();
    alert("El cupón ya no es válido (usado o inexistente). Se quitó del pedido.");
    return;
  }

  const lineas = [`Hola Dr1p.tm! Soy ${nombre}, quiero comprar:`, ""];
  for (const l of carrito) {
    const p = PRODUCTOS.find(x => x.id == l.id);
    lineas.push(`- ${p.nombre} (${l.talle}) x${l.cant} = $${fmt(p.precio * l.cant)}`);
  }
  lineas.push("", `Subtotal: $${fmt(sub)}`);
  if (cuponAplicado) lineas.push(`Cupón ${cuponAplicado.codigo}: -$${fmt(desc)}`);
  lineas.push(`Total: $${fmt(tot)}`);
  window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(lineas.join("\n"))}`, "_blank");
}

async function enviarContacto(e) {
  e.preventDefault();
  const data = {
    nombre: document.getElementById("c-nombre").value,
    email: document.getElementById("c-email").value,
    telefono: document.getElementById("c-tel").value,
    mensaje: document.getElementById("c-msg").value,
    website: document.querySelector('.contacto-form [name="website"]').value,
  };
  const r = await fetch("/api/contacto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (r.ok) {
    document.getElementById("c-ok").style.display = "block";
    e.target.reset();
  }
}

// ---- [03] Countdown del drop + suscripción early access ----
function tickCountdown() {
  const el = id => document.getElementById(id);
  if (!el("cd-d")) return;
  const diff = DROP_DATE - Date.now();
  if (diff <= 0) {
    document.querySelector(".drop-title").textContent = "DROP 003 — DISPONIBLE AHORA";
    ["cd-d", "cd-h", "cd-m", "cd-s"].forEach(id => el(id).textContent = "00");
    return;
  }
  const pad = n => String(n).padStart(2, "0");
  el("cd-d").textContent = pad(Math.floor(diff / 864e5));
  el("cd-h").textContent = pad(Math.floor(diff / 36e5) % 24);
  el("cd-m").textContent = pad(Math.floor(diff / 6e4) % 60);
  el("cd-s").textContent = pad(Math.floor(diff / 1e3) % 60);
}

function init() {
  // init hidrata datos y delega la ruta inicial al Router (?cat= / ?prod=)
  Promise.all([fetch("/api/productos"), fetch("/api/config")]).then(async ([pr, cfg]) => {
    PRODUCTOS = await pr.json();
    try { WHATSAPP_NUMERO = (await cfg.json()).whatsapp || WHATSAPP_NUMERO; } catch {}
    try {
      const q = new URLSearchParams(location.search).get("cat");
      if (q && ["todos", "remeras", "pantalones", "gorras"].includes(q)) filtroActual = q;
    } catch {}
    mostrarCarrito();
    renderFiltros(); // construye el sidebar con los datos reales
    window.__datosOK = true;
    if (window.Router) window.Router.refrescar(false);
    else if (typeof window.filtrar === "function") window.filtrar(filtroActual);
    initFiltrosToggle(); // botón FILTROS colapsable
  });

  // Buscador en vivo (no toca la URL ni el historial)
  const search = document.getElementById("nav-search");
  if (search) search.addEventListener("input", e => {
    busqueda = e.target.value;
    if (typeof window.filtrar === "function") window.filtrar(filtroActual);
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
  });

  // Countdown + form del drop
  setInterval(tickCountdown, 1000); tickCountdown();
  const df = document.getElementById("drop-form");
  if (df) df.addEventListener("submit", e => {
    e.preventDefault();
    const email = document.getElementById("drop-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, premio: "DROP", cupon: "-" })
    }).catch(() => {});
    document.getElementById("drop-ok").hidden = false;
    e.target.reset();
  });
}

init();
