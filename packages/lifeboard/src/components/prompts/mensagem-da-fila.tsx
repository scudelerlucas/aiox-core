/**
 * OS-LIFEBOARD · P7 — D14 (rodada 4): a linha de resposta da fila.
 *
 * Componente burro DE PROPÓSITO: ele imprime a frase que a server action já
 * montou, e nada mais. Foi exatamente a costura feita aqui — "Enfileirado para
 * {conta} — {motivo do banco}." — que deixou o texto cru do Postgres
 * ("roteamento automatico: maior espaco livre hoje (US$ 150.00)") chegar à
 * tela em modo live, sem acento e com ponto decimal.
 *
 * Existe separado do formulário para poder ser RENDERIZADO num teste com a
 * frase que a ação devolveu (`tests/unit/prompts-mensagem-live.test.tsx`) —
 * sem isso, a prova pararia no retorno da função e ninguém saberia se a tela
 * mostra aquilo mesmo.
 */
export function MensagemDaFila({
  mensagem,
  cabeHoje,
}: {
  mensagem?: string;
  /** `false` = entrou na fila mas espera espaço: aviso, não sucesso pleno. */
  cabeHoje?: boolean;
}): JSX.Element | null {
  if (!mensagem) return null;
  return (
    <p
      role="status"
      className={`mt-2 text-xs font-medium ${
        cabeHoje === false ? "text-state-progress" : "text-state-done"
      }`}
    >
      {mensagem}
    </p>
  );
}
