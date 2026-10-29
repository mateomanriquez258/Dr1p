import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");
const PRODUCTOS_FILE = path.join(__dirname, "productos.json");
const PEDIDOS_FILE = path.join(__dirname, "pedidos.json");
const CONTACTOS_FILE = path.join(__dirname, "contactos.json");
const LEADS_FILE = path.join(__dirname, "leads.json");
const GIROS_FILE = path.join(__dirname, "giros.json");

const WHATSAPP_NUMERO = "5492993244379";
const PORT = process.env.PORT || 3000; // Render inyecta PORT; local usa 3000
// Acepta los cupones históricos de 4 caracteres y los nuevos de 8.
const CUPON_RE = /^DR1P-(10OFF|15OFF|20OFF|5000)-(?:[A-Z0-9]{4}|[A-Z0-9]{8})$/;
const ALFABETO_CUPON = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODIGOS_POR_PREMIO = 125_000;
const SEGMENTOS_RUEDA = ["10OFF", "NONE", "15OFF", "NONE", "20OFF", "5000"];
const PESOS_RUEDA = [40, 5, 35, 5, 20, 40];
let colaPedidos = Promise.resolve();

function encolarPedido(tarea) {
  const siguiente = colaPedidos.then(tarea, tarea);
  colaPedidos = siguiente.catch(() => {});
  return siguiente;
}

