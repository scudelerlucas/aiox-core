"use server";

/**
 * OS-LIFEBOARD · P6 — Server actions da página da tarefa.
 *
 * Uma função por operação de `lifeboard_mutate` (contrato em
 * `supabase/migrations/0006_lifeboard_v3_escrita.sql`). Cada uma:
 *  1. lê os campos do `FormData` (nunca confia no formato — tudo é `string | null`);
 *  2. valida em português, com a MESMA régua do banco (`atomosDeclaradosValidos`,
 *     `pesoValido`, `FAIXAS_ESFORCO_CUSTO`) — pega o erro ANTES de gastar uma
 *     chamada de rede, mas nunca reimplementa o que o CHECK/gatilho já garante;
 *  3. despacha por `mutar` (`@/app/tarefa/despachante`) e nunca lança: sempre
 *     devolve `{ erro }` ou `{ ok: true, id? }`, o par que `useFormState` espera;
 *  4. em sucesso, revalida as 3 rotas que podem ter mudado.
 *
 * [Achado MAIOR, CodeRabbit + rodada 10] Este módulo é `"use server"`, então
 * TUDO que ele exporta vira uma Server Action pública, chamável pela rede por
 * qualquer cliente autenticado. Por isso o despachante `mutar` foi movido para
 * `@/app/tarefa/despachante`, que não é `"use server"`: exportado daqui, ele
 * era uma porta dos fundos que pulava a porta de escrita inteira.
 *
 * **A regra que fica: este arquivo exporta APENAS `escreverTarefaAction`.**
 * Qualquer export novo aqui é um endpoint novo na internet — pense duas vezes.
 */

import { revalidatePath } from "next/cache";

import {
  ehOperacaoDeEscrita,
  type CamposDeEscrita,
  type EstadoAcaoTarefa,
  type PedidoDeEscrita,
} from "@/app/tarefa/pedido";

import { mutar } from "@/app/tarefa/despachante";
import { dataOriginalValidaOuErro } from "@/lib/fuso";
import {
  atomosDeclaradosValidos,
  AUTOR_MAXIMO,
  DURACAO_MINIMA_DIAS,
  pesoValido,
  TITULO_MAXIMO,
} from "@/core/prioritize/tipos-v3";
import type { EdgeTipo, TaskStatus } from "@/types/canonical";

export type { EstadoAcaoTarefa } from "@/app/tarefa/pedido";

const TIPOS_DE_ARESTA: readonly EdgeTipo[] = [
  "predecessor",
  "correlacao",
  "sinergia",
  "obsolescencia",
];
const STATUS_VALIDOS: readonly TaskStatus[] = ["open", "in_progress", "blocked", "done"];

// ── ALTO #3/#5 (crítico 13/09) — limites que a coluna/JSON do banco impõem,
// checados aqui em português ANTES da chamada de rede (mesma disciplina do
// resto deste arquivo: nunca reimplementar o CHECK, só adiantar o erro).
/** `tasks.estimativa_dias` é `numeric(6,2)` — acima disso o Postgres rejeita com "numeric field overflow". */
const ESTIMATIVA_DIAS_MAXIMA = 9999.99;
/** `task_notes.texto` (migration 0008): teto de tamanho para não caber payload de 2 MB numa nota. */
const NOTA_TEXTO_MAX = 10_000;
/** `task_edges.nota` (migration 0008). */
const ARESTA_NOTA_MAX = 2_000;
/** `pg_column_size(assimetria) < 2048` (migration 0008) — teto de bytes, não de chaves; medido em JSON. */
const ASSIMETRIA_BYTES_MAX = 2_048;

/**
 * [BAIXO #10, crítico 13/09, rodada 2] ÚNICA régua de duração mínima — antes
 * `subtarefa_add` só exigia `> 0` (aceitava `0.1`) enquanto `estimativa_set`
 * exigia `>= 0.25`; as duas portas de entrada para o MESMO campo aplicavam
 * leis diferentes. As duas chamam esta função agora; `DURACAO_MINIMA_DIAS`
 * vem de `tipos-v3.ts` — mesmo valor usado pela migration 0010.
 */
