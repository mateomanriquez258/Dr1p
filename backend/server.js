import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FRONTEND = path.join(ROOT, "frontend");
const PRODUCTOS_FILE = path.join(__dirname, "productos.json");
const PEDIDOS_FILE = path.join(__dirname, "pedidos.json");
const CONTACTOS_FILE = path.join(__dirname, "contactos.json");
const LEADS_FILE = path.join(__dirname, "leads.json");

const WHATSAPP_NUMERO = "5492993244379";
const PORT = process.env.PORT || 3000; // Render inyecta PORT; local usa 3000

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

  // --- API: guardar pedido (quema el cupón: un solo uso) ---
  if (url.pathname === "/api/pedidos" && req.method === "POST") {
    try {
      const pedido = await leerBody(req);
      let pedidos = [];
      try {
        pedidos = JSON.parse(await fs.readFile(PEDIDOS_FILE, "utf-8"));
      } catch { /* archivo no existe aun */ }
      pedido.fecha = new Date().toISOString();
      pedidos.push(pedido);
      await fs.writeFile(PEDIDOS_FILE, JSON.stringify(pedidos, null, 2));
      // Si el pedido trae cupón válido y sin usar → marcarlo como usado
      const cod = (pedido.cupon && pedido.cupon.codigo || "").toUpperCase();
      if (cod) {
        try {
          const leads = JSON.parse(await fs.readFile(LEADS_FILE, "utf-8"));
          const lead = leads.find(l => (l.cupon || "").toUpperCase() === cod && !l.usado);
          if (lead) {
            lead.usado = true;
            lead.usadoEn = pedido.fecha;
            await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
          }
        } catch {}
      }
      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "Pedido invalido" }));
    }
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
  var CUPON_RE = /^DR1P-(10OFF|15OFF|20OFF|5000)-[A-Z0-9]{4}$/;
  if (url.pathname === "/api/validar-cupon" && req.method === "GET") {
    const codigo = (url.searchParams.get("codigo") || "").trim().toUpperCase();
    let r = { ok: false, motivo: "invalido" };
    if (CUPON_RE.test(codigo)) {
      try {
        const leads = JSON.parse(await fs.readFile(LEADS_FILE, "utf-8"));
        const lead = leads.find(l => (l.cupon || "").toUpperCase() === codigo);
        if (!lead) r = { ok: false, motivo: "invalido" };
        else if (lead.usado) r = { ok: false, motivo: "usado" };
        else r = { ok: true, premio: lead.premio };
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
    let cod;
    do {
      cod = pref + Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
    } while (existentes.has(cod));
    return cod;
  }
  if (url.pathname === "/api/leads" && req.method === "POST") {
    try {
      const lead = await leerBody(req);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email || "")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Email inválido" }));
      }
      let leads = [];
      try {
        leads = JSON.parse(await fs.readFile(LEADS_FILE, "utf-8"));
      } catch {}
      const esCupon = c => CUPON_RE.test(c || "");
      // Giros sin premio ("NONE"): se registran una vez por email, sin cupón
      if (lead.premio === "NONE") {
        if (!leads.some(l => l.email === lead.email)) {
          leads.push({ email: lead.email, premio: "NONE", cupon: "-", usado: false, fecha: new Date().toISOString() });
          await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
        }
        res.writeHead(201, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, cupon: null }));
      }
      // Mismo email con cupón vigente → devuelve su cupón (no duplica)
      const conCupon = leads.filter(l => l.email === lead.email && esCupon(l.cupon));
      if (conCupon.length) {
        const ultimo = conCupon[conCupon.length - 1];
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, cupon: ultimo.cupon, repetido: true }));
      }
      const cupon = generarCupon(lead.premio,
        new Set(leads.map(l => (l.cupon || "").toUpperCase())));
      leads.push({ email: lead.email, premio: lead.premio, cupon, usado: false, fecha: new Date().toISOString() });
      await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
      // TODO: await fetch("https://api.tu-proveedor.com/subscribe", {...})
      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, cupon }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false }));
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