const VIDA_CUPON_MS = 24 * 60 * 60 * 1000;
function expiraCuponEn(lead) {
  const fechaExpiracion = Date.parse(lead.expiraEn || lead.expira_en || "");
  if (Number.isFinite(fechaExpiracion)) return fechaExpiracion;
  const fechaEmision = Date.parse(lead.fecha || "");
  return Number.isFinite(fechaEmision) ? fechaEmision + VIDA_CUPON_MS : 0;
}
function cuponVigente(lead, ahora = Date.now()) {
  return !!lead && !lead.usado && expiraCuponEn(lead) > ahora;
}
function limpiarCuponesVencidos(leads, ahora = Date.now()) {
  return leads.filter(lead => (lead.cupon || "-") !== "-" && expiraCuponEn(lead) > ahora);
}
function hashEmail(email) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
function sortearSegmento() {
  const elegido = randomInt(PESOS_RUEDA.reduce((suma, peso) => suma + peso, 0));
  let acumulado = 0;
  for (let i = 0; i < PESOS_RUEDA.length; i++) {
    acumulado += PESOS_RUEDA[i];
    if (elegido < acumulado) return i;
  }
  return PESOS_RUEDA.length - 1;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function leerBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // --- API: listar productos ---
  if (url.pathname === "/api/productos" && req.method === "GET") {
    const data = await fs.readFile(PRODUCTOS_FILE, "utf-8");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(data);
  }

  // --- API: config (numero wsp) ---
  if (url.pathname === "/api/config" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ whatsapp: WHATSAPP_NUMERO }));
  }

  // --- API: guardar pedido (1 cupón, revalidado y recalculado en servidor) ---
  // REGLA: un solo cupón por orden. El servidor IGNORA los totales del
  // cliente: recalcula subtotal con precios propios y aplica UN cupón
  // válido y sin usar. Cupón inválido/usado → 400, pedido NO guardado.
  if (url.pathname === "/api/pedidos" && req.method === "POST") {
    return encolarPedido(async () => {
      try {
      const body = await leerBody(req);
      if (Array.isArray(body.cupon)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Solo se permite un cupón por pedido" }));
      }
      const catalogo = JSON.parse(await fs.readFile(PRODUCTOS_FILE, "utf-8"));
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Carrito vacío" }));
      }
      // Subtotal con precios del servidor (no los del cliente)
      let subtotal = 0;
      const itemsOk = [];
      for (const it of items) {
        const p = catalogo.find(x => x.id == it.id);
        const cant = parseInt(it.cant, 10);
        if (!p || !(cant > 0)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "Ítem inválido" }));
        }
        subtotal += p.precio * cant;
        itemsOk.push({ id: p.id, nombre: p.nombre, talle: it.talle || "-", cant, precio: p.precio });
      }
      // Un solo cupón: se revalida contra leads (existe + no usado)
      let cupon = null, descuento = 0;
      const cod = (body.cupon && body.cupon.codigo || "").toUpperCase();
      if (cod) {
        let leads = JSON.parse(await fs.readFile(LEADS_FILE, "utf-8").catch(() => "[]"));
        const ahora = Date.now();
        const leadOriginal = leads.find(l => (l.cupon || "").toUpperCase() === cod);
        const vigente = cuponVigente(leadOriginal, ahora);
        const cantidadOriginal = leads.length;
        leads = limpiarCuponesVencidos(leads, ahora);
        const lead = leads.find(l => (l.cupon || "").toUpperCase() === cod);
        if (!CUPON_RE.test(cod) || !lead || !vigente) {
          if (leads.length !== cantidadOriginal || leadOriginal) {
            await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
          }
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: vigente ? "cupon_invalido" : "cupon_expirado_o_usado" }));
        }
        const PCT_SRV = { "10OFF": 0.10, "15OFF": 0.15, "20OFF": 0.20, "A": 0.20 };
        descuento = (lead.premio in PCT_SRV)
          ? Math.round(subtotal * PCT_SRV[lead.premio])
          : Math.min(5000, subtotal);
        cupon = { codigo: cod, premio: lead.premio };
        lead.usado = true; // quemado: un solo uso
        lead.usadoEn = new Date().toISOString();
        await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
      }
      const pedido = {
        nombre: body.nombre || "Sin nombre",
        items: itemsOk,
        subtotal, cupon, descuento,
        total: subtotal - descuento,
        fecha: new Date().toISOString()
      };
      if (cupon) pedido.cupon.usadoEn = pedido.fecha;
      let pedidos = [];
      try {
        pedidos = JSON.parse(await fs.readFile(PEDIDOS_FILE, "utf-8"));
      } catch { /* archivo no existe aun */ }
      pedidos.push(pedido);
      await fs.writeFile(PEDIDOS_FILE, JSON.stringify(pedidos, null, 2));
      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, total: pedido.total, descuento }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Pedido invalido" }));
      }
    });
  }

  // --- API: guardar contacto ---
  if (url.pathname === "/api/contacto" && req.method === "POST") {
    try {
      const msg = await leerBody(req);
      if (msg.website) { // honeypot anti-spam
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true }));
      }
      let contactos = [];
      try {
        contactos = JSON.parse(await fs.readFile(CONTACTOS_FILE, "utf-8"));
      } catch {}
      msg.fecha = new Date().toISOString();
      contactos.push(msg);
      await fs.writeFile(CONTACTOS_FILE, JSON.stringify(contactos, null, 2));
      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false }));
    }
  }

  // --- API: validar cupón (estricto + un solo uso) ---
  // Solo valen cupones generados por el servidor y no quemados.
  // Prefijos válidos: 10OFF | 15OFF | 20OFF | 5000 (+ A/B históricos).
  if (url.pathname === "/api/validar-cupon" && req.method === "GET") {
    const codigo = (url.searchParams.get("codigo") || "").trim().toUpperCase();
    let r = { ok: false, motivo: "invalido" };
    if (CUPON_RE.test(codigo)) {
      try {
        let leads = JSON.parse(await fs.readFile(LEADS_FILE, "utf-8"));
        const ahora = Date.now();
        const original = leads.find(l => (l.cupon || "").toUpperCase() === codigo);
        const vigente = cuponVigente(original, ahora);
        const cantidadOriginal = leads.length;
        leads = limpiarCuponesVencidos(leads, ahora);
        if (leads.length !== cantidadOriginal) {
          await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
        }
        if (original && !vigente && expiraCuponEn(original) <= ahora) r = { ok: false, motivo: "expirado" };
        else if (!vigente) r = { ok: false, motivo: original?.usado ? "usado" : "invalido" };
        else r = { ok: true, premio: original.premio };
      } catch {}
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(r));
  }
  // --- API: leads ruleta (genera el cupón en el SERVIDOR, único) ---
  // CONECTAR AQUÍ tu proveedor de email marketing (Mailchimp/Brevo/Klaviyo):
  // reenvía `lead` a su API dentro de este bloque además de guardarlo local.
  function generarCupon(premio, existentes) {
    const PREFIJOS = { "10OFF": "DR1P-10OFF-", "15OFF": "DR1P-15OFF-", "20OFF": "DR1P-20OFF-", "A": "DR1P-20OFF-", "5000": "DR1P-5000-", "B": "DR1P-5000-" };
    const pref = PREFIJOS[premio] || "DR1P-20OFF-";
    for (let intento = 0; intento < 1000; intento++) {
      let valor = randomInt(CODIGOS_POR_PREMIO);
      let sufijo = "";
      for (let i = 0; i < 4; i++) {
        sufijo = ALFABETO_CUPON[valor % ALFABETO_CUPON.length] + sufijo;
        valor = Math.floor(valor / ALFABETO_CUPON.length);
      }
      const codigo = pref + sufijo;
      if (!existentes.has(codigo)) return codigo;
    }
    throw new Error("coupon_pool_full");
  }
  if (url.pathname === "/api/leads" && req.method === "POST") {
    try {
      const body = await leerBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Email inválido" }));
      }
      let leads = [];
      let giros = [];
      try {
        leads = JSON.parse(await fs.readFile(LEADS_FILE, "utf-8"));
      } catch {}
      try {
        giros = JSON.parse(await fs.readFile(GIROS_FILE, "utf-8"));
      } catch {}
      const ahora = Date.now();
      const cantidadAntesDeLimpiar = leads.length;
      leads = limpiarCuponesVencidos(leads, ahora);
      if (leads.length !== cantidadAntesDeLimpiar) {
        await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
      }
      const girosVigentes = giros.filter(giro => Date.parse(giro.expiraEn || "") > ahora);
      if (girosVigentes.length !== giros.length) {
        giros = girosVigentes;
        await fs.writeFile(GIROS_FILE, JSON.stringify(giros, null, 2));
      }
      const emailHash = hashEmail(email);
      const giroPrevio = giros.find(giro => giro.emailHash === emailHash);
      if (giroPrevio) {
        const cuponPrevio = giroPrevio.cupon && leads.find(item => item.cupon === giroPrevio.cupon && cuponVigente(item, ahora));
        if (!cuponPrevio) {
          res.writeHead(429, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "cooldown", reintentarEn: giroPrevio.expiraEn }));
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          ok: true, cupon: cuponPrevio.cupon, premio: cuponPrevio.premio,
          segmento: giroPrevio.segmento, repetido: true, reintentarEn: giroPrevio.expiraEn
        }));
      }
      const segmento = sortearSegmento();
      const premio = SEGMENTOS_RUEDA[segmento];
      const emitido = new Date(ahora).toISOString();
      const expiraEn = new Date(ahora + VIDA_CUPON_MS).toISOString();
      let cupon = null;
      if (premio !== "NONE") {
        cupon = generarCupon(premio, new Set(leads.map(item => (item.cupon || "").toUpperCase())));
        leads.push({
          emailHash, premio, cupon, usado: false,
          fecha: emitido, expiraEn
        });
        await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
      }
      giros.push({ emailHash, premio, segmento, cupon, fecha: emitido, expiraEn });
      await fs.writeFile(GIROS_FILE, JSON.stringify(giros, null, 2));
      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, cupon, premio, segmento, repetido: false, reintentarEn: expiraEn }));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "spin_not_recorded" }));
    }
  }

  // --- Frontend estatico ---
  let filePath = path.join(FRONTEND, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  if (!filePath.startsWith(FRONTEND)) {
    res.writeHead(403); return res.end("Forbidden");
  }
  try {
    const ext = path.extname(filePath);
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    return res.end(content);
  } catch {
    res.writeHead(404); return res.end("No encontrado");
  }
});

server.listen(PORT, () => {
  console.log(`Tienda en http://localhost:${PORT}`);
});
