let PRODUCTOS = [];
let WHATSAPP_NUMERO = "5492993244379";
let carrito = []; // líneas independientes: [{ id, talle, cant }]
let filtroActual = "todos";
let busqueda = ""; // buscador del header (filtra en vivo, sin recargar)
let cuponAplicado = null; // { codigo, premio: "A"|"B" }

const fmt = n => n.toLocaleString("es-AR");

// ---------------------------------------------------------------------
// CATÁLOGO: de dónde se lee productos.json
// Se prueba cada URL en orden y gana la primera que devuelve un catálogo válido.
//   1) /api/productos  → backend Node (si está corriendo; stock/precios en vivo)
//   2) productos.json  → junto al index.html (raíz o carpeta frontend/)
//   3) el resto        → ubicaciones alternativas habituales
// pedidos.json y aplicar-aumento.js NO se leen desde el navegador: el primero
// son pedidos de clientes y el segundo es un script de Node.
// ---------------------------------------------------------------------
const CATALOGO_URLS = [
  "/api/productos",
  "productos.json",
  "frontend/productos.json",
  "../productos.json",
  "/productos.json",
  "/frontend/productos.json"
];
let FUENTE_CATALOGO = "";

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ESC[c]);

// Normaliza cada producto para que un campo faltante en el JSON no rompa la UI
function normalizarProducto(p) {
  return Object.assign({}, p, {
    id: Number(p.id),
    nombre: String(p.nombre || "Producto"),
    marca: p.marca || "",
    categoria: String(p.categoria || "").toLowerCase(),
    precio: Number(p.precio) || 0,
    stock: Math.max(0, Number(p.stock) || 0),
    imagen: encodeURI(p.imagen || ""),
    imagenes: Array.isArray(p.imagenes) ? p.imagenes.map(x => encodeURI(x)) : (p.imagen ? [encodeURI(p.imagen)] : [])
  });
}

async function cargarCatalogo() {
  const errores = [];
  for (const url of CATALOGO_URLS) {
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) { errores.push(url + " → HTTP " + r.status); continue; }
      const data = await r.json();
      const lista = Array.isArray(data) ? data : (data && data.productos);
      if (!Array.isArray(lista)) { errores.push(url + " → formato inesperado"); continue; }
      const productos = lista.map(normalizarProducto).filter(p => Number.isFinite(p.id) && p.precio > 0);
      if (!productos.length) { errores.push(url + " → catálogo vacío"); continue; }
      FUENTE_CATALOGO = url;
      return productos;
    } catch (e) {
      errores.push(url + " → " + e.message);
    }
  }
  throw new Error("No se pudo cargar el catálogo:\n" + errores.join("\n"));
}

// Config del servidor (número de WhatsApp). En sitio estático no existe /api/config.
async function cargarConfig() {
  if (!FUENTE_CATALOGO.startsWith("/api/")) return;
  try {
    const r = await fetch("/api/config");
    if (r.ok) WHATSAPP_NUMERO = (await r.json()).whatsapp || WHATSAPP_NUMERO;
  } catch (e) { /* queda el número por defecto */ }
}

function mostrarErrorCatalogo() {
  const box = document.getElementById("productos");
  if (!box) return;
  box.innerHTML = `<div class="grid-msg" role="alert">
    <p>No pudimos cargar el catálogo. Revisá tu conexión y reintentá.</p>
    <button type="button" class="btn-dark" onclick="location.reload()">REINTENTAR</button>
    <a class="btn-dark" href="${wspUrl("Hola DR1P, no me carga el catálogo")}" target="_blank" rel="noopener noreferrer">ESCRIBIR POR WHATSAPP</a>
  </div>`;
}

// Imagen de reemplazo si la URL del producto falla (CDN caído, link roto)
const IMG_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#0a0a0a"/>' +
  '<text x="200" y="212" fill="#8e939a" font-family="monospace" font-size="30" text-anchor="middle">DR1P</text></svg>');
function imgFallback(img) { img.onerror = null; img.src = IMG_FALLBACK; }

// WhatsApp: el acceso flotante apunta al producto que se está viendo
function wspUrl(texto) {
  return "https://wa.me/" + WHATSAPP_NUMERO + "?text=" + encodeURIComponent(texto);
}
function actualizarWsp(texto) {
  const a = document.getElementById("wsp-fab");
  if (a) a.href = wspUrl(texto || "Hola DR1P, quería consultar por un producto");
}