/**
 * [BAIXO #10, rodada 13] O CLIENTE ACEITAVA MAIS CASAS DO QUE A COLUNA GUARDA.
 *
 * `tasks.estimativa_dias` é `numeric(6,2)` e `task_edges.peso` é
 * `numeric(4,3)`. Em modo fixture o JavaScript guardava `1.005` e `0.5555`
 * inteiros, a tela confirmava "Duração salva." e o número continuava lá; em
 * modo live o Postgres ARREDONDA na hora de gravar (1.01 e 0.556) — os dois
 * modos passavam a discordar sobre a mesma entrada, e no modo que vale o
 * operador via na volta um número que nunca digitou.
 *
 * A régua é a da coluna, aplicada ao TEXTO que a pessoa escreveu (depois da
 * conversão a informação já se perdeu): recusa em português antes de gravar,
 * como todo o resto deste arquivo.
 */
function casasDecimais(bruto: string): number {
  // [BAIXO #2, rodada 15] a vírgula conta como separador aqui também: sem
  // isto `0,1255` passaria pelo limite de casas e o Postgres arredondaria em
  // silêncio — o defeito que o BAIXO #10 da rodada 13 fechou para o ponto.
  const canonico = comDecimalCanonico(bruto);
  const ponto = canonico.indexOf(".");
  return ponto === -1 ? 0 : canonico.length - ponto - 1;
}

/** `tasks.estimativa_dias` é `numeric(6,2)` (migration 0004). */
const ESTIMATIVA_CASAS_MAX = 2;
/** `task_edges.peso` é `numeric(4,3)` (migration 0004). */
const PESO_CASAS_MAX = 3;

function estimativaValidaOuErro(n: number, bruta: string): string | null {
  // [CRÍTICO, rodada 11] `NaN` é o caminho do que a caixa mostra e o
  // `Number()` não converte (`2e`, `1,5`, `--`): `NaN < x` e `NaN > y` são
  // AMBOS falsos, então sem este ramo o valor atravessaria a régua inteira e
  // chegaria à RPC. Ramo próprio, e não `||`, para a frase dizer a coisa
  // certa: o problema não é ser pequeno demais, é não ser número.
  if (!Number.isFinite(n)) {
    return "A duração precisa ser um número em dias, com ponto ou vírgula no decimal (ex.: 1.5 ou 1,5).";
  }
  if (n < DURACAO_MINIMA_DIAS) {
    // Vírgula decimal (pt-BR), não o ponto do `toString()` do JS — mesmo
    // formato que a mensagem já tinha antes desta função existir.
    const minimoFormatado = String(DURACAO_MINIMA_DIAS).replace(".", ",");
    return `A duração (estimativa em dias) precisa ser um número de pelo menos ${minimoFormatado} dia.`;
  }
  if (n > ESTIMATIVA_DIAS_MAXIMA) {
    return `A duração não pode passar de ${ESTIMATIVA_DIAS_MAXIMA} dias.`;
  }
  if (casasDecimais(bruta) > ESTIMATIVA_CASAS_MAX) {
    return `A duração guarda no máximo ${ESTIMATIVA_CASAS_MAX} casas depois do ponto (ex.: 1.5 ou 1.25).`;
  }
  return null;
}

function revalidar(taskId: string): void {
  revalidatePath("/");
  revalidatePath(`/tarefa/${taskId}`);
  revalidatePath("/linha-do-tempo");
}

function textoOu(campos: CamposDeEscrita, campo: string): string {
  const v = campos[campo];
  return typeof v === "string" ? v : "";
}

/**
 * [CRÍTICO, rodada 11] O NÚMERO QUE O OPERADOR DIGITOU — ou `NaN`.
 *
 * `Number()` sozinho é generoso demais para ser a régua de um campo que a
 * pessoa preenche: `Number("0x10")` é 16, `Number("1e3")` é 1000,
 * `Number("Infinity")` é infinito, `Number(" ")` é 0. Com o campo virando
 * texto (`campo-numerico.tsx`), essas formas passam a CHEGAR aqui — e
 * gravar 16 dias porque alguém escreveu `0x10` é a mesma família de defeito
 * que apagar a duração porque alguém escreveu `2e`: o banco fica com um
 * número que a tela nunca mostrou.
 *
 * A régua é a forma que o campo promete: dígitos, com um ponto decimal
 * opcional. Tudo que não é isso vira `NaN` e cai na frase em português.
 */
function numeroDigitado(bruto: string): number {
  const comPonto = comDecimalCanonico(bruto);
  return /^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(comPonto) ? Number(comPonto) : Number.NaN;
}

