import { errorResponse, json, leerJson, metodoNoPermitido, supabase } from "../backend/api-shared.js";

export default {
  async fetch(request) {
    if (request.method !== "POST") return metodoNoPermitido();
    try {
      const body = await leerJson(request);
      if (body.website) return json({ ok: true });
      await supabase("dr1p_contactos", {
        method: "POST",
        prefer: "return=minimal",
        body: [{
          nombre: String(body.nombre || "").slice(0, 120),
          email: String(body.email || "").slice(0, 254),
          telefono: String(body.telefono || "").slice(0, 50),
          mensaje: String(body.mensaje || "").slice(0, 4000)
        }]
      });
      return json({ ok: true }, 201);
    } catch (error) {
      return errorResponse(error);
    }
  }
};
