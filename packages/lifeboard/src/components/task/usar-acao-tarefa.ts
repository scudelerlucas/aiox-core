/**
 * OS-LIFEBOARD · P6 — o MIOLO da chamada de escrita, sem React.
 *
 * Extraído na rodada 5 (achado MÉDIO #4: 8 dos 9 componentes de P6 não tinham
 * teste, e a parte mais cara de errar aqui — "falha de rede vira frase em
 * português" — só existia dentro de um hook, que sem jsdom não dá para
 * montar). Como função pura, ela é testável direto
 * (`tests/unit/tarefa-acao-executar.test.ts`).
 *
 * [ALTO #1, rodada 9] O hook `useAcaoTarefa` que morava aqui DEIXOU DE
 * EXISTIR. Ele devolvia um `disparar(form)` cru, e era exatamente isso que
 * tornava possível a forma M8 do crítico: um segundo hook no mesmo arquivo,
 * um handler que CITAVA a porta e um `disparar(form)` que passava por fora
 * dela. O despacho agora só existe dentro de `porta-de-escrita.ts`, e sai de
 * lá já validado, já anunciado e já com o foco entregue.
 *
 * Nunca lança: uma falha de REDE de verdade (o fetch da Server Action
 * rejeita) não devolve `{erro}` nenhum — sem este `catch` o `await` do
 * chamador estouraria, o controle otimista ficaria preso no valor recusado e
 * nenhum `aoFalha`/`router.refresh()` rodaria. Mensagem genérica em
 * português; nunca a stack nem o erro cru na tela.
 */

import type { EstadoAcaoTarefa } from "@/app/tarefa/pedido";

export async function executarAcaoTarefa<A>(
  acao: (estado: EstadoAcaoTarefa, argumento: A) => Promise<EstadoAcaoTarefa>,
  estado: EstadoAcaoTarefa,
  argumento: A,
): Promise<EstadoAcaoTarefa> {
  try {
    return await acao(estado, argumento);
  } catch {
    return { erro: "Não foi possível salvar agora — tente de novo." };
  }
}