/**
 * ═══════════════════════════════════════════════════════ BAIXO #2, rodada 15 ═
 * O TECLADO OFERECIA A VÍRGULA E A PÁGINA RECUSAVA A VÍRGULA.
 *
 * Os três campos numéricos declaram `inputMode="decimal"`, e num celular em
 * português esse teclado entrega **vírgula**. Medido pelo crítico:
 *
 *   P2 inputMode do campo: decimal
 *   P2 mensagens: "A duração precisa ser um número em dias, com ponto no
 *                  decimal (ex.: 1.5)."
 *   P2 caixa depois: "1,5"
 *
 * Não perdia dado e recusava em português, no campo — por isso BAIXO. Mas é a
 * tela pedindo uma coisa e recusando a mesma coisa. Desde a rodada 11 o campo
 * é de TEXTO, então a vírgula CHEGA aqui e dá para tratá-la: **uma vírgula
 * decimal vira ponto**, e só uma. `1,5` passa a valer 1.5; `1,5,5` continua
 * recusado; `1.234,5` continua recusado (duas grafias misturadas não são um
 * número que alguém quis escrever).
 */
function comDecimalCanonico(bruto: string): string {
  if (bruto.indexOf(",") === -1) return bruto;
  // Vírgula E ponto na mesma caixa, ou mais de uma vírgula: não é uma grafia
  // decidida. Devolve como veio e a régua recusa, com a frase em português.
  if (bruto.indexOf(".") !== -1) return bruto;
  if (bruto.indexOf(",") !== bruto.lastIndexOf(",")) return bruto;
  return bruto.replace(",", ".");
}

/** O campo VEIO no pedido? (vazio é diferente de ausente — ver `arestaAdd`.) */
function temCampo(campos: CamposDeEscrita, campo: string): boolean {
  return Object.prototype.hasOwnProperty.call(campos, campo);
}

/**
 * [BAIXO #1, rodada 12] `" "` NÃO É CAMPO VAZIO.
 *
 * A duração só é REMOVIDA quando a caixa está de fato vazia. Antes, o
 * `.trim()` acontecia antes da pergunta "veio alguma coisa?", e um espaço em
 * branco — uma caixa que parece preenchida — virava `""`, que virava
 * `estimativa_dias: null`: a tela dizia "Duração removida." e o banco
 * apagava o número. Medido no Chromium em `/tarefa/task-docs` (duração 2):
 * digitar um espaço, "Salvar duração" → banco `null`.
 *
 * É a mesma família do CRÍTICO da rodada 11 (o campo que apaga o dado
 * dizendo que salvou). As outras entradas ilegíveis (`2e`, `1,5`) já
 * recusavam; esta passava porque o branco desaparece antes de ser visto.
 *
 * Devolve `{ bruta }` (já aparada, para `  4  ` continuar gravando 4) ou
 * `{ erro }` quando havia texto e ele era só espaço.
 */
function duracaoBrutaOuErro(
  campos: CamposDeEscrita,
  campo: string,
): { bruta: string } | { erro: string } {
  const cru = textoOu(campos, campo);
  const bruta = cru.trim();
  if (bruta.length === 0 && cru.length > 0) {
    return {
      erro:
        "A duração precisa ser um número em dias, com ponto ou vírgula no decimal (ex.: 1.5 ou 1,5) — " +
        "só espaço em branco não remove nada. Para remover a duração, deixe a caixa vazia.",
    };
  }
  return { bruta };
}

function textoOuNulo(campos: CamposDeEscrita, campo: string): string | null {
  const v = textoOu(campos, campo).trim();
  return v.length > 0 ? v : null;
}

// ═══════════════════════════════════════════════════════════════ nota_add ═
async function notaAdd(
  campos: CamposDeEscrita,
  permiteDataOriginal: boolean,
): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const texto = textoOu(campos, "texto");
  const autor = textoOuNulo(campos, "autor");

  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (texto.trim().length === 0) return { erro: "Escreva algo antes de salvar a nota." };
  if (texto.length > NOTA_TEXTO_MAX) {
    return { erro: `A nota não pode passar de ${NOTA_TEXTO_MAX} caracteres.` };
  }
  // [ALTO #2, crítico 13/09, rodada 2] `autor` sem teto aceitava 1 MB.
  if (autor !== null && autor.length > AUTOR_MAXIMO) {
    return { erro: `O nome do autor não pode passar de ${AUTOR_MAXIMO} caracteres.` };
  }

  // [MÉDIO #4, rodada 7 + P2 do Codex, rodada 10] só o DESFAZER manda
  // `criado_em`. Na rodada 7 isso era CONVENÇÃO — `nota_criar` e
  // `nota_desfazer` caem no mesmo handler, e ele aceitava a data em qualquer
  // um dos dois. O selo do pedido é só do compilador: um cliente autenticado
  // monta o objeto na mão e retrodata uma nota NOVA, com a tela omitindo o
  // campo. Agora quem decide é a OPERAÇÃO, não a presença do campo.
  const criadoEmBruto = textoOuNulo(campos, "criado_em");
  let criadoEm: string | null = null;
  if (criadoEmBruto !== null) {
    if (!permiteDataOriginal) {
      return { erro: "Uma nota nova não escolhe a própria data." };
    }
    const v = dataOriginalValidaOuErro(criadoEmBruto);
    if ("erro" in v) return { erro: v.erro };
    criadoEm = v.iso;
  }

  const r = await mutar("nota_add", { task_id: taskId, texto, autor, criado_em: criadoEm });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true, id: r.id };
}

