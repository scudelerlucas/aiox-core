/**
 * OS-LIFEBOARD · P7 — semente fixture da fila de prompts.
 *
 * Números escolhidos para mostrar as 3 faixas de cor da barra de consumo
 * (ok/warn/crit — `faixaConsumo`), os 5 estados da fila e, desde a rodada 3,
 * os dois retratos de um item `pega`: um com sinal vivo e um MUDO há mais de
 * 45 min (o que a tela precisa dizer em voz alta — D7). Read-only; a cópia
 * mutável vive em `prompts-fila.fixture-store.ts`.
 *
 * `AGORA_FIXTURE` é a âncora: os instantes abaixo são relativos a ela, e a
 * página em modo fixture passa `agora = AGORA_FIXTURE` para a tabela, para o
 * screenshot ser o mesmo em qualquer dia (determinismo de prova visual).
 */

import type { ConsumoConta, ItemFilaPrompt } from "@/core/prompts/tipos";

export const AGORA_FIXTURE = Date.parse("2026-09-13T12:00:00.000Z");

function menosMin(minutos: number): string {
  return new Date(AGORA_FIXTURE - minutos * 60_000).toISOString();
}

/**
 * D3 (rodada 3): `reservadoUsd` é SÓ o que está em execução com sinal vivo —
 * o item-2 (`media`, pega há 3 min) na Pandora = 15. O item-6 da Pandora está
 * `pega` mas MUDO há 70 min: não reserva mais nada (o próximo pull o devolve).
 * `naFilaUsd` é o que espera: item-3 (baixa, 5) no Lucas; item-7 (maxima, 120)
 * na Alma Petra.
 */
/**
 * MÉDIO 2 (rodada 8) · OS DOIS ESTADOS QUE FALTAVAM.
 *
 * O crítico mediu: nenhuma das 3 contas do fixture tinha `medidoAteEm: null`
 * nem `exigeMedicaoRecente: true` — ou seja, o estado MAJORITÁRIO da produção
 * (2 das 3 contas reais nunca tiveram sessão medida, e a trava de D32c existe
 * desde a rodada 7) não entrava em screenshot nenhum, e os dois ramos de
 * `conta-card.tsx` que mais mudaram nesta rodada não tinham retrato.
 *
 * Como as contas são exatamente 3 (`CONTAS`, o contrato do banco), os estados
 * foram REDISTRIBUÍDOS em vez de somados — e os quatro cabem:
 *   · Lucas       → medição RECENTE (30 min);
 *   · Pandora     → SEM MEDIÇÃO NENHUMA (`medidoAteEm: null`);
 *   · Alma Petra  → medição ATRASADA (13 h) + `exigeMedicaoRecente: true`,
 *     que é o par que faz o banco recusar 100% dos disparos (D36).
 */
