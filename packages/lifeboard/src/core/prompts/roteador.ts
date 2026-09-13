/**
 * OS-LIFEBOARD · P7 — roteador de conta (função PURA, camada O).
 *
 * ═══ FONTE ÚNICA DA REGRA DE ROTEAMENTO ═══
 * Este arquivo é o lugar onde a regra mora. O laço de `fila_prompts_enfileirar`
 * (`supabase/migrations/0012_lifeboard_v3_fila_posse_e_tentativas.sql`) é um
 * ESPELHO DECLARADO dele — o `case` de ordem das contas lá cita este caminho
 * em comentário. Mudou aqui? Muda lá, no mesmo commit.
 *
 * A REGRA (D5, rodada 3):
 *   1. espaço livre de uma conta = teto − medido − em_execucao − na_fila dela.
 *   2. ganha a conta com MAIOR espaço livre.
 *   3. EMPATE: a ordem de `CONTAS` neste módulo — lucasscudeler, lsgpandora,
 *      almapetra. (Antes havia duas regras convivendo: "menor consumo" com
 *      desempate por conta preferida no TS, e "menor consumo" com um `case`
 *      diferente no SQL. Agora é uma só, escrita uma vez.)
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
  /** D3: há espaço HOJE nesta conta para esta complexidade? (false ≠ recusa.) */
  cabeHoje: boolean;
  /** Espaço livre (US$) da conta escolhida, pela conta do item 1 acima. */
  espacoLivreUsd: number;
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
    };
  }

  let melhor = ordenadas[0] as ConsumoConta;
  let melhorEspaco = espacoLivreUsd(melhor);
  for (const atual of ordenadas.slice(1)) {
    const espaco = espacoLivreUsd(atual);
    if (espaco > melhorEspaco) {
      melhor = atual;
      melhorEspaco = espaco;
    }
  }

  const cabeHoje = melhorEspaco >= custoEstimado;

  // D9: frase gramatical, rótulo da conta (nunca o e-mail cru), complexidade
  // por extenso e dinheiro com vírgula.
  const motivo = cabeHoje
    ? `${ROTULO_CONTA[melhor.conta]} tem o maior espaço livre hoje: ${formatarUsd(melhorEspaco)}.`
    : `Nenhuma conta tem ${formatarUsd(custoEstimado)} livres hoje para uma tarefa ` +
      `${ROTULO_COMPLEXIDADE[complexidade]}. A mais próxima (${ROTULO_CONTA[melhor.conta]}) tem ` +
      `${formatarUsd(melhorEspaco)}.`;

  return { conta: melhor.conta, motivo, modeloSugerido, cabeHoje, espacoLivreUsd: melhorEspaco };
}

/**
 * Esta conta tem espaço HOJE para a complexidade dada?
 *
 * Usa o HEADROOM (teto − medido − em_execucao), que é exatamente o que
 * `fila_prompts_pegar_interno` compara na hora de liberar o item — a fila
 * parada não entra aqui (D3), porque ela ainda não gastou nada.
 */
export function contaTemEspacoPara(consumo: ConsumoConta, complexidade: Complexidade): boolean {
  return headroomUsd(consumo) >= custoEstimadoParaComplexidade(complexidade);
}