function stockTexto(p) {
  if (p.stock <= 0) return "AGOTADO";
  if (p.stock === 1) return "¡Último en stock!";
  return "¡Solo quedan " + p.stock + " en stock!";
}
function fotosDe(p) {
  return Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : [p.imagen];
}

// Card única (catálogo y similares). Imagen y título son enlaces reales a ?prod=ID:
// funcionan con teclado, clic medio y se pueden compartir.
function cardHTML(p, opts) {
  const conStock = !opts || opts.mostrarStock !== false;
  const sinStock = p.stock <= 0;
  const nombre = esc(nombreLimpio(p.nombre));
  const go = `href="?prod=${p.id}" onclick="Router.irProd(${p.id});return false;"`;
  return `
    <div class="card">
      <a class="card-media" ${go} tabindex="-1" aria-hidden="true">
        <img src="${esc(p.imagen)}" alt="" loading="lazy" onerror="imgFallback(this)">
      </a>
      <div class="card-body">
        <h3><a ${go}>${nombre}</a></h3>
        <span class="price">$${fmt(p.precio)},00</span>
        ${conStock ? `<span class="stock${sinStock ? " agotado" : ""}">${stockTexto(p)}</span>` : ""}
        <button type="button" onclick="agregar(${p.id})"${sinStock ? " disabled" : ""}>${sinStock ? "AGOTADO" : "CONSEGUIR DR1P"}</button>
      </div>
    </div>`;
}

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
  document.querySelectorAll("#panel-filtros input[type=checkbox]").forEach(ch =>
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

// Panel de filtros: sidebar en desktop, drawer en móvil
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

  limpiar.addEventListener("click", () => {
    limpiarFiltros();
  });

  aplicar.addEventListener("click", () => {
    cerrarPanel();
    mostrarProductos();
  });
}

// Limpia el buscador (lo usa Router.catalogo antes de mostrar todo)
function limpiarBusqueda() {
  busqueda = "";
  if (typeof window.filtrar === "function") window.filtrar(filtroActual);
}

function mostrarProductos() {
  document.getElementById("productos").innerHTML = listaFiltrada().map(p => cardHTML(p)).join("") ||
    '<p class="grid-msg">Sin productos con esos filtros. Probá limpiar el sidebar.</p>';
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
  if (!p || p.stock <= 0) return;
  agregarCantidad(id, talleDefault(p), 1);
  openCart();
  // Enganchar animación GSAP (no toca la lógica del carrito)
  document.dispatchEvent(new CustomEvent("dr1p:cart-add"));
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
  if (!on) actualizarWsp();
  // En PDP solo quedan header + ficha (+contacto/footer): se oculta hero,
  // marquesina y secciones de tienda
  ["hero", "marquee", "categorias", "catalogo", "probarte", "contacto"].forEach(id => {
    const s = document.getElementById(id);
    if (s) s.style.display = on ? "none" : "";
  });
}

function mostrarProducto(id) {
  const p = PRODUCTOS.find(x => x.id == id);
  if (!p) {
    // ?prod= con un id que no existe en productos.json → catálogo, con la URL limpia
    vistaProductoVisible(false);
    try { history.replaceState(null, "", location.pathname + (filtroActual !== "todos" ? "?cat=" + filtroActual : "")); } catch (e) {}
    return;
  }
  pdId = p.id; pdCant = 1;
  const fotos = fotosDe(p); // galería: p.imagenes (opcional en el JSON) o la foto principal
  const img = document.getElementById("pd-img");
  img.onerror = () => imgFallback(img);
  img.src = fotos[0];
  img.alt = nombreLimpio(p.nombre);
  const thumbs = document.getElementById("pd-thumbs");
  thumbs.style.display = fotos.length > 1 ? "" : "none"; // con 1 sola foto la tira sobra
  thumbs.innerHTML = fotos.map((f, i) =>
    `<button type="button" class="pd-thumb" aria-label="Ver foto ${i + 1}" onclick="pdFoto(${i})"><img src="${esc(f)}" alt="" class="${i === 0 ? "sel" : ""}"></button>`).join("");
  document.getElementById("pd-cat").textContent = "[ " + (p.categoria || "").toUpperCase() + " ]";
  document.getElementById("pd-nombre").textContent = nombreLimpio(p.nombre);
  document.getElementById("pd-precio").textContent = "$" + fmt(p.precio);
  document.getElementById("pd-stock").textContent = stockTexto(p);
  const add = document.getElementById("pd-add");
  if (add) { add.disabled = p.stock <= 0; add.textContent = p.stock <= 0 ? "AGOTADO" : "AGREGAR AL CARRITO"; }
  actualizarWsp("Hola DR1P, quería consultar por: " + p.nombre);
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
  document.getElementById("pd-similares").innerHTML = sim.map(s => cardHTML(s, { mostrarStock: false })).join("") ||
    '<p class="grid-msg">Sin similares por ahora</p>';
  vistaProductoVisible(true);
  // Enganchar animación GSAP para la ficha de producto
  document.dispatchEvent(new CustomEvent("dr1p:pdp-open"));
}

