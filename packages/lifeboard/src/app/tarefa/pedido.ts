/**
 * OS-LIFEBOARD · P6 — O PEDIDO SELADO: o contrato entre a porta de escrita e
 * o servidor.
 *
 * [ALTO #1, rodada 9] A rodada 8 tentou garantir a porta por VARREDURA — um
 * scanner léxico que lia os handlers e exigia `decidirEscrita` +
 * `concluirEscrita` em volta de cada `disparar(form)`. O crítico passou 7 de
 * 12 formas de escrita por essa peneira (a decisiva: um 2º
 * `useAcaoTarefa(estimativaSetAction)` cujo handler CITAVA a porta e
 * despachava cru — varredura verde, duração apagada no servidor, zero
 * anúncios).
 *
 * A decisão desta rodada é arquitetônica, não lexical: **a porta é o próprio
 * transporte**. O servidor só aceita um `PedidoDeEscrita`, e um
 * `PedidoDeEscrita` não pode ser escrito à mão — a marca `seloDaPorta` é um
 * `unique symbol` AMBIENTE e NÃO EXPORTADO: nenhum outro módulo consegue
 * nomear essa chave, então nenhum outro módulo consegue produzir um objeto
 * que satisfaça este tipo. Quem tenta chamar a ação com um `FormData` (ou com
 * `<form action={...}>`, que entrega um `FormData`) não compila.
 *
 * A única fábrica vive em `src/components/task/porta-de-escrita.ts`, é
 * privada daquele módulo, e é o único ponto do `src/` autorizado a converter
 * para este tipo — o que a segunda rede (`tests/unit/tarefa-varredura-derivada.ts`)
 * confere lendo o fonte inteiro, `src/app/api/**` incluído.
 */

/** As 14 escritas da página, por extenso — nenhuma amostra. */
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

export function ehOperacaoDeEscrita(v: unknown): v is OperacaoDeEscrita {
  return typeof v === "string" && (OPERACOES_DE_ESCRITA as readonly string[]).includes(v);
}

/** O par que o cliente lê de toda escrita — mesmo contrato de `useFormState`. */
export type EstadoAcaoTarefa = { erro?: string; ok?: true; id?: string };

/**
 * A marca de fábrica. `declare const` + `unique symbol` + **sem export**:
 * o nome não sai deste arquivo, e sem o nome não há como escrever a chave.
 */
declare const seloDaPorta: unique symbol;

/** O único argumento que o servidor desta página aceita. */
export interface PedidoDeEscrita {
  readonly op: OperacaoDeEscrita;
  readonly campos: Readonly<Record<string, string>>;
  /** Prova de que veio da porta — inexprimível fora deste arquivo. */
  readonly [seloDaPorta]: true;
}

/** Os campos como o servidor os lê: tudo é `string`, nada é confiável. */
export type CamposDeEscrita = Readonly<Record<string, string>>;
