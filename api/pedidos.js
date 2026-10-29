import { errorResponse, json, leerJson, limpiarCuponesVencidos, metodoNoPermitido, supabase } from "../backend/api-shared.js";

const CUPON_RE = /^DR1P-(10OFF|15OFF|20OFF|5000)-(?:[A-Z0-9]{4}|[A-Z0-9]{8})$/;
const PCT = { "10OFF": 0.10, "15OFF": 0.15, "20OFF": 0.20, A: 0.20 };

async function cargarCatalogo(request) {
  const url = new URL("/productos.json", request.url);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("catalog_unavailable");
  const productos = await response.json();
  if (!Array.isArray(productos)) throw new Error("catalog_invalid");
  return productos;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return metodoNoPermitido();
    try {
      const body = await leerJson(request);
      if (Array.isArray(body.cupon)) return json({ ok: false, error: "solo_un_cupon" }, 400);
      const catalogo = await cargarCatalogo(request);
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return json({ ok: false, error: "carrito_vacio" }, 400);

      let subtotal = 0;
      const itemsOk = [];
      for (const item of items) {
        const producto = catalogo.find(p => p.id == item.id);
        const cantidad = Number.parseInt(item.cant, 10);
        if (!producto || !Number.isInteger(cantidad) || cantidad < 1) {
          return json({ ok: false, error: "item_invalido" }, 400);
        }
        subtotal += Number(producto.precio) * cantidad;
        itemsOk.push({
          id: producto.id,
          nombre: producto.nombre,
          talle: String(item.talle || "-"),
          cant: cantidad,
          precio: Number(producto.precio)
        });
      }

      const nombre = String(body.nombre || "Sin nombre").slice(0, 120);
      const fecha = new Date().toISOString();
      const codigo = String(body.cupon?.codigo || "").trim().toUpperCase();
      await limpiarCuponesVencidos();
      if (codigo) {
        if (!CUPON_RE.test(codigo)) return json({ ok: false, error: "cupon_invalido" }, 400);
        const rows = await supabase("rpc/consume_dr1p_coupon", {
          method: "POST",
          body: {
            p_codigo: codigo,
            p_nombre: nombre,
            p_items: itemsOk,
            p_subtotal: subtotal,
            p_fecha: fecha
          }
        });
        const result = rows?.[0];
        if (!result?.ok) return json({ ok: false, error: "cupon_invalido" }, 400);
        return json({ ok: true, total: result.total, descuento: result.descuento }, 201);
      }

      await supabase("dr1p_pedidos", {
        method: "POST",
        prefer: "return=minimal",
        body: [{
          nombre,
          items: itemsOk,
          subtotal,
          cupon_codigo: null,
          descuento: 0,
          total: subtotal,
          fecha
        }]
      });
      return json({ ok: true, total: subtotal, descuento: 0 }, 201);
    } catch (error) {
      return errorResponse(error);
    }
  }
};
