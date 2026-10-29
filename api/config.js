import { json, metodoNoPermitido } from "../backend/api-shared.js";

export default {
  async fetch(request) {
    if (request.method !== "GET") return metodoNoPermitido();
    return json({ whatsapp: "5492993244379" });
  }
};
