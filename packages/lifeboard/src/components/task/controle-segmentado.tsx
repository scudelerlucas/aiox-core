"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * OS-LIFEBOARD · P6 — controle segmentado genérico (radiogroup de botões).
 * Reusado por status, opcionalidade, esforço, custo e tipo de aresta — a
 * régua de UI/UX pede uma ação primária por tela; isto aqui é seleção, não
 * ação, então múltiplos cabem lado a lado sem violar a régua.
 *
 * v2 (achado MÉDIO #8, crítico 13/09): `role="radiogroup"` sem roving
 * tabindex — Tab visitava CADA botão (20 paradas de Tab na página inteira
 * antes de chegar na textarea da nota), e as setas não faziam nada, ao
 * contrário de todo `radiogroup` nativo. Agora só o botão SELECIONADO tem
 * `tabIndex=0` (o resto é `-1`, fora do fluxo de Tab); ArrowLeft/Up move
 * para a opção anterior, ArrowRight/Down para a próxima (com wrap), e o
 * foco segue a seleção — mesmo padrão de um `<input type=radio">` nativo.
 *
 * v3 (achado MÉDIO #3, crítico 13/09, rodada 2): as setas moviam o foco E
 * COMITAVAM (chamavam `aoMudar`) a cada tecla — em `StatusForm`, que dispara
 * a mutação assim que `aoMudar` roda, isso mandava uma chamada de rede por
 * tecla ao navegar as 4 opções. Setas (e Home/End) agora só movem o FOCO do
 * navegador entre os botões — `aoMudar` só roda por clique, ou por Enter/
 * Espaço no botão focado (comportamento NATIVO do `<button>`, que já
 * dispara `onClick`; por isso o teclado não precisa de um caso especial
 * para essas duas teclas).
 *
 * v5 (achado MÉDIO #2, rodada 5 do crítico): NENHUM botão do grupo usa mais
 * o atributo `disabled` durante a gravação. Medido: apertar Enter no
 * segmentado de status mandava o foco para o `<body>` — o navegador desfoca
 * qualquer elemento que vire `disabled`, e `desabilitado={pendente}` fazia
 * exatamente isso com o botão recém-apertado. Agora o estado "gravando" é
 * dito por `aria-busy`/`aria-disabled` (o leitor de tela sabe; o gerenciador
 * de foco não se mete) e o duplo envio é recusado no handler.
 *
 * v4 (achado MÉDIO #2, rodada 4 do crítico): `valorAtual` aceita `null` — o
 * estado LEGÍTIMO de "nada escolhido ainda" (`AtomosForm` sem átomos
 * declarados, achado MÉDIO #2), não só um bug defensivo. Com `null`, todo
 * botão nasce `aria-checked="false"` e o primeiro vira a parada do Tab (o
 * mesmo fallback que já existia para o caso "não deveria acontecer" — antes
 * dele virar um caso real, com nome).
 */
export interface OpcaoSegmentada<T extends string | number> {
  valor: T;
  rotulo: string;
}

/**
 * PURA — para uma tecla de navegação, devolve o índice que deve RECEBER O
 * FOCO (nunca o que deve ser comitado): `null` quando a tecla não é de
 * navegação (inclui Enter/Espaço, que continuam sendo o clique nativo do
 * `<button>` — não passam por aqui). A assinatura em si é a prova do achado
 * MÉDIO #3 (rodada 2): esta função não recebe `aoMudar`, então não existe
 * chamada de commit que ela possa fazer — exportada só para o teste, que
 * roda sem DOM/jsdom (o repo não tem nenhum dos dois).
 */
export function indiceDeFocoParaTecla(
  key: string,
  indiceAtual: number,
  totalOpcoes: number,
): number | null {
  if (totalOpcoes === 0) return null;
  const ultimo = totalOpcoes - 1;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return indiceAtual === ultimo ? 0 : indiceAtual + 1;
    case "ArrowLeft":
    case "ArrowUp":
      return indiceAtual === 0 ? ultimo : indiceAtual - 1;
    case "Home":
      return 0;
    case "End":
      return ultimo;
    default:
      return null;
  }
}

export interface ControleSegmentadoProps<T extends string | number> {
  rotuloGrupo: string;
  opcoes: readonly OpcaoSegmentada<T>[];
  /** `null` (achado MÉDIO #2, rodada 4): nenhuma opção escolhida ainda. */
  valorAtual: T | null;
  aoMudar: (valor: T) => void;
  desabilitado?: boolean;
  className?: string;
}

export function ControleSegmentado<T extends string | number>({
  rotuloGrupo,
  opcoes,
  valorAtual,
  aoMudar,
  desabilitado = false,
  className,
}: ControleSegmentadoProps<T>): JSX.Element {
  const botoesRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const indiceAtual = valorAtual === null ? -1 : opcoes.findIndex((op) => op.valor === valorAtual);

  /**
   * Só move o FOCO do navegador para o botão alvo — nunca chama `aoMudar`.
   * Esta é a correção do achado MÉDIO #3: a versão anterior (`moverPara`)
   * comitava a cada tecla de seta; esta função, por contrato, não tem como
   * comitar nada — não recebe nem chama o callback de mudança.
   */
  function moverFoco(indiceAlvo: number): void {
    botoesRef.current.get(indiceAlvo)?.focus();
  }

  /**
   * [MÉDIO #2, rodada 5] O commit é recusado enquanto a gravação anterior não
   * volta — a mesma proteção que o `disabled` dava, só que sem tirar o foco
   * do botão que o operador acabou de apertar. (`useAcaoTarefa` tem a mesma
   * trava por dentro; esta aqui evita até a chamada.)
   */
  function aoClicar(valor: T): void {
    if (desabilitado) return;
    aoMudar(valor);
  }

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    // Navegar por seta continua permitido durante a gravação (só move foco,
    // não comita) — o que é recusado é o COMMIT, em `aoClicar`.
    // Enter/Espaço não passam por `indiceDeFocoParaTecla` (devolve `null`) —
    // sem `e.preventDefault()`, o comportamento nativo do `<button>` já
    // dispara `onClick` (que comita via `aoMudar`), então não duplicamos o
    // commit aqui.
    const alvo = indiceDeFocoParaTecla(e.key, indice, opcoes.length);
    if (alvo === null) return;
    e.preventDefault();
    moverFoco(alvo);
  }

  return (
    <div
      role="radiogroup"
      aria-label={rotuloGrupo}
      className={`inline-flex flex-wrap gap-1.5 ${className ?? ""}`}
    >
      {opcoes.map((op, indice) => {
        const selecionado = valorAtual !== null && op.valor === valorAtual;
        // Roving tabindex: só a opção selecionada entra no fluxo de Tab da
        // página — nenhuma outra (achado #8). Sem seleção nenhuma — caso
        // REAL desde o achado MÉDIO #2 (rodada 4): `AtomosForm` sem átomos
        // declarados nasce com `valorAtual=null` nos 3 grupos — o primeiro
        // item vira a parada do Tab (mesmo padrão de um radiogroup nativo
        // sem nenhum rádio marcado).
        const ehParadaDoTab = selecionado || (indiceAtual === -1 && indice === 0);
        return (
          <button
            key={String(op.valor)}
            ref={(el) => {
              if (el) botoesRef.current.set(indice, el);
              else botoesRef.current.delete(indice);
            }}
            type="button"
            role="radio"
            aria-checked={selecionado}
            tabIndex={ehParadaDoTab ? 0 : -1}
            // [MÉDIO #2, rodada 5] NÃO `disabled` — ver o bloco v5 acima.
            aria-busy={desabilitado ? true : undefined}
            aria-disabled={desabilitado ? true : undefined}
            onClick={() => aoClicar(op.valor)}
            onKeyDown={(e) => aoTeclar(e, indice)}
            className={`min-h-[36px] rounded-lg border px-3 text-sm font-semibold transition duration-150 ease-almapetra ${
              desabilitado ? "opacity-50" : ""
            } ${
              selecionado
                ? "border-gold-500 bg-navy-800 text-gold-300"
                : "border-navy-700 bg-navy-850 text-bone-300 hover:border-navy-600 hover:text-bone-100"
            }`}
          >
            {op.rotulo}
          </button>
        );
      })}
    </div>
  );
}
