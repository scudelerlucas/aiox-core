// MiroFish Populations — loader zero-dependência (ESM).
// Consumo em qualquer projeto: import { getMarket } from "<...>/data/mirofish/loader.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
let _cache = null;

/** Carrega o dataset inteiro (cacheado). */
export function loadPopulations(path = join(HERE, "populations.v1.json")) {
  if (!_cache) _cache = JSON.parse(readFileSync(path, "utf8"));
  return _cache;
}

/** Mercado por código ISO-2 (ex.: "BR", "MX"). Retorna null se não existir. */
export function getMarket(code) {
  const c = String(code).toUpperCase();
  return loadPopulations().markets.find((m) => m.code === c) ?? null;
}

/** Todos os mercados de uma região ("latam" | "eastern_europe" | "west" | "asia"). */
export function byRegion(region) {
  return loadPopulations().markets.filter((m) => m.region === region);
}

/** Só os mercados com qualidade "firm" (dado a travar). */
export function firmMarkets() {
  return loadPopulations().markets.filter((m) => m.quality === "firm");
}

/** Vetor Hofstede 6D de um mercado, na ordem pdi,idv,mas,uai,lto,ivr. */
export function hofstede(code) {
  const m = getMarket(code);
  return m ? m.hofstede : null;
}
