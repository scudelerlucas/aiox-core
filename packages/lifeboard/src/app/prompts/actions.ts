"use server";

/**
 * OS-LIFEBOARD · P7 — server actions da fila de prompts (`/prompts`).
 *
 * Mesmo contrato de `src/app/tarefa/actions.ts`: cada ação valida em
 * português ANTES de gastar uma chamada de rede/RPC (régua de UI/UX —
 * "erro em português no campo, nunca JSON"), despacha para o modo certo
 * (`mutar()` decide live × fixture uma vez só) e nunca lança — sempre
 * `{ erro }` ou `{ ok: true, ... }`.
 */

import { revalidatePath } from "next/cache";

import { env } from "@/config/env";
import {
  CONTAS,
  CUSTO_MAXIMO_POR_ITEM_USD,
  ROTULO_CONTA,
  complexidadeValida,
  contaValida,
  fraseDoCancelamento,
  fraseDoEnfileiramento,
  motivoCancelamentoValido,
  motivoEnfileirarValido,
  motivoEsperaVagaDeVoo,
  type Complexidade,
} from "@/core/prompts/tipos";
import {
  ajustarCustoFixture,
  cancelarFixture,
  enfileirarFixture,
} from "@/lib/repositories/prompts-fila.fixture-store";
import { ajustarCustoPrompt, cancelarPromptFila, enfileirarPrompt } from "@/lib/supabase/live-client";
import { createSupabaseUserClient } from "@/lib/supabase/user-server";

export type EstadoAcaoPrompt = {
  erro?: string;
  ok?: true;
  id?: string;
  conta?: string;
  /**
   * D14 (rodada 4): a frase INTEIRA que a tela mostra, montada aqui — em modo
   * live ela vinha crua do Postgres ("roteamento automatico: maior espaco livre
   * hoje (US$ 150.00)"), sem acento e com ponto decimal.
   */
  mensagem?: string;
  /**
   * D3/D29: entrou na fila mas não cabe hoje contando a fila parada. P2 do
   * Codex (PR #42, 11ª rodada): também `false` quando a conta está no limite
   * de sessões em voo — é a PRONTIDÃO que a tela mostra, não só o dinheiro.
   */
  cabeHoje?: boolean;
  /**
   * MÉDIO 4 (crítico da rodada 5): a única frase que avisa "acabei de lançar
   * US$ 120,00 no seu teto" saía no MESMO verde de "deu tudo certo". `atencao`
   * é o tom de toda mensagem que LANÇA dinheiro no dia.
   */
  tom?: "sucesso" | "atencao";
};

function revalidar(): void {
  revalidatePath("/prompts");
}

/**
 * D3/D9 (rodada 3): depois da mudança de admissão, a fila só recusa UMA coisa
 * — o item que nunca caberia (custo estimado maior que o teto da conta). A
 * mensagem do trigger já nasce em português e já traz a complexidade por
 * extenso ("uma tarefa máxima"); o que sobra aqui é (a) tirar o prefixo
 * técnico `fila: `, (b) trocar qualquer e-mail cru pelo rótulo da conta
 * (Lucas/Pandora/Alma Petra — o operador não precisa saber qual e-mail é
 * qual) e (c) pôr a vírgula decimal no lugar do ponto. O texto INTEIRO sempre
 * vai para `console.error` — nunca se perde, só não aparece na tela.
 */
