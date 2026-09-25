import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { duracaoCanonica } from "@/components/task/duracao-form";

/**
 * ═══════════════════════════════════════════════════════ ALTO #1, rodada 18 ═
 * OS QUATRO STATUS, DERIVADOS DO FONTE — NÃO SÓ `"done"`.
 *
 * Os dois testes de `statusSetAction` (modo live e modo fixture) exerciam
 * `"done"` e mais nada. `blocked` não era gravado por teste nenhum desta base
 * nem por medida nenhuma da guarda de navegador (lá ele só aparece como o 2º
 * clique de uma corrida, e é exigido RECUSADO). A sabotagem de uma linha
 * `status: status === "blocked" ? "done" : status` passava por tudo.
 *
 * A lista sai do fonte do produto — `STATUS_VALIDOS` em `actions.ts` — e não
 * de uma cópia escrita aqui: status novo entra nos dois testes sozinho. E há
 * piso, escrito à mão: se a leitura quebrar e devolver menos que isto, o teste
 * falha em vez de voltar a exercer o caso fácil.
 */
const PISO_DE_STATUS = 4;

function statusDoProduto(): string[] {
  const fonte = readFileSync(
    new URL("../../src/app/tarefa/actions.ts", import.meta.url),
    "utf8",
  );
  const bloco = /const STATUS_VALIDOS[^=]*=\s*\[([^\]]*)\]/.exec(fonte);
  const lidos = [...(bloco?.[1] ?? "").matchAll(/"([^"\n]+)"/g)].map((m) => m[1] ?? "");
  if (lidos.length < PISO_DE_STATUS) {
    throw new Error(
      `li ${String(lidos.length)} status em actions.ts, piso escrito à mão ${String(
        PISO_DE_STATUS,
      )} — derivação quebrada é cegueira, não aprovação`,
    );
  }
  return lidos;
}

const STATUS_DO_PRODUTO = statusDoProduto();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/live-client", () => ({
  mutateLifeboard: vi.fn(async () => ({ ok: true }) as const),
}));

vi.mock("@/lib/repositories/tasks.fixture-store", () => ({
  notaAddFixture: vi.fn(() => ({ ok: true, id: "note-x" }) as const),
  notaDelFixture: vi.fn(() => ({ ok: true }) as const),
  subtarefaAddFixture: vi.fn(() => ({ ok: true, id: "task-x" }) as const),
  parentSetFixture: vi.fn(() => ({ ok: true }) as const),
  goalSetFixture: vi.fn(() => ({ ok: true }) as const),
  atomosSetFixture: vi.fn(() => ({ ok: true }) as const),
  estimativaSetFixture: vi.fn(() => ({ ok: true }) as const),
  statusSetFixture: vi.fn(() => ({ ok: true }) as const),
  arestaAddFixture: vi.fn(() => ({ ok: true, id: "edge-x" }) as const),
  arestaDelFixture: vi.fn(() => ({ ok: true }) as const),
}));

import { revalidatePath } from "next/cache";

import { mutateLifeboard } from "@/lib/supabase/live-client";
import * as fixtureStore from "@/lib/repositories/tasks.fixture-store";
import { escreverTarefaAction } from "@/app/tarefa/actions";
import { mutar } from "@/app/tarefa/despachante";
import type {
  EstadoAcaoTarefa,
  OperacaoDeEscrita,
  PedidoDeEscrita,
} from "@/app/tarefa/pedido";

/**
 * [ALTO #1, rodada 9] As dez actions por operação deixaram de ser exportadas:
 * o servidor desta página tem UMA porta, `escreverTarefaAction`, e ela só
 * aceita um `PedidoDeEscrita` (selo `unique symbol` não exportado —
 * `pedido.ts`). Um componente não consegue montar esse objeto; um TESTE
 * consegue, com a conversão abaixo, e é isso que mantém a bateria de
 * validação desta rodada apontando exatamente para os mesmos ramos.
 *
 * Os dez nomes viram apelidos locais com a `op` correspondente — o corpo dos
 * testes abaixo não mudou uma linha.
 */
function porOp(op: OperacaoDeEscrita) {
  return async (estado: EstadoAcaoTarefa, f: FormData): Promise<EstadoAcaoTarefa> => {
    const campos: Record<string, string> = {};
    for (const [k, v] of f.entries()) if (typeof v === "string") campos[k] = v;
    return escreverTarefaAction(estado, { op, campos } as unknown as PedidoDeEscrita);
  };
}

