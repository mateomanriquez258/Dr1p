let PRODUCTOS = [];
let WHATSAPP_NUMERO = "5492993244379";
let carrito = []; // líneas independientes: [{ id, talle, cant }]
let filtroActual = "todos";
let busqueda = ""; // buscador del header (filtra en vivo, sin recargar)
let cuponAplicado = null; // { codigo, premio: "A"|"B" }
const DROP_DATE = new Date("2026-12-01T20:00:00-03:00").getTime(); // [03] DROP 003 = hoy + 50 días

const fmt = n => n.toLocaleString("es-AR");

function filtrar(cat) {
  filtroActual = cat;
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
    const okQ = !q || (p.nombre + " " + (p.categoria || "")).toLowerCase().includes(q);
    return okCat && okQ;
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
      <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
      <div class="card-body">
        <h3>${p.nombre}</h3>
        <span class="price">$${fmt(p.precio)},00</span>
        <span class="stock">¡Solo quedan ${p.stock} en stock!</span>
        <button onclick="agregar(${p.id})">CONSEGUIR DR1P</button>
      </div>
    </div>`).join("") || "Sin productos en esta categoría";
}

// Talles aislados por categoría: gorras solo Único, el resto M/L/XL
function tallesPara(p) {
  return (p.categoria || "").toLowerCase() === "gorras"
    ? ["Único / 7 3/8"]
    : ["M", "L", "XL"];
}
function talleDefault(p) {
  return (p.categoria || "").toLowerCase() === "gorras" ? "Único / 7 3/8" : "L";
}

function agregar(id) {
  const p = PRODUCTOS.find(x => x.id == id);
  const actual = lineasCarrito(id, talleDefault(p));
  if (actual + 1 > p.stock) return alert("No hay más stock de este producto.");
  // Misma prenda + mismo talle → suma cantidad; sino, línea independiente
  const linea = carrito.find(l => l.id == id && l.talle === talleDefault(p));
  if (linea) linea.cant++;
  else carrito.push({ id, talle: talleDefault(p), cant: 1 });
  mostrarCarrito();
  openCart();
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

// Talle individual por línea: si ya existe otra línea igual, se fusionan
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

// Descuento según cupón de ruleta: A=20% OFF, B=$5.000 fijos (tope: subtotal)
function descuento() {
  if (!cuponAplicado) return 0;
  const sub = total();
  if (cuponAplicado.premio === "A") return Math.round(sub * 0.20);
  return Math.min(5000, sub);
}
function totalFinal() { return total() - descuento(); }

async function aplicarCupon() {
  const input = document.getElementById("cupon");
  const msg = document.getElementById("cupon-msg");
  const codigo = (input.value || "").trim().toUpperCase();
  if (!codigo) return;
  try {
    const r = await fetch("/api/validar-cupon?codigo=" + encodeURIComponent(codigo));
    const data = await r.json();
    if (data.ok) {
      cuponAplicado = { codigo, premio: data.premio };
      msg.style.display = "block";
      msg.textContent = data.premio === "A" ? "✓ Cupón 20% OFF aplicado" : "✓ Cupón $5.000 aplicado";
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

  await fetch("/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre,
      items: carrito.map(l => {
        const p = PRODUCTOS.find(x => x.id == l.id);
        return { id: l.id, nombre: p.nombre, talle: l.talle, cant: l.cant, precio: p.precio };
      }),
      subtotal: sub, cupon: cuponAplicado, descuento: desc, total: tot
    }),
  });

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
  // La ruta inicial (?cat=) la aplica Router (replaceState, sin scroll).
  // init solo hidrata datos; el filtrado lo dispara Router o este init.
  Promise.all([fetch("/api/productos"), fetch("/api/config")]).then(async ([pr, cfg]) => {
    PRODUCTOS = await pr.json();
    try { WHATSAPP_NUMERO = (await cfg.json()).whatsapp || WHATSAPP_NUMERO; } catch {}
    try {
      const q = new URLSearchParams(location.search).get("cat");
      if (q && ["todos", "remeras", "pantalones", "gorras"].includes(q)) filtroActual = q;
    } catch {}
    mostrarCarrito();
    if (typeof window.filtrar === "function") window.filtrar(filtroActual);
    if (window.Router) {
      const t = { todos: "[ CATÁLOGO // TODOS ]", remeras: "[ CATÁLOGO // REMERAS ]", pantalones: "[ CATÁLOGO // PANTALONES ]", gorras: "[ CATÁLOGO // GORRAS ]" };
      document.getElementById("titulo-categoria").textContent = t[filtroActual];
      document.querySelectorAll("[data-cat]").forEach(a =>
        a.classList.toggle("active", a.getAttribute("data-cat") === filtroActual));
    }
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
