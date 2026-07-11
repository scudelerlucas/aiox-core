// @ts-check
/**
 * AF — Antifragilidade (Taleb internalizado). Engine deterministico.
 * Transforma fragilidades (modos de fracasso da OP3LIF) em opcoes CONVEXAS:
 * ganhar com a desordem, nao apenas resistir a ela.
 *
 * 4 respostas antifrageis:
 *   - via negativa (remover fragilidade)
 *   - opcionalidade (manter varias saidas baratas)
 *   - redundancia (folga que vira vantagem sob estresse)
 *   - small bets (apostas pequenas, ganho ilimitado, perda limitada)
 */

/**
 * @param {{failureModes?:import("../types.mjs").FailureMode[], thesis?:string}} ctx
 * @returns {{fragilities:string[], convexResponses:Array<{type:string, action:string, addresses:string}>, barbell:string, viaNegativa:string[]}}
 */
export function antifragility(ctx) {
  const fms = ctx.failureModes || [];
  const fragilities = fms.map((f) => `${f.id} ${f.name}`);

  const convexResponses = fms.map((f) => {
    if (f.lethal) {
      return {
        type: "redundancia",
        action: `Redundar contra ${f.name}: ${f.vaccine} (a folga vira vantagem quando a dependencia cai).`,
        addresses: f.id,
      };
    }
    if (f.id === "F-SCOPE" || f.id === "F-SCALE") {
      return {
        type: "small-bets",
        action: `Apostar pequeno em ${f.name}: MVP de baixo custo, ganho aberto se validar, perda limitada se nao.`,
        addresses: f.id,
      };
    }
    return {
      type: "opcionalidade",
      action: `Manter opcao barata contra ${f.name}: ${f.vaccine}, mantendo saidas alternativas abertas.`,
      addresses: f.id,
    };
  });

  const viaNegativa = fms
    .filter((f) => f.lethal)
    .map((f) => `Remover a origem de ${f.name} antes de adicionar features (via negativa).`);

  const barbell =
    "Barbell: 90% em fundamentos deterministicos comprovados (fallbacks, gates, testes) + 10% em apostas assimetricas (LLM/automacao) que so agregam quando funcionam.";

  return {
    fragilities,
    convexResponses,
    barbell,
    viaNegativa: viaNegativa.length ? viaNegativa : ["Sem fragilidade letal: preservar simplicidade (via negativa por padrao)."],
  };
}

export default { antifragility };
