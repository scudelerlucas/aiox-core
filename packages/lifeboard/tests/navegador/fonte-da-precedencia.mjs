/**
 * OS-LIFEBOARD · P5 — rodada 14, achado ALTO 3: O UNIVERSO VEM DA FONTE.
 *
 * ## O defeito
 *
 * `void edges` em `precedenciaDeclarada` (`core/timeline/linha-do-tempo.ts`)
 * derruba a terceira fonte de precedência — as `task_edges` de tipo
 * `predecessor`. Os conectores do Gantt caíam de 5 para 4, e a guarda
 * **imprimia o número mudado e aprovava**, porque o "universo esperado" dela
 * era o que o próprio desenho tinha entregue: 4 desenhos, 4 conferidos, ok.
 * É a forma 3 do vício desta base — universo por convenção.
 *
 * ## A cura
 *
 * O conjunto ESPERADO de precedências sai da **mesma fonte de dado que
 * alimenta o CPM**: as tarefas e as arestas que `getTasksRepository()` serve.
 * A guarda sobe o servidor com `LIFEBOARD_DATA_MODE=fixture`, então a fonte é
 * `src/lib/repositories/tasks.fixture.ts` — lido aqui como DADO, sem passar
 * por nenhuma função do produto (passar por `precedenciaDeclarada` seria
 * medir a mentira contra ela mesma).
 *
 * A regra da união é a que o CPM declara (`tipos-v3.ts`, "Regras do CPM") e
 * que `precedenciaDeclarada` implementa, escrita de novo aqui de propósito:
 * `predecessorIds` ∪ `successorIds` (invertido) ∪ `task_edges` tipo
 * `predecessor`, descartando órfão e auto-laço. Duas implementações
 * independentes da mesma lei é o que torna a comparação capaz de reprovar.
 *
 * ## Falha fechada
 *
 * Se a leitura não achar tarefas, ou não achar NENHUMA aresta de tipo
 * `predecessor`, ou o total de pares vier abaixo do piso, esta função LANÇA.
 * Um universo esperado vazio aprovaria um Gantt sem conector nenhum — que é
 * exatamente o estado que o achado descreve, só que pior.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_DO_PACOTE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ARQUIVO_DA_FONTE = "src/lib/repositories/tasks.fixture.ts";

/** Piso do que a fixture tem de declarar — abaixo disto a leitura falhou. */
const MINIMO_DE_TAREFAS = 8;
const MINIMO_DE_PARES = 4;

/** `["a", "b"]` (ou `[]`) → array de strings. */
function listaDeStrings(bruto) {
  return [...bruto.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * As precedências declaradas na fonte de dado, como pares `origem->destino`.
 *
 * Devolve `{ ids, pares, porFonte }` — `porFonte` conta de onde cada par veio,
 * para o relatório mostrar que as TRÊS fontes da união estão representadas.
 */
export function precedenciaDaFonte() {
  const fonte = readFileSync(join(RAIZ_DO_PACOTE, ARQUIVO_DA_FONTE), "utf8");

  /* ── as tarefas: `makeTask("id", {…}, { … })` ─────────────────────────── */
  const ids = [];
  const arrays = new Map();
  for (const m of fonte.matchAll(/makeTask\(\s*"([^"]+)"/g)) ids.push(m[1]);
  /* Cada bloco `makeTask(...)` até o `}),` que o fecha — a fixture escreve um
     por tarefa, com indentação fixa. `predecessorIds`/`successorIds` são lidos
     dentro do bloco, para nunca atribuir o array de uma tarefa a outra. */
  const blocos = fonte.split(/makeTask\(\s*"/).slice(1);
  blocos.forEach((bloco, i) => {
    const id = ids[i];
    const fim = bloco.indexOf("\n  }),");
    const corpo = fim >= 0 ? bloco.slice(0, fim) : bloco;
    const preds = /predecessorIds:\s*\[([^\]]*)\]/.exec(corpo);
    const sucs = /successorIds:\s*\[([^\]]*)\]/.exec(corpo);
    arrays.set(id, {
      predecessorIds: preds ? listaDeStrings(preds[1]) : [],
      successorIds: sucs ? listaDeStrings(sucs[1]) : [],
    });
  });

  /* ── as arestas: FIXTURE_EDGES, só `tipo: "predecessor"` ──────────────── */
  const tabela = /const FIXTURE_EDGES[^=]*=\s*\[([\s\S]*?)\n\];/.exec(fonte);
  if (!tabela) {
    throw new Error(`${ARQUIVO_DA_FONTE}: não achei \`FIXTURE_EDGES\` — sem ela o universo seria menor que a verdade`);
  }
  const arestas = [];
  for (const bloco of tabela[1].split(/\n\s{2}\{/)) {
    const origem = /origem:\s*"([^"]+)"/.exec(bloco);
    const destino = /destino:\s*"([^"]+)"/.exec(bloco);
    const tipo = /tipo:\s*"([^"]+)"/.exec(bloco);
    if (origem && destino && tipo) arestas.push({ origem: origem[1], destino: destino[1], tipo: tipo[1] });
  }

  if (ids.length < MINIMO_DE_TAREFAS) {
    throw new Error(
      `${ARQUIVO_DA_FONTE}: li só ${String(ids.length)} tarefa(s) (piso ${String(MINIMO_DE_TAREFAS)}) — a leitura da fonte quebrou`,
    );
  }
  if (!arestas.some((e) => e.tipo === "predecessor")) {
    throw new Error(
      `${ARQUIVO_DA_FONTE}: nenhuma aresta \`tipo: "predecessor"\` — é a fonte que o \`void edges\` apaga, e sem ela esta medida não mediria nada`,
    );
  }

  /* ── a união, escrita aqui de novo (a lei do CPM, não a função dele) ──── */
  const validos = new Set(ids);
  const pares = new Map();
  const liga = (origem, destino, deOnde) => {
    if (!validos.has(origem) || !validos.has(destino) || origem === destino) return;
    const chave = `${origem}->${destino}`;
    pares.set(chave, [...new Set([...(pares.get(chave) ?? []), deOnde])]);
  };
  for (const id of ids) {
    const a = arrays.get(id) ?? { predecessorIds: [], successorIds: [] };
    for (const p of a.predecessorIds) liga(p, id, "predecessorIds");
    for (const s of a.successorIds) liga(id, s, "successorIds");
  }
  for (const e of arestas) if (e.tipo === "predecessor") liga(e.origem, e.destino, "task_edges");

  if (pares.size < MINIMO_DE_PARES) {
    throw new Error(
      `${ARQUIVO_DA_FONTE}: a união deu só ${String(pares.size)} par(es) (piso ${String(MINIMO_DE_PARES)}) — universo esperado pequeno demais para reprovar coisa alguma`,
    );
  }
  const porFonte = {};
  for (const fontes of pares.values()) {
    for (const f of fontes) porFonte[f] = (porFonte[f] ?? 0) + 1;
  }
  for (const exigida of ["predecessorIds", "successorIds", "task_edges"]) {
    if (!porFonte[exigida]) {
      throw new Error(
        `${ARQUIVO_DA_FONTE}: a fonte "${exigida}" não contribuiu com nenhum par — as três fontes da união do CPM têm de estar representadas, senão a medida não cobre a que sumir`,
      );
    }
  }
  return { ids, pares, porFonte };
}