// ═══════════════════════════════════════════════════════════════ nota_del ═
async function notaDel(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const id = textoOu(campos, "id");
  const taskId = textoOu(campos, "task_id");
  if (id.length === 0) return { erro: "Nota não identificada." };

  const r = await mutar("nota_del", { id });
  if ("erro" in r) return { erro: r.erro };
  if (taskId.length > 0) revalidar(taskId);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════ subtarefa_add ═
async function subtarefaAdd(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const parentId = textoOu(campos, "parent_id");
  const title = textoOu(campos, "title");
  // [BAIXO #1, rodada 12] mesma régua do campo da tarefa — ver `duracaoBrutaOuErro`.
  const lidaDaCaixa = duracaoBrutaOuErro(campos, "estimativa_dias");
  if ("erro" in lidaDaCaixa) return { erro: lidaDaCaixa.erro };
  const estimativaBruta = lidaDaCaixa.bruta;

  if (parentId.length === 0) return { erro: "Tarefa mãe não identificada." };
  if (title.trim().length === 0) return { erro: "O título da subtarefa não pode ficar vazio." };
  // [ALTO #2, crítico 13/09, rodada 2] `title` sem teto aceitava 3 MB.
  if (title.length > TITULO_MAXIMO) {
    return { erro: `O título não pode passar de ${TITULO_MAXIMO} caracteres.` };
  }

  let estimativaDias: number | null = null;
  if (estimativaBruta.length > 0) {
    const n = numeroDigitado(estimativaBruta);
    const erro = estimativaValidaOuErro(n, estimativaBruta);
    if (erro) return { erro };
    estimativaDias = n;
  }

  const r = await mutar("subtarefa_add", {
    parent_id: parentId,
    title,
    estimativa_dias: estimativaDias,
  });
  if ("erro" in r) return { erro: r.erro };
  revalidar(parentId);
  return { ok: true, id: r.id };
}

// ═══════════════════════════════════════════════════════════════ parent_set ═
async function parentSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const parentId = textoOuNulo(campos, "parent_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (parentId === taskId) return { erro: "Uma tarefa não pode ser mãe de si mesma." };

  const r = await mutar("parent_set", { task_id: taskId, parent_id: parentId });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════ goal_set ═
async function goalSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const isGoal = textoOu(campos, "is_goal") === "true";
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  const r = await mutar("goal_set", { task_id: taskId, is_goal: isGoal });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ atomos_set ═
async function atomosSet(campos: CamposDeEscrita, limpar: boolean): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  if (limpar) {
    const r = await mutar("atomos_set", { task_id: taskId, assimetria: null });
    if ("erro" in r) return { erro: r.erro };
    revalidar(taskId);
    return { ok: true };
  }

  const opcionalidade = Number(textoOu(campos, "opcionalidade"));
  const esforco = Number(textoOu(campos, "esforco"));
  const custo = Number(textoOu(campos, "custo"));
  const candidato = { opcionalidade, esforco, custo };
  if (!atomosDeclaradosValidos(candidato)) {
    return {
      erro:
        "Átomos inválidos: opcionalidade precisa ser 1, 2 ou 3; esforço e custo precisam ser 1, 2, 3 ou 5.",
    };
  }
  // ALTO #5 (crítico 13/09) — defesa em profundidade: esta ação só monta 3
  // chaves numéricas, então nunca produz os 2 MB do achado sozinha, mas o
  // teto do banco (`pg_column_size(assimetria) < 2048`) é checado aqui
  // também para nunca gastar a chamada de rede à toa.
  if (new TextEncoder().encode(JSON.stringify(candidato)).length >= ASSIMETRIA_BYTES_MAX) {
    return { erro: "Os átomos declarados ficaram grandes demais para salvar." };
  }

  const r = await mutar("atomos_set", { task_id: taskId, assimetria: candidato });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════ estimativa_set ═
async function estimativaSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };

  // [BAIXO #1, rodada 12] `" "` não apaga a duração — ver `duracaoBrutaOuErro`.
  const lida = duracaoBrutaOuErro(campos, "estimativa_dias");
  if ("erro" in lida) return { erro: lida.erro };
  const bruta = lida.bruta;
  let estimativaDias: number | null = null;
  if (bruta.length > 0) {
    const n = numeroDigitado(bruta);
    // [BAIXO #10, rodada 2] mesma função de `subtarefaAddAction` — uma só régua.
    const erro = estimativaValidaOuErro(n, bruta);
    if (erro) return { erro };
    estimativaDias = n;
  }

  const r = await mutar("estimativa_set", { task_id: taskId, estimativa_dias: estimativaDias });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ status_set ═
async function statusSet(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const taskId = textoOu(campos, "task_id");
  const status = textoOu(campos, "status");
  if (taskId.length === 0) return { erro: "Tarefa não identificada." };
  if (!STATUS_VALIDOS.includes(status as TaskStatus)) {
    return { erro: "status precisa ser um de: aberta, em progresso, bloqueada, concluída." };
  }

  const r = await mutar("status_set", { task_id: taskId, status });
  if ("erro" in r) return { erro: r.erro };
  revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ aresta_add ═
async function arestaAdd(
  campos: CamposDeEscrita,
  permiteDataOriginal: boolean,
): Promise<EstadoAcaoTarefa> {
  const origem = textoOu(campos, "origem");
  const destino = textoOu(campos, "destino");
  const tipo = textoOu(campos, "tipo") as EdgeTipo;
  const nota = textoOuNulo(campos, "nota");
  const pesoBruto = textoOu(campos, "peso").trim();

  if (origem.length === 0 || destino.length === 0) {
    return { erro: "Escolha a tarefa de destino da relação." };
  }
  if (origem === destino) {
    return { erro: "A tarefa de origem e a tarefa de destino não podem ser a mesma." };
  }
  if (!TIPOS_DE_ARESTA.includes(tipo)) {
    return { erro: "O tipo de relação precisa ser um de: predecessor, correlação, sinergia, obsolescência." };
  }
  // [ALTO A2, rodada 11] `peso` AUSENTE e `peso` VAZIO não são a mesma coisa.
  // Ausente = a relação não é de sinergia e o desconto não se aplica (1, o
  // neutro). Vazio/ilegível = o operador tinha algo na caixa e o programa não
  // entendeu — e o `let peso = 1` de antes gravava calado o EXTREMO OPOSTO da
  // escala que a tela mostrava (0.5 na caixa, 1 no banco), direto na conta do
  // HIERARQ, com "Relação criada." anunciado.
  let peso = 1;
  if (temCampo(campos, "peso")) {
    if (pesoBruto.length === 0) {
      return { erro: "O desconto precisa ser um número entre 0 e 1." };
    }
    peso = numeroDigitado(pesoBruto);
    if (!pesoValido(peso)) return { erro: "O desconto precisa ser um número entre 0 e 1." };
    // [BAIXO #10, rodada 13] `numeric(4,3)`: acima de 3 casas o Postgres
    // arredonda em silêncio e o fixture não — ver `casasDecimais`.
    if (casasDecimais(pesoBruto) > PESO_CASAS_MAX) {
      return {
        erro: `O desconto guarda no máximo ${PESO_CASAS_MAX} casas depois do ponto (ex.: 0.5 ou 0.125).`,
      };
    }
  }
  if (nota !== null && nota.length > ARESTA_NOTA_MAX) {
    return { erro: `A nota da relação não pode passar de ${ARESTA_NOTA_MAX} caracteres.` };
  }

  // [MÉDIO #4, rodada 7 + P2 do Codex, rodada 10] mesma régua da nota, e pelo
  // mesmo motivo: `relacao_criar` e `relacao_desfazer_exclusao` compartilham
  // este handler, então a presença do campo não pode ser o critério.
  const criadoEmBruto = textoOuNulo(campos, "criado_em");
  let criadoEm: string | null = null;
  if (criadoEmBruto !== null) {
    if (!permiteDataOriginal) {
      return { erro: "Uma relação nova não escolhe a própria data." };
    }
    const v = dataOriginalValidaOuErro(criadoEmBruto);
    if ("erro" in v) return { erro: v.erro };
    criadoEm = v.iso;
  }

  const r = await mutar("aresta_add", {
    origem,
    destino,
    tipo,
    peso,
    nota,
    criado_em: criadoEm,
  });
  if ("erro" in r) return { erro: r.erro };
  revalidar(origem);
  revalidar(destino);
  return { ok: true, id: r.id };
}

// ══════════════════════════════════════════════════════════════ aresta_del ═
async function arestaDel(campos: CamposDeEscrita): Promise<EstadoAcaoTarefa> {
  const id = textoOu(campos, "id");
  const taskId = textoOu(campos, "task_id");
  if (id.length === 0) return { erro: "Aresta não identificada." };

  const r = await mutar("aresta_del", { id });
  if ("erro" in r) return { erro: r.erro };
  if (taskId.length > 0) revalidar(taskId);
  return { ok: true };
}

// ══════════════════════════════════════════════════════ a PORTA do servidor ═
/**
 * [ALTO #1, rodada 9] A ÚNICA função de escrita que o cliente consegue
 * chamar. As dez funções acima deixaram de ser exportadas: quem quiser
 * gravar tem de trazer um `PedidoDeEscrita`, e um `PedidoDeEscrita` só
 * nasce dentro de `porta-de-escrita.ts` (o selo é um `unique symbol`
 * ambiente e não exportado — ver `pedido.ts`).
 *
 * Consequências que a rodada 8 não tinha:
 *  - `<form action={zerarDuracaoDireto}>` (forma M6) entrega um `FormData`;
 *    `FormData` não é `PedidoDeEscrita` → não compila;
 *  - um 2º hook despachando cru (forma M8) não tem o que despachar: a porta
 *    não devolve `disparar`, e a ação não aceita nada além do pedido selado;
 *  - a `op` viaja DENTRO do pedido, então o servidor sabe qual escrita está
 *    executando — não é mais uma string que um handler de cliente "declara".
 *
 * Nunca lança: devolve `{ erro }` em português ou `{ ok: true, id? }`.
 */
export async function escreverTarefaAction(
  _estado: EstadoAcaoTarefa,
  pedido: PedidoDeEscrita,
): Promise<EstadoAcaoTarefa> {
  // O pedido cruza a fronteira serializado: o selo é só do compilador, e o
  // servidor nunca confia no formato de nada que chega do cliente.
  const op: unknown = (pedido as { op?: unknown } | null)?.op;
  const brutos: unknown = (pedido as { campos?: unknown } | null)?.campos;
  if (!ehOperacaoDeEscrita(op)) return { erro: "Operação desconhecida." };
  const campos: CamposDeEscrita =
    typeof brutos === "object" && brutos !== null
      ? Object.fromEntries(
          Object.entries(brutos as Record<string, unknown>).map(([k, v]) => [
            k,
            typeof v === "string" ? v : "",
          ]),
        )
      : {};

  switch (op) {
    // A DATA ORIGINAL só viaja no desfazer, e quem diz isso é a operação —
    // nunca a presença do campo (P2 do Codex, rodada 10).
    case "nota_criar":
      return notaAdd(campos, false);
    case "nota_desfazer":
      return notaAdd(campos, true);
    case "nota_excluir":
      return notaDel(campos);
    case "subtarefa_criar":
      return subtarefaAdd(campos);
    case "relacao_criar":
      return arestaAdd(campos, false);
    case "relacao_desfazer_exclusao":
      return arestaAdd(campos, true);
    case "relacao_excluir":
    case "relacao_desfazer_criacao":
      return arestaDel(campos);
    case "status":
      return statusSet(campos);
    case "mae":
      return parentSet(campos);
    case "meta":
      return goalSet(campos);
    case "duracao":
      return estimativaSet(campos);
    case "atomos_salvar":
      return atomosSet(campos, false);
    case "atomos_limpar":
      return atomosSet(campos, true);
    // [ALTO #2, rodada 14] o desfazer da limpeza é a MESMA gravação do salvar
    // (os três números voltam), com operação própria para o anúncio e a
    // auditoria distinguirem "salvei" de "desfiz".
    case "atomos_desfazer_limpeza":
      return atomosSet(campos, false);
  }
}