const notaAddAction = porOp("nota_criar");
const notaDelAction = porOp("nota_excluir");
const subtarefaAddAction = porOp("subtarefa_criar");
const parentSetAction = porOp("mae");
const goalSetAction = porOp("meta");
const atomosSetAction = porOp("atomos_salvar");
const estimativaSetAction = porOp("duracao");
const statusSetAction = porOp("status");
const arestaAddAction = porOp("relacao_criar");
const arestaDelAction = porOp("relacao_excluir");

/**
 * OS-LIFEBOARD · P6 — os ramos de VALIDAÇÃO das server actions da tarefa
 * devolvem `{ erro }` em português SEM chamar `mutateLifeboard` (modo live)
 * nem qualquer função de `tasks.fixture-store` (modo fixture) — a régua de
 * UI/UX (B11 + "erro em português no campo, nunca JSON") é do lado do
 * cliente/servidor da ação, antes de gastar uma chamada.
 */
function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

function nenhumaChamadaFoiFeita(): void {
  expect(mutateLifeboard).not.toHaveBeenCalled();
  for (const fn of Object.values(fixtureStore)) {
    expect(fn as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  }
}

describe("tarefa/actions — validação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notaAddAction: texto vazio", async () => {
    const r = await notaAddAction({}, form({ task_id: "task-build", texto: "   " }));
    expect(r).toEqual({ erro: "Escreva algo antes de salvar a nota." });
    nenhumaChamadaFoiFeita();
  });

  it("notaAddAction: sem task_id", async () => {
    const r = await notaAddAction({}, form({ texto: "algo" }));
    expect(r).toEqual({ erro: "Tarefa não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("notaDelAction: sem id", async () => {
    const r = await notaDelAction({}, form({ task_id: "task-build" }));
    expect(r).toEqual({ erro: "Nota não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: título vazio", async () => {
    const r = await subtarefaAddAction({}, form({ parent_id: "task-build", title: "  " }));
    expect(r).toEqual({ erro: "O título da subtarefa não pode ficar vazio." });
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: sem parent_id", async () => {
    const r = await subtarefaAddAction({}, form({ title: "algo" }));
    expect(r).toEqual({ erro: "Tarefa mãe não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: estimativa <= 0", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "0" }),
    );
    expect(r.erro).toMatch(/0,25/);
    nenhumaChamadaFoiFeita();
  });

  // [BAIXO #10, crítico 13/09, rodada 2] antes desta correção, `subtarefa_add`
  // só exigia `> 0` (aceitava 0,1) enquanto `estimativa_set` exigia `>= 0,25`
  // — o MESMO campo, duas leis diferentes conforme a porta de entrada. Agora
  // as duas usam `estimativaValidaOuErro` (`DURACAO_MINIMA_DIAS`).
  it("subtarefaAddAction: estimativa 0,1 — abaixo do mínimo unificado (0,25); antes era aceita (achado BAIXO #10)", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "0.1" }),
    );
    expect(r.erro).toMatch(/0,25/);
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: título acima do teto (500) é recusado (achado ALTO #2, rodada 2)", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "x".repeat(501) }),
    );
    expect(r.erro).toMatch(/500/);
    nenhumaChamadaFoiFeita();
  });

  it("notaAddAction: autor acima do teto (120) é recusado (achado ALTO #2, rodada 2)", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "nota válida", autor: "x".repeat(121) }),
    );
    expect(r.erro).toMatch(/120/);
    nenhumaChamadaFoiFeita();
  });

  it("parentSetAction: parent_id igual a task_id", async () => {
    const r = await parentSetAction({}, form({ task_id: "task-build", parent_id: "task-build" }));
    expect(r).toEqual({ erro: "Uma tarefa não pode ser mãe de si mesma." });
    nenhumaChamadaFoiFeita();
  });

  it("goalSetAction: sem task_id", async () => {
    const r = await goalSetAction({}, form({ is_goal: "true" }));
    expect(r).toEqual({ erro: "Tarefa não identificada." });
    nenhumaChamadaFoiFeita();
  });

  it("atomosSetAction: opcionalidade fora do domínio (1..3)", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "9", esforco: "1", custo: "1" }),
    );
    expect(r.erro).toMatch(/^Átomos inválidos/);
    nenhumaChamadaFoiFeita();
  });

  it("atomosSetAction: esforço fora das faixas {1,2,3,5}", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "2", esforco: "4", custo: "1" }),
    );
    expect(r.erro).toMatch(/^Átomos inválidos/);
    nenhumaChamadaFoiFeita();
  });

  /**
   * ═════════════════════════════════════════════ CRÍTICO + MUTAÇÃO 2, rodada 11 ═
   * `NaN` é o caminho do que a caixa mostra e o `Number()` não converte —
   * `2e`, `1,5`, `--`. `NaN < x` e `NaN > y` são AMBOS falsos: trocar
   * `if (!Number.isFinite(n) || n < MIN)` por `if (n < MIN)` faz o valor
   * atravessar a régua inteira e chegar à RPC, que é exatamente o caminho do
   * CRÍTICO desta rodada. Cada forma tem o seu caso — uma só deixaria o ramo
   * meio provado.
   */
  /*
   * [BAIXO #2, rodada 15] `"1,5"` SAIU DESTA LISTA e ganhou caso próprio mais
   * abaixo: o teclado `inputMode="decimal"` de um celular em português entrega
   * vírgula, e recusar o que o próprio campo oferece era a tela brigando com
   * ela mesma. O que entrou no lugar são as grafias AMBÍGUAS — `1.234,5` e
   * `1,5,5` —, que continuam recusadas de propósito.
   */
  for (const bruto of ["2e", "--", "abc", "e", "Infinity", "0x10", "1.234,5", "1,5,5", ","]) {
    it(`estimativaSetAction: "${bruto}" não é número — recusa em português, sem tocar a rede`, async () => {
      const r = await estimativaSetAction(
        {},
        form({ task_id: "task-build", estimativa_dias: bruto }),
      );
      expect(r.erro, `"${bruto}" passou pela régua`).toBeDefined();
      expect(r.ok).toBeUndefined();
      nenhumaChamadaFoiFeita();
    });
  }

  it('estimativaSetAction: "2e" diz que o problema é NÃO SER NÚMERO, não ser pequeno', async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "2e" }));
    expect(r.erro).toBe(
      "A duração precisa ser um número em dias, com ponto ou vírgula no decimal (ex.: 1.5 ou 1,5).",
    );
  });

  /**
   * ══════════════════════════════════════════════════════ BAIXO #2, rodada 15 ═
   * A VÍRGULA QUE O TECLADO OFERECE PASSA A SER ACEITA.
   *
   * Medido pelo crítico: o campo declara `inputMode="decimal"`, o teclado pt-BR
   * entrega vírgula, e a página respondia "precisa ser um número em dias, com
   * ponto no decimal". Desde a rodada 11 o campo é de TEXTO, então a vírgula
   * CHEGA ao servidor e dá para tratá-la. Uma vírgula decimal, e só uma.
   */
  for (const [bruto, esperado] of [
    ["1,5", 1.5],
    ["0,5", 0.5],
    ["  2,25  ", 2.25],
  ] as const) {
    it(`estimativaSetAction: "${bruto}" é aceito e grava ${String(esperado)}`, async () => {
      const r = await estimativaSetAction(
        {},
        form({ task_id: "task-build", estimativa_dias: bruto }),
      );
      expect(r.erro, `"${bruto}" foi recusado`).toBeUndefined();
      expect(r.ok).toBe(true);
    });
  }

  it("estimativaSetAction: a vírgula NÃO escapa do limite de casas decimais", async () => {
    // `0,1255` tem 4 casas: sem contar a vírgula como separador, o limite
    // passava batido e o Postgres arredondaria em silêncio (BAIXO #10, rodada 13).
    const r = await estimativaSetAction(
      {},
      form({ task_id: "task-build", estimativa_dias: "0,1255" }),
    );
    expect(r.erro, "0,1255 passou pelo limite de casas").toBeDefined();
  });

  /**
   * ══════════════════════════════════════════════ BAIXO #1, rodada 12 ═
   * `" "` (SÓ ESPAÇO) NA DURAÇÃO ERA TRATADO COMO REMOÇÃO.
   *
   * Medido no Chromium em `/tarefa/task-docs` (duração 2): apagar o número,
   * digitar um espaço, "Salvar duração" → a tela diz "Duração removida." e o
   * banco fica `null`. Mesma família do CRÍTICO da rodada 11 — um campo que
   * PARECE preenchido apaga o dado. As outras entradas ilegíveis (`2e`,
   * `1,5`) já recusavam; esta passava porque o `.trim()` acontecia antes da
   * pergunta "veio alguma coisa?".
   *
   * MUTAÇÃO: voltar `duracaoBrutaOuErro` a `textoOu(...).trim()`.
   */
  for (const branco of [" ", "   ", "\t", "\n", " \t "]) {
    it(`estimativaSetAction: ${JSON.stringify(branco)} NÃO remove a duração — recusa`, async () => {
      const r = await estimativaSetAction(
        {},
        form({ task_id: "task-build", estimativa_dias: branco }),
      );
      expect(r.erro, `${JSON.stringify(branco)} apagou a duração`).toBeDefined();
      expect(r.ok).toBeUndefined();
      nenhumaChamadaFoiFeita();
    });
  }

  /**
   * ══════════════════════════════════════════════════ BAIXO #10, rodada 13 ═
   * O CLIENTE ACEITAVA MAIS CASAS DO QUE A COLUNA GUARDA.
   *
   * `tasks.estimativa_dias` é `numeric(6,2)` e `task_edges.peso` é
   * `numeric(4,3)` (migration 0004). Em fixture o JavaScript guardava `1.005`
   * e `0.5555` inteiros e a tela confirmava "Duração salva."; em live o
   * Postgres ARREDONDA na gravação. Os dois modos discordavam sobre a mesma
   * entrada, e no modo que vale o operador via na volta um número que nunca
   * digitou.
   *
   * MUTAÇÃO: tirar a checagem de `casasDecimais`.
   */
  for (const [bruto, casas] of [
    ["1.005", 3],
    ["0.333333", 6],
    ["2.129", 3],
  ] as const) {
    it(`estimativaSetAction: "${bruto}" (${String(casas)} casas) é recusado — a coluna guarda 2`, async () => {
      const r = await estimativaSetAction(
        {},
        form({ task_id: "task-build", estimativa_dias: bruto }),
      );
      expect(r.erro, `"${bruto}" passou`).toContain("2 casas");
      expect(r.ok).toBeUndefined();
      nenhumaChamadaFoiFeita();
    });
  }

  for (const bom of ["1", "1.5", "1.25", "0.25", "9999.99"]) {
    it(`estimativaSetAction: "${bom}" continua passando`, async () => {
      const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: bom }));
      expect(r.erro, `"${bom}" foi recusado por engano`).toBeUndefined();
      expect(r.ok).toBe(true);
    });
  }

  it("arestaAddAction: desconto com 4 casas é recusado — `peso` é numeric(4,3)", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-docs", tipo: "sinergia", peso: "0.5555" }),
    );
    expect(r.erro).toContain("3 casas");
    expect(r.ok).toBeUndefined();
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: desconto com 3 casas continua passando", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-docs", tipo: "sinergia", peso: "0.125" }),
    );
    expect(r.erro).toBeUndefined();
    expect(r.ok).toBe(true);
  });

  it("subtarefaAddAction: a duração da subtarefa segue a MESMA régua de casas", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "1.005" }),
    );
    expect(r.erro).toContain("2 casas");
    nenhumaChamadaFoiFeita();
  });

  it("estimativaSetAction: a recusa do branco ensina como REMOVER de verdade", async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: " " }));
    expect(r.erro).toContain("deixe a caixa vazia");
  });

  it('estimativaSetAction: a caixa VAZIA de verdade continua removendo', async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "" }));
    expect(r.ok).toBe(true);
    expect(fixtureStore.estimativaSetFixture).toHaveBeenCalledWith("task-build", null);
  });

  it('estimativaSetAction: "  4  " continua gravando 4 (o branco em volta não estorva)', async () => {
    const r = await estimativaSetAction(
      {},
      form({ task_id: "task-build", estimativa_dias: "  4  " }),
    );
    expect(r.ok).toBe(true);
    expect(fixtureStore.estimativaSetFixture).toHaveBeenCalledWith("task-build", 4);
  });

  it('subtarefaAddAction: " " na duração recusa — a subtarefa não nasce sem duração por um espaço', async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: " " }),
    );
    expect(r.erro).toBeDefined();
    nenhumaChamadaFoiFeita();
  });

  it('subtarefaAddAction: "2e" na duração recusa — a subtarefa NÃO nasce sem duração', async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "2e" }),
    );
    expect(r.erro).toBeDefined();
    nenhumaChamadaFoiFeita();
  });

  /**
   * [ALTO A2, rodada 11] O desconto VAZIO não é o desconto AUSENTE. Com
   * `let peso = 1; if (pesoBruto.length > 0)`, a tela mostrando `0.5` e o
   * programa recebendo `""` gravava **1** — o extremo oposto da escala —
   * dentro da conta do HIERARQ, anunciando "Relação criada.".
   */
  it("arestaAddAction: `peso` presente e VAZIO é recusado (nunca vira o default 1)", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-docs", tipo: "sinergia", peso: "" }),
    );
    expect(r.erro).toBe("O desconto precisa ser um número entre 0 e 1.");
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: `peso` ilegível é recusado (0.5e, 0,5,5, abc)", async () => {
    // [BAIXO #2, rodada 15] `0,5` saiu daqui: passou a ser aceito, como no
    // campo de duração. O que ficou são as grafias ambíguas.
    for (const bruto of ["0.5e", "0,5,5", "abc", "0.5,5"]) {
      vi.clearAllMocks();
      const r = await arestaAddAction(
        {},
        form({ origem: "task-build", destino: "task-docs", tipo: "sinergia", peso: bruto }),
      );
      expect(r.erro, `"${bruto}" passou`).toBe("O desconto precisa ser um número entre 0 e 1.");
      nenhumaChamadaFoiFeita();
    }
  });

  it("arestaAddAction: `peso` com vírgula decimal é aceito (teclado pt-BR)", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-docs", tipo: "sinergia", peso: "0,5" }),
    );
    expect(r.erro, '"0,5" foi recusado no desconto').toBeUndefined();
  });

  it("arestaAddAction: `peso` AUSENTE continua valendo 1 (relação que não é sinergia)", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-docs", tipo: "predecessor" }),
    );
    expect(r.ok).toBe(true);
    expect(fixtureStore.arestaAddFixture).toHaveBeenCalledWith(
      "task-build",
      "task-docs",
      "predecessor",
      1,
      null,
      null,
    );
  });

  it("estimativaSetAction: abaixo do mínimo (0,25)", async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "0.1" }));
    expect(r.erro).toMatch(/0,25/);
    nenhumaChamadaFoiFeita();
  });

  // ALTO #3 (crítico 13/09) — sem teto superior, isto virava "numeric field
  // overflow" cru vindo do banco (numeric(6,2)). Pego aqui, antes da rede.
  it("estimativaSetAction: acima do teto (9999.99)", async () => {
    const r = await estimativaSetAction(
      {},
      form({ task_id: "task-build", estimativa_dias: "99999999" }),
    );
    expect(r.erro).toMatch(/9999.99 dias/);
    nenhumaChamadaFoiFeita();
  });

  it("subtarefaAddAction: estimativa acima do teto (9999.99)", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "algo", estimativa_dias: "99999999" }),
    );
    expect(r.erro).toMatch(/9999.99 dias/);
    nenhumaChamadaFoiFeita();
  });

  // ALTO #5 (crítico 13/09) — teto de tamanho do lado do cliente também.
  it("notaAddAction: texto acima de 10000 caracteres", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "a".repeat(10001) }),
    );
    expect(r.erro).toMatch(/10000 caracteres/);
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: nota acima de 2000 caracteres", async () => {
    const r = await arestaAddAction(
      {},
      form({
        origem: "task-build",
        destino: "task-deploy",
        tipo: "correlacao",
        nota: "a".repeat(2001),
      }),
    );
    expect(r.erro).toMatch(/2000 caracteres/);
    nenhumaChamadaFoiFeita();
  });

  it("statusSetAction: status fora do enum", async () => {
    const r = await statusSetAction({}, form({ task_id: "task-build", status: "cancelado" }));
    expect(r.erro).toMatch(/^status precisa ser/);
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: origem igual a destino", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-build", tipo: "predecessor" }),
    );
    expect(r).toEqual({ erro: "A tarefa de origem e a tarefa de destino não podem ser a mesma." });
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: tipo fora dos 4 tipos declarados", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "bloqueia" }),
    );
    expect(r.erro).toMatch(/^O tipo de relação precisa ser/);
    nenhumaChamadaFoiFeita();
  });

  it("arestaAddAction: peso fora de 0..1", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "sinergia", peso: "1.5" }),
    );
    expect(r).toEqual({ erro: "O desconto precisa ser um número entre 0 e 1." });
    nenhumaChamadaFoiFeita();
  });

  it("arestaDelAction: sem id", async () => {
    const r = await arestaDelAction({}, form({ task_id: "task-build" }));
    expect(r).toEqual({ erro: "Aresta não identificada." });
    nenhumaChamadaFoiFeita();
  });
});

