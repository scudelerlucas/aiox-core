"use client";

import {
  documentoAtual,
  focarComAlternativa,
  type DocumentoComFoco,
  type Focavel,
} from "@/components/task/foco";

/**
 * OS-LIFEBOARD · P6 — a LISTA das operações de escrita desta página, e o que
 * cada uma faz quando termina.
 *
 * [ALTO #1 + MÉDIO #2/#3/#4, rodada 6 do crítico] O padrão que ele nomeou:
 * "consertou os 5 caminhos que mediu e deixou os 3 gêmeos". A rodada 5
 * consertou o foco em 5 operações (desfazer, limpar átomos, excluir nota,
 * Enter no status, troca de mãe) e deixou intactas as 3 CRIAÇÕES — que
 * jogavam o foco no `<body>` por outro motivo: o botão tinha
 * `disabled={campo vazio}`, o `aoSucesso` esvaziava o campo, o botão virava
 * `disabled` NO INSTANTE DO SUCESSO e o navegador o desfocava.
 *
 * A resposta desta rodada não é consertar mais três casos: é parar de ter
 * casos. Toda escrita da página passa por DUAS funções deste arquivo —
 * `decidirEscrita` (antes de gravar) e `concluirEscrita` (depois do sucesso)
 * — e a lista `OPERACOES_DE_ESCRITA` abaixo é a fonte que o teste-varredura
 * percorre (`tests/unit/tarefa-escritas-varredura.test.ts`). Operação nova
 * que não entre nesta lista falha o teste; operação da lista cujo componente
 * não chame as duas funções também.
 */
export type OperacaoDeEscrita =
  | "nota_criar"
  | "nota_excluir"
  | "nota_desfazer"
  | "subtarefa_criar"
  | "relacao_criar"
  | "relacao_excluir"
  | "relacao_desfazer_criacao"
  | "relacao_desfazer_exclusao"
  | "status"
  | "mae"
  | "meta"
  | "duracao"
  | "atomos_salvar"
  | "atomos_limpar";

/** As 14 escritas da página, por extenso — nenhuma amostra. */
export const OPERACOES_DE_ESCRITA: readonly OperacaoDeEscrita[] = [
  "nota_criar",
  "nota_excluir",
  "nota_desfazer",
  "subtarefa_criar",
  "relacao_criar",
  "relacao_excluir",
  "relacao_desfazer_criacao",
  "relacao_desfazer_exclusao",
  "status",
  "mae",
  "meta",
  "duracao",
  "atomos_salvar",
  "atomos_limpar",
];

/**
 * [MÉDIO #2, rodada 6] O que a região viva (`role="status"`) recebe quando a
 * operação dá certo. Salvar nota e adicionar subtarefa não anunciavam NADA —
 * as 8 regiões vivas da página existiam, e nenhuma pertencia aos dois
 * formulários de criação. Texto em português, frase inteira, sem jargão.
 *
 * `nota_desfazer`/`relacao_desfazer_exclusao` dizem "(como nova)" de
 * propósito — ver `MENSAGEM_RESTAURADA_COMO_NOVA` abaixo.
 */
export const ANUNCIO_DE_SUCESSO: Record<OperacaoDeEscrita, string> = {
  nota_criar: "Nota salva.",
  nota_excluir: "Excluída.",
  nota_desfazer: "Nota restaurada (como nova).",
  subtarefa_criar: "Subtarefa criada.",
  relacao_criar: "Relação criada.",
  relacao_excluir: "Excluída.",
  relacao_desfazer_criacao: "Relação desfeita.",
  relacao_desfazer_exclusao: "Relação restaurada (como nova).",
  status: "Status atualizado.",
  mae: "Tarefa mãe atualizada.",
  meta: "Meta atualizada.",
  duracao: "Duração salva.",
  atomos_salvar: "Átomos salvos.",
  atomos_limpar: "Átomos limpos.",
};

/**
 * [BAIXO #5, rodada 6] Desfazer NÃO ressuscita a linha apagada: o banco só
 * tem `nota_add`/`aresta_add`, que inserem uma linha NOVA (id novo,
 * `created_at` = agora — conferido em
 * `supabase/migrations/0010_lifeboard_v3_escrita_ajustes_2.sql`, `nota_add`:
 * o insert não aceita nem lê `criado_em`/`created_at` do payload). Mexer
 * nisso seria mexer no banco, que está fora do alcance desta rodada. Então a
 * frase diz a verdade em vez de esconder: a nota voltou, e voltou como nova
 * (por isso aparece no topo da lista).
 */
export const MENSAGEM_RESTAURADA_COMO_NOVA = ANUNCIO_DE_SUCESSO.nota_desfazer;

/**
 * [BAIXO #4, rodada 6] Segunda edição enquanto a primeira ainda está em voo
 * era descartada EM SILÊNCIO (`if (pendente) return`). Agora a recusa fala.
 */
export const MENSAGEM_AGUARDE = "Aguarde: a gravação anterior ainda está em andamento.";

/**
 * [ALTO #1, rodada 6] O que substitui o `disabled` por validade: o botão
 * continua clicável (e focável — `disabled` é justamente o que tirava o foco
 * dele), o handler recusa, e ESTA frase explica por quê. Antes, um clique no
 * botão cinza não produzia nada, nem explicação.
 */
