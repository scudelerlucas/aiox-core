// MiroFish Populations — FEATURE: calibração de mercado.
// Transforma os dados brutos (Hofstede + digital + confiança) de um mercado em
// DIRETIVAS ACIONÁVEIS para copy/oferta/funil. É a camada que faz a população
// virar feature: qualquer app chama calibrate("BR") e recebe o que FAZER.
//
// Toda diretiva rastreia para um valor real; se o mercado é `placeholder`,
// `confidence` vem "placeholder" — não travar preço/mensagem sem validar.
import { getMarket } from "./loader.mjs";

/** Faixa auxiliar. */
const band = (v, lo, hi) => (v == null ? null : v <= lo ? "low" : v >= hi ? "high" : "mid");

/**
 * calibrate(marketCode) -> diretivas de mercado, ou null se o mercado não existe.
 * Campos derivados dos eixos de Hofstede (todos citam o eixo de origem).
 */
export function calibrate(code) {
  const m = getMarket(code);
  if (!m) return null;
  const h = m.hofstede;

  // Prova social: coletivista (IDV baixo) => família/grupo; individualista => conquista pessoal.
  const social_proof =
    h.idv == null ? "unknown" : h.idv < 40 ? "grupo/família" : h.idv >= 60 ? "conquista pessoal" : "misto";

  // Ênfase em garantia: aversão à incerteza (UAI) alta => garantia/passo-a-passo central.
  const guarantee = h.uai == null ? "unknown" : h.uai >= 80 ? "alta" : h.uai >= 60 ? "média" : "baixa";

  // Horizonte da promessa: LTO baixo => resultado rápido; alto => método/jornada.
  const timeframe =
    h.lto == null ? "unknown" : h.lto < 30 ? "resultado rápido" : h.lto > 60 ? "longo prazo/método" : "médio prazo";

  // Gatilho: indulgência (IVR) alta => urgência/prazer; baixa => disciplina/dever.
  const motivation =
    h.ivr == null ? "unknown" : h.ivr >= 60 ? "urgência/gratificação" : h.ivr <= 35 ? "disciplina/dever" : "equilibrado";

  // Autoridade do mentor: PDI alto => autoridade clássica/hierárquica; baixo => competência demonstrada.
  const authority =
    h.pdi == null ? "unknown" : h.pdi >= 65 ? "autoridade clássica" : h.pdi <= 45 ? "competência demonstrada" : "misto";

  return {
    code: m.code,
    name: m.name,
    region: m.region,
    confidence: m.quality ?? "placeholder",
    directives: {
      social_proof, // como provar valor
      guarantee, // quanto peso dar à garantia/risco
      timeframe, // horizonte da promessa
      motivation, // urgência vs disciplina
      authority, // como posicionar o mentor
    },
    signals: {
      internet_penetration_pct: m.digital?.internet_penetration_pct ?? null,
      trust: m.trust ?? null,
      entrepreneurship: m.entrepreneurship ?? null,
    },
    hofstede: h,
    caveat:
      m.quality === "placeholder"
        ? "Mercado com dados placeholder — usar diretivas como hipótese, validar antes de travar preço/mensagem."
        : null,
    _bands: { idv: band(h.idv, 40, 60), uai: band(h.uai, 60, 80), pdi: band(h.pdi, 45, 65) },
  };
}

/** Compara N mercados lado a lado (ex.: calibrateMany(["BR","MX","US"])). */
export function calibrateMany(codes) {
  return codes.map((c) => calibrate(c)).filter(Boolean);
}