function formatarRecusaFila(erroBruto: string): string {
  console.error("[prompts] recusa da fila (bruto):", erroBruto);

  let texto = erroBruto.replace(/^fila:\s*/, "");
  for (const conta of CONTAS) {
    texto = texto.split(conta).join(ROTULO_CONTA[conta]);
  }
  // "US$ 120.00" -> "US$ 120,00" (só onde é dinheiro, nunca no resto do texto).
  texto = texto.replace(/US\$\s*(\d+)\.(\d{2})\b/g, "US$ $1,$2");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function textoOu(form: FormData, campo: string): string {
  const v = form.get(campo);
  return typeof v === "string" ? v : "";
}

function textoOuNulo(form: FormData, campo: string): string | null {
  const v = textoOu(form, campo).trim();
  return v.length > 0 ? v : null;
}

/**
 * Achado MÉDIO #14 (crítico hostil, rodada de correção 13/09/2026):
 * `criado_por` nunca era gravado (o formulário não tem — nem deveria ter —
 * um campo para o operador se identificar; era só um parâmetro morto). Lido
 * do lado do SERVIDOR, na sessão logada — mesmo utilitário que `/frentes`
 * usa (`createSupabaseUserClient`, cookies da sessão Google do middleware).
 * Sem sessão (modo fixture local, ou um soluço de rede lendo o cookie):
 * `null` — nunca falha a ação por causa disto.
 */
async function emailDaSessao(): Promise<string | null> {
  try {
    const supabase = await createSupabaseUserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

type ResultadoMutar =
  | {
      ok: true;
      id?: string;
      conta?: string;
      complexidade?: string;
      motivoCodigo?: string;
      cabeHoje?: boolean;
      headroomUsd?: number;
      espacoLivreUsd?: number;
      custoEstimadoUsd?: number;
      naFilaUsd?: number;
      itensNaFrente?: number;
      motivoCancelamento?: string;
      custoLancadoUsd?: number;
      tentativas?: number;
    }
  | { erro: string };

async function mutarEnfileirar(input: {
  prompt: string;
  complexidade: Complexidade;
  conta: string | null;
  criadoPor: string | null;
  taskId: string | null;
}): Promise<ResultadoMutar> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    return enfileirarPrompt({
      prompt: input.prompt,
      complexidade: input.complexidade,
      conta: input.conta,
      criado_por: input.criadoPor,
      task_id: input.taskId,
    });
  }
  return enfileirarFixture({
    prompt: input.prompt,
    complexidade: input.complexidade,
    conta: input.conta,
    criadoPor: input.criadoPor,
    taskId: input.taskId,
  });
}

async function mutarCancelar(id: string): Promise<ResultadoMutar> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    return cancelarPromptFila(id);
  }
  return cancelarFixture(id);
}

async function mutarAjustarCusto(
  id: string,
  custoUsd: number,
  sessionId: string | null,
): Promise<ResultadoMutar> {
  if (env.LIFEBOARD_DATA_MODE === "live") {
    return ajustarCustoPrompt(id, custoUsd, sessionId);
  }
  return ajustarCustoFixture(id, custoUsd, sessionId);
}

/**
 * D14 (rodada 4) — O FORMATADOR ÚNICO. Erro e sucesso saem daqui, e só daqui:
 * o banco devolve código + números (sucesso) ou a própria mensagem em
 * português do `check_violation` (recusa), e esta função é o lugar onde
 * qualquer um dos dois vira a frase que o operador lê. Antes eram dois
 * caminhos: a recusa passava por `formatarRecusaFila` e o sucesso ia CRU.
 */
