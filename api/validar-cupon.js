import { errorResponse, json, metodoNoPermitido, supabase } from "../backend/api-shared.js";

const CUPON_RE = /^DR1P-(10OFF|15OFF|20OFF|5000)-(?:[A-Z0-9]{4}|[A-Z0-9]{8})$/;

export default {
  async fetch(request) {
    if (request.method !== "GET") return metodoNoPermitido();
    try {
      const codigo = (new URL(request.url).searchParams.get("codigo") || "").trim().toUpperCase();
      if (!CUPON_RE.test(codigo)) return json({ ok: false, motivo: "invalido" });
      const query = new URLSearchParams({ select: "premio,usado,expira_en", codigo: `eq.${codigo}`, limit: "1" });
      const rows = await supabase(`dr1p_cupones?${query.toString()}`);
      const cupon = rows?.[0];
      if (!cupon) return json({ ok: false, motivo: "invalido" });
      if (cupon.usado) return json({ ok: false, motivo: "usado" });
      if (Date.parse(cupon.expira_en) <= Date.now()) {
        const borrar = new URLSearchParams({ codigo: `eq.${codigo}` });
        await supabase(`dr1p_cupones?${borrar.toString()}`, { method: "DELETE", prefer: "return=minimal" });
        return json({ ok: false, motivo: "expirado" });
      }
      return json({ ok: true, premio: cupon.premio });
    } catch (error) {
      return errorResponse(error);
    }
  }
};
