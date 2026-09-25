"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";

import { focar } from "@/components/task/foco";
import { formatarUsd } from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — botão "cancelar". Desde a rodada 3 (D7) ele aparece
 * também em item `pega`: cancelar um item em execução é a única saída que o
 * operador tem quando a sessão filha travou (antes, o item ficava preso até
 * expirar). A consequência é outra nesse caso — a sessão que está rodando vai
 * ser interrompida pelo worker no próximo sinal de vida —, e a confirmação diz
 * isso com todas as letras.
 *
 * RODADA 7 — o `window.confirm` nativo saiu. Ele BLOQUEIA a thread, não é
 * estilizável, não é anunciável e devolve o foco onde quiser. A confirmação é
 * de DOIS PASSOS dentro da página, no mesmo padrão da peça P6: o próprio botão
 * vira "confirmar cancelamento?", o foco NÃO sai dele, **Escape cancela** e,
 * sem confirmação, ele volta sozinho ao normal em 5 s.
 *
 * RODADA 8 — dois achados do crítico, os dois medidos:
 *
 *  · MÉDIO 5 · A CONFIRMAÇÃO NÃO CHEGAVA A LEITOR DE TELA. A frase que diz o
 *    que vai acontecer era um `<p>` solto: sem `aria-describedby`, sem
 *    `role="status"`, sem `aria-live`. O `window.confirm` que ela substituiu
 *    ERA lido em voz alta — a troca melhorou o teclado e piorou o áudio, na
 *    ÚNICA ação destrutiva da página. Agora ela é as duas coisas: uma região
 *    viva que existe ANTES do texto (vazia, é `sr-only` — um `role="status"`
 *    que nasce junto com o conteúdo não é anunciado, o mesmo achado de D22 em
 *    `mensagem-da-fila.tsx`) E a descrição acessível do botão, por
 *    `aria-describedby`. Cinto e suspensório, de propósito: é a ação que
 *    destrói trabalho.
 *
 *  · BAIXO 2 · `confirmando` era `useState` LOCAL. `fila-tabela.tsx` monta a
 *    linha DUAS vezes (tabela `hidden sm:block` + cartão `sm:hidden`), então a
 *    confirmação armada em 390 px sumia ao ir para 1280 px — exatamente o
 *    defeito que a rodada 7 corrigiu para o painel de ajuste e deixou passar
 *    aqui. O estado subiu para a LINHA, como `ajuste`; as duas instâncias leem
 *    e escrevem o mesmo booleano. O relógio de 5 s continua aqui (é efeito de
 *    UI, não estado compartilhado) e as duas instâncias desarmam o mesmo bit.
 */