/**
 * OS-LIFEBOARD · P6 — achado MÉDIO #7 (crítico 13/09): o arquivo só tinha os
 * ramos de rejeição. Aqui, cada ação com entrada VÁLIDA em modo `live`:
 * chama `mutateLifeboard` com o `(op, payload)` exato do contrato
 * (`0008_lifeboard_v3_escrita_ajustes.sql`) e revalida as rotas certas.
 */
describe("tarefa/actions — sucesso (modo live: mutateLifeboard com op+payload exatos)", () => {
  const modoOriginal = process.env.LIFEBOARD_DATA_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIFEBOARD_DATA_MODE = "live";
  });

  afterEach(() => {
    if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
    else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
  });

  it("notaAddAction", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "uma nota válida", autor: "Lucas" }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith("nota_add", {
      task_id: "task-build",
      texto: "uma nota válida",
      autor: "Lucas",
      // [MÉDIO #4, rodada 7] `criado_em` só vem preenchido no DESFAZER; uma
      // nota nova manda `null` e o banco usa o `default now()` de sempre.
      criado_em: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
    expect(revalidatePath).toHaveBeenCalledWith("/linha-do-tempo");
  });

  it("notaDelAction", async () => {
    const r = await notaDelAction({}, form({ id: "note-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("nota_del", { id: "note-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("subtarefaAddAction", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "nova subtarefa", estimativa_dias: "2" }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith("subtarefa_add", {
      parent_id: "task-build",
      title: "nova subtarefa",
      estimativa_dias: 2,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("parentSetAction", async () => {
    const r = await parentSetAction({}, form({ task_id: "task-docs", parent_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("parent_set", {
      task_id: "task-docs",
      parent_id: "task-build",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-docs");
  });

  it("goalSetAction", async () => {
    const r = await goalSetAction({}, form({ task_id: "task-deploy", is_goal: "true" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("goal_set", {
      task_id: "task-deploy",
      is_goal: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("atomosSetAction", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "2", esforco: "3", custo: "1" }),
    );
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("atomos_set", {
      task_id: "task-build",
      assimetria: { opcionalidade: 2, esforco: 3, custo: 1 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("estimativaSetAction", async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "3.5" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("estimativa_set", {
      task_id: "task-build",
      estimativa_dias: 3.5,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it.each(STATUS_DO_PRODUTO)("statusSetAction — %s chega ao servidor como foi pedido", async (status) => {
    const r = await statusSetAction({}, form({ task_id: "task-build", status }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("status_set", {
      task_id: "task-build",
      status,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("arestaAddAction", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "sinergia", peso: "0.5" }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith("aresta_add", {
      origem: "task-build",
      destino: "task-deploy",
      tipo: "sinergia",
      peso: 0.5,
      nota: null,
      criado_em: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("arestaDelAction", async () => {
    const r = await arestaDelAction({}, form({ id: "edge-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(mutateLifeboard).toHaveBeenCalledWith("aresta_del", { id: "edge-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });
});

/**
 * [BAIXO #6, rodada 3 do crítico 13/09] os 10 testes de sucesso acima só
 * cobrem `LIFEBOARD_DATA_MODE=live` — o `switch` do despachante fixture em
 * `mutar()` (`src/app/tarefa/actions.ts`) nunca rodava em nenhum teste.
 * Mesmas 10 operações, mesmas entradas VÁLIDAS, mas com o modo default
 * (qualquer valor ≠ "live" cai em fixture — `src/config/env.ts`): cada teste
 * afirma qual função do `tasks.fixture-store` foi chamada, com que
 * argumentos — nunca `mutateLifeboard`.
 */
describe("tarefa/actions — sucesso (modo fixture: tasks.fixture-store com args exatos)", () => {
  const modoOriginal = process.env.LIFEBOARD_DATA_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LIFEBOARD_DATA_MODE;
  });

  afterEach(() => {
    if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
    else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
  });

  function nenhumaChamadaLiveFoiFeita(): void {
    expect(mutateLifeboard).not.toHaveBeenCalled();
  }

  it("notaAddAction", async () => {
    const r = await notaAddAction(
      {},
      form({ task_id: "task-build", texto: "uma nota válida", autor: "Lucas" }),
    );
    expect(r).toEqual({ ok: true, id: "note-x" });
    expect(fixtureStore.notaAddFixture).toHaveBeenCalledWith(
      "task-build",
      "uma nota válida",
      "Lucas",
      null, // [MÉDIO #4, rodada 7] sem `criado_em`: a nota nasce agora.
    );
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("notaDelAction", async () => {
    const r = await notaDelAction({}, form({ id: "note-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.notaDelFixture).toHaveBeenCalledWith("note-1");
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("subtarefaAddAction", async () => {
    const r = await subtarefaAddAction(
      {},
      form({ parent_id: "task-build", title: "nova subtarefa", estimativa_dias: "2" }),
    );
    expect(r).toEqual({ ok: true, id: "task-x" });
    expect(fixtureStore.subtarefaAddFixture).toHaveBeenCalledWith(
      "task-build",
      "nova subtarefa",
      2,
    );
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("parentSetAction", async () => {
    const r = await parentSetAction({}, form({ task_id: "task-docs", parent_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.parentSetFixture).toHaveBeenCalledWith("task-docs", "task-build");
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-docs");
  });

  it("goalSetAction", async () => {
    const r = await goalSetAction({}, form({ task_id: "task-deploy", is_goal: "true" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.goalSetFixture).toHaveBeenCalledWith("task-deploy", true);
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("atomosSetAction", async () => {
    const r = await atomosSetAction(
      {},
      form({ task_id: "task-build", opcionalidade: "2", esforco: "3", custo: "1" }),
    );
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.atomosSetFixture).toHaveBeenCalledWith("task-build", {
      opcionalidade: 2,
      esforco: 3,
      custo: 1,
    });
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("estimativaSetAction", async () => {
    const r = await estimativaSetAction({}, form({ task_id: "task-build", estimativa_dias: "3.5" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.estimativaSetFixture).toHaveBeenCalledWith("task-build", 3.5);
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it.each(STATUS_DO_PRODUTO)("statusSetAction — %s chega ao store como foi pedido", async (status) => {
    const r = await statusSetAction({}, form({ task_id: "task-build", status }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.statusSetFixture).toHaveBeenCalledWith("task-build", status);
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });

  it("arestaAddAction", async () => {
    const r = await arestaAddAction(
      {},
      form({ origem: "task-build", destino: "task-deploy", tipo: "sinergia", peso: "0.5" }),
    );
    expect(r).toEqual({ ok: true, id: "edge-x" });
    expect(fixtureStore.arestaAddFixture).toHaveBeenCalledWith(
      "task-build",
      "task-deploy",
      "sinergia",
      0.5,
      null,
      null, // [MÉDIO #4, rodada 7] idem.
    );
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-deploy");
  });

  it("arestaDelAction", async () => {
    const r = await arestaDelAction({}, form({ id: "edge-1", task_id: "task-build" }));
    expect(r).toEqual({ ok: true });
    expect(fixtureStore.arestaDelFixture).toHaveBeenCalledWith("edge-1");
    nenhumaChamadaLiveFoiFeita();
    expect(revalidatePath).toHaveBeenCalledWith("/tarefa/task-build");
  });
});

/**
 * [BAIXO #6, rodada 4 do crítico 13/09] o ramo `default` do dispatcher
 * fixture (`mutar()`) nunca tinha teste — nenhuma action pública chama
 * `mutar` com um `op` fora da lista de `case`s, então o ramo só é alcançável
 * chamando `mutar` diretamente (por isso o export "só para teste" em
 * `actions.ts`). `op` já é tipado como `string` puro (não um union), então
 * nenhum `as`/cast é necessário para "forçar" um valor inválido — passar
 * qualquer string fora da lista já é válido em TypeScript normal.
 */
describe("tarefa/actions — mutar(): operação desconhecida (achado BAIXO #6, rodada 4)", () => {
  const modoOriginal = process.env.LIFEBOARD_DATA_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LIFEBOARD_DATA_MODE; // fixture — é onde o `switch` mora.
  });

  afterEach(() => {
    if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
    else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
  });

  it("devolve a mensagem fixa e loga o valor recebido no console — nunca ecoa `op` na tela", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await mutar("operacao-que-nao-existe", { foo: "bar" });

    expect(r).toEqual({ erro: "Operação desconhecida." });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    // O valor vai como argumento próprio do console.error (CodeQL js/tainted-format-string), não na format string.
    expect(consoleErrorSpy.mock.calls[0]?.join(" ")).toContain("operacao-que-nao-existe");
    expect(consoleErrorSpy.mock.calls[0]?.[0]).not.toContain("operacao-que-nao-existe");
    expect(mutateLifeboard).not.toHaveBeenCalled();
    for (const fn of Object.values(fixtureStore)) {
      expect(fn as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    }

    consoleErrorSpy.mockRestore();
  });
});

/**
 * [P2 do Codex, rodada 10] A DATA ORIGINAL é privilégio do DESFAZER.
 *
 * `nota_criar` e `nota_desfazer` caem no MESMO handler; idem `relacao_criar` e
 * `relacao_desfazer_exclusao`. Até a rodada 9 o handler aceitava `criado_em`
 * vindo em qualquer um dos dois, e a regra "só o desfazer manda a data" era
 * uma CONVENÇÃO escrita em comentário.
 *
 * O selo do `PedidoDeEscrita` é um `unique symbol` — some na compilação. Do
 * outro lado da rede o pedido é um objeto comum, então um cliente autenticado
 * monta `{ op: "nota_criar", campos: { criado_em: "2020-01-01..." } }` na mão
 * e RETRODATA uma nota nova, com a tela nunca tendo mostrado o campo. O
 * estrago é na ordem cronológica: a nota nasce no passado, no meio do
 * histórico de outra época.
 *
 * Agora quem decide é a OPERAÇÃO. Estes 4 testes são a guarda.
 */
describe("tarefa/actions — `criado_em` só no desfazer (P2 do Codex, rodada 10)", () => {
  const modoOriginal = process.env.LIFEBOARD_DATA_MODE;
  const DATA = "2020-01-01T12:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIFEBOARD_DATA_MODE = "live";
    vi.mocked(mutateLifeboard).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    if (modoOriginal === undefined) delete process.env.LIFEBOARD_DATA_MODE;
    else process.env.LIFEBOARD_DATA_MODE = modoOriginal;
  });

  it("RECUSA `criado_em` numa nota NOVA — e não grava nada", async () => {
    const r = await porOp("nota_criar")(
      {},
      form({ task_id: "task-build", texto: "nota forjada", criado_em: DATA }),
    );
    expect(r).toEqual({ erro: "Uma nota nova não escolhe a própria data." });
    expect(mutateLifeboard).not.toHaveBeenCalled();
  });

  it("ACEITA `criado_em` no desfazer da nota — a data original volta", async () => {
    const r = await porOp("nota_desfazer")(
      {},
      form({ task_id: "task-build", texto: "nota restaurada", criado_em: DATA }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith(
      "nota_add",
      expect.objectContaining({ criado_em: DATA }),
    );
  });

  it("RECUSA `criado_em` numa relação NOVA — e não grava nada", async () => {
    const r = await porOp("relacao_criar")(
      {},
      form({ origem: "a", destino: "b", tipo: "predecessor", criado_em: DATA }),
    );
    expect(r).toEqual({ erro: "Uma relação nova não escolhe a própria data." });
    expect(mutateLifeboard).not.toHaveBeenCalled();
  });

  it("ACEITA `criado_em` no desfazer da exclusão da relação", async () => {
    const r = await porOp("relacao_desfazer_exclusao")(
      {},
      form({ origem: "a", destino: "b", tipo: "predecessor", criado_em: DATA }),
    );
    expect(r).toEqual({ ok: true, id: undefined });
    expect(mutateLifeboard).toHaveBeenCalledWith(
      "aresta_add",
      expect.objectContaining({ criado_em: DATA }),
    );
  });
});

/**
 * ═══════════════════════════════════════════════════════ BAIXO #2, rodada 15 ═
 * A CAIXA E O BANCO NA MESMA GRAFIA, TAMBÉM COM VÍRGULA.
 *
 * `duracaoCanonica` é o que faz a caixa passar a mostrar o que o servidor
 * guardou (`007` → `7`). Com a vírgula agora aceita, ela precisa da MESMA
 * régua do servidor: sem isso, salvar `1,5` gravaria 1.5 no banco e deixaria
 * `1,5` na caixa — a tela numa grafia, o dado em outra, que é o BAIXO #11 da
 * rodada 13 de volta.
 */
describe("BAIXO #2 — duracaoCanonica e a vírgula do teclado pt-BR", () => {
  for (const [bruta, esperado] of [
    ["1,5", "1.5"],
    ["0,5", "0.5"],
    ["  2,25  ", "2.25"],
    ["007", "7"],
    ["1.5", "1.5"],
    ["", ""],
    // Ambíguas: seguem intocadas, e a recusa em português é quem fala.
    ["1.234,5", "1.234,5"],
    ["1,5,5", "1,5,5"],
    ["2e", "2e"],
  ] as const) {
    it(`duracaoCanonica(${JSON.stringify(bruta)}) === ${JSON.stringify(esperado)}`, () => {
      expect(duracaoCanonica(bruta)).toBe(esperado);
    });
  }
});
