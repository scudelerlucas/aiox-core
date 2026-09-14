/**
 * OS-LIFEBOARD · P6 — o despachante live × fixture.
 *
 * Este módulo NÃO tem `"use server"`, e é exatamente esse o ponto.
 *
 * [Achado MAIOR, CodeRabbit + rodada 10] `mutar` morava em `actions.ts`, que é
 * um módulo `"use server"`. Toda função exportada de um módulo desses é uma
 * Server Action PÚBLICA: o Next publica um endpoint para ela, e qualquer
 * cliente autenticado pode chamá-la pela rede. Como `mutar(op, payload)`
 * aceita uma `op` solta e um objeto qualquer, e despacha direto para
 * `mutateLifeboard` ou para o store do fixture, ela era uma porta dos fundos
 * para TODA a escrita — sem `PedidoDeEscrita`, sem `ehOperacaoDeEscrita`, sem
 * a porta de `porta-de-escrita.ts`, sem anúncio e sem foco.
 *
 * A ironia é que o `export` tinha sido acrescentado na rodada 4 "só para
 * teste", para que o ramo `default` do `switch` ganhasse cobertura. O remédio
 * abriu o buraco que a peça inteira existe para fechar.
 *
 * Tirar só o `export` fecharia o buraco e mataria o teste junto. Mover o
 * despachante para FORA da fronteira `"use server"` fecha o buraco e mantém o
 * teste: aqui `mutar` é uma função de módulo comum — importável por
 * `actions.ts` e pelos testes, e invisível para a rede, porque o Next só
 * publica endpoint para o que está sob `"use server"`.
 *
 * A regra que fica: `actions.ts` exporta APENAS o que deve ser chamável da
 * rede. Tudo que é mecânica interna mora aqui.
 *
 * @module app/tarefa/despachante
 */

import { env } from "@/config/env";
import {
  arestaAddFixture,
  arestaDelFixture,
  atomosSetFixture,
  estimativaSetFixture,
  goalSetFixture,
  notaAddFixture,
  notaDelFixture,
  parentSetFixture,
  statusSetFixture,
  subtarefaAddFixture,
} from "@/lib/repositories/tasks.fixture-store";
import { mutateLifeboard } from "@/lib/supabase/live-client";
import type { AssimetriaDeclarada, EdgeTipo, TaskStatus } from "@/types/canonical";

/** O par que `useFormState` espera — o despachante nunca lança. */
export type ResultadoMutar = { ok: true; id?: string } | { erro: string };

/**
 * Despachante único: live chama a RPC secret-gated; fixture, o store em
 * memória. `env.LIFEBOARD_DATA_MODE` decide uma vez, aqui no topo — nenhuma
 * ação chama a RPC em modo fixture, e nenhuma toca o store em modo live.
 *
 * Não é uma Server Action (ver o cabeçalho deste arquivo). Quem chama de fora
 * do servidor é `escreverTarefaAction`, e só ela.
 */
export async function mutar(op: string, payload: Record<string, unknown>): Promise<ResultadoMutar> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    return mutateLifeboard(op, payload);
  }
  switch (op) {
    case "nota_add":
      return notaAddFixture(
        payload.task_id as string,
        payload.texto as string,
        (payload.autor as string | null) ?? null,
        (payload.criado_em as string | null) ?? null,
      );
    case "nota_del":
      return notaDelFixture(payload.id as string);
    case "subtarefa_add":
      return subtarefaAddFixture(
        payload.parent_id as string,
        payload.title as string,
        (payload.estimativa_dias as number | null) ?? null,
      );
    case "parent_set":
      return parentSetFixture(payload.task_id as string, (payload.parent_id as string | null) ?? null);
    case "goal_set":
      return goalSetFixture(payload.task_id as string, payload.is_goal as boolean);
    case "atomos_set":
      return atomosSetFixture(
        payload.task_id as string,
        (payload.assimetria as AssimetriaDeclarada | null) ?? null,
      );
    case "estimativa_set":
      return estimativaSetFixture(
        payload.task_id as string,
        (payload.estimativa_dias as number | null) ?? null,
      );
    case "status_set":
      return statusSetFixture(payload.task_id as string, payload.status as TaskStatus);
    case "aresta_add":
      return arestaAddFixture(
        payload.origem as string,
        payload.destino as string,
        payload.tipo as EdgeTipo,
        (payload.peso as number | undefined) ?? 1,
        (payload.nota as string | null) ?? null,
        (payload.criado_em as string | null) ?? null,
      );
    case "aresta_del":
      return arestaDelFixture(payload.id as string);
    default:
      // [BAIXO #5, rodada 3] a mensagem não ecoa mais `op` (valor recebido,
      // não confiável) — texto fixo em português; o valor real ainda vai
      // para o log do servidor, nunca para a tela.
      console.error("[tarefa/despachante] operação desconhecida no dispatcher fixture:", op);
      return { erro: "Operação desconhecida." };
  }
}
