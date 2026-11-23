// Prepara el aviso a IndexNow (Bing, Yahoo, DuckDuckGo, Yandex…) con las URLs que cambiaron.
// Compara el sitemap publicado (en vivo) con el recién generado y deja en OUT un JSON listo para
// enviarse con curl a https://api.indexnow.org/indexnow DESPUÉS de publicar el sitio.
// Incluye: ofertas y páginas nuevas, las que desaparecieron (para que las saquen del índice),
// y la portada y el informe, que cambian en cada actualización.
// Uso: node scripts/indexnow.mjs <salida.json>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.SITE_URL || "https://trabajaenmineria.cl").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const KEY = "8be7d4244ae761b6d9c8ee86feb9ae7f"; // archivo site/<KEY>.txt
const out = process.argv[2] || "indexnow.json";

const locs = (xml) => new Set([...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));
const nuevo = locs(fs.readFileSync(path.join(ROOT, "site", "sitemap.xml"), "utf8"));

let anterior = new Set();
try {
  const r = await fetch(`${BASE}/sitemap.xml`, { headers: { "cache-control": "no-cache" } });
  if (r.ok) anterior = locs(await r.text());
} catch (e) { /* sin sitemap publicado: solo se avisan las páginas principales */ }

const urls = new Set([`${BASE}/`, `${BASE}/informe-empleo-minero`]);
if (anterior.size) {
  for (const u of nuevo) if (!anterior.has(u)) urls.add(u);
  for (const u of anterior) if (!nuevo.has(u)) urls.add(u);
}
const urlList = [...urls].filter((u) => u.startsWith(BASE)).slice(0, 10000);

fs.writeFileSync(out, JSON.stringify({ host: HOST, key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList }));
console.log(`IndexNow: ${urlList.length} URLs (${anterior.size ? "comparando con el sitemap publicado" : "sin sitemap previo"}).`);
