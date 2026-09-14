/**
 * OS-LIFEBOARD · P4 — Contrato server → client do grafo de dependências v3.
 *
 * Tipo PLANO (sem `Set`/`Map`, sem `server-only`): o servidor (`page.tsx`) calcula
 * `ResultadoCPM` + `Map<string, ScoreAssimetria | null>` (camada O, `core/prioritize/*`)
 * e serializa para este formato antes de descer a um Client Component
 * (`DependencyGraph`). Nunca importar `caminho-critico.ts`/`assimetria.ts` (ambos
 * `server-only`) de um Client Component — só os TIPOS deste arquivo e de
 * `tipos-v3.ts`, que não carregam a guarda `server-only`.
 *
 * Serializador: `@/lib/serializa-grafo-v3` (`serializaGrafoV3`).
 */

import type { JanelaCPM, ScoreAssimetria } from "@/core/prioritize/tipos-v3";
import type { TaskEdge } from "@/types/canonical";

/**
 * P4d (achado MÉDIO #6 do crítico hostil ROUND 3): altura ÚNICA do cartão de
 * tarefa. Antes eram DOIS números hardcoded que só coincidiam por disciplina
 * manual — `h-[112px]` (classe Tailwind literal) em `task-node.tsx` e
 * `nodeH: 112` em `layout-do-grafo.ts`/`dependency-graph.tsx` — nenhum teste
 * comparava um contra o outro, então os três podiam divergir em silêncio (o
 * crítico provou: rodar com `h-[160px]`/`NODE_H: 112` fazia os 384 testes
 * passarem do mesmo jeito). Agora só existe ESTE número; `task-node.tsx`
 * consome via `style={{ height }}` (nunca uma classe Tailwind gerada
 * dinamicamente — o JIT do Tailwind só compila classes que aparecem como
 * STRING LITERAL no código-fonte, então um template `h-[${token}px]` nunca
 * seria compilado). `tests/unit/altura-do-cartao.test.ts` prova que os três
 * consumidores leem o mesmo valor.
 *
 * P4f (decisão D4 + achado BAIXO #10 do crítico hostil ROUND 5): o rodapé
 * continua com duas linhas, mas agora a de cima é SÓ o dado numérico
 * (`S xx · folga: N d`, sem truncar nunca) e a de baixo é chip de estado +
 * badge `A xx`; e a base tipográfica do cartão subiu de 12 para 13px (título
 * 14px) para que o texto de TELA fique acima de 11,4px também no piso de zoom
 * do modo cartão. Os dois somam altura: 156 é o que o conteúdo real pede
 * 180 é a ALTURA NATURAL do cartão mais alto, medida no navegador (clone do
 * cartão real fora do canvas, sem altura imposta: 179px no fixture de 11,
 * 180px no cenário de 40). É a régua que a decisão D4 manda seguir — "se ainda
 * não couber, o cartão cresce em altura pelo token": nada do rodapé pode ser
 * cortado em silêncio, e a nota (2 linhas) é o que definia o piso.
 * Continua sendo o ÚNICO número — layout e cartão seguem o token.
 */
export const ALTURA_DO_CARTAO = 180;

/**
 * Altura do cartão no MODO MAPA (achado MÉDIO #6 do crítico hostil ROUND 6).
 *
 * O que ele mediu: abaixo de 0,85 de zoom o cartão vira pastilha — uma linha
 * com ponto de estado, META e título — mas continuava com `height: 180`. "O
 * modo mapa esconde o conteúdo e mantém o tamanho": 40 tarefas em 7 linhas
 * pediam 7 × 264 = 1.764px de mundo, e nenhum zoom acima do piso enquadra
 * isso. Com a pastilha de 44px a mesma grade pede 812px e "Ver tudo" cabe
 * inteiro em 1280×800 sem encostar no piso de zoom.
 *
 * 44 não é estético: é o alvo de toque mínimo da régua de UI/UX da casa — a
 * pastilha continua clicável com o dedo.
 */
export const ALTURA_DA_PASTILHA = 44;

/** Modo de desenho do cartão — decidido pelo ZOOM (`tipografia-do-cartao.ts`). */
export type ModoDoCartao = "cartao" | "mapa";

/**
 * A altura do cartão no modo dado. FONTE ÚNICA: `task-node.tsx` desenha com
 * ela, `layout-do-grafo.ts` espaça as linhas com ela e `dependency-graph.tsx`
 * enquadra com ela. Antes o layout usava 180 sempre — inclusive quando a tela
 * mostrava pastilhas de 44.
 */
export function alturaDoCartao(modo: ModoDoCartao): number {
  return modo === "mapa" ? ALTURA_DA_PASTILHA : ALTURA_DO_CARTAO;
}

export interface GrafoV3Props {
  /** Arestas declaradas v3 (predecessor · correlação · sinergia · obsolescência). */
  edges: TaskEdge[];
  /** Ids com folga zero no caminho até o goal (goal incluído). */
  critico: string[];
  /** Janela de CPM por id de tarefa. */
  janelas: Record<string, JanelaCPM>;
  /** Ids sem `estimativaDias` que entraram no CPM com a duração-placeholder. */
  semDuracao: string[];
  /** Ids excluídos do CPM por ciclo de dependência. */
  emCiclo: string[];
  /** Goal usado pelo CPM. `null` = nenhum goal na lista. */
  goalId: string | null;
  /** Duração total do caminho crítico, em dias. */
  duracaoTotal: number;
  /** Score de assimetria por id de tarefa. `null` = sem átomos declarados. */
  scores: Record<string, ScoreAssimetria | null>;
}