export function CancelarBotao({
  id,
  emExecucao = false,
  podeCancelar = true,
  pendente = false,
  confirmando = false,
  custoAoCancelarUsd = 0,
  jaMedidoPelaSessao = false,
  aoMudarConfirmando,
  aoConfirmar,
}: {
  id: string;
  emExecucao?: boolean;
  podeCancelar?: boolean;
  pendente?: boolean;
  /**
   * MÉDIO 6 (rodada 9) · QUANTO ESTE CANCELAMENTO VAI LANÇAR NO GASTO DE HOJE.
   * Zero quando não lança nada. A linha calcula pela MESMA régua do banco
   * (`fila_prompts_cancelar`, D12): item que já teve dono — em execução OU
   * devolvido para a fila depois de uma tentativa — lança o custo estimado.
   */
  custoAoCancelarUsd?: number;
  /**
   * MÉDIO 3 (rodada 13) · POR QUE não entra nada. `custoAoCancelarUsd = 0`
   * tem duas causas muito diferentes — "este item nunca rodou" e "a sessão já
   * publicou o número real, e a estimativa da casa vai ser recusada pelo
   * livro". A segunda precisa ser dita: na linha o operador está vendo
   * US$ 50,00 de estimativa, e um silêncio ali é a frase falsa de antes com
   * outra roupa.
   */
  jaMedidoPelaSessao?: boolean;
  /** BAIXO 2: o passo da confirmação mora na LINHA — as duas instâncias o compartilham. */
  confirmando?: boolean;
  aoMudarConfirmando?: (id: string, armado: boolean) => void;
  /** A linha dispara a server action; este botão só decide QUANDO. */
  aoConfirmar?: (id: string) => void;
}): JSX.Element | null {
  const relogio = useRef<number | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  // [Minor do CodeRabbit, rodada 10] `FilaTabela` monta a tabela do desktop E
  // os cartões do celular para o MESMO item, então este componente nasce duas
  // vezes com o mesmo `id` — e o `aria-describedby` do botão do celular podia
  // resolver para o nó do desktop. `useId` dá o sufixo por instância; o prefixo
  // continua estável para quem procura pelo padrão.
  const descricaoId = `cancelar-consequencia-${id}-${useId()}`;

  useEffect(() => {
    return () => {
      if (relogio.current !== null) window.clearTimeout(relogio.current);
    };
  }, []);

  /**
   * [pós-merge, CodeRabbit] O RELÓGIO É LOCAL, O `confirmando` É COMPARTILHADO.
   * `FilaTabela` monta esta linha duas vezes (tabela do desktop e cartão do
   * telefone) sobre o MESMO item, e as duas dividem `confirmando` pelo pai.
   * Quando uma instância confirma, a outra fica com um relógio correndo sem
   * dono: cinco segundos depois ele chama `aoMudarConfirmando(id, false)` e
   * desarma uma confirmação NOVA, que o operador acabou de armar. Desarmou por
   * fora, o relógio desta instância morre junto.
   */
  useEffect(() => {
    if (confirmando) return;
    if (relogio.current !== null) {
      window.clearTimeout(relogio.current);
      relogio.current = null;
    }
  }, [confirmando]);

  function desarmar(): void {
    if (relogio.current !== null) window.clearTimeout(relogio.current);
    relogio.current = null;
    aoMudarConfirmando?.(id, false);
  }

  function aoClicar(): void {
    // B3 (rodada 11): a recusa do 2º clique tem VOZ — ver `emAndamento` abaixo.
    if (pendente) return;
    if (!confirmando) {
      aoMudarConfirmando?.(id, true);
      // Foco GERENCIADO: no macOS o Safari não dá foco a um `<button>` clicado,
      // e sem foco o Escape não chegaria ao handler abaixo — a saída do passo 2
      // viraria só o relógio de 5 s. Entregar o foco aqui torna o "Esc cancela"
      // verdadeiro em todo navegador, e é também o instante em que o leitor de
      // tela lê a descrição nova (`aria-describedby`). (Reusa `focar` da P6.)
      focar(botaoRef.current);
      if (relogio.current !== null) window.clearTimeout(relogio.current);
      relogio.current = window.setTimeout(() => aoMudarConfirmando?.(id, false), 5000);
      return;
    }
    desarmar();
    aoConfirmar?.(id);
  }

  // MÉDIO 5 (rodada 7): Escape cancela a confirmação. O foco está no próprio
  // botão (ele não sai do DOM entre os dois passos), então o handler mora aqui
  // — não há captura global a instalar nem a remover.
  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === "Escape" && confirmando) {
      e.preventDefault();
      desarmar();
    }
  }

  if (!podeCancelar) return null;

  /*
    MÉDIO 6 (rodada 9) · A CONFIRMAÇÃO ESCONDIA O DINHEIRO. Ela decidia a frase
    SÓ por `emExecucao`: um item `na_fila` com `tentativas > 0` (pego, morto,
    devolvido) lança até US$ 120 ao ser cancelado — e a confirmação dizia, com
    todas as letras, "Ele sai da fila e não vai rodar". O texto certo
    (`fraseDoCancelamento` → `cancelado_apos_devolucao`) só aparecia DEPOIS,
    quando o dinheiro já tinha entrado. A pergunta que destrói trabalho e gasta
    dinheiro agora diz as duas coisas ANTES.
  */
  const lanca = custoAoCancelarUsd > 0;
  const oQueAcontece = emExecucao
    ? "A sessão que está rodando vai ser interrompida no próximo sinal de vida."
    : "Ele sai da fila e não vai rodar.";
  /*
    MÉDIO 3 (rodada 13) · A FRASE DIZIA DUAS COISAS FALSAS SOBRE DINHEIRO.
    Medido pelo crítico, na única pergunta destrutiva da página: item em
    execução cuja sessão já publicou US$ 300; a confirmação prometia
    "US$ 50,00 entram no gasto de hoje como estimativa — dá para ajustar na
    linha depois". Entravam US$ 0,00 (o livro recusa posto 10 sobre posto 40) e
    NÃO dava para ajustar (a mesma recusa, pela outra porta).
    Agora as duas metades vêm da MESMA leitura do livro que decide o botão de
    ajuste: quando ela deixa lançar, a promessa de ajustar também vale.
  */
  const oQueCusta = lanca
    ? ` ${formatarUsd(custoAoCancelarUsd)} entram no gasto de hoje como estimativa — dá para ajustar na linha depois.`
    : jaMedidoPelaSessao
      ? " O gasto de hoje não muda: a sessão já publicou o número real deste item."
      : " Não entra nada no gasto de hoje.";
  const consequencia = `${oQueAcontece}${oQueCusta} Esc cancela.`;
  /**
   * B3 (rodada 11) · O SEGUNDO CLIQUE ERA RECUSADO EM SILÊNCIO.
   * Com um cancelamento em voo, `aoClicar` faz `if (pendente) return;` e nada
   * acontecia na tela — o operador clica de novo, o sistema não responde nada,
   * e é assim que se faz alguém achar que a página travou. A recusa passa a ter
   * frase, e ela fica visível o tempo todo em que o clique vai ser recusado
   * (não só depois do clique perdido): a região viva abaixo já existe, é
   * `role="status"` e anuncia sozinha. Sem estado local — BAIXO 2 (rodada 8)
   * manda este componente ser controlado pela linha, e `pendente` é prop.
   */
  const emAndamento = pendente
    ? "Este cancelamento já está em andamento — clicar de novo não adianta."
    : "";

  /**
   * M2 (rodada 11) · `relative` NÃO É ENFEITE: ELE É O CONSERTO.
   * O `<p role="status">` abaixo é `sr-only` quando está vazio, e `sr-only` é
   * `position:absolute`. Sem ancestral posicionado, o bloco que o contém é o
   * da PÁGINA — então ele escapava do `overflow-x-auto` da tabela
   * (`min-w-[880px]`) e esticava o documento inteiro a partir da posição
   * estática dele, lá dentro da tabela larga. Medido em 820×1180: a página
   * rolava 74 px de lado (`scrollWidth` 894 contra 820 de viewport), e
   * esconder a tabela derrubava o `scrollWidth` para 820 — era ela, por este
   * parágrafo. Telefone e desktop davam 0, que é por que ninguém tinha visto.
   * Com `relative`, o bloco que o contém é esta coluna e o `overflow-x-auto`
   * volta a recortá-lo.
   */
  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        ref={botaoRef}
        type="button"
        onClick={aoClicar}
        onKeyDown={aoTeclar}
        onBlur={desarmar}
        aria-busy={pendente ? true : undefined}
        aria-disabled={pendente ? true : undefined}
        /* MÉDIO 5: a consequência é a DESCRIÇÃO deste botão, não um texto que
           por acaso está do lado. O `id` existe sempre; a descrição só ganha
           conteúdo no passo 2, que é quando o foco chega aqui. */
        aria-describedby={confirmando ? descricaoId : undefined}
        className={`inline-flex min-h-[44px] items-center rounded-md border px-2.5 text-xs font-medium transition duration-150 ease-almapetra focus:outline-none ${
          pendente ? "opacity-50" : ""
        } ${
          confirmando
            ? "border-state-blocked/70 bg-state-blocked/12 text-state-blocked"
            : "border-navy-700 bg-navy-850 text-bone-300 hover:border-state-blocked/60 hover:text-state-blocked focus:border-gold-500"
        }`}
      >
        {pendente ? "cancelando…" : confirmando ? "confirmar cancelamento?" : "cancelar"}
      </button>
      {/* MÉDIO 5: a região existe ANTES do texto — vazia ela é `sr-only` e não
          desenha nada, mas está no DOM quando o conteúdo chega, que é a única
          forma de um `role="status"` ser anunciado. */}
      <p
        id={descricaoId}
        role="status"
        aria-live="polite"
        className={
          confirmando || emAndamento.length > 0
            ? "max-w-[240px] text-right text-[11px] text-state-progress"
            : // M2: `sr-only` é `position:absolute` SEM deslocamento — e um
              // absoluto de deslocamento automático fica na "posição
              // estática", que aqui é lá dentro da tabela de 880 px. Medido:
              // o `overflow-x-auto` da tabela não o recortava e a PÁGINA
              // inteira rolava 74 px de lado em 820×1180. Ancorado em
              // `left-0 top-0` dentro do `relative` acima, ele volta a ser
              // recortado: 894 → 820, e segue 1×1 px, invisível e anunciável.
              "sr-only left-0 top-0"
        }
      >
        {confirmando ? consequencia : emAndamento}
      </p>
    </div>
  );
}