function frasePraTela(r: Extract<ResultadoMutar, { ok: true }>): string | undefined {
  const codigo = r.motivoCodigo;
  const conta = r.conta;
  const complexidade = r.complexidade;
  if (
    codigo !== undefined &&
    motivoEnfileirarValido(codigo) &&
    conta !== undefined &&
    contaValida(conta) &&
    complexidade !== undefined &&
    complexidadeValida(complexidade)
  ) {
    return fraseDoEnfileiramento(codigo, {
      conta,
      complexidade,
      headroomUsd: r.headroomUsd ?? 0,
      espacoLivreUsd: r.espacoLivreUsd ?? 0,
      custoEstimadoUsd: r.custoEstimadoUsd ?? 0,
      naFilaUsd: r.naFilaUsd ?? 0,
      itensNaFrente: r.itensNaFrente ?? 0,
    });
  }
  const cancelamento = r.motivoCancelamento;
  if (cancelamento !== undefined && motivoCancelamentoValido(cancelamento)) {
    return fraseDoCancelamento(cancelamento, r.custoLancadoUsd ?? 0, r.tentativas ?? 0);
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════ novo_prompt ═
export async function novoPromptAction(
  _estado: EstadoAcaoPrompt,
  form: FormData,
): Promise<EstadoAcaoPrompt> {
  const prompt = textoOu(form, "prompt");
  const complexidade = textoOu(form, "complexidade");
  const conta = textoOuNulo(form, "conta");
  const taskId = textoOuNulo(form, "task_id");

  if (prompt.trim().length === 0) {
    return { erro: "Escreva o prompt antes de enviar." };
  }
  if (prompt.trim().length > 20000) {
    return { erro: "O prompt passou de 20000 caracteres — encurte antes de enviar." };
  }
  if (!complexidadeValida(complexidade)) {
    return { erro: "complexidade precisa ser uma de: baixa, média, alta, máxima." };
  }

  // Achado MÉDIO #14: `criado_por` vem da sessão (server-side), nunca de um
  // campo do formulário — o operador não digita quem ele é.
  const criadoPor = await emailDaSessao();

  const r = await mutarEnfileirar({
    prompt: prompt.trim(),
    complexidade,
    conta,
    criadoPor,
    taskId,
  });
  // Achado BAIXO #9: só a recusa da RPC/fixture (jargão + e-mail cru) passa
  // pelo formatador — os `erro` de validação acima já estão em português
  // simples e nunca citam uma conta.
  if ("erro" in r) return { erro: formatarRecusaFila(r.erro) };
  revalidar();
  return {
    ok: true,
    id: r.id,
    conta: r.conta,
    mensagem: frasePraTela(r),
    // P2 do Codex (PR #42, 11ª rodada): `cabeHoje` do banco é o dinheiro; na
    // tela ele é a prontidão. Item que espera vaga de sessão em voo é aviso.
    cabeHoje: r.cabeHoje !== false && !motivoEsperaVagaDeVoo(r.motivoCodigo),
  };
}

// ══════════════════════════════════════════════════════════ cancelar ═════
export async function cancelarPromptAction(
  _estado: EstadoAcaoPrompt,
  form: FormData,
): Promise<EstadoAcaoPrompt> {
  const id = textoOu(form, "id");
  if (id.length === 0) return { erro: "Item não identificado." };

  const r = await mutarCancelar(id);
  if ("erro" in r) return { erro: formatarRecusaFila(r.erro) };
  revalidar();
  // #11: cancelar não é sempre a mesma coisa — "nunca foi pego" é de graça,
  // "já rodou e voltou" custa o estimado. A frase diz qual dos dois foi.
  // MÉDIO 4 (rodada 6): quando LANÇA dinheiro, o tom é de atenção, não de
  // sucesso — a frase que avisa "US$ 120,00 entram no gasto de hoje" saía no
  // mesmo verde de "enfileirado com sucesso".
  const lancou = (r.custoLancadoUsd ?? 0) > 0;
  return { ok: true, mensagem: frasePraTela(r), tom: lancou ? "atencao" : "sucesso" };
}

// ═════════════════════════════════════════════════════ ajustar custo ═════
/**
 * D20 (rodada 4): o operador corrige o custo de um item que morreu sem fechar
 * (ou foi cancelado em execução) e ficou contando pela ESTIMATIVA da casa.
 * Sem esta ação, uma estimativa de US$ 120 congelava a conta até a virada do
 * dia — e o painel não tinha como saber que ela estava errada.
 */
export async function ajustarCustoPromptAction(
  _estado: EstadoAcaoPrompt,
  form: FormData,
): Promise<EstadoAcaoPrompt> {
  const id = textoOu(form, "id");
  if (id.length === 0) return { erro: "Item não identificado." };

  const sessionId = textoOuNulo(form, "session_id");
  const bruto = textoOu(form, "custo_usd").trim().replace(",", ".");
  const custo = Number.parseFloat(bruto);
  if (bruto.length === 0) return { erro: "Escreva o custo real antes de salvar." };
  if (!Number.isFinite(custo)) return { erro: "O custo precisa ser um número (ex.: 12,30)." };
  // ALTO 2 (rodada 13): era `> 500` — o teto do DIA. O operador corrige com o
  // número real, mesmo acima do teto: recusar a correção só mantém a
  // estimativa no livro e abre teto falso. O limite aqui é de sanidade,
  // espelho de `public.painel_custo_maximo_por_item()` (0027 §0).
  if (custo < 0 || custo > CUSTO_MAXIMO_POR_ITEM_USD) {
    return { erro: `O custo precisa ficar entre 0 e ${CUSTO_MAXIMO_POR_ITEM_USD}.` };
  }

  const r = await mutarAjustarCusto(id, custo, sessionId);
  if ("erro" in r) return { erro: formatarRecusaFila(r.erro) };
  revalidar();
  // MÉDIO 3 (rodada 6): esta frase só pode ser dita porque agora ela é
  // VERDADE — a régua do dia do ajuste (`concluido_em`) virou a mesma régua do
  // dia do consumo (D25). Antes, o botão aparecia para item de qualquer dia e
  // a frase prometia um movimento que não acontecia.
  const vinculo = sessionId === null ? "" : " A sessão ficou vinculada ao item.";
  return {
    ok: true,
    mensagem: `Custo ajustado — o gasto de hoje já considera o número real.${vinculo}`,
    tom: "sucesso",
  };
}
