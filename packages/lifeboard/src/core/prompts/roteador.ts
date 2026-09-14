/**
 * OS-LIFEBOARD · P7 — roteador de conta (função PURA, camada O).
 *
 * ═══ FONTE ÚNICA DA REGRA DE ROTEAMENTO ═══
 * Este arquivo é o lugar onde a regra mora. O laço de `fila_prompts_enfileirar`
 * (`supabase/migrations/0012_lifeboard_v3_fila_posse_e_tentativas.sql`) é um
 * ESPELHO DECLARADO dele — o `case` de ordem das contas lá cita este caminho
 * em comentário. A versão viva do laço está em
 * `supabase/migrations/0015_lifeboard_v3_fila_dia_e_dono.sql` §11.
 * Mudou aqui? Muda lá, no mesmo commit.
 *
 * A REGRA (D5, rodada 3; D29, rodada 6):
 *   1. espaço livre de uma conta = teto − medido − em_execucao − na_fila dela.
 *   2. ganha a conta com MAIOR espaço livre.
 *   3. EMPATE: a ordem de `CONTAS` neste módulo — lucasscudeler, lsgpandora,
 *      almapetra. (Antes havia duas regras convivendo: "menor consumo" com
 *      desempate por conta preferida no TS, e "menor consumo" com um `case`
 *      diferente no SQL. Agora é uma só, escrita uma vez.)
 *   4. D29: o MESMO espaço livre decide `cabeHoje` e escreve a frase. A frase
 *      diz "contando a fila parada" e revela, quando existe, a conta de
 *      headroom maior que não ganhou — porque a fila dela já está cheia.
 *
 * POR QUE "maior espaço" e não "menor consumo" (mudança da rodada 3): duas
 * contas podem ter o mesmo consumo medido e espaços completamente diferentes,
 * porque uma delas tem 3 itens `maxima` esperando na fila. Roteando por
 * consumo, a fila inteira ia para a mesma conta e nenhuma delas rodava hoje.
 *
 * POR QUE ELE NUNCA DIZ "não" (D3): a admissão só recusa o que NUNCA caberia
 * (custo estimado maior que o teto da conta). Item que não cabe HOJE entra na
 * fila assim mesmo e roda quando houver espaço — por isso `cabeHoje` é um
 * campo do resultado, não uma recusa.
 */

import type { Complexidade, Conta, ConsumoConta, ModeloSugerido } from "@/core/prompts/tipos";
import {
  CONTAS,
  MODELO_POR_COMPLEXIDADE,
  ROTULO_COMPLEXIDADE,
  ROTULO_CONTA,
  custoEstimadoParaComplexidade,
  espacoLivreUsd,
  formatarUsd,
  headroomUsd,
} from "@/core/prompts/tipos";

export interface EscolhaDeConta {
  /** `null` só quando o item NUNCA caberia em nenhuma conta (estimado > todos os tetos). */
  conta: Conta | null;
  /** Frase em português — o "porquê" que a tela mostra ao lado do modelo. */
  motivo: string;
  modeloSugerido: ModeloSugerido;
  /** D3/D29: cabe HOJE contando a fila parada? (false ≠ recusa: o item entra.) */
  cabeHoje: boolean;
  /** D29: a RÉGUA — headroom − fila parada da conta escolhida. Escolhe e fala. */
  espacoLivreUsd: number;
  /**
   * O headroom cru da conta escolhida (teto − medido − em_execucao) — o número
   * que o PULL compara item a item. Pode ser negativo; toda frase o clampa.
   * D29: deixou de decidir `cabeHoje`; virou explicação dentro da frase.
   */
  headroomUsd: number;
}


/**
 * @param consumos  uma linha por conta (`fila_prompts_listar` → `consumo`).
 * @param complexidade define o modelo sugerido e o custo estimado do item.
 */
