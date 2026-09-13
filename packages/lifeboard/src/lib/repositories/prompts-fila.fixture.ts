/**
 * OS-LIFEBOARD · P7 — semente fixture da fila de prompts.
 *
 * Números escolhidos para mostrar as 3 faixas de cor da barra de consumo
 * (ok/warn/crit — `faixaConsumo` em `@/core/prompts/tipos`) e os 5 estados da
 * fila numa carga só, sem precisar rodar nada — o mesmo espírito de
 * `tasks.fixture.ts` (read-only; a cópia mutável vive em
 * `prompts-fila.fixture-store.ts`).
 */

import type { ConsumoConta, ItemFilaPrompt } from "@/core/prompts/tipos";

export const FIXTURE_CONSUMO: readonly ConsumoConta[] = [
  { conta: "lucasscudeler@gmail.com", tetoUsd: 150, consumoHojeUsd: 42.1 }, // ok (28%)
  { conta: "lsgpandora@gmail.com", tetoUsd: 150, consumoHojeUsd: 98.5 }, // warn (66%)
  { conta: "almapetra.ltda@gmail.com", tetoUsd: 150, consumoHojeUsd: 150 }, // crit — teto atingido
];

export const FIXTURE_FILA: readonly ItemFilaPrompt[] = [
  {
    id: "fila-fixture-1",
    conta: "lucasscudeler@gmail.com",
    prompt: "Auditar o PR #716 do painel de assuntos e apontar riscos de RLS.",
    complexidade: "alta",
    modeloSugerido: "Opus",
    estado: "concluida",
    custoUsd: 3.42,
    criadoEm: "2026-09-13T09:10:00.000Z",
    pegoEm: "2026-09-13T09:12:00.000Z",
    concluidoEm: "2026-09-13T09:41:00.000Z",
    sessaoUrl: "https://claude.ai/code/session_01ABCDEF00000000000000001",
    resultado: "3 riscos apontados, PR comentado.",
    criadoPor: "Lucas",
    taskId: null,
  },
  {
    id: "fila-fixture-2",
    conta: "lsgpandora@gmail.com",
    prompt: "Escrever o roteiro do reel de terça sobre ferida de abandono.",
    complexidade: "media",
    modeloSugerido: "Sonnet",
    estado: "pega",
    custoUsd: null,
    criadoEm: "2026-09-13T10:02:00.000Z",
    pegoEm: "2026-09-13T10:05:00.000Z",
    concluidoEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "Lucas",
    taskId: null,
  },
  {
    id: "fila-fixture-3",
    conta: "lucasscudeler@gmail.com",
    prompt: "Listar os PRs abertos há mais de 5 dias no repo vsl-mastery.",
    complexidade: "baixa",
    modeloSugerido: "Haiku",
    estado: "na_fila",
    custoUsd: null,
    criadoEm: "2026-09-13T11:00:00.000Z",
    pegoEm: null,
    concluidoEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "Lucas",
    taskId: "task-build",
  },
  {
    id: "fila-fixture-4",
    conta: "almapetra.ltda@gmail.com",
    prompt: "Redesenhar o score de assimetria com o átomo de opcionalidade.",
    complexidade: "maxima",
    modeloSugerido: "Fable",
    estado: "falhou",
    custoUsd: 8.9,
    criadoEm: "2026-09-12T22:00:00.000Z",
    pegoEm: "2026-09-12T22:03:00.000Z",
    concluidoEm: "2026-09-12T22:50:00.000Z",
    sessaoUrl: "https://claude.ai/code/session_01ABCDEF00000000000000002",
    resultado: "Teto de gasto do dia bateu no meio da sessão — retomar amanhã.",
    criadoPor: "Lucas",
    taskId: null,
  },
  {
    id: "fila-fixture-5",
    conta: "lsgpandora@gmail.com",
    prompt: "Gerar 10 variações de headline para a página do quiz.",
    complexidade: "baixa",
    modeloSugerido: "Haiku",
    estado: "cancelada",
    custoUsd: null,
    criadoEm: "2026-09-12T15:00:00.000Z",
    pegoEm: null,
    concluidoEm: null,
    sessaoUrl: null,
    resultado: null,
    criadoPor: "Lucas",
    taskId: null,
  },
];
