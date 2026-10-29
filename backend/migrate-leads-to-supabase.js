import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "leads.json");
const codigoValido = /^DR1P-(10OFF|15OFF|20OFF|5000)-[A-Z0-9]{4,8}$/i;
const premios = new Set(["10OFF", "15OFF", "20OFF", "5000"]);
const premioCodigo = codigo => codigo.match(/^DR1P-(10OFF|15OFF|20OFF|5000)-/i)?.[1]?.toUpperCase() || null;
const ahora = new Date();
const expiraEn = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
const codigoHash = codigo => createHash("sha256").update(codigo.toLowerCase()).digest("hex");

const base = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("Faltan SUPABASE_URL y/o la clave de servicio de Supabase.");

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
if (!Array.isArray(source)) throw new Error("leads.json no contiene una lista.");
const vistos = new Set();
const cupones = [];
for (const lead of source) {
  const codigo = String(lead.cupon || "").trim().toUpperCase();
  if (!codigoValido.test(codigo) || lead.usado === true || /-(TEST|PRUEBA)(-|$)/i.test(codigo) || vistos.has(codigo)) continue;
  const premio = String(lead.premio || premioCodigo(codigo) || "").trim().toUpperCase();
  const premioFinal = premio === "A" ? "20OFF" : premio === "B" ? "5000" : premio;
  if (!premios.has(premioFinal)) continue;
  vistos.add(codigo);
  cupones.push({ codigo, email_hash: codigoHash(codigo), premio: premioFinal, usado: false, fecha: ahora.toISOString(), expira_en: expiraEn.toISOString() });
}

if (cupones.length) {
  const response = await fetch(base + "/rest/v1/dr1p_cupones?on_conflict=codigo", {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify(cupones)
  });
  if (!response.ok) throw new Error("Supabase rechazó la migración (HTTP " + response.status + ").");
}
console.log("Migración lista: " + cupones.length + " cupones anteriores vigentes por 24 horas; no se copiaron correos.");

