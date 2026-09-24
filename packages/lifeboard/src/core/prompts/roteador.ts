/**
 * OS-LIFEBOARD · P7 — roteador de conta (função PURA, camada O).
 *
 * ═══ FONTE ÚNICA DA REGRA DE ROTEAMENTO, E A PARIDADE É PROVADA ═══
 * Este arquivo é o lugar onde a regra mora. O lado SQL dela é a função PURA
 * `public.painel_fila_escolher_conta(jsonb, numeric)`
 * (`supabase/migrations/0019_lifeboard_v3_livro_razao.sql` §15), que
 * `fila_prompts_enfileirar` passou a chamar.
 *
 * MÉDIO 1 (rodada 9) · POR QUE ISSO MUDOU. Até a rodada 8 o espelho era um
 * LAÇO dentro de `fila_prompts_enfileirar` que se autodeclarava "ESPELHO
 * DECLARADO de escolherConta" e divergia em dois pontos medidos pelo crítico:
 *   · ele não filtrava `exigir_medicao_recente`, e como o `<select name="conta">`
 *     manda `""` no modo automático, QUEM DECIDE É O SQL — ele escolhia
 *     `lsgpandora@gmail.com` (exige medição, sem medição nenhuma) e o pull
 *     daquela conta recusava: "não autorizo contra saldo nenhum…";
 *   · o teste de "nunca vai caber" era `max(tetos)` aqui e o teto da conta
 *     ESCOLHIDA lá (BAIXO 4).
 * E o teste que deveria pegar isso (`prompts-espelho-sql.test.ts:334-338`)
 * conferia o número `12`, nunca a escolha.
 *
 * AGORA a paridade é caso a caso: `supabase/tests/fila_prompts.test.sql` (bloco
 * T42) carrega uma tabela de casos em JSON e roda a função SQL sobre ela;
 * `tests/unit/prompts-paridade-chooser.test.ts` LÊ O MESMO LITERAL do disco e
 * roda ESTA função sobre os mesmos casos. Divergir em qualquer um dos dois
 * lados — ou mexer na tabela de casos — pinta um dos dois de vermelho.
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
 *   5. D36 (rodada 8): conta que o BANCO RECUSARIA agora não é escolhida, não
 *      "cabe hoje" e não é convidada. Toda frase de espaço livre carimba DE
 *      QUANDO é a medição.
 *
 * D36 — POR QUE (MÉDIO 1 da rodada 7, medido pelo crítico): a rodada 7 criou
 * `exigir_medicao_recente` no banco e `defasagemHoras` no contrato, e o
 * roteador ignorou os dois. Resultado na tela: a frase ao lado do botão dizia
 * "Pandora tem o maior espaço livre hoje… US$ 500,00" sobre uma conta que o
 * card, dois centímetros acima, declarava "sem medição nenhuma"; e com a trava
 * ligada e a medição velha, `cabeHoje` saía `true` e o selo "escolhida agora"
 * aparecia enquanto o banco recusava 100% dos disparos. É a extensão de D9
 * ("teto atingido não convida") ao estado que a rodada 7 criou: nenhuma
 * superfície convida para a ação que o banco vai recusar.
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
  LIMITE_DEFASAGEM_HORAS,
  MODELO_POR_COMPLEXIDADE,
  ROTULO_COMPLEXIDADE,
  ROTULO_CONTA,
  bancoRecusaria,
  custoEstimadoParaComplexidade,
  espacoLivreUsd,
  formatarUsd,
  headroomUsd,
  horasDeDefasagem,
  seloDaMedicao,
  semVagaEmVoo,
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
  /**
   * D36 · A4 (rodada 11): NENHUMA conta candidata está autorizada agora — o
   * banco recusaria 100% dos disparos de todas elas por medição velha. É
   * diferente de "não cabe": o veredito já saía certo em `cabeHoje`, mas
   * quem chamava não tinha como distinguir os dois casos e a tela explicava
   * falta de dinheiro onde o problema é medição parada. Espelho de
   * `todas_recusadas` em `painel_fila_escolher_conta` (migration 0019 §15).
   */
  todasRecusadas: boolean;
  /**
   * P2 do Codex (PR #42): nenhuma conta da disputa tem vaga de sessão em voo
   * agora. A escolha volta a ser entre todas; `cabeHoje` continua sendo
   * dinheiro (vaga libera em minutos). Espelho de `todas_sem_vaga` (0030).
   */
  todasSemVaga: boolean;
  /**
   * P2 do Codex (PR #42, 6ª rodada): quantas contas da disputa ficaram de fora
   * por estarem no limite de sessões em voo. Espelho de `puladas_sem_vaga`.
   */
  puladasSemVaga: number;
}