function pdFoto(i) {
  const p = PRODUCTOS.find(x => x.id == pdId);
  if (!p) return;
  const fotos = fotosDe(p);
  document.getElementById("pd-img").src = fotos[i] || fotos[0];
  document.querySelectorAll("#pd-thumbs img").forEach((t, j) =>
    t.classList.toggle("sel", j === i));
}

function pdQty(d) {
  const p = PRODUCTOS.find(x => x.id == pdId);
  if (!p) return;
  pdCant = Math.min(Math.max(p.stock, 1), Math.max(1, pdCant + d));
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
      <img src="${esc(p.imagen)}" alt="" onerror="imgFallback(this)">
      <div style="flex:1">
        <div>${esc(p.nombre)}</div>
        <small>$${fmt(p.precio)} c/u</small>
        <select aria-label="Talle" onchange="setTalle(${i},this.value)">${opts}</select>
        <div class="item-qty">
          <button type="button" aria-label="Restar una unidad" onclick="cambiar(${i},-1)">−</button>
          <span>${l.cant}</span>
          <button type="button" aria-label="Sumar una unidad" onclick="cambiar(${i},1)">+</button>
        </div>
      </div>
      <button type="button" class="item-del" aria-label="Quitar del carrito" onclick="quitar(${i})">✕</button>
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

  // Registro del pedido en el servidor. Si no hay servidor (sitio estático: 404/405/501
  // o red caída) NO se bloquea la venta: el pedido igual sale por WhatsApp.
  const SIN_API = [404, 405, 501];
  try {
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
    if (!r.ok && SIN_API.indexOf(r.status) < 0) {
      // Cupón inválido/usado al momento del pedido → se limpia y no se envía
      cuponAplicado = null;
      mostrarCarrito();
      alert("El cupón ya no es válido (usado o inexistente). Se quitó del pedido.");
      return;
    }
  } catch (e) {
    console.warn("Pedido sin registrar (sin servidor):", e);
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

async function init() {
  // El buscador se conecta primero: existe aunque el catálogo tarde o falle.
  // (en vivo, no toca la URL ni el historial)
  const search = document.getElementById("nav-search");
  if (search) search.addEventListener("input", e => {
    busqueda = e.target.value;
    if (typeof window.filtrar === "function") window.filtrar(filtroActual);
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
  });

  try {
    PRODUCTOS = await cargarCatalogo();
  } catch (err) {
    console.error(err.message);
    mostrarErrorCatalogo();
    return;
  }
  await cargarConfig();
  actualizarWsp();

  // hidrata datos y delega la ruta inicial al Router (?cat= / ?prod=)
  try {
    const q = new URLSearchParams(location.search).get("cat");
    if (q && ["todos", "remeras", "pantalones", "gorras"].includes(q)) filtroActual = q;
  } catch (e) {}
  mostrarCarrito();
  renderFiltros(); // construye el sidebar con los datos reales
  window.__datosOK = true;
  if (window.Router) window.Router.refrescar(false);
  else if (typeof window.filtrar === "function") window.filtrar(filtroActual);
  initPanelFiltros(); // panel de filtros (desktop sidebar / móvil drawer)
}

init();
