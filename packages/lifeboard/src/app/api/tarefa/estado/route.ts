/**
 * OS-LIFEBOARD · P6 — A FOTOGRAFIA DO ESTADO (só em modo fixture).
 *
 * [ALTO #1, rodada 17] Por que esta rota existe, dito sem maquiagem.
 *
 * A família `P` da guarda de navegador perguntava, de cada escrita, "o valor
 * que pedi voltou?" — **uma op por vez, cada uma lendo só o seu próprio
 * campo**. Nenhuma medida perguntava "e o resto continua como estava?". O
 * crítico da rodada 17 derrubou a guarda inteira com uma linha em
 * `statusSetFixture` que, ao mudar o status, também apagava a duração:
 * cinco portões verdes, 50 medidas verdes, e a guarda IMPRIMINDO o apagamento
 * (`antes=""` onde antes era `"2"`) sem reprovar.
 *
 * Uma escrita só pode ser conferida contra o estado INTEIRO, e o estado
 * inteiro não cabe na tela de uma tarefa: a página de `/tarefa/task-docs` não
 * mostra a duração de `task-build`, nem as notas das outras tarefas. Daí esta
 * rota — o mesmo `carregarEstado()` que a página usa, servido como JSON para
 * a guarda tirar a fotografia antes e depois de cada escrita.
 *
 * ## As travas
 *
 * 1. **Modo live responde 404, sempre.** Em produção (`LIFEBOARD_DATA_MODE=live`)
 *    esta rota não existe: nem o `GET`, nem o `POST`. O dado real do operador
 *    nunca passa por aqui.
 * 2. **Ela só LÊ.** Esta rota não importa mutador nenhum, e é por isso que ela
 *    não vira um portador novo na varredura de `tests/unit/tarefa-escritas-varredura`:
 *    a lei "só a porta escreve" continua com os mesmos três portadores. A
 *    primeira versão desta correção tinha um `POST` que devolvia o store à
 *    semente (seria o jeito mais simples de dar a cada medida `P` um estado
 *    próprio) — **a varredura o acusou como escrita fora da porta, e ele foi
 *    retirado**. O estado próprio de cada medida passou a ser escrito pela
 *    própria medida, pela interface, e conferido depois do F5.
 * 3. **Ela lê pela mesma porta da página.** Se fosse um caminho de leitura
 *    próprio, uma sabotagem poderia estragar o que a página lê e deixar a
 *    fotografia limpa. `carregarEstado` é literalmente a função que
 *    `src/app/tarefa/[id]/page.tsx` chama.
 */

import { carregarEstado } from "@/app/tarefa/estado";
import { env } from "@/config/env";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Em live esta rota não existe — nem para ler, nem para zerar. */
function foraDoFixture(): Response | null {
  if (env.LIFEBOARD_DATA_MODE === "fixture") return null;
  return json({ error: "not_found" }, 404);
}

/**
 * [ALTO #2, rodada 18] `sources` entrou na fotografia.
 *
 * Dois motivos, e o segundo é o que obrigou:
 *
 * 1. a fotografia é o universo contra o qual o ALCANCE de cada escrita é
 *    conferido — uma coleção de fora do universo é uma coleção onde um estrago
 *    não aparece;
 * 2. a guarda passou a conferir os CAMPOS de toda entidade que nasce, e uma
 *    subtarefa nasce com `sourceId` da fonte "Notas". Sem `sources` na
 *    fotografia, a guarda teria de trazer aquele id escrito à mão — que é
 *    justamente a "grafia literal" de que esta peça já saiu três vezes. Com
 *    ele aqui, a expectativa é DERIVADA: a fonte cujo `kind` é `notes`.
 */
export async function GET(): Promise<Response> {
  const barrado = foraDoFixture();
  if (barrado !== null) return barrado;
  const { tasks, edges, notes, sources } = await carregarEstado();
  return json({ tasks, edges, notes, sources });
}
