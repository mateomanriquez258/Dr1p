// Regla comercial: +20% sobre precio base para absorber cupones.
// - 20% OFF sobre precio inflado = precio original (P*1.2*0.8 = P*0.96 ≈ P)
// - $5.000 sobre precio inflado ≈ precio original en tickets ~$25.000
// Uso: node backend/aplicar-aumento.js [--factor=1.2]
// Idempotente: guarda `precio_base` la primera vez y recalcula desde ahí.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "productos.json");

const arg = process.argv.find(a => a.startsWith("--factor="));
const FACTOR = arg ? parseFloat(arg.split("=")[1]) : 1.2;

const raw = await fs.readFile(FILE, "utf-8");
const productos = JSON.parse(raw);

for (const p of productos) {
  if (p.precio_base == null) p.precio_base = p.precio; // congela base original
  p.precio = Math.round(p.precio_base * FACTOR);       // reaplica desde base
}

await fs.writeFile(FILE, JSON.stringify(productos, null, 2));
console.log(`OK: ${productos.length} productos x${FACTOR} (base preservada en precio_base)`);
for (const p of productos) console.log(`- ${p.nombre}: base $${p.precio_base} → lista $${p.precio}`);
