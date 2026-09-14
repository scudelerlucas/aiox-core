/**
 * OS-LIFEBOARD · P7 — D14 (rodada 4) + D22 (rodada 5): a região VIVA da fila.
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
 * Os botões de produção (`cancelar-botao.tsx`, `ajustar-custo-botao.tsx`)
 * montam ESTE componente — é o par que a produção realmente forma, e é esse
 * par que `tests/unit/prompts-mensagem-live.test.tsx` renderiza.
 */
export function MensagemDaFila({
  mensagem,
  cabeHoje,
  erro,
}: {
  mensagem?: string;
  /** `false` = entrou na fila mas espera espaço: aviso, não sucesso pleno. */
  cabeHoje?: boolean;
  /** A recusa em português da action — mesma região, papel de alerta. */
  erro?: string;
}): JSX.Element {
  const temTexto = typeof mensagem === "string" && mensagem.length > 0;
  return (
    <>
      <p
        role="status"
        aria-live="polite"
        className={
          temTexto
            ? `mt-2 text-xs font-medium ${cabeHoje === false ? "text-state-progress" : "text-state-done"}`
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
