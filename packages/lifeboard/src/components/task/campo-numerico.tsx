"use client";

import type { ReactNode } from "react";

/**
 * OS-LIFEBOARD · P6 — O ÚNICO campo numérico desta página.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * [CRÍTICO, rodada 11] A PÁGINA APAGAVA DADO DO OPERADOR E DIZIA QUE SALVOU.
 *
 * Medido no Chromium, em `/tarefa/task-docs` (duração 2): clicar no campo,
 * `End`, digitar `e`. A caixa mostra `2e`. Clicar "Salvar duração". A tela diz
 * "Duração salva." Recarregar: duração VAZIA. Em `task-build`, a janela do
 * cronograma foi de fim-mais-cedo 4 para 1 no mesmo ato.
 *
 * A causa não é bug de navegador: é o contrato do HTML. Um
 * `<input type="number">` em estado `badInput` (`2e`, `1,5`, `--`) MOSTRA o
 * texto na caixa e reporta `value === ""`. O React lê `""`, o formulário
 * conclui "o operador apagou a duração" e o servidor, obediente, apaga.
 *
 * A ESCOLHA, em uma linha: **o campo é de texto (`type="text"` +
 * `inputMode="decimal"`), porque só assim o programa recebe o que o operador
 * vê** — a validação em português que já existe no servidor faz o resto, e
 * recusa com frase no campo em vez de apagar em silêncio.
 *
 * Por que não `validity.badInput`: ela consertaria os três sítios de hoje e
 * deixaria o buraco aberto para o quarto — cada campo novo teria de lembrar
 * de ler o DOM antes de decidir. Aqui não há estado que o programa não veja.
 * `inputMode="decimal"` mantém o teclado numérico no celular; o que se perde
 * são as setinhas de incremento, que nenhum dos três campos exigia.
 *
 * A trava que impede a volta: `tarefa-escritas-varredura.test.ts` recusa
 * qualquer `<input type="number"` em `components/task/**`.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface CampoNumericoProps {
  /** O rótulo visível, em português. */
  rotulo: ReactNode;
  /** O texto EXATO que está na caixa — nunca um número já convertido. */
  valor: string;
  /** Recebe o texto exato digitado, sem filtro e sem conversão. */
  aoMudar: (texto: string) => void;
  placeholder?: string;
  /** Classe do `<input>` (largura varia por formulário). */
  classeDoCampo: string;
  /** Classe do `<label>` que o envolve. */
  classeDoRotulo?: string;
}

export function CampoNumerico({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  classeDoCampo,
  classeDoRotulo = "flex flex-col gap-1 text-xs font-semibold text-bone-300",
}: CampoNumericoProps): JSX.Element {
  return (
    <label className={classeDoRotulo}>
      {rotulo}
      <input
        type="text"
        inputMode="decimal"
        // `autoComplete="off"`: o histórico do navegador não tem por que
        // sugerir números de outro formulário dentro de uma duração.
        autoComplete="off"
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
        placeholder={placeholder}
        className={classeDoCampo}
      />
    </label>
  );
}