export const MENSAGEM_INVALIDO: Partial<Record<OperacaoDeEscrita, string>> = {
  nota_criar: "Escreva a nota antes de salvar.",
  subtarefa_criar: "Dê um título à subtarefa antes de adicionar.",
  relacao_criar: "Escolha a tarefa de destino antes de adicionar a relação.",
  atomos_salvar: "Escolha os três átomos antes de salvar.",
};

/**
 * [MÉDIO #3, rodada 6] 6 Enters no segmentado de status já selecionado
 * mandavam 6 POSTs idênticos. Gravar o que já está gravado não é salvar: é
 * gastar rede e arriscar um erro onde não havia nada a mudar. Quando o
 * controle é de SELEÇÃO (status, mãe, meta) a recusa é silenciosa — o que o
 * operador pediu já está na tela. Quando ele APERTOU um botão "salvar"
 * (duração, átomos), o silêncio seria um botão morto: a região viva responde.
 */
export const MENSAGEM_SEM_MUDANCA: Partial<Record<OperacaoDeEscrita, string>> = {
  duracao: "A duração já está salva assim — nada mudou.",
  atomos_salvar: "Os átomos já estão salvos assim — nada mudou.",
};

export type DecisaoDeEscrita = "gravar" | "aguardar" | "invalido" | "sem_mudanca";

/**
 * A ÚNICA porta de entrada de toda escrita da página. Ordem das recusas:
 *
 *  1. `pendente` — a gravação anterior ainda não voltou (a trava que antes
 *     morava no `disabled={pendente}`, e que era a causa medida do foco no
 *     `<body>`);
 *  2. `valido` — a regra de validade do formulário (nota vazia, subtarefa sem
 *     título, relação sem destino, átomos incompletos), que antes morava no
 *     `disabled={campo vazio}` — a causa medida das 3 CRIAÇÕES perderem o
 *     foco no instante do sucesso;
 *  3. `mudou` — o valor pedido é igual ao último CONFIRMADO pelo servidor.
 *
 * Pura de propósito: é o que dá para provar sem DOM (o repositório não tem
 * jsdom nem `@testing-library`, e instalar está proibido nesta rodada).
 */
export function decidirEscrita(params: {
  pendente: boolean;
  valido?: boolean;
  mudou?: boolean;
}): DecisaoDeEscrita {
  if (params.pendente) return "aguardar";
  if (params.valido === false) return "invalido";
  if (params.mudou === false) return "sem_mudanca";
  return "gravar";
}

/** A frase que a recusa devolve — `null` quando a recusa é (por desenho) silenciosa. */
export function mensagemDeRecusa(
  op: OperacaoDeEscrita,
  decisao: DecisaoDeEscrita,
): string | null {
  if (decisao === "aguardar") return MENSAGEM_AGUARDE;
  if (decisao === "invalido") return MENSAGEM_INVALIDO[op] ?? null;
  if (decisao === "sem_mudanca") return MENSAGEM_SEM_MUDANCA[op] ?? null;
  return null;
}

export interface SinaisDeEscrita {
  /** Região viva `role="status"` do próprio formulário (não interrompe o leitor de tela). */
  anunciar: (texto: string) => void;
  /** `role="alert"` ao lado do campo — para o que o operador precisa corrigir. */
  alertar: (texto: string) => void;
}

/**
 * Escreve a recusa onde ela é lida: erro de preenchimento vai para o alerta
 * (é uma correção a fazer); "aguarde" e "nada mudou" vão para a região viva
 * (são notícia, não erro).
 */
export function recusarEscrita(
  op: OperacaoDeEscrita,
  decisao: DecisaoDeEscrita,
  sinais: SinaisDeEscrita,
): void {
  const texto = mensagemDeRecusa(op, decisao);
  if (texto === null) return;
  if (decisao === "invalido") sinais.alertar(texto);
  else sinais.anunciar(texto);
}

/**
 * O fim de TODA escrita bem-sucedida: entrega o foco a um controle vivo e
 * anuncia o que aconteceu — nesta ordem, e antes de o `router.refresh()`
 * remontar a árvore.
 *
 * `alvo` é o controle onde o trabalho continua (o campo que ficou vazio numa
 * criação; a linha seguinte numa exclusão). `alternativa` é o plano B para
 * quando o alvo não aceita foco (saiu do DOM). Se os dois falharem o foco
 * fica onde estava — o que nunca é o `<body>`, porque nenhum controle desta
 * página vira `disabled` durante a gravação (ver `decidirEscrita`).
 */
export function concluirEscrita(
  op: OperacaoDeEscrita,
  alvo: Focavel | null | undefined,
  alternativa: Focavel | null | undefined,
  anunciar: (texto: string) => void,
  texto: string = ANUNCIO_DE_SUCESSO[op],
  /** Injetável só para o teste-varredura — em produção é sempre o `document`. */
  documento: DocumentoComFoco | null = documentoAtual(),
): void {
  focarComAlternativa(alvo, alternativa, documento);
  anunciar(texto);
}
