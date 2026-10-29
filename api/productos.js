import { errorResponse, json, metodoNoPermitido } from "../backend/api-shared.js";

export default {
  async fetch(request) {
    if (request.method !== "GET") return metodoNoPermitido();
    try {
      const response = await fetch(new URL("/productos.json", request.url), { cache: "no-store" });
      if (!response.ok) throw new Error("catalog_unavailable");
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
};