export const FIXTURE_CONSUMO: readonly ConsumoConta[] = [
  {
    conta: "lucasscudeler@gmail.com",
    // D16 (rodada 4): este número é SÓ o das sessões publicadas. O item-1
    // (concluída hoje, US$ 3,42) entra por cima, calculado pela mesma regra do
    // banco — 38,68 + 3,42 = 42,10, o total que a tela mostrava antes como
    // constante. Agora ele MEXE quando a fila mexe, que era o defeito medido.
    tetoUsd: 150,
    consumoHojeUsd: 38.68,
    reservadoUsd: 0,
    naFilaUsd: 5,
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
    medidoAteEm: menosMin(30),
    // D32a/d (rodada 7): a conta medida HÁ POUCO — a linha do card continua
    // sendo "medido até há 30 min", e agora vem com a faixa real dos dias
    // medidos ao lado do teto.
    defasagemHoras: 0.5,
    exigeMedicaoRecente: false,
    historico: { dias: 9, minUsd: 155.72, maxUsd: 2513.29, medianaUsd: 391.7 },
  }, // ok (28,1% com o item da fila somado)
  {
    conta: "lsgpandora@gmail.com",
    // 48,50 publicadas + 50,00 do item-8 (morto sem fechar, D20) = 98,50 — o
    // mesmo total de antes, agora com uma parcela que a tela precisa marcar
    // como ESTIMATIVA da casa.
    tetoUsd: 150,
    consumoHojeUsd: 48.5,
    reservadoUsd: 15,
    naFilaUsd: 0,
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
    // MÉDIO 2 (rodada 8): a conta que NUNCA teve sessão medida — o estado de 2
    // das 3 contas reais, e o que o card tem de dizer sem fingir que o zero
    // não medido é zero gasto. O teto continua visível na linha do dinheiro.
    medidoAteEm: null,
    defasagemHoras: null,
    exigeMedicaoRecente: false,
    historico: null,
  }, // sem medição nenhuma
  {
    conta: "almapetra.ltda@gmail.com",
    // O item-4 desta conta falhou ONTEM (13 h atrás, já em outro dia do
    // operador) — não conta hoje, como no SQL.
    tetoUsd: 150,
    consumoHojeUsd: 150,
    reservadoUsd: 0,
    naFilaUsd: 120,
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
    // D32a (rodada 7): 13 h de atraso — acima das 12 h, o card troca "medido
    // até" por "última medição há 13 h" e a linha inteira sai em amarelo. É o
    // caso que o crítico mediu na conta real (37 h) e que a tela escondia.
    medidoAteEm: menosMin(13 * 60),
    defasagemHoras: 13,
    // MÉDIO 2 + D36 (rodada 8): a trava do operador LIGADA, com a medição
    // velha — o par exato em que o banco recusa todo disparo desta conta. Sem
    // este retrato, o selo "sem autorização agora" e a recusa do roteador não
    // apareciam em screenshot nenhum.
    exigeMedicaoRecente: true,
    historico: { dias: 1, minUsd: 150, maxUsd: 150, medianaUsd: 150 },
  }, // crit — teto atingido E sem autorização (medição de 13 h com a trava ligada)
];

