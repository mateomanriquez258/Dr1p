import { createHash, randomInt } from "node:crypto";
import { errorResponse, json, leerJson, limpiarCuponesVencidos, metodoNoPermitido, supabase } from "../backend/api-shared.js";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODIGOS_POR_PREMIO = 125_000;
const PREFIJOS = {
  "10OFF": "DR1P-10OFF-",
  "15OFF": "DR1P-15OFF-",
  "20OFF": "DR1P-20OFF-",
  "5000": "DR1P-5000-"
};
const PREMIOS_POR_SEGMENTO = ["10OFF", "NONE", "15OFF", "NONE", "20OFF", "5000"];
const PESOS = [40, 5, 35, 5, 20, 40];

function generarCodigo(premio) {
  let valor = randomInt(CODIGOS_POR_PREMIO);
  let sufijo = "";
  for (let i = 0; i < 4; i++) {
    sufijo = ALFABETO[valor % ALFABETO.length] + sufijo;
    valor = Math.floor(valor / ALFABETO.length);
  }
  return PREFIJOS[premio] + sufijo;
}

function sortearSegmento() {
  const total = PESOS.reduce((suma, peso) => suma + peso, 0);
  const elegido = randomInt(total);
  let acumulado = 0;
  for (let i = 0; i < PESOS.length; i++) {
    acumulado += PESOS[i];
    if (elegido < acumulado) return i;
  }
  return PESOS.length - 1;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return metodoNoPermitido();
    try {
      const lead = await leerJson(request);
      const email = String(lead.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return json({ ok: false, error: "email_invalido" }, 400);
      }
      // El premio se sortea en el servidor; nunca confiamos en el resultado enviado por el navegador.
      const segmento = sortearSegmento();
      const premioSorteado = PREMIOS_POR_SEGMENTO[segmento];
      const emailHash = createHash("sha256").update(email).digest("hex");
      await limpiarCuponesVencidos();
      let result;
      for (let intento = 0; intento < 8; intento++) {
        try {
          const rows = await supabase("rpc/issue_dr1p_coupon", {
            method: "POST",
            body: {
              p_email_hash: emailHash,
              p_segmento: segmento,
              p_cupon: premioSorteado === "NONE" ? null : generarCodigo(premioSorteado)
            }
          });
          result = rows?.[0];
          break;
        } catch (error) {
          if (error.status !== 409 || intento === 7) throw error;
        }
      }
      if (!result) throw new Error("spin_not_recorded");
      if (result.bloqueado) {
        return json({ ok: false, error: "cooldown", reintentarEn: result.reintentar_en }, 429);
      }
      return json({
        ok: true,
        cupon: result.cupon || null,
        premio: result.premio,
        segmento: Number(result.segmento),
        repetido: Boolean(result.repetido),
        reintentarEn: result.reintentar_en
      }, result.repetido ? 200 : 201);
    } catch (error) {
      return errorResponse(error);
    }
  }
};