export function escolherConta(
  consumos: readonly ConsumoConta[],
  complexidade: Complexidade,
): EscolhaDeConta {
  const modeloSugerido = MODELO_POR_COMPLEXIDADE[complexidade];
  const custoEstimado = custoEstimadoParaComplexidade(complexidade);

  // Ordem de CONTAS = a régua de desempate. `>` estrito abaixo nunca troca o
  // primeiro candidato por um empatado — o empate cai sempre no mais à esquerda.
  const ordenadas = CONTAS.map((conta) => consumos.find((c) => c.conta === conta)).filter(
    (c): c is ConsumoConta => c !== undefined,
  );

  if (ordenadas.length === 0) {
    return {
      conta: null,
      motivo: "nenhuma conta configurada no painel",
      modeloSugerido,
      cabeHoje: false,
      espacoLivreUsd: 0,
      headroomUsd: 0,
    };
  }

  // Mesma recusa do trigger (D3): o item nunca caberia, em nenhum dia.
  const maiorTeto = Math.max(...ordenadas.map((c) => c.tetoUsd));
  if (custoEstimado > maiorTeto) {
    return {
      conta: null,
      motivo:
        `Uma tarefa ${ROTULO_COMPLEXIDADE[complexidade]} custa cerca de ${formatarUsd(custoEstimado)} — ` +
        `mais que o teto diário de qualquer conta (${formatarUsd(maiorTeto)}). Nunca vai caber.`,
      modeloSugerido,
      cabeHoje: false,
      espacoLivreUsd: 0,
      headroomUsd: 0,
    };
  }

  // D29 (rodada 6) · UMA RÉGUA, e é a mesma que FALA. O espaço livre
  // (headroom − fila parada) escolhe a conta E decide `cabeHoje`. Antes eram
  // duas: o espaço escolhia, o headroom vereditava, e a frase saía do headroom
  // — o crítico mediu "Nenhuma conta tem US$ 50,00 livres hoje" escrito sobre
  // uma conta com US$ 150,00 de headroom e US$ 140,00 já na fila. (Supersede a
  // metade "headroom decide cabeHoje" de D13; a metade "nunca um número
  // negativo na tela" continua valendo — ver os `Math.max(0, …)` abaixo.)
  let melhor = ordenadas[0] as ConsumoConta;
  let melhorEspaco = espacoLivreUsd(melhor);
  let empatados = 1;
  for (const atual of ordenadas.slice(1)) {
    const espaco = espacoLivreUsd(atual);
    if (espaco > melhorEspaco) {
      melhor = atual;
      melhorEspaco = espaco;
      empatados = 1;
    } else if (espaco === melhorEspaco) {
      empatados += 1;
    }
  }

  const headroom = headroomUsd(melhor);
  const cabeHoje = custoEstimado <= melhorEspaco;

  // A conta com MAIS headroom cru, quando não é a escolhida: é o número que a
  // frase antiga usava e que fazia a frase mentir. Ele não some — vira a
  // explicação de por que aquela conta, que parece folgada, não ganhou.
  let outraFolgada: ConsumoConta | null = null;
  for (const atual of ordenadas) {
    if (atual.conta === melhor.conta) continue;
    if (headroomUsd(atual) <= headroom) continue;
    if (outraFolgada === null || headroomUsd(atual) > headroomUsd(outraFolgada)) {
      outraFolgada = atual;
    }
  }
  const revelacao =
    outraFolgada === null
      ? ""
      : `; ${ROTULO_CONTA[outraFolgada.conta]} tem ${formatarUsd(Math.max(0, headroomUsd(outraFolgada)))} ` +
        `livres agora, mas ${formatarUsd(outraFolgada.naFilaUsd)} já na fila`;
  // Empate → ordem de CONTAS, e o operador lê por quê (antes o desempate era
  // silencioso e parecia arbitrário).
  const empate = empatados > 1 ? " Empate no espaço livre; vale a ordem da casa." : "";

  // D9: frase gramatical, rótulo da conta (nunca o e-mail cru), complexidade
  // por extenso e dinheiro com vírgula. D13: nada de número negativo.
  const detalhe =
    melhor.naFilaUsd > 0
      ? ` (headroom de ${formatarUsd(Math.max(0, headroom))} menos ${formatarUsd(melhor.naFilaUsd)} já na fila)`
      : "";
  const motivo = cabeHoje
    ? `${ROTULO_CONTA[melhor.conta]} tem o maior espaço livre hoje contando a fila parada: ` +
      `${formatarUsd(Math.max(0, melhorEspaco))}${detalhe}.${empate}`
    : `Nenhuma conta tem ${formatarUsd(custoEstimado)} livres para uma tarefa ` +
      `${ROTULO_COMPLEXIDADE[complexidade]} contando a fila parada. A mais folgada ` +
      // Arranhão da rodada 7: saía "A mais folgada (Pandora) tem US$ 30,00" —
      // sem dizer de quê. Toda metade da frase agora termina em "livres".
      `(${ROTULO_CONTA[melhor.conta]}) tem ${melhorEspaco > 0 ? `${formatarUsd(melhorEspaco)} livres` : "0 livres"}` +
      `${detalhe}${revelacao}.${empate}`;

  return {
    conta: melhor.conta,
    motivo,
    modeloSugerido,
    cabeHoje,
    espacoLivreUsd: melhorEspaco,
    headroomUsd: headroom,
  };
}

/**
 * Esta conta tem espaço HOJE para a complexidade dada?
 *
 * D29 (rodada 6): usa o ESPAÇO LIVRE (headroom − fila parada) — a mesma régua
 * de `escolherConta`, para a tela não dizer "cabe" sobre uma conta cuja fila
 * parada já consumiu o teto do dia. O PULL compara o headroom item a item; a
 * diferença entre os dois números é justamente o que a frase agora revela em
 * voz alta, em vez de esconder.
 */
export function contaTemEspacoPara(consumo: ConsumoConta, complexidade: Complexidade): boolean {
  return espacoLivreUsd(consumo) >= custoEstimadoParaComplexidade(complexidade);
}
