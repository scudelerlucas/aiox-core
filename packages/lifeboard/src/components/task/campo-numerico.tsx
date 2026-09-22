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
 * ═══════════════════════════════════════════════════════════════════════════
 * A TRAVA QUE IMPEDE A VOLTA — e por que ela mudou três vezes (rodada 14).
 *
 * Ela já foi: "o texto `type="number"` não aparece neste arquivo" (rodada 10),
 * "o `<input>` RENDERIZADO não é `number`" (rodada 12) e "nenhum arquivo destas
 * duas pastas escreve em nó de DOM" (rodada 13). O crítico passou pelas três —
 * a última com um par de parênteses, `(el).type = "number"`, e com um ajudante
 * de nome inocente em `src/lib/ui/`, os dois com os quatro portões verdes e a
 * duração do operador apagada no Chromium.
 *
 * A trava de verdade passou a ser **de navegador**:
 * `tests/navegador/guarda-p6.mjs` abre a página no Chromium e pergunta ao DOM
 * (`el.type`, `el.inputMode`, `el.value`) — não ao texto do arquivo. Ela não se
 * importa se a escrita veio de regex, de `ref`, de um ajudante em `lib/`, do
 * setter do protótipo ou de um pacote de fora.
 *
 * **E a rodada 14 achou o buraco dela:** essa pergunta era sempre "o que o
 * campo é AGORA?", e "agora" eram os primeiros segundos depois da carga. Com
 * `setTimeout(…, 4000)` dentro da `ref` deste `<input>`, o campo virava
 * `number` depois de a guarda medir — cinco portões verdes e a duração do
 * operador apagada no Chromium, outra vez. A pergunta virou **"alguma coisa
 * mexeu nisto em algum momento?"**: um vigia instalado na página antes da
 * hidratação anota toda mudança em `type`/`inputMode` de qualquer campo
 * (setter do protótipo, `setAttribute`, `MutationObserver`), e a guarda reprova
 * se o registro não estiver vazio. Duas sentinelas dão alcance de tempo a isso:
 * uma de tempo real (~40 s, o tempo da guarda) e uma com o relógio da página
 * sob controle da guarda, que adianta meia hora de uma vez. O que fica fora de
 * alcance está declarado no cabeçalho da guarda — nem aqui nem lá se afirma que
 * ela alcança tudo.
 *
 * As duas redes de fonte continuam, como segunda linha: `tiposDeInput` e
 * `escritasNoDom` (`tests/unit/tarefa-varredura-derivada.ts`) leem agora o
 * `src/` INTEIRO, com exceções declaradas por caminho + propriedade + motivo.
 * A `tiposDeInput` ganhou na rodada 14 um piso e uma exigência nominal: ela
 * chegava a achar ZERO campo e o portão continuava verde (medido).
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