export const FIXTURE_FILA: readonly ItemFilaPrompt[] = [
  {
    id: "fila-fixture-1",
    conta: "lucasscudeler@gmail.com",
    prompt: "Auditar o PR #716 do painel de assuntos e apontar riscos de RLS.",
    promptTamanho: 63,
    complexidade: "alta",
    custoEstimadoUsd: 50,
    modeloSugerido: "Opus",
    estado: "concluida",
    custoUsd: 3.42,
    criadoEm: menosMin(170),
    pegoEm: menosMin(168),
    concluidoEm: menosMin(139),
    heartbeatEm: null,
    workerId: "session_01WORKERLUCAS0000000000001",
    tentativas: 1,
    maxTentativas: 3,
    sessionId: "session_01FILHA000000000000000001",
    motivoFalha: null,
    custoEEstimativa: false,
    // MÉDIO 4 (rodada 8): a origem é explícita no fixture, como no banco.
    custoOrigem: "medido",
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: "https://claude.ai/code/session_01FILHA000000000000000001",
    resultado: "3 riscos apontados, PR comentado.",
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
  {
    id: "fila-fixture-2",
    conta: "lsgpandora@gmail.com",
    prompt: "Escrever o roteiro do reel de terça sobre ferida de abandono.",
    promptTamanho: 60,
    complexidade: "media",
    custoEstimadoUsd: 15,
    modeloSugerido: "Sonnet",
    estado: "pega",
    custoUsd: null,
    criadoEm: menosMin(133),
    pegoEm: menosMin(130),
    concluidoEm: null,
    heartbeatEm: menosMin(3),
    workerId: "session_01WORKERPANDORA000000001",
    tentativas: 1,
    maxTentativas: 3,
    sessionId: "session_01FILHA000000000000000002",
    motivoFalha: null,
    custoEEstimativa: false,
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
  {
    id: "fila-fixture-3",
    conta: "lucasscudeler@gmail.com",
    prompt: "Listar os PRs abertos há mais de 5 dias no repo vsl-mastery.",
    promptTamanho: 59,
    complexidade: "baixa",
    custoEstimadoUsd: 5,
    modeloSugerido: "Haiku",
    estado: "na_fila",
    custoUsd: null,
    criadoEm: menosMin(60),
    pegoEm: null,
    concluidoEm: null,
    heartbeatEm: null,
    workerId: null,
    tentativas: 0,
    maxTentativas: 3,
    sessionId: null,
    motivoFalha: null,
    custoEEstimativa: false,
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "lucasscudeler@gmail.com",
    taskId: "task-build",
  },
  {
    id: "fila-fixture-4",
    conta: "almapetra.ltda@gmail.com",
    prompt: "Redesenhar o score de assimetria com o átomo de opcionalidade.",
    promptTamanho: 61,
    complexidade: "maxima",
    custoEstimadoUsd: 120,
    modeloSugerido: "Fable",
    estado: "falhou",
    custoUsd: 8.9,
    criadoEm: menosMin(14 * 60),
    pegoEm: menosMin(14 * 60 - 3),
    concluidoEm: menosMin(13 * 60),
    heartbeatEm: null,
    workerId: "session_01WORKERALMA00000000001",
    tentativas: 1,
    maxTentativas: 3,
    sessionId: "session_01FILHA000000000000000004",
    motivoFalha: null,
    custoEEstimativa: false,
    custoOrigem: "medido",
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: "https://claude.ai/code/session_01FILHA000000000000000004",
    resultado: "Teto de gasto do dia bateu no meio da sessão — retomar amanhã.",
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
  {
    id: "fila-fixture-5",
    conta: "lsgpandora@gmail.com",
    prompt: "Gerar 10 variações de headline para a página do quiz.",
    promptTamanho: 52,
    complexidade: "baixa",
    custoEstimadoUsd: 5,
    modeloSugerido: "Haiku",
    estado: "cancelada",
    custoUsd: null,
    criadoEm: menosMin(21 * 60),
    pegoEm: null,
    concluidoEm: menosMin(20 * 60),
    heartbeatEm: null,
    workerId: null,
    tentativas: 0,
    maxTentativas: 3,
    sessionId: null,
    motivoFalha: null,
    custoEEstimativa: false,
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
  {
    // D7: o retrato que a rodada 3 exige na tela — `pega` há 2 h 10 min, MUDO
    // há 1 h 10 min. A linha precisa dizer as duas coisas e oferecer cancelar.
    id: "fila-fixture-6",
    conta: "lsgpandora@gmail.com",
    prompt:
      "Refatorar o extrator de átomos do OS-CAS para ler transcrição em lote e " +
      "gravar o vetor completo, mantendo a face OPERADOR sem pesos.",
    promptTamanho: 1240,
    complexidade: "alta",
    custoEstimadoUsd: 50,
    modeloSugerido: "Opus",
    estado: "pega",
    custoUsd: null,
    criadoEm: menosMin(135),
    pegoEm: menosMin(130),
    concluidoEm: null,
    heartbeatEm: menosMin(70),
    workerId: "session_01WORKERPANDORA000000002",
    tentativas: 2,
    maxTentativas: 3,
    sessionId: "session_01FILHA000000000000000006",
    motivoFalha: null,
    custoEEstimativa: false,
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
  {
    // D20 (rodada 4): o retrato que faltava — item que morreu sem ninguém
    // fechar. O custo dele é ESTIMATIVA da casa (conservador), a tela marca
    // isso em voz alta e oferece "ajustar custo" na linha.
    id: "fila-fixture-8",
    conta: "lsgpandora@gmail.com",
    prompt: "Fechar o relatório de cobertura do quiz e comentar no PR.",
    promptTamanho: 56,
    complexidade: "alta",
    custoEstimadoUsd: 50,
    modeloSugerido: "Opus",
    estado: "falhou",
    custoUsd: 50,
    criadoEm: menosMin(300),
    pegoEm: menosMin(240),
    concluidoEm: menosMin(45),
    heartbeatEm: null,
    workerId: null,
    tentativas: 3,
    maxTentativas: 3,
    sessionId: null,
    motivoFalha: "expirou 3 vezes sem fechamento",
    custoEEstimativa: true,
    custoOrigem: "estimativa",
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
  {
    id: "fila-fixture-7",
    conta: "almapetra.ltda@gmail.com",
    prompt: "Reescrever a carta de diagnóstico do LEGADO com a lei central inteira.",
    promptTamanho: 69,
    complexidade: "maxima",
    custoEstimadoUsd: 120,
    modeloSugerido: "Fable",
    estado: "na_fila",
    custoUsd: null,
    criadoEm: menosMin(25),
    pegoEm: null,
    concluidoEm: null,
    heartbeatEm: null,
    workerId: null,
    tentativas: 0,
    maxTentativas: 3,
    sessionId: null,
    motivoFalha: null,
    custoEEstimativa: false,
    custoAjustadoEm: null,
    disponivelEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
];
