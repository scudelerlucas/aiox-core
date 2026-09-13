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
export const FIXTURE_CONSUMO: readonly ConsumoConta[] = [
  {
    conta: "lucasscudeler@gmail.com",
    tetoUsd: 150,
    consumoHojeUsd: 42.1,
    reservadoUsd: 0,
    naFilaUsd: 5,
    medidoAteEm: menosMin(30),
  }, // ok (28,1%)
  {
    conta: "lsgpandora@gmail.com",
    tetoUsd: 150,
    consumoHojeUsd: 98.5,
    reservadoUsd: 15,
    naFilaUsd: 0,
    medidoAteEm: menosMin(80),
  }, // warn (75,7%)
  {
    conta: "almapetra.ltda@gmail.com",
    tetoUsd: 150,
    consumoHojeUsd: 150,
    reservadoUsd: 0,
    naFilaUsd: 120,
    medidoAteEm: menosMin(13 * 60),
  }, // crit — teto atingido
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
    sessaoUrl: null,
    resultado: null,
    criadoPor: "lucasscudeler@gmail.com",
    taskId: null,
  },
];
