import type { Ref } from "react";

/**
 * OS-LIFEBOARD · P7 — D14 (rodada 4) + D22 (rodada 5) + MÉDIO 4/BAIXO 3
 * (rodada 6): a região VIVA da fila.
 *
 * Componente burro DE PROPÓSITO: ele imprime a frase que a server action já
 * montou, e nada mais. Foi exatamente a costura feita aqui — "Enfileirado para
 * {conta} — {motivo do banco}." — que deixou o texto cru do Postgres
 * ("roteamento automatico: maior espaco livre hoje (US$ 150.00)") chegar à
 * tela em modo live, sem acento e com ponto decimal.
 *
 * RODADA 5 (D22) — duas mudanças, pelo mesmo motivo medido: a frase de
 * cancelamento que a action calculava (#11/D12, "US$ 50,00 entram no gasto de
 * hoje como estimativa") NUNCA era renderizada por ninguém, e o sucesso do
 * ajuste de custo era mudo.
 *
 *  1. A região existe ANTES do texto. Um `role="status"` que só nasce junto
 *     com a mensagem não é anunciado por leitor de tela — a região precisa
 *     estar no DOM quando o conteúdo chega. Vazia, ela é `sr-only`: não ocupa
 *     espaço nem desenha nada.
 *  2. Ela sabe mostrar ERRO também (`role="alert"`), para quem a usa não ter
 *     duas caixas diferentes para as duas metades da mesma resposta.
 *
 * RODADA 6 — duas mudanças, as duas medidas pelo crítico:
 *
 *  · MÉDIO 4 · A ÚNICA FRASE QUE AVISA QUE DINHEIRO ENTROU SAÍA EM VERDE.
 *    "Cancelado durante a execução. US$ 120,00 entram no gasto de hoje…" vinha
 *    com `text-state-done` — o mesmo verde de "Enfileirado para Lucas: é a
 *    conta com maior espaço livre". A única diferença entre "deu tudo certo" e
 *    "acabei de queimar US$ 120,00 do seu teto" era o texto. Agora existe
 *    `tom`, e ele é `atencao` (amarelo, `text-state-progress`) sempre que a
 *    ação LANÇA dinheiro no dia. Cinto e suspensório: se a frase falar de
 *    lançamento e o chamador esquecer o `tom`, o componente decide sozinho —
 *    uma mensagem de dinheiro nunca sai em verde por distração de caller.
 *
 *  · BAIXO 3 · O FOCO CAÍA NO `<body>` depois de cancelar (o `<button>` some
 *    do DOM com o foco nele). A região aceita foco programático
 *    (`tabIndex={-1}` quando tem texto) e um `ref`, para quem dispara a ação
 *    ENTREGAR o foco ao texto da resposta em vez de largá-lo no documento.
 *
 * Os botões de produção (`cancelar-botao.tsx`, `ajustar-custo-botao.tsx`)
 * montam ESTE componente — é o par que a produção realmente forma, e é esse
 * par que `tests/unit/prompts-mensagem-live.test.tsx` renderiza.
 */
export type TomDaMensagem = "sucesso" | "atencao";

/**
 * Marcas de que a frase LANÇOU dinheiro no dia do operador. Vivem aqui, ao
 * lado da cor, porque é aqui que a decisão é tomada.
 */
const MARCAS_DE_LANCAMENTO = [
  "entram no gasto",
  "entra no gasto",
  "lançou US$",
  "lançaram US$",
] as const;

export function frasePeLancamento(mensagem: string): boolean {
  return MARCAS_DE_LANCAMENTO.some((marca) => mensagem.includes(marca));
}

export function MensagemDaFila({
  mensagem,
  cabeHoje,
  erro,
  tom,
  refDaMensagem,
}: {
  mensagem?: string;
  /** `false` = entrou na fila mas espera espaço: aviso, não sucesso pleno. */
  cabeHoje?: boolean;
  /** A recusa em português da action — mesma região, papel de alerta. */
  erro?: string;
  /** MÉDIO 4: `atencao` = esta frase mexeu no teto de hoje. */
  tom?: TomDaMensagem;
  /** BAIXO 3: para quem dispara a ação entregar o foco ao texto da resposta. */
  refDaMensagem?: Ref<HTMLParagraphElement>;
}): JSX.Element {
  const temTexto = typeof mensagem === "string" && mensagem.length > 0;
  const atencao =
    tom === "atencao" ||
    cabeHoje === false ||
    (temTexto && frasePeLancamento(mensagem as string));
  return (
    <>
      <p
        ref={refDaMensagem}
        role="status"
        aria-live="polite"
        tabIndex={temTexto ? -1 : undefined}
        className={
          temTexto
            ? `mt-2 text-xs font-medium focus:outline-none ${atencao ? "text-state-progress" : "text-state-done"}`
            : "sr-only"
        }
      >
        {temTexto ? mensagem : ""}
      </p>
      {erro ? (
        <p role="alert" className="mt-1 text-[11px] font-medium text-state-blocked">
          {erro}
        </p>
      ) : null}
    </>
  );
}