/**
 * @param consumos  uma linha por conta (`fila_prompts_listar` → `consumo`).
 * @param complexidade define o modelo sugerido e o custo estimado do item.
 */
export function escolherConta(
  consumos: readonly ConsumoConta[],
  complexidade: Complexidade,
  agora: number = Date.now(),
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
      todasRecusadas: false,
      todasSemVaga: false,
      puladasSemVaga: 0,
    };
  }

  // BAIXO 4 (rodada 9) · A MESMA RECUSA DO TRIGGER, CONTA A CONTA.
  // Aqui havia `custoEstimado > Math.max(...tetos)`: um teste de EXISTÊNCIA
  // ("alguma conta comporta?") enquanto o trigger de admissão compara o
  // estimado com o teto da conta ESCOLHIDA, uma a uma. Com os três tetos iguais
  // os dois davam o mesmo resultado — e essa coincidência era a única coisa
  // segurando a paridade. Agora a conta cujo teto não comporta o item SAI DA
  // DISPUTA (ela nunca poderia recebê-lo), e a recusa só acontece quando não
  // sobra nenhuma. Espelho exato de `painel_fila_escolher_conta` (0019 §15).
  const maiorTeto = Math.max(...ordenadas.map((c) => c.tetoUsd));
  const candidatas = ordenadas.filter((c) => c.tetoUsd >= custoEstimado);
  if (candidatas.length === 0) {
    return {
      conta: null,
      motivo:
        `Uma tarefa ${ROTULO_COMPLEXIDADE[complexidade]} custa cerca de ${formatarUsd(custoEstimado)} — ` +
        `mais que o teto diário de qualquer conta (${formatarUsd(maiorTeto)}). Nunca vai caber.`,
      modeloSugerido,
      cabeHoje: false,
      espacoLivreUsd: 0,
      headroomUsd: 0,
      todasRecusadas: false,
      todasSemVaga: false,
      puladasSemVaga: 0,
    };
  }

  // D29 (rodada 6) · UMA RÉGUA, e é a mesma que FALA. O espaço livre
  // (headroom − fila parada) escolhe a conta E decide `cabeHoje`. Antes eram
  // duas: o espaço escolhia, o headroom vereditava, e a frase saía do headroom
  // — o crítico mediu "Nenhuma conta tem US$ 50,00 livres hoje" escrito sobre
  // uma conta com US$ 150,00 de headroom e US$ 140,00 já na fila. (Supersede a
  // metade "headroom decide cabeHoje" de D13; a metade "nunca um número
  // negativo na tela" continua valendo — ver os `Math.max(0, …)` abaixo.)
  // D36 (rodada 8): quem o banco recusaria AGORA sai da disputa. A conta
  // continua existindo na tela (o card diz por que ela está fora), mas não
  // ganha o item e não é apresentada como "a mais folgada": espaço livre num
  // saldo que o banco não autoriza a gastar não é espaço livre.
  const autorizadas = candidatas.filter((c) => !bancoRecusaria(c, agora));
  const disputaPorAutorizacao = autorizadas.length > 0 ? autorizadas : candidatas;
  const todasRecusadas = autorizadas.length === 0;
  // P2 do Codex (PR #42): dentro da disputa, conta COM VAGA de sessão em voo
  // vem antes. A conta com o maior espaço mas quatro sessões em voo ganhava o
  // item, que ficava parado atrás do limite enquanto outra conta tinha vaga.
  const comVaga = disputaPorAutorizacao.filter((c) => !semVagaEmVoo(c));
  const todasSemVaga = comVaga.length === 0;
  const disputa = todasSemVaga ? disputaPorAutorizacao : comVaga;
  const puladasSemVaga = todasSemVaga ? 0 : disputaPorAutorizacao.length - comVaga.length;
  const entreComVaga = puladasSemVaga > 0 ? " entre as contas com vaga de sessão" : "";
  const foraSemVaga =
    puladasSemVaga > 0 ? " As contas no limite de sessões em voo ficaram de fora." : "";

  let melhor = disputa[0] as ConsumoConta;
  let melhorEspaco = espacoLivreUsd(melhor);
  let empatados = 1;
  for (const atual of disputa.slice(1)) {
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
  // D36: nenhuma conta autorizada = não cabe hoje em conta nenhuma, por mais
  // dinheiro livre que o teto mostre. É o banco quem decide, e ele já decidiu.
  const cabeHoje = !todasRecusadas && custoEstimado <= melhorEspaco;

  if (todasRecusadas) {
    const horas = horasDeDefasagem(melhor, agora);
    const desde =
      horas === null
        ? "nunca teve gasto medido"
        : `a última medição é de ${Math.round(horas)} h atrás`;
    return {
      conta: melhor.conta,
      motivo:
        `Nenhuma conta autoriza gasto agora: ela exige medição de menos de ` +
        `${LIMITE_DEFASAGEM_HORAS} h e ${desde}. O item entra na fila e roda quando ` +
        `a medição voltar.`,
      modeloSugerido,
      cabeHoje: false,
      espacoLivreUsd: melhorEspaco,
      headroomUsd: headroom,
      todasRecusadas: true,
      todasSemVaga,
      puladasSemVaga,
    };
  }

  // A conta com MAIS headroom cru, quando não é a escolhida: é o número que a
  // frase antiga usava e que fazia a frase mentir. Ele não some — vira a
  // explicação de por que aquela conta, que parece folgada, não ganhou.
  let outraFolgada: ConsumoConta | null = null;
  for (const atual of disputa) {
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
  const semVaga = todasSemVaga
    ? " Todas as contas estão no limite de sessões em voo; o item sai quando uma vaga abrir."
    : "";

  // D9: frase gramatical, rótulo da conta (nunca o e-mail cru), complexidade
  // por extenso e dinheiro com vírgula. D13: nada de número negativo.
  const detalhe =
    melhor.naFilaUsd > 0
      ? ` (headroom de ${formatarUsd(Math.max(0, headroom))} menos ${formatarUsd(melhor.naFilaUsd)} já na fila)`
      : "";
  // MÉDIO 1 (rodada 8): TODA frase de espaço livre carimba de quando é a
  // medição. Um saldo de 37 h atrás e um saldo de agora saíam com exatamente
  // as mesmas palavras — e o operador não tinha como saber qual dos dois lia.
  const selo = ` — ${seloDaMedicao(melhor, agora)}`;
  const motivo = cabeHoje
    ? `${ROTULO_CONTA[melhor.conta]} tem o maior espaço livre hoje${entreComVaga} contando a fila parada: ` +
      `${formatarUsd(Math.max(0, melhorEspaco))}${detalhe}${selo}.${empate}${semVaga}${foraSemVaga}`
    : `Nenhuma conta${puladasSemVaga > 0 ? " com vaga de sessão" : ""} tem ${formatarUsd(custoEstimado)} livres para uma tarefa ` +
      `${ROTULO_COMPLEXIDADE[complexidade]} contando a fila parada. A mais folgada ` +
      // Arranhão da rodada 7: saía "A mais folgada (Pandora) tem US$ 30,00" —
      // sem dizer de quê. Toda metade da frase agora termina em "livres".
      `(${ROTULO_CONTA[melhor.conta]}) tem ${melhorEspaco > 0 ? `${formatarUsd(melhorEspaco)} livres` : "0 livres"}` +
      `${detalhe}${selo}${revelacao}.${empate}${semVaga}${foraSemVaga}`;

  return {
    conta: melhor.conta,
    motivo,
    modeloSugerido,
    cabeHoje,
    espacoLivreUsd: melhorEspaco,
    headroomUsd: headroom,
    todasRecusadas,
    todasSemVaga,
    puladasSemVaga,
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
export function contaTemEspacoPara(
  consumo: ConsumoConta,
  complexidade: Complexidade,
  agora: number = Date.now(),
): boolean {
  // D36 (rodada 8): a primeira pergunta é se o banco AUTORIZA — não adianta
  // ter US$ 500,00 de espaço livre numa conta cujo pull recusa 100% dos
  // disparos por medição velha. Esta função alimenta o selo "escolhida agora"
  // e o aviso "não cabe hoje" do cartão; devolver `true` aqui era convidar o
  // operador para o que o banco já tinha recusado.
  if (bancoRecusaria(consumo, agora)) return false;
  return espacoLivreUsd(consumo) >= custoEstimadoParaComplexidade(complexidade);
}
