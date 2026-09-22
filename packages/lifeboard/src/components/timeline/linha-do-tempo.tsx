"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ARESTA_STROKE,
  ARESTA_STROKE_CRITICO,
  ARESTA_STROKE_DESTACADA,
} from "@/components/graph/aresta-svg";
import {
  avisoDeItensFora,
  depoisDoFimDesenhado,
  diasDesenhados,
  faixaSuperiorDaTela,
  fimDesenhadoIso as calcularFimDesenhadoIso,
  gerarEscalaEixo,
  larguraAproximada,
  PADDING_CHIP_PX,
  rotulosNaJanela,
  tetoMordeu as tetoMordeuAJanela,
} from "@/core/timeline/eixo-rotulos";
import {
  aplicarPlanoDaFolha,
  planoDaFolhaInferior,
  semRolagem,
} from "@/core/timeline/folha-inferior";
import {
  estadoDoAssunto,
  rotuloAcessivelDoAssunto,
  textoDoPeriodoDoAssunto,
} from "@/core/timeline/assunto-em-palavras";
import {
  desenhaBarraDeDuracao,
  motivoForaDaGrade,
  textoDoPeriodo,
} from "@/core/timeline/periodo-da-tarefa";
import {
  avisoDeOverflow,
  fatorDeOverflow,
  formatarFator,
  posicaoDoBadge,
} from "@/core/timeline/geometria-painel";
import {
  aoRedimensionar,
  aplicarTransformDoCabecalho,
  rolarESincronizar,
  scrollParaRevelar,
} from "@/core/timeline/sincronizacao-painel";
import type {
  LinhaDoTempoAssuntoRow,
  LinhaDoTempoProps,
  LinhaDoTempoRow,
  LinhaDoTempoTarefaRow,
} from "@/types/linha-do-tempo";

/**
 * OS-LIFEBOARD · P5 — Linha do tempo (Gantt): "Assuntos" (PRs, `criado_em →
 * mergeado_em`) e "Tarefas" (janela do CPM), com predecessores/sucessores.
 *
 * Sem lib pesada: SVG + `<div>` posicionados por matemática de dias × px. A
 * barra que se beija com "Asana Timeline" (o alvo declarado do gauntlet, §7 do
 * doc de átomos) precisa de: escala de dias com "hoje" marcado, ticks de
 * semana, traço triplo vermelho no crítico (mesma linguagem do grafo — P4),
 * extensão de folga mais clara, setas de dependência coloridas por seleção.
 *
 * Cores: SEMPRE tokens Tailwind literais em `className` (nunca hex fora de
 * `tailwind.config.ts`); hex só nos 3 `stroke=` de SVG importados de
 * `aresta-svg.tsx` — mesma exceção documentada lá ("API do SVG exige literal
 * no atributo, não em classe"), reusada aqui em vez de duplicada.
 */

/**
 * P5b (achado CRÍTICO #3 do crítico hostil): a escala fixa PADRÃO era "mes"
 * (16px/dia), escolhida sem olhar para o dado — os 59 dias de span dos
 * ASSUNTOS (o quadro de PRs) esmagavam o horizonte de 4 dias das TAREFAS em
 * frestas de 4px. `"auto"` substitui esse default: encaixa `pxPorDia` para que
 * a janela relevante (hoje ± o horizonte real das tarefas, nunca o histórico
 * inteiro de assuntos) preencha a largura do painel, com piso de 24px por dia
 * de barra. Os três zooms fixos continuam existindo como AJUSTE FINO — quem
 * quer ver os 59 dias de assuntos ainda pode pedir "Trimestre".
 */
type Zoom = "auto" | "semana" | "mes" | "trimestre";

const ZOOM_OPCOES: readonly { id: Zoom; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "trimestre", label: "Trimestre" },
];
const PX_POR_DIA_FIXO: Record<Exclude<Zoom, "auto">, number> = {
  semana: 46,
  mes: 16,
  trimestre: 6,
};
/** Usado só antes da 1ª medição real do painel (SSR / primeiro paint sem `ResizeObserver`). */
const PX_POR_DIA_AUTO_FALLBACK = 16;
/**
 * P5c (achado ALTO #4, rodada 2): 24px/dia era tratado como o ALVO do "auto"
 * (a densidade confortável quando a janela cabe), NUNCA o piso — o piso de
 * verdade é `PX_POR_DIA_AUTO_PISO`. Antes `Math.max(24, largura/dias)` fazia
 * o 24 SEMPRE vencer em janelas largas (>~41 dias a 1280px), forçando
 * overflow horizontal que "auto" deveria evitar encolhendo a densidade.
 */
/** Piso de verdade do "auto" — nunca encolhe além disto, mesmo com o horizonte inteiro. */
const PX_POR_DIA_AUTO_PISO = 6;
/**
 * P5e (achado BAIXO #6 do crítico hostil, rodada 4): o 24px/dia acima virou o
 * TETO na prática — uma janela ESTREITA (poucos dias) num painel largo
 * (977–1280px) ficava presa em 24px/dia mesmo sobrando painel (medido:
 * `totalW 624` num painel de até 1280px, 36% desperdiçado). Este é o teto de
 * verdade agora: "auto" cresce até 64px/dia (ainda uma barra legível, nunca a
 * escala tipo calendário gigante) para preencher o painel quando o horizonte
 * é curto; continua encolhendo (piso `PX_POR_DIA_AUTO_PISO`) quando é largo.
 */
const PX_POR_DIA_AUTO_TETO = 64;
/** Janela mínima do "auto" quando não há tarefa nenhuma: hoje − 7 d → hoje + 14 d. */
const AUTO_MARGEM_PASSADO_DIAS = 7;
const AUTO_MARGEM_FUTURO_DIAS = 14;
/** Mesma margem de respiro que os zooms fixos dão (`minIsoDados`/`maxIsoDados`) — achado MÉDIO #8. */
const AUTO_MARGEM_RESPIRO_PASSADO_DIAS = 2;
const AUTO_MARGEM_RESPIRO_FUTURO_DIAS = 3;
/** Piso visual de uma barra de tarefa — achado BAIXO #11 (sub-dia vira barra curta, nunca diamante nem 4px cru). */
const LARGURA_MINIMA_BARRA = 12;
/** P5f (achado MÉDIO A7, rodada 5): passo do scroll por tecla (← →) no painel. */
const PASSO_SCROLL_TECLADO_PX = 80;
/** Namespaced — mesma disciplina de qualquer outra chave de `localStorage` da casa. */
const CHAVE_ZOOM = "lifeboard:linha-do-tempo:zoom";

/**
 * P5e (achado MÉDIO #5 do crítico hostil, rodada 4): a 34px, a coluna de
 * rótulo (108px a 390px de largura) truncava 11 de 22 nomes em ~10
 * caracteres. A coluna larga a 42px (2 linhas de 12px cabem com folga) — o
 * mesmo valor vale para a linha de CABEÇALHO de grupo (usa `ROW_H` também) e
 * para o cálculo de `top` das barras, que continuam alinhadas 1:1 com o
 * rótulo do lado esquerdo (mesma constante, sempre).
 */
const ROW_H = 42;
const BAR_H = 16;
const HEADER_H = 40;
/**
 * P5d (achado MÉDIO #5, rodada 3): altura da 2ª faixa do cabeçalho — o nome
 * do MÊS, uma vez por mês — que só aparece na densidade "dia" (≥24px/dia),
 * onde os rótulos de baixo são só números soltos ("13", "14"…) sem contexto
 * nenhum de mês.
 */
const HEADER_MES_H = 18;
const MS_POR_DIA = 86_400_000;
/** "Hoje" mira ~40% da largura visível do painel (achados CRÍTICO #1/#2). */
const ANCORA_HOJE_FRACAO = 0.4;
/**
 * P5d (achado ALTO #1, rodada 3): o offset do cabeçalho STICKY não é mais uma
 * constante — antes supunha 44px fixos para a nav do shell, mas a nav não era
 * sticky: na TRANSIÇÃO do scroll (nav saindo de cena, cabeçalho já grudado no
 * offset fixo) sobrava uma faixa sem nav NEM cabeçalho, onde linhas da tabela
 * vazavam por cima do eixo de datas. A nav agora É sticky (`src/app/
 * layout.tsx`) — nunca sai de cena — e a altura real dela é MEDIDA em
 * runtime (`navAltura`, `getBoundingClientRect`); este é só o valor antes da
 * 1ª medição (SSR / sem nav encontrada no DOM).
 */
const NAV_ALTURA_FALLBACK = 0;
/** Respiro entre a nav sticky e o topo do painel de detalhe quando ele é COLUNA (≥768px). */
const MARGEM_PAINEL_STICKY_PX = 8;

function ehZoomValido(v: unknown): v is Zoom {
  return v === "auto" || v === "semana" || v === "mes" || v === "trimestre";
}

function lerZoomSalvo(): Zoom | null {
  try {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(CHAVE_ZOOM);
    return ehZoomValido(v) ? v : null;
  } catch {
    return null; // modo privado / storage bloqueado — segue sem persistir
  }
}

function salvarZoom(zoom: Zoom): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAVE_ZOOM, zoom);
  } catch {
    // idem — falha ao salvar nunca quebra a tela
  }
}

// ─── datas ───────────────────────────────────────────────────────────────────

function paraEpoch(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00.000Z`);
  return Number.isFinite(t) ? t : Date.now();
}
function diffDias(a: string, b: string): number {
  return Math.round((paraEpoch(b) - paraEpoch(a)) / MS_POR_DIA);
}
function somaDiasIso(iso: string, dias: number): string {
  return new Date(paraEpoch(iso) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}
function diaMesCurto(iso: string): string {
  const d = new Date(paraEpoch(iso));
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/**
 * P5f (achado MÉDIO A4, rodada 5): TODO tooltip/`aria-label` de barra, ponto,
 * conector e painel de detalhe usa `dd/MM/aaaa`. `dd/MM` sozinho num quadro
 * que mostra 400 dias (e um histórico de PRs que cruza a virada do ano) não
 * identifica a data — "13/09" pode ser de dois anos diferentes na MESMA tela.
 * O `dd/MM` curto sobrevive só nos RÓTULOS DO EIXO, onde o espaço é físico e
 * a faixa de mês/ano do cabeçalho dá o contexto que falta.
 */
function diaMesAnoCurto(iso: string): string {
  return `${diaMesCurto(iso)}/${new Date(paraEpoch(iso)).getUTCFullYear()}`;
}
// P5e (rodada 4): `mesCurto`/`MESES_PT` saíram daqui — só serviam ao antigo
// `gerarEscala` local, agora substituído por `gerarEscalaEixo` (`core/timeline/
// eixo-rotulos.ts`, que já formata os rótulos de mês por conta própria).

// ─── linha "achatada" (cabeçalho de grupo + linhas), para o 1:1 rótulo↔barra ──

interface LinhaExibicaoCabecalho {
  tipo: "cabecalho";
  chave: string;
  titulo: string;
}
interface LinhaExibicaoDado {
  tipo: "linha";
  chave: string;
  linha: LinhaDoTempoRow;
}
type LinhaExibicao = LinhaExibicaoCabecalho | LinhaExibicaoDado;

/**
 * P5b (achado ALTO #9): "fechado sem merge" usava o MESMO vermelho da barra
 * crítica e do `state-error` — na tela os dois liam-se como o mesmo conceito
 * ("isto é grave"), quando um é "descartado" (neutro) e o outro é "risco de
 * prazo" (crítico). Cinza + traço (`riscado`, aplicado no render) — nunca o
 * vermelho.
 */
function corDoAssunto(row: LinhaDoTempoAssuntoRow): {
  barra: string;
  texto: string;
  riscado: boolean;
  /**
   * P5g (achado ALTO A3, rodada 6): cor do "▶" desenhado DENTRO da barra
   * cortada pelo fim da janela. Escuro sobre os preenchimentos claros
   * (`state-done`/`state-open`: ≥ 9,7:1 a 100%, e a barra só perde 10% de
   * opacidade); claro sobre o cinza de "fechado sem merge", cujo pixel já
   * composto (#626E8B) mede 3,95:1 contra o escuro e 5,09:1 contra o branco.
   * Os dois pares estão em `scripts/checar-contraste.mjs`.
   */
  chevron: string;
} {
  if (row.estado === "mergeado")
    return { barra: "bg-state-done", texto: "text-state-done", riscado: false, chevron: "text-navy-950" };
  if (row.estado === "fechado")
    return { barra: "bg-bone-500", texto: "text-bone-400", riscado: true, chevron: "text-bone-50" };
  return { barra: "bg-state-open", texto: "text-state-open", riscado: false, chevron: "text-navy-950" }; // aberto
}

export function LinhaDoTempoView(props: LinhaDoTempoProps): JSX.Element {
  // "auto" é o default quando nada foi salvo (achado CRÍTICO #3) — persiste a
  // escolha do operador do jeito que já era feito para os zooms fixos.
  const [zoom, setZoom] = useState<Zoom>(() => lerZoomSalvo() ?? "auto");
  /**
   * Rodada 7 (achado MÉDIO #7): o painel de detalhe deixou de ser exclusivo
   * das TAREFAS — a metade das linhas da tela são ASSUNTOS (PRs), cujo nome a
   * 390px trunca em `line-clamp-2` e cujo único caminho para o texto inteiro
   * era o `title` (inexistente no toque) ou sair para o GitHub. Como assunto e
   * tarefa podem repetir id, o que fica ativo é a CHAVE da linha
   * (`${kind}-${id}`), a mesma que o `map` já usa — nunca o id cru.
   */
  const [ativaChave, setAtivaChave] = useState<string | null>(null);
  /**
   * Rodada 7: abrir ou fechar o detalhe MUDA A ALTURA da página — o gráfico
   * fica mais estreito e o aviso "a janela é maior que a tela" nasce (medido a
   * 1024px: a página cresceu 40px). O que não pode mudar é onde a LINHA QUE O
   * OPERADOR TOCOU está na tela — a âncora certa é ela, não o `scrollY` cru
   * (repor o `scrollY` brigaria com o "scroll anchoring" do navegador e faria
   * o conteúdo pular 40px, que é o defeito ao contrário). Guardado no CLIQUE,
   * reposto depois do layout E de novo quando o `ResizeObserver` assenta a
   * largura nova; a validade curta impede que um resize de janela, muito
   * depois, ressuscite uma âncora velha.
   */
  const ancoraDaLinhaRef = useRef<{ chave: string; topAntes: number; expiraEm: number } | null>(null);
  const alternarAtiva = (chave: string): void => {
    const botao = botoesLinhaRef.current.get(chave);
    ancoraDaLinhaRef.current =
      botao && typeof window !== "undefined"
        ? { chave, topAntes: botao.getBoundingClientRect().top, expiraEm: Date.now() + 1500 }
        : null;
    setAtivaChave((a) => (a === chave ? null : chave));
  };
  const painelRef = useRef<HTMLDivElement | null>(null);
  const [larguraPainel, setLarguraPainel] = useState(0);
  /**
   * P5e (achado BAIXO #9 do crítico hostil, rodada 4): nenhuma pista de que
   * o painel tem mais conteúdo além da borda (390/Semana: 3542px de
   * conteúdo, ~250px visíveis, zero afordância). `esquerda`/`direita` dizem
   * se HÁ de fato mais para rolar em cada direção — nunca um degradê
   * decorativo fixo que mentiria num painel que já mostra tudo.
   */
  const [afordanciaScroll, setAfordanciaScroll] = useState<{ esquerda: boolean; direita: boolean }>({
    esquerda: false,
    direita: false,
  });
  /**
   * P5c (achado ALTO #2 do crítico hostil, rodada 2): o cabeçalho de datas
   * vivia DENTRO do painel `overflow-x-auto` — `overflow-x` diferente de
   * `visible` força o `overflow-y` computado a `auto` também (regra do CSS
   * Overflow), então o painel vira um "scroll container" e o `position:
   * sticky` do cabeçalho passa a stickar relativo A ELE, não à página. Como
   * quem rola de verdade é a PÁGINA (o painel não tem altura própria), o
   * cabeçalho ia para `top: −134` ao rolar e, em repouso, ficava 44px
   * deslocado (cobrindo a linha "ASSUNTOS"). Fix: o cabeçalho agora é um
   * elemento PRÓPRIO, fora do scroller horizontal — sticky de verdade contra
   * a página — sincronizado por `transform` a partir do `scrollLeft` do
   * painel (sem re-render por pixel: manipulação direta do DOM via ref).
   */
  const headerTicksRef = useRef<HTMLDivElement | null>(null);
  /**
   * P5f (achados MÉDIO A3 / BAIXO A12, rodada 5): o `scrollLeft` deixou de
   * ser só um `transform` no DOM — o cabeçalho agora PRECISA saber onde a
   * viewport está para (1) grudar o mês corrente na borda esquerda e (2) não
   * desenhar rótulo cortado pela borda. Segue havendo o `transform` direto
   * por ref (sem re-render por pixel na faixa inteira); este estado muda no
   * mesmo evento e re-renderiza só o que depende da posição.
   */
  const [scrollLeft, setScrollLeft] = useState(0);
  /**
   * P5g (achado ALTO A1, rodada 6): o cabeçalho SÓ se sincroniza com o
   * `scrollLeft` que o navegador de fato assumiu — nunca com o destino
   * calculado. Era exatamente essa a causa dos 329,6px de desalinho depois de
   * um resize: `irParaHoje()` escrevia um destino impossível, o navegador
   * clampava, o evento `scroll` não disparava (o valor já era aquele) e o
   * cabeçalho ficava adiantado das barras, sem "Hoje" nem a tecla H
   * conseguirem consertar (as duas repetiam o mesmo destino impossível).
   * Este é o ÚNICO caminho de sincronização da tela.
   */
  /**
   * Rodada 7 (achado ALTO #1): o componente virou CASCA. Ele não escreve mais
   * em `.scrollLeft` nem calcula o `translateX` — as duas coisas vivem em
   * `core/timeline/sincronizacao-painel.ts` (puro, elemento injetado, testado
   * com um elemento falso que CLAMPA como o navegador). Aqui só resta aplicar
   * ao DOM o que o módulo devolveu. A varredura de fonte
   * (`tests/unit/linha-do-tempo-sincronizacao.test.ts`) falha se alguém
   * reintroduzir uma atribuição direta a `.scrollLeft` neste arquivo.
   */
  const aplicarSincronizacao = (s: {
    scrollLeftAplicado: number;
    transformDoCabecalho: number;
    afordancia: { esquerda: boolean; direita: boolean };
  }): void => {
    aplicarTransformDoCabecalho(headerTicksRef.current, s);
    setScrollLeft(s.scrollLeftAplicado);
    setAfordanciaScroll(s.afordancia);
  };
  /** O painel mexeu sozinho (evento `scroll`, ou resize): relê e sincroniza. */
  const sincronizarComPainel = (el: HTMLDivElement): void => {
    aplicarSincronizacao(aoRedimensionar(el));
  };
  /** Vai para `destino` e sincroniza pelo valor que o navegador REALMENTE assumiu. */
  const rolarPara = (el: HTMLDivElement, destino: number): void => {
    aplicarSincronizacao(rolarESincronizar(el, destino));
  };

  /**
   * P5d (achado ALTO #1, rodada 3): a nav do shell (`src/app/layout.tsx`)
   * agora é `sticky top-0` — nunca sai de cena. O offset do cabeçalho da
   * escala precisa ser a altura REAL dela (não um número fixo suposto): mede
   * via `getBoundingClientRect` no mount e observa resize (a nav pode crescer
   * — telas muito estreitas quebram os links de linha). Fallback 0 antes da
   * 1ª medição (SSR, ou nav não encontrada).
   */
  const [navAltura, setNavAltura] = useState<number>(NAV_ALTURA_FALLBACK);
  /**
   * Rodada 7 (achado BAIXO #10): a 390×844 o crítico mediu 494px de cabeçalho
   * antes da primeira linha — título, parágrafo, 4 botões, "Hoje", 2 avisos e
   * uma legenda de 13 itens que sozinha ocupava várias linhas. A legenda vira
   * um `<details>` FECHADO por padrão; a partir de 768px ele abre sozinho (o
   * 1º render é sempre fechado, e o efeito abre depois do mount — nunca um
   * `open` decidido no servidor, que daria hidratação divergente).
   *
   * Rodada 9 (achado BAIXO A5) — o NÚMERO da rodada 8 estava errado, e o
   * número certo importa porque é ele que diz se a 1ª linha aparece sem rolar.
   * A rodada 8 declarou "494 → 293px"; 293px é o topo do CABEÇALHO DA ESCALA,
   * não o da primeira linha. A primeira LINHA nasce em **393px**:
   * `topo do h1 = 65` + `details = 225` + `cabeçalho da escala = 293 + 58` +
   * `grupo ASSUNTOS = 42`. A conclusão continua a mesma (393 < 844: a 1ª linha
   * aparece sem rolar, a 390×844); o número declarado é que era 3,4× otimista
   * sobre a economia.
   */
  const [legendaAberta, setLegendaAberta] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(min-width: 768px)");
    const aplicar = (): void => setLegendaAberta(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  /**
   * "Voltar para hoje" (botão + tecla `H`) precisa da versão ATUAL da função
   * (que depende de `xHoje`/`pxPorDia`/largura do painel) dentro de um
   * listener registrado UMA vez no mount — o ref é o que impede o listener de
   * congelar a versão do primeiro render.
   */
  const irParaHojeRef = useRef<() => void>(() => {});
  /**
   * P5g (achado ALTO A2, rodada 6): o painel de detalhe virou um diálogo
   * `position: fixed` — e um diálogo que abre sem levar o foco, e fecha sem
   * devolvê-lo, some para quem navega por teclado. Este mapa guarda o BOTÃO
   * de cada linha (o mesmo que abre o painel, por clique ou por Enter) para
   * que `Escape`/"fechar" devolvam o foco exatamente de onde ele saiu.
   */
  const botoesLinhaRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  /**
   * Rodada 9 (achado ALTO A1): o espaço reservado abaixo da última linha
   * enquanto a folha inferior está aberta. Altura manipulada direto no DOM
   * (sem re-render por pixel, mesma disciplina do `transform` do cabeçalho) e
   * decidida pela função pura — nunca um `pb-` fixo que mentiria sobre a
   * altura real da folha.
   */
  const espacoFolhaRef = useRef<HTMLDivElement | null>(null);
  const registrarBotaoLinha = (id: string, el: HTMLButtonElement | null): void => {
    if (el) botoesLinhaRef.current.set(id, el);
    else botoesLinhaRef.current.delete(id);
  };
  /**
   * Fecha o painel e devolve o foco — nunca deixa o foco cair no `<body>`.
   *
   * P5h (achado BAIXO 8, rodada 10): `preventScroll`. Medido na rota real: o
   * operador abria a gaveta em `scrollY = 538`, rolava até 0 para ver o topo
   * do quadro, fechava — e a página voltava sozinha para 538. A culpa não era
   * da reserva nem da âncora: era este `.focus()`. O navegador traz à vista
   * todo elemento que recebe foco, e o botão de origem estava 538px abaixo.
   * A devolução de foco está certa (é o que o leitor de tela precisa); o
   * efeito colateral de arrastar a página junto é que não. `preventScroll`
   * separa as duas coisas — o foco vai, a página fica.
   */
  const fecharDetalhe = (): void => {
    const chave = ativaChave;
    setAtivaChave(null);
    if (chave) botoesLinhaRef.current.get(chave)?.focus({ preventScroll: true });
  };
  const fecharDetalheRef = useRef<() => void>(() => {});
  fecharDetalheRef.current = fecharDetalhe;
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Navegação principal"]');
    if (!nav) return undefined;
    const medir = (): void => setNavAltura(nav.getBoundingClientRect().height);
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const obs = new ResizeObserver(medir);
    obs.observe(nav);
    return () => obs.disconnect();
  }, []);

  // Achado BAIXO #8: `Escape` limpa a seleção — sem isto, a única forma de
  // desmarcar uma linha ativa era clicar nela de novo (nada no teclado).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === "Escape") fecharDetalheRef.current();
      // Achado BAIXO A12 (rodada 5): "voltar para hoje" pelo teclado, em
      // qualquer lugar da página — menos dentro de um campo de texto, onde
      // "h" é uma letra que o operador está digitando, nunca um atalho.
      const alvo = e.target as HTMLElement | null;
      const editando =
        alvo instanceof HTMLInputElement ||
        alvo instanceof HTMLTextAreaElement ||
        alvo instanceof HTMLSelectElement ||
        alvo?.isContentEditable === true;
      if (!editando && (e.key === "h" || e.key === "H") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        irParaHojeRef.current();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const mudarZoom = (z: Zoom): void => {
    setZoom(z);
    salvarZoom(z);
  };

  const linhas: LinhaExibicao[] = useMemo(() => {
    const out: LinhaExibicao[] = [];
    for (const grupo of props.grupos) {
      out.push({ tipo: "cabecalho", chave: `cab-${grupo.titulo}`, titulo: grupo.titulo });
      for (const linha of grupo.linhas) {
        out.push({ tipo: "linha", chave: `${linha.kind}-${linha.id}`, linha });
      }
    }
    return out;
  }, [props.grupos]);

  const linhaAtivaQualquer = useMemo(
    () =>
      linhas.find(
        (l): l is LinhaExibicaoDado => l.tipo === "linha" && l.chave === ativaChave,
      )?.linha ?? null,
    [linhas, ativaChave],
  );
  const temLinhas = linhas.some((l) => l.tipo === "linha");
  const detalheAberto = linhaAtivaQualquer !== null;
  const linhaAtiva =
    linhaAtivaQualquer && linhaAtivaQualquer.kind === "tarefa" ? linhaAtivaQualquer : null;
  const assuntoAtivo =
    linhaAtivaQualquer && linhaAtivaQualquer.kind === "assunto" ? linhaAtivaQualquer : null;
  const predecessorasAtivas = new Set(linhaAtiva?.predecessores ?? []);
  const sucessorasAtivas = new Set(linhaAtiva?.sucessores ?? []);

  // Janela dos ZOOMS FIXOS — o histórico inteiro (assuntos + tarefas), como
  // sempre foi: quem pede "Trimestre" quer ver os 59 dias de PRs também.
  const { minIso: minIsoDados, maxIso: maxIsoDados } = useMemo(() => {
    const datas: string[] = [props.hoje];
    for (const l of linhas) {
      if (l.tipo !== "linha") continue;
      datas.push(l.linha.inicio, l.linha.fim);
      if (l.linha.kind === "tarefa") datas.push(l.linha.fimComFolga);
    }
    let min = datas[0] ?? props.hoje;
    let max = datas[0] ?? props.hoje;
    for (const d of datas) {
      if (paraEpoch(d) < paraEpoch(min)) min = d;
      if (paraEpoch(d) > paraEpoch(max)) max = d;
    }
    return { minIso: somaDiasIso(min, -2), maxIso: somaDiasIso(max, 3) };
  }, [linhas, props.hoje]);

  // Janela do zoom "AUTO" (achado CRÍTICO #3) — só o horizonte das TAREFAS QUE
  // DESENHAM BARRA (nunca o histórico de assuntos, que é o que esmagava a
  // escala antes): min(hoje − 7d, início mais cedo de tarefa) → max(LF de
  // tarefas, hoje + 14d). Achado ALTO #4 (rodada 2): linhas `semBarra` (um
  // `done` fora do CPM que só desenha um PONTO, às vezes muito no passado —
  // o "ponto 07/07" do crítico) NUNCA entram nesta conta — elas não desenham
  // barra nenhuma, e deixá-las inflar a janela é o que esmagava `pxPorDia`
  // exatamente do jeito que "auto" existe para evitar. A mesma margem de
  // respiro dos zooms fixos (`minIsoDados`/`maxIsoDados`, −2/+3 dias) fecha o
  // achado MÉDIO #8 (ponto de conclusão colado no `left:-4` da borda).
  const { minIso: minIsoAuto, maxIso: maxIsoAuto } = useMemo(() => {
    let minInicio = props.hoje;
    let maxLf = props.hoje;
    for (const l of linhas) {
      if (l.tipo !== "linha" || l.linha.kind !== "tarefa" || l.linha.semBarra) continue;
      if (paraEpoch(l.linha.inicio) < paraEpoch(minInicio)) minInicio = l.linha.inicio;
      if (paraEpoch(l.linha.fimComFolga) > paraEpoch(maxLf)) maxLf = l.linha.fimComFolga;
    }
    const pisoPassado = somaDiasIso(props.hoje, -AUTO_MARGEM_PASSADO_DIAS);
    const pisoFuturo = somaDiasIso(props.hoje, AUTO_MARGEM_FUTURO_DIAS);
    const minBruto = paraEpoch(minInicio) < paraEpoch(pisoPassado) ? minInicio : pisoPassado;
    const maxBruto = paraEpoch(maxLf) > paraEpoch(pisoFuturo) ? maxLf : pisoFuturo;
    return {
      minIso: somaDiasIso(minBruto, -AUTO_MARGEM_RESPIRO_PASSADO_DIAS),
      maxIso: somaDiasIso(maxBruto, AUTO_MARGEM_RESPIRO_FUTURO_DIAS),
    };
  }, [linhas, props.hoje]);

  const minIso = zoom === "auto" ? minIsoAuto : minIsoDados;
  const maxIso = zoom === "auto" ? maxIsoAuto : maxIsoDados;

  // P5c (achado ALTO #4, rodada 2): 24px/dia é o ALVO, não o piso — quando o
  // horizonte não cabe no painel a essa densidade, "auto" ENCOLHE (nunca
  // abaixo de `PX_POR_DIA_AUTO_PISO`) em vez de forçar overflow horizontal
  // fingindo que ainda é "auto". P5e (achado BAIXO #6, rodada 4): o inverso
  // também vale — um horizonte ESTREITO não fica preso no alvo de 24 quando
  // sobra painel; cresce até `PX_POR_DIA_AUTO_TETO` para preencher de verdade
  // (antes: `totalW 624` num painel de até 1280px, 36% desperdiçado).
  /**
   * Rodada 11 (achado MÉDIO 5): ABRIR A GAVETA NÃO RE-ESCALA O EIXO.
   *
   * A partir de 768px a gaveta é uma COLUNA (decisão D2 da rodada 7) e
   * comprime o gráfico. Como "auto" derivava `px/dia` da largura VISÍVEL, um
   * clique numa linha para inspecioná-la mudava a escala inteira — medido:
   *
   * | janela | canvas fechado → aberto | encolhe | o "hoje" anda | a barra clicada |
   * |---|---|---|---|---|
   * | 768×900 | 480 → 328 px | 32% | 430 → 278 | 55 → 38 px |
   * | 1024×768 | 736 → 424 px | 42% | 519 → 411 | 85 → 49 px |
   * | 1280×900 | 992 → 680 px | 31% | 607 → 499 | 114 → 78 px |
   * | 1440×900 | 1112 → 800 px | 28% | 669 → 561 | 128 → 92 px |
   *
   * Toda barra mudava de tamanho e de lugar no instante da inspeção —
   * inclusive a que o operador estava olhando. A referência (Asana) estreita
   * a área visível e o Gantt ROLA, mantendo a escala. É o que se faz aqui: a
   * largura que alimenta o "auto" é congelada enquanto a gaveta estiver
   * aberta, e volta a seguir o painel quando ela fecha.
   */
  const [larguraEscalaCongelada, setLarguraEscalaCongelada] = useState(0);
  const larguraParaEscala =
    detalheAberto && larguraEscalaCongelada > 0 ? larguraEscalaCongelada : larguraPainel;
  const pxPorDiaAuto = useMemo(() => {
    const totalDiasAuto = Math.max(1, diffDias(minIsoAuto, maxIsoAuto));
    if (larguraParaEscala <= 0) return PX_POR_DIA_AUTO_FALLBACK;
    const ideal = larguraParaEscala / totalDiasAuto;
    return Math.min(PX_POR_DIA_AUTO_TETO, Math.max(PX_POR_DIA_AUTO_PISO, ideal));
  }, [minIsoAuto, maxIsoAuto, larguraParaEscala]);

  const pxPorDia = zoom === "auto" ? pxPorDiaAuto : PX_POR_DIA_FIXO[zoom];
  // P5e (achado ALTO, rodada 4 — causa raiz "o eixo tem dono demais"): ÚNICA
  // função de posicionamento dos rótulos do eixo (`core/timeline/eixo-
  // rotulos.ts`, pura, testada isoladamente). `rotulos` já vem com "hoje" e a
  // borda `x=0` inclusos e desconflitados — a VIEW só desenha o que ela
  // devolve, nunca decide sozinha se cabe mais um rótulo.
  const { guiasSemana, rotulosSuperiores, periodoSuperior, rotulos } = useMemo(
    () => gerarEscalaEixo({ minIso, maxIso, pxPorDia, hojeIso: props.hoje }),
    [minIso, maxIso, pxPorDia, props.hoje],
  );
  /**
   * P5f (achado MÉDIO A3, rodada 5): em "Semana" (46px/dia) o mês SUMIA da
   * tela ao rolar — a faixa de mês rola junto com o conteúdo, e o rótulo de
   * "set/2026" fica centenas de px atrás da viewport. Este é o mês da posição
   * ATUAL do scroll, desenhado FORA do conteúdo transladado: gruda na borda
   * esquerda do cabeçalho e nunca sai. Sempre com ano (é o único rótulo que
   * ancora a tela inteira — ano errado ali é pior que ano repetido).
   */
  /**
   * O rótulo GRUDADO na borda esquerda da faixa de cima — o período (mês, ou
   * trimestre/ano quando o mês não cabe) da posição ATUAL do scroll. Rodada 7
   * (decisão D4): ele vive na faixa de cima em TODA densidade, porque a faixa
   * de cima agora existe em toda densidade. É a única pista de período que
   * nunca sai da tela por mais que se role.
   */
  const faixaDeCima = faixaSuperiorDaTela({
    rotulosSuperiores,
    minIso,
    pxPorDia,
    periodo: periodoSuperior,
    janela: { scrollLeft, larguraVisivel: larguraPainel },
  });
  const mesGrudado = faixaDeCima.chip.label;
  const larguraMesGrudado = faixaDeCima.chip.largura;
  const alturaHeaderTotal = HEADER_H + HEADER_MES_H;
  /**
   * Rodada 7 (decisão D3): a MESMA lei nos dois lados da janela. A rodada 6
   * guardava só a borda esquerda (`if (t.x < scrollLeft) return null`) e o
   * crítico mediu 28 de 60 combos com rótulo cortado ao meio pela DIREITA
   * ("nov/2026" com 1px visível; com o scroll no máximo o cortado era sempre
   * o ÚLTIMO rótulo do eixo — a data em que a meta termina). `rotulosNaJanela`
   * é puro e testado; a VIEW só desenha o que ele devolve.
   */
  /**
   * Rodada 7 (decisão D2): com o painel COMPRIMINDO a tela, a coluna de
   * rótulos de 240px + os 240 do painel deixavam só ~170px de gráfico a 768px.
   * Enquanto o detalhe está aberto, a coluna volta aos 140px até `lg` — o nome
   * inteiro está no painel ao lado de qualquer jeito, que é o ponto dele.
   */
  const classeColunaRotulos = detalheAberto
    ? "w-[140px] shrink-0 lg:w-[240px]"
    : "w-[140px] shrink-0 sm:w-[240px]";
  const janelaCabecalho = { scrollLeft, larguraVisivel: larguraPainel };
  const rotulosVisiveis = rotulosNaJanela(rotulos, janelaCabecalho);
  /**
   * Rodada 9 (achado MÉDIO A2): a faixa de cima NÃO é mais filtrada pelo
   * espaço do chip grudado. Era `margemEsquerda: larguraMesGrudado` — e o
   * efeito medido era que TODO rótulo de mês caindo atrás do chip sumia: 320
   * de 730 posições de scroll (43,8%) tinham um mês começando dentro da
   * janela sem nenhum cabeçalho, e em 48 delas o portador de ano mais próximo
   * declarava ano diferente do real. Caso canônico (1280px, Mês, 400 d,
   * `scrollLeft` 3333): a régua lia `dez/2026 … 04/01 11/01 18/01 25/01 …
   * fev/2027`, com janeiro de 2027 inteiro sem cabeçalho. Agora o mês que
   * entra EMPURRA o chip (`posicaoDoChipGrudado`), como faz a referência —
   * nenhum rótulo é escondido por causa dele.
   */
  const superioresVisiveis = faixaDeCima.rotulos;
  const chipGrudado = faixaDeCima.chip;
  /**
   * P5g (achado ALTO A3, rodada 6): o teto de dias (`TETO_DIAS_ESCALA`)
   * cortava a janela EM SILÊNCIO. A escala desenhava `min(teto, diff)` dias,
   * mas a tela perguntava "está depois da janela?" comparando com `maxIso` —
   * então uma barra de 400 dias terminava no último pixel do eixo, com ponta
   * arredondada, escondendo 50 dias de duração sem nenhum sinal. `fimDesenhado`
   * é agora a ÚNICA fonte do fim: o clamp de `xFor`, o chevron "▶", o `title`
   * e a contagem de itens fora da janela olham TODOS para ele.
   */
  const fimDesenhado = calcularFimDesenhadoIso(minIso, maxIso);
  const totalWidth = diasDesenhados(minIso, maxIso) * pxPorDia;
  /**
   * P5g (achado BAIXO A6, rodada 6): nada pode nascer DEPOIS do fim do eixo —
   * senão o painel ganha faixa de rolagem sem eixo nenhum. Duas fontes além
   * do badge lateral: a guia de segunda-feira que cai exatamente no último dia
   * desenhado (borda de 1px a `left: totalWidth`) e a linha de "hoje" quando
   * "hoje" fica além do fim (o chip já vem clampado por `gerarEscalaEixo` — a
   * linha precisa do MESMO clamp, ou as duas se separam, que é o achado A2).
   */
  const guiasDentroDoEixo = guiasSemana.filter((x) => x < totalWidth);
  const alturaLinhas = linhas.length * ROW_H;
  const xHoje = Math.min(Math.max(0, diffDias(minIso, props.hoje) * pxPorDia), totalWidth);
  /**
   * P5g (achado MÉDIO A4, rodada 6): "Auto" batia no piso de 6px/dia e virava
   * 11,3× de rolagem a 390px SEM DIZER — o chip continuava escrito só "Auto",
   * como se a escala tivesse se ajustado à tela. Quando o piso é atingido e o
   * conteúdo ainda não cabe, o chip nomeia o custo e o aviso diz o caminho
   * (setas ou Trimestre). `fatorDeOverflow` é pura e testada; o nome ACESSÍVEL
   * do botão continua "Auto" (o texto extra é visual — quem usa leitor de tela
   * recebe a mesma informação pelo aviso `role="note"` abaixo).
   */
  const autoNoPiso = zoom === "auto" && pxPorDiaAuto <= PX_POR_DIA_AUTO_PISO;
  const fatorOverflow = fatorDeOverflow(totalWidth, larguraPainel);
  const autoNaoCabe = autoNoPiso && larguraPainel > 0 && totalWidth > larguraPainel;
  const telasDeRolagem = formatarFator(fatorOverflow);

  // Achado BAIXO #14 (rodada 2): `TETO_DIAS_ESCALA` capa os TICKS mas antes
  // não capava as BARRAS — uma data real além do teto (raríssima, mas
  // possível com dado podre/distante) calculava um `x` além de `totalWidth`,
  // desenhando fora do SVG/contêiner enquanto a régua de ticks parava antes.
  // Clampar aqui cobre TODOS os consumidores (barras, conectores, marcador de
  // hoje, marcador de prazo) num único ponto.
  const xFor = (iso: string): number => {
    const bruto = diffDias(minIso, iso) * pxPorDia;
    return Math.min(Math.max(bruto, 0), totalWidth);
  };
  /**
   * P5d (achados ALTO #2/#7, rodada 3): antes, uma data que caía ANTES da
   * janela vigente (o horizonte do "auto", ou o teto raro dos zooms fixos)
   * era silenciosamente grudada em `x=0` pelo clamp de `xFor` acima — um
   * assunto de meses atrás virava um coto de 4px sem nenhum aviso, ou um
   * ponto de conclusão nascia "cortado" em `left:-4`. `foraDaJanela` é o
   * sinal que os componentes de barra usam para desenhar um chevron "◀ fora
   * da janela" (com as datas reais no `title`) em vez de fingir uma posição.
   */
  const foraDaJanela = (iso: string): boolean => paraEpoch(iso) < paraEpoch(minIso);
  /**
   * P5f (achado MÉDIO A5, rodada 5): o clamp da DIREITA era mudo. `xFor`
   * gruda qualquer data depois de `maxIso` na borda direita — uma barra que
   * continua além da janela terminava exatamente como uma que termina ali,
   * e um conector com a ponta lá fora nascia com cara de data conhecida. O
   * lado direito passa a ter o mesmo tratamento do esquerdo: chevron "▶",
   * data real no `title`, conector `indefinido`.
   */
  const depoisDaJanela = (iso: string): boolean => depoisDoFimDesenhado(iso, fimDesenhado);
  /**
   * P5d (achado BAIXO #11, rodada 3): a caixa de aviso ("datas inconsistentes",
   * "data inválida") não tinha limite de largura — a 390px ela encostava na
   * borda e cortava o texto. `undefined` antes da 1ª medição real do painel
   * (SSR / sem `ResizeObserver`) — sem `maxWidth`, mas nunca lança.
   */
  const larguraErroMax = larguraPainel > 0 ? Math.max(80, larguraPainel - 8) : undefined;

  // Mede a largura real do painel (para o "auto") e mantém a linha de "hoje"
  // ancorada a ~40% da largura visível — no mount, a cada mudança de escala
  // E a cada resize (achados CRÍTICO #1 e #2). `ResizeObserver` cobre os três
  // gatilhos de uma vez: dispara já na 1ª medição (mount) e de novo sempre que
  // o painel muda de tamanho (resize da janela incluso).
  useEffect(() => {
    const el = painelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const obs = new ResizeObserver((entradas) => {
      const largura = entradas[0]?.contentRect.width;
      if (typeof largura === "number") setLarguraPainel(largura);
      /**
       * P5g (achado ALTO A1, rodada 6): o cabeçalho re-sincroniza com o
       * `scrollLeft` REAL a cada mudança de tamanho do painel. É a rede que
       * pega o caso em que o navegador clampa o scroll sozinho por causa do
       * resize (o conteúdo passou a caber, ou o máximo diminuiu) e, por já
       * estar no valor novo, nunca dispara `scroll` — o cabeçalho ficava
       * parado no valor antigo, 329,6px adiantado das barras.
       */
      aplicarSincronizacao(aoRedimensionar(el));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /**
   * Rodada 11 (achado MÉDIO 5): a largura de referência do "auto" só é
   * atualizada enquanto NENHUMA gaveta está aberta. Assim o clique numa linha
   * nunca muda `px/dia` — o painel apenas fica mais estreito e rola.
   */
  useEffect(() => {
    if (!detalheAberto && larguraPainel > 0) setLarguraEscalaCongelada(larguraPainel);
  }, [detalheAberto, larguraPainel]);

  /**
   * P5d (achado BAIXO #9, rodada 3): x do fim (com folga) da tarefa do GOAL
   * — ou, na falta dela/sem bar, da última barra CRÍTICA — usado para
   * deslocar a âncora de "hoje" quando ela deixaria a meta fora do painel.
   */
  const linhaDoGoal = props.goalId
    ? (linhas.find(
        (l): l is LinhaExibicaoDado & { linha: LinhaDoTempoTarefaRow } =>
          l.tipo === "linha" && l.linha.kind === "tarefa" && l.linha.id === props.goalId,
      )?.linha ?? null)
    : null;
  const xFimAlvo = ((): number | null => {
    if (linhaDoGoal && !linhaDoGoal.semBarra) return xFor(linhaDoGoal.fimComFolga);
    let alvo: number | null = null;
    for (const l of linhas) {
      if (l.tipo !== "linha" || l.linha.kind !== "tarefa" || l.linha.semBarra || !l.linha.critico) continue;
      const x = xFor(l.linha.fimComFolga);
      if (alvo === null || x > alvo) alvo = x;
    }
    return alvo;
  })();

  /**
   * Onde o painel precisa estar para "hoje" ficar ancorado a ~40% da largura
   * visível (achados CRÍTICO #1/#2) — extraído do efeito porque agora tem
   * DOIS chamadores: o efeito (mount, zoom, resize) e o "voltar para hoje"
   * do operador (botão + tecla `H`, achado BAIXO A12 da rodada 5).
   */
  const scrollLeftDeHoje = (largura: number): number => {
    let novoScrollLeft = Math.max(0, xHoje - largura * ANCORA_HOJE_FRACAO);
    // Achado BAIXO #9 (rodada 3): a âncora de 40% ignorava onde a meta
    // termina — em telas estreitas + zoom denso ("Semana"), a barra do
    // objetivo nascia fora do painel, sem nenhuma pista de que existia mais
    // adiante. Desloca a âncora para caber o fim da meta quando ele CABE na
    // largura do painel junto de "hoje" (senão a prioridade continua sendo
    // manter "hoje" visível, como sempre foi — nunca escondê-lo pelo alvo).
    if (largura > 0 && xFimAlvo !== null && xFimAlvo - xHoje <= largura) {
      const MARGEM_ALVO_PX = 8;
      if (xFimAlvo > novoScrollLeft + largura - MARGEM_ALVO_PX) {
        novoScrollLeft = Math.min(xHoje, Math.max(0, xFimAlvo - largura + MARGEM_ALVO_PX));
      }
    }
    return novoScrollLeft;
  };

  const irParaHoje = (): void => {
    const el = painelRef.current;
    if (!el) return;
    // A régua de clamp é a mesma de Home/End/setas (`clampScroll`, pura e
    // testada); a sincronização lê `el.scrollLeft` DEPOIS da atribuição.
    rolarPara(el, scrollLeftDeHoje(el.clientWidth || larguraPainel));
  };
  irParaHojeRef.current = irParaHoje;

  useEffect(() => {
    irParaHoje();
    // Achado BAIXO #9 (rodada 4): a afordância de scroll é reavaliada junto
    // (dentro de `irParaHoje`) toda vez que o conteúdo muda de tamanho ou
    // posição por este efeito (zoom, resize, troca de janela).
    // `pxPorDia` muda em toda troca de zoom (inclusive "auto" recalculando)
    // — reancorar em "hoje" sempre que a escala muda é o que resolve o
    // "Semana" esvaziando a tela (achado CRÍTICO #2: a âncora era perdida).
  }, [xHoje, pxPorDia, larguraPainel, xFimAlvo, totalWidth]);

  /**
   * Rodada 7 (decisão D2): com o painel de detalhe COMPRIMINDO o gráfico a
   * partir de 768px, a largura visível encolhe — e a barra da linha que o
   * operador acabou de selecionar pode ficar do lado de fora (era exatamente o
   * que o crítico mediu a 768px, com a barra INTEGRALMENTE atrás do painel).
   * Este efeito roda DEPOIS do de "voltar para hoje" (ordem de declaração é a
   * ordem de execução no mesmo commit) e só mexe quando a barra não está
   * inteira na janela: `scrollParaRevelar` é puro e devolve o próprio
   * `scrollLeft` quando já dá para ver.
   */
  const faixaXDaAtiva = ((): { inicio: number; fim: number } | null => {
    if (assuntoAtivo) {
      if (assuntoAtivo.dataInvalida || assuntoAtivo.datasInconsistentes) return null;
      return { inicio: xFor(assuntoAtivo.inicio), fim: xFor(assuntoAtivo.fim) };
    }
    if (!linhaAtiva || linhaAtiva.datasInconsistentes) return null;
    if (linhaAtiva.semBarra) {
      if (!linhaAtiva.pontoConcluidoEm) return null;
      const x = xFor(linhaAtiva.pontoConcluidoEm);
      return { inicio: x, fim: x };
    }
    return { inicio: xFor(linhaAtiva.inicio), fim: xFor(linhaAtiva.fimComFolga) };
  })();
  const inicioAtiva = faixaXDaAtiva?.inicio ?? null;
  const fimAtiva = faixaXDaAtiva?.fim ?? null;
  useEffect(() => {
    const el = painelRef.current;
    if (!el || inicioAtiva === null || fimAtiva === null) return;
    const largura = el.clientWidth || larguraPainel;
    const destino = scrollParaRevelar({
      inicio: inicioAtiva,
      fim: fimAtiva,
      scrollLeftAtual: el.scrollLeft,
      larguraVisivel: largura,
      margem: 12,
    });
    if (Math.abs(destino - el.scrollLeft) < 0.5) return;
    rolarPara(el, destino);
  }, [ativaChave, inicioAtiva, fimAtiva, larguraPainel, pxPorDia, totalWidth]);

  /**
   * Rodada 7 (achado MÉDIO #5) + rodada 9 (achado ALTO A1): abaixo de 768px o
   * painel é uma FOLHA INFERIOR `fixed`, e tocar uma linha baixa abria a folha
   * EM CIMA dela. A rodada 8 pediu a rolagem e parou aí — e `window.scrollBy`
   * é um NO-OP SILENCIOSO quando a página já está no fim
   * (`scrollY === scrollHeight − innerHeight`), que é exatamente onde a ÚLTIMA
   * linha vive. Medido na rota real, fixture de 25 linhas: tapava em 9 de 9
   * casos (360/390/767 × as 3 últimas linhas), resíduo de 9 a 133px; a 390px a
   * barra da linha tocada ficava 100% coberta e o rótulo sumia inteiro.
   *
   * A correção é dar à página PARA ONDE rolar: enquanto a folha inferior está
   * aberta, o espaçador abaixo da última linha (`espacoFolhaRef`) recebe a
   * altura da folha. O plano inteiro (é folha inferior? quanto reservar?
   * quanto rolar?) vem de `planoDaFolhaInferior` — puro e testado com a
   * geometria do resultado, não com a chamada de rolagem.
   */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let id = 0;
    const aplicar = (podeRolar: boolean): void => {
      window.cancelAnimationFrame(id);
      id = window.requestAnimationFrame(() => {
        const ancora = ancoraDaLinhaRef.current;
        // A linha tocada é a ATIVA — não a âncora, que expira em 1,5s. Sem
        // isto, um `resize` posterior (girar o telefone, o teclado virtual
        // abrindo) não tinha mais de quem medir, e a folha voltava a tapar.
        const botaoAtivo = ativaChave ? botoesLinhaRef.current.get(ativaChave) ?? null : null;
        const botaoAncora = ancora ? botoesLinhaRef.current.get(ancora.chave) ?? null : null;
        const folha = ativaChave ? document.querySelector<HTMLElement>("[data-lb-detalhe]") : null;
        const rf = folha ? folha.getBoundingClientRect() : null;
        const rb = botaoAtivo ? botaoAtivo.getBoundingClientRect() : null;
        const espacador = espacoFolhaRef.current;
        const plano = planoDaFolhaInferior({
          folha: rf
            ? { top: rf.top, left: rf.left, width: rf.width, height: rf.height, bottom: rf.bottom }
            : null,
          bottomDoBotao: rb ? rb.bottom : null,
          topoDoBotao: rb ? rb.top : null,
          larguraJanela: window.innerWidth,
          alturaJanela: window.innerHeight,
          scrollY: window.scrollY,
          alturaDoDocumento: document.documentElement.scrollHeight,
          espacoAtual: espacador ? espacador.getBoundingClientRect().height : 0,
          // A âncora do clique é quem repõe a linha ao abrir/fechar; só
          // quando ela já expirou (um `resize` de verdade) é que a reposição
          // passa a ser tarefa do plano.
          manterLinhaVisivel:
            podeRolar && !(ancora !== null && Date.now() < ancora.expiraEm),
        });
        // A ORDEM é a correção: teto de altura → reserva → rolagem. Folha
        // fechada ou folha-COLUNA (≥768px) não ganham teto nem rolagem, só a
        // âncora de fechamento — é ela que segura o `ΔscrollY = 0`. Quem
        // ESCREVE é o módulo puro, com os elementos injetados.
        aplicarPlanoDaFolha(podeRolar ? plano : semRolagem(plano), {
          espacador,
          folha,
          rolarPagina: (px) => window.scrollBy({ top: px, behavior: "auto" }),
        });
        if (plano.ehInferior) {
          ancoraDaLinhaRef.current = null; // a folha manda; a âncora está consumida
          return;
        }
        // Coluna (≥768) e fechamento: a linha tocada volta exatamente para onde
        // estava na tela, por mais que a altura da página tenha mudado.
        if (!ancora || !botaoAncora || Date.now() >= ancora.expiraEm) return;
        const delta = botaoAncora.getBoundingClientRect().top - ancora.topAntes;
        if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, behavior: "auto" });
      });
    };
    aplicar(true);
    // Rodada 10: a ALTURA da janela também manda. `larguraPainel` só muda
    // quando a LARGURA muda — girar o telefone (844×390) ou abrir o teclado
    // virtual (390×844 → 390×500) não re-executava nada, e a folha voltava a
    // tapar 42.946px² do painel com a linha tocada fora da viewport (medido).
    // `visualViewport` é quem enxerga o teclado; `window.resize` cobre o resto.
    const aoRedimensionarJanela = (): void => aplicar(true);
    window.addEventListener("resize", aoRedimensionarJanela);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", aoRedimensionarJanela);
    // A reserva ENCOLHE conforme o operador rola de volta para cima — a âncora
    // de fechamento é um trinco que só afrouxa, nunca aperta.
    // …e NUNCA rola junto: puxar o operador de volta enquanto ele rola de
    // propósito seria trocar um defeito por outro.
    const aoRolar = (): void => aplicar(false);
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", aoRedimensionarJanela);
      vv?.removeEventListener("resize", aoRedimensionarJanela);
      window.removeEventListener("scroll", aoRolar);
    };
  }, [ativaChave, larguraPainel]);

  /**
   * P5d (achado ALTO #2, rodada 3): quantos itens começam (ou, para uma
   * tarefa `done` fora do CPM, TERMINAM — seu único ponto no tempo) antes da
   * janela vigente — só interessa em "auto" (os zooms fixos já mostram o
   * histórico inteiro por construção, `minIsoDados`). Alimenta o aviso sob o
   * seletor de zoom; cada item em si já ganha o chevron "◀ fora da janela"
   * (com as datas reais no `title`) em vez de ser cortado em silêncio.
   *
   * P5e (achado MÉDIO #4, rodada 4): antes só contava ASSUNTOS — o chevron
   * "◀" também aparece em TAREFAS (início antes da janela, ou o ponto de
   * conclusão de uma `done` fora do CPM), e a nota dizia "4 assuntos" quando
   * a tela tinha 6 chevrons de verdade (2 tarefas fora da contagem). Um único
   * contador, os dois grupos, o mesmo critério (`foraDaJanela`) que a barra usa.
   */
  const itensForaDaJanela = (() => {
    let n = 0;
    // P5f (achado MÉDIO A5, rodada 5): conta os DOIS lados — um item que
    // termina depois da janela ganha "▶" e também não está inteiro na tela.
    const contaPonta = (iso: string): boolean => foraDaJanela(iso) || depoisDaJanela(iso);
    for (const l of linhas) {
      if (l.tipo !== "linha") continue;
      if (l.linha.kind === "assunto") {
        if (l.linha.dataInvalida || l.linha.datasInconsistentes) continue;
        if (contaPonta(l.linha.inicio) || depoisDaJanela(l.linha.fim)) n += 1;
        continue;
      }
      if (l.linha.datasInconsistentes) continue;
      if (l.linha.semBarra) {
        if (l.linha.pontoConcluidoEm && contaPonta(l.linha.pontoConcluidoEm)) n += 1;
        continue;
      }
      if (contaPonta(l.linha.inicio) || depoisDaJanela(l.linha.fim)) n += 1;
    }
    return n;
  })();

  /**
   * Rodada 7 (achado MÉDIO #6): a FRASE do aviso é decidida por uma função
   * pura e testada (`avisoDeItensFora`). O conselho "Mês/Trimestre mostra o
   * histórico" só aparece quando ele é VERDADE — quando quem corta é o
   * recorte do "auto". Quando quem corta é o TETO de dias da escala, nenhum
   * zoom resolve (o crítico mediu: em Mês o fim RECUA de 29/10/2027 para
   * 09/01/2027 e a contagem SOBE de 5 para 6), e o aviso diz isso.
   */
  const avisoItensFora = avisoDeItensFora({
    itensFora: itensForaDaJanela,
    fimDesenhadoFormatado: diaMesAnoCurto(fimDesenhado),
    tetoMordeu: tetoMordeuAJanela(minIso, maxIso),
    zoom: zoom === "auto" ? "auto" : "fixo",
  });

  const indicePorTarefaId = useMemo(() => {
    const m = new Map<string, number>();
    linhas.forEach((l, i) => {
      if (l.tipo === "linha" && l.linha.kind === "tarefa") m.set(l.linha.id, i);
    });
    return m;
  }, [linhas]);

  /** id → título — só para o aria-label da linha citar predecessores/sucessores por NOME (achado ALTO #11). */
  const tituloPorTarefaId = useMemo(() => {
    const m = new Map<string, string>();
    linhas.forEach((l) => {
      if (l.tipo === "linha" && l.linha.kind === "tarefa") m.set(l.linha.id, l.linha.titulo);
    });
    return m;
  }, [linhas]);


  interface Conector {
    chave: string;
    origemId: string;
    destinoId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    critico: boolean;
    destacado: "predecessor" | "sucessor" | null;
    /** P5b (achado ALTO #5): sucessora começa ANTES da predecessora terminar — erro de datas, não sucessão saudável. */
    conflito: boolean;
    /**
     * P5c (achado ALTO #3, rodada 2): `x2 < x1` também acontece quando uma
     * das duas pontas tem data FABRICADA (`foraDoCpm` inventa `inicio = hoje`,
     * `semDuracao` usa o placeholder, `semBarra` não tem geometria real) — aí
     * não é um "conflito" (erro de dado), é "não dá para saber" (dado que falta).
     */
    indefinido: boolean;
    /**
     * P5e (achado MÉDIO #2 do crítico hostil, rodada 4): quando a ponta
     * (origem OU destino) tem data REAL do CPM mas essa data cai FORA da
     * janela vigente, `xFor` clampa o `x` em silêncio para a borda — a
     * aresta nascia com a aparência de uma tarefa que começa DENTRO da
     * janela (às vezes até com o traço triplo do crítico), quando na
     * verdade a barra virou chevron "◀" e não sabemos onde ela realmente
     * está. Independente de `forasDeOrdem`/`datasConfiaveis`: sempre vence
     * `critico` e `conflito` (nunca afirma prazo nem erro provado sobre uma
     * posição fabricada pelo clamp).
     */
    janelaIncompleta: boolean;
  }
  /** Só conflito/indefinido quando as DUAS pontas têm data real (achado ALTO #3). */
  const temDataReal = (r: LinhaDoTempoTarefaRow): boolean =>
    !r.foraDoCpm && !r.semDuracao && !r.semBarra;
  const conectores: Conector[] = [];
  linhas.forEach((l, i) => {
    if (l.tipo !== "linha" || l.linha.kind !== "tarefa") return;
    const destino = l.linha;
    for (const predId of destino.predecessores) {
      const j = indicePorTarefaId.get(predId);
      if (j === undefined) continue; // predecessor fora da lista (órfão) — ignora, nunca lança
      const origemLinha = linhas[j];
      if (!origemLinha || origemLinha.tipo !== "linha" || origemLinha.linha.kind !== "tarefa") continue;
      const origem = origemLinha.linha;
      const destacado =
        linhaAtiva?.id === destino.id
          ? "predecessor"
          : linhaAtiva?.id === origem.id
            ? "sucessor"
            : null;
      const x1 = xFor(origem.fim);
      const x2 = xFor(destino.inicio);
      const forasDeOrdem = x2 < x1;
      const datasConfiaveis = temDataReal(origem) && temDataReal(destino);
      // Achado MÉDIO #2 (rodada 4): a ponta pode ter data REAL do CPM e ainda
      // assim cair fora da janela vigente — `xFor` clampa o `x` para a borda
      // em silêncio, e sem este check a aresta nascia com o estilo/cor de
      // uma tarefa comum (às vezes até "crítica"), começando exatamente onde
      // o chevron "◀" da barra já avisa "não sei onde isto está de verdade".
      // P5f (achado MÉDIO A5, rodada 5): "fora da janela" agora é dos DOIS
      // lados — antes do início (clamp para x=0) ou depois do fim (clamp para
      // a borda direita). Nos dois casos o `x` é fabricado pelo clamp.
      const janelaIncompleta =
        foraDaJanela(origem.fim) ||
        foraDaJanela(destino.inicio) ||
        depoisDaJanela(origem.fim) ||
        depoisDaJanela(destino.inicio);
      conectores.push({
        chave: `${origem.id}->${destino.id}`,
        origemId: origem.id,
        destinoId: destino.id,
        x1,
        y1: j * ROW_H + ROW_H / 2,
        x2,
        y2: i * ROW_H + ROW_H / 2,
        critico: !janelaIncompleta && origem.critico && destino.critico,
        destacado,
        conflito: forasDeOrdem && datasConfiaveis && !janelaIncompleta,
        indefinido: janelaIncompleta || (forasDeOrdem && !datasConfiaveis),
        janelaIncompleta,
      });
    }
  });

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-5 sm:px-6 sm:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
            Linha do tempo
          </h1>
          {/*
            Rodada 7 (achado BAIXO #10): a 390×844 o crítico mediu 494px de
            cabeçalho antes da PRIMEIRA linha do Gantt. Este parágrafo é a
            decodificação das cores — a legenda logo abaixo diz o mesmo com
            amostras. Some abaixo de 640px (`sm`), onde o custo é a tela toda.
          */}
          <p className="mt-1 hidden text-sm text-bone-300 sm:block">
            Progressão dos assuntos e das tarefas — predecessores em{" "}
            <span className="text-aresta-predecessor">amarelo</span>, sucessores em{" "}
            <span className="text-aresta-sucessao">verde</span>, caminho crítico em{" "}
            <span className="text-aresta-critico">vermelho triplo</span>.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            role="group"
            aria-label="Zoom da escala de dias"
            className="inline-flex overflow-hidden rounded-md border border-navy-700"
          >
            {ZOOM_OPCOES.map((op) => (
              <button
                key={op.id}
                type="button"
                aria-pressed={zoom === op.id}
                aria-label={op.label}
                onClick={() => mudarZoom(op.id)}
                className={
                  zoom === op.id
                    ? "min-h-[44px] min-w-[44px] border-l border-navy-700 bg-navy-850 px-3 text-xs font-semibold text-gold-300 first:border-l-0"
                    : "min-h-[44px] min-w-[44px] border-l border-navy-700 bg-navy-900 px-3 text-xs text-bone-300 first:border-l-0 hover:text-bone-100"
                }
              >
                {/*
                  Rodada 7 (achado BAIXO #8): o aviso "· não cabe (N×)" vivia
                  DENTRO deste botão — a 390px ele ia de 52×36 para 152×36 e
                  empurrava o "Hoje" para outra linha, quebrando o segmentado
                  em duas. O botão continua sendo só "Auto"; o aviso vive na
                  linha de avisos abaixo, que já existe para isso.
                */}
                {op.label}
              </button>
            ))}
          </div>
          {/*
            P5f (achado BAIXO A12, rodada 5): não havia NENHUM caminho de
            volta depois de rolar a escala — o painel se reancora em "hoje"
            só quando a escala muda. Botão explícito (e a tecla `H`, mesmo
            efeito) ao lado do seletor de zoom.
          */}
          <button
            type="button"
            onClick={irParaHoje}
            title="Voltar para hoje (tecla H)"
            className="lb-tl-btn-hoje min-h-[44px] min-w-[44px] rounded-md border border-navy-700 bg-navy-900 px-3 text-xs font-semibold text-gold-300 hover:border-gold-600"
          >
            Hoje
          </button>
          </div>
          {/*
            Achado ALTO #2 (rodada 3): "auto" recorta a janela pelo horizonte
            das TAREFAS — nunca clampa um item mais antigo em silêncio (ele
            ganha o chevron "◀ fora da janela"), mas o aviso aqui diz QUANTOS
            e para onde ir para ver o histórico inteiro. Achado MÉDIO #4
            (rodada 4): "itens" — assuntos E tarefas, nunca só assuntos (o
            chevron aparece nos dois grupos).
          */}
          {/*
            P5g (achado ALTO A3, rodada 6): o aviso deixou de ser exclusivo do
            "auto" — o TETO de dias corta a janela nos zooms fixos também (uma
            barra de 400 dias em Trimestre terminava no fim do eixo sem dizer
            nada). A contagem usa o mesmo critério da barra (`fimDesenhado`) e
            o aviso nomeia o último dia desenhado.
          */}
          {avisoItensFora ? (
            <p role="note" className="max-w-[280px] text-right text-[12px] text-bone-400">
              {avisoItensFora}
            </p>
          ) : null}
          {autoNaoCabe ? (
            <p role="note" className="max-w-[280px] text-right text-[12px] text-bone-400">
              {avisoDeOverflow({
                telas: telasDeRolagem,
                pxPorDiaAtual: pxPorDia,
                pxPorDiaTrimestre: PX_POR_DIA_FIXO.trimestre,
              })}
            </p>
          ) : null}
        </div>
      </div>

      {/*
        Rodada 11 (achado BAIXO 7): a legenda só existe quando há gráfico. Com
        o quadro vazio, a tela abria com 13 símbolos decodificando desenhos
        que não estavam ali — e o primeiro contato de um quadro novo é
        exatamente esse.
      */}
      {temLinhas ? <Legenda aberta={legendaAberta} onAlternar={setLegendaAberta} /> : null}

      {!temLinhas ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-navy-700 bg-navy-850 px-4 py-3 text-sm text-bone-300"
        >
          <p className="text-bone-100">Nada para mostrar na linha do tempo ainda.</p>
          <p className="mt-1">
            Ela desenha duas coisas: os assuntos (os PRs das suas frentes) e as tarefas com data.
            Quando existir uma das duas, o gráfico aparece aqui.
          </p>
          {/*
            Rodada 11 (achado BAIXO 7): não havia NENHUMA saída — nem para
            criar tarefa, nem para as frentes. Uma tela vazia sem caminho é um
            beco.
          */}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="/" className={CLASSE_ACAO_DETALHE}>
              Ver as tarefas de hoje
            </a>
            <a href="/frentes" className={CLASSE_ACAO_DETALHE}>
              Abrir as frentes
            </a>
          </div>
        </div>
      ) : (
        /*
          Rodada 7 (decisão D2): o painel de detalhe deixou de SOBREPOR o
          gráfico e passou a COMPRIMI-LO a partir de 768px. Medido pelo
          crítico na rodada 6: o painel `fixed … md:w-[360px] z-40` tapava
          70,0% do scroller a 768px, 45,7% a 1024 e 33,9% a 1280; a 768 a
          barra da própria tarefa selecionada ficava INTEGRALMENTE atrás dele
          e o `z-40` cobria o cabeçalho sticky (`z-20`), cortando "13/09/202".
          Agora são duas colunas de verdade: o gráfico encolhe, o
          `ResizeObserver` recalcula a escala e a sincronização (D1) roda nos
          dois sentidos — abrir e fechar. Abaixo de 768 ele continua sendo a
          folha inferior `fixed` (e a linha tocada rola para cima dela: D5).
        */
        <div className="mt-6 flex w-full flex-col md:flex-row md:items-start md:gap-3">
        <div className="flex w-full min-w-0 flex-1 flex-col">
          {/*
            Achado ALTO #2 (rodada 2): cabeçalho de datas como linha PRÓPRIA,
            fora do scroller horizontal — `sticky` aqui stacka contra a
            PÁGINA (nenhum ancestral com overflow != visible), nunca contra o
            painel. `z-20` fica acima das linhas quando a página rola por
            baixo dele. Achado ALTO #1 (rodada 3): `top` é a altura REAL da
            nav (`navAltura`, medida em runtime) — a nav agora é sticky
            (`src/app/layout.tsx`) e nunca sai de cena, então não sobra mais
            faixa vazia entre as duas.
          */}
          <div
            style={{ top: navAltura, height: alturaHeaderTotal }}
            className="sticky z-20 flex w-full"
          >
            {/* Célula do cabeçalho da coluna de rótulos — mesma largura da coluna abaixo. */}
            <div className={`${classeColunaRotulos} border-b border-r border-navy-700 bg-navy-900`} />
            {/* Célula do cabeçalho da escala — clip (nunca scroll próprio) + conteúdo deslocado por `transform` para acompanhar o `scrollLeft` do painel. */}
            <div className="relative min-w-0 flex-1 overflow-hidden border-b border-navy-700 bg-navy-900">
              <div
                ref={headerTicksRef}
                style={{ width: totalWidth, height: alturaHeaderTotal }}
                className="relative"
              >
                <div
                  className="absolute inset-x-0 top-0 border-b border-navy-800"
                  style={{ height: HEADER_MES_H }}
                >
                  {/*
                    Rodada 7 (decisão D4): a faixa de cima existe em TODA
                    densidade e carrega o período MAIOR (`periodoSuperior`).
                    Rodada 7 (decisão D3): `superioresVisiveis` já veio filtrado
                    pelos DOIS lados da janela — o que não cabe inteiro não é
                    desenhado, e quem fala pela borda esquerda é o chip grudado.
                  */}
                  {superioresVisiveis.map((t) => (
                    <div
                      key={`sup-${t.x}`}
                      className="absolute top-0 flex h-full items-center border-l border-navy-700 pl-1 text-[12px] font-semibold text-bone-300"
                      style={{ left: t.x }}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
                <div
                  className="absolute inset-x-0"
                  style={{ top: HEADER_MES_H, height: HEADER_H }}
                >
                  {/*
                    P5e (achado ALTO, rodada 4 — causa raiz "o eixo tem dono
                    demais"): UMA lista, já desconflitada por `gerarEscalaEixo`
                    — inclui os ticks de dia/semana/mês, a borda `x=0` e o
                    rótulo de "hoje" (chip dourado). A VIEW só decide o
                    ESTILO por `tipo`/`forte`; nunca mais decide sozinha se
                    cabe mais um rótulo (isso já veio resolvido).
                  */}
                  {rotulosVisiveis.map((t) => {
                    // Achado ALTO A2 (rodada 5): o chip de "hoje" é ancorado
                    // no MESMO `left` da linha dourada — o `pl-1` vive DENTRO
                    // do `<span>` (padding não move a caixa), nunca num
                    // contêiner que deslocaria a caixa 4px à direita da linha.
                    return t.tipo === "hoje" ? (
                      <span
                        key="hoje"
                        className="lb-tl-hoje-rotulo absolute top-0 flex h-full items-center whitespace-nowrap rounded-sm bg-navy-900/80 pl-1 pr-0.5 text-[12px] font-semibold text-gold-300"
                        style={{ left: t.x }}
                      >
                        {t.label}
                      </span>
                    ) : (
                      <div
                        key={`${t.tipo}-${t.x}`}
                        className={
                          t.forte
                            ? "absolute top-0 flex h-full items-center border-l border-navy-600 pl-1 text-[12px] font-semibold text-bone-200"
                            : "absolute top-0 flex h-full items-center border-l border-navy-800 pl-1 text-[12px] text-bone-400"
                        }
                        style={{ left: t.x }}
                      >
                        {t.label}
                      </div>
                    );
                  })}
                </div>
                {/* Linha vertical de "hoje" — sempre em `xHoje`, a mesma posição do
                    chip acima (`rotulos`, tipo "hoje"); desenhada à parte porque é
                    uma LINHA (não compete por espaço com texto vizinho). */}
                <div
                  data-timeline-hoje="true"
                  className="lb-tl-hoje absolute top-0 h-full border-l-2 border-gold-500"
                  style={{ left: xHoje }}
                  title="Hoje"
                />
              </div>
              {/*
                Achado MÉDIO A3 (rodada 5): o período grudado vive FORA do
                conteúdo transladado (`headerTicksRef`) — por isso não rola.
                Rodada 7 (achado BAIXO #11): o comentário anterior dizia que
                ele "cai na faixa principal quando não há 2ª faixa" e o código
                logo abaixo renderizava `null` nesse caso — a explicação mentia
                sobre o próprio arquivo. Agora não há mais o caso: a faixa de
                cima existe sempre (decisão D4) e o chip mora nela, sempre.
              */}
              {/*
                P5h (achado BAIXO 6, rodada 10): o chip só existe enquanto
                sobra chip. Empurrado além de `FRACAO_MINIMA_DO_CHIP`, ele
                virava um caco de glifo com fundo sólido — medido a 768×900 em
                "Semana": 0,6px visíveis de um chip de 66,6px em
                `scrollLeft = 1236`, e menos de 60% em 29 de 858 posições. A
                decisão de sumir é da função pura, que no mesmo ato tira o ano
                da lista de anos "já ditos na tela".
              */}
              {chipGrudado.visivel && (
                <span
                  className="lb-tl-mes-grudado absolute top-0 z-20 flex items-center whitespace-nowrap bg-navy-900 text-[12px] font-semibold text-bone-200"
                  style={{
                    // Rodada 9 (achado MÉDIO A2): o chip não mora mais em
                    // `left-0` fixo — ele é EMPURRADO para fora pelo mês que
                    // entra (valor ≤ 0, vindo da função pura), em vez de apagar
                    // o rótulo desse mês como fazia a rodada 8.
                    left: chipGrudado.x,
                    height: HEADER_MES_H,
                    // P5g (achado BAIXO A5, rodada 6): o padding do chip é a
                    // MESMA constante que entra em `larguraAproximada` —
                    // `pl-1 pr-2` (12px) contra `PADDING_ROTULO_PX` (10px) era
                    // a razão de a estimativa SUBESTIMAR o chip ("ago/2026":
                    // estimava 70px, media 74,72px), contra o comentário que
                    // prometia superestimar. Uma fonte só, nunca duas.
                    paddingLeft: PADDING_CHIP_PX / 2,
                    paddingRight: PADDING_CHIP_PX / 2,
                  }}
                >
                  {mesGrudado}
                </span>
              )}
              {/* Achado BAIXO A12 (rodada 5): o degradê de borda que o CORPO já
                  tinha passa a existir também no cabeçalho — começa onde o mês
                  grudado termina, para não apagá-lo. */}
              {afordanciaScroll.esquerda ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 z-10 w-6 bg-gradient-to-r from-navy-900 to-transparent"
                  style={{ left: Math.max(0, chipGrudado.x + larguraMesGrudado) }}
                />
              ) : null}
              {afordanciaScroll.direita ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-navy-900 to-transparent"
                />
              ) : null}
            </div>
          </div>

          <div className="flex w-full items-stretch">
            {/* Coluna de rótulos — fora do scroll horizontal, encolhe no celular. */}
            <div className={`${classeColunaRotulos} border-r border-navy-700`}>
              {linhas.map((l) =>
                l.tipo === "cabecalho" ? (
                  <div
                    key={l.chave}
                    style={{ height: ROW_H }}
                    className="flex items-center bg-navy-900 px-2 text-[12px] font-semibold uppercase tracking-wide text-bone-300"
                  >
                    {l.titulo}
                  </div>
                ) : (
                  <RotuloLinha
                    key={l.chave}
                    linha={l.linha}
                    ativo={ativaChave === l.chave}
                    destacadoPredecessora={l.linha.kind === "tarefa" && predecessorasAtivas.has(l.linha.id)}
                    destacadoSucessora={l.linha.kind === "tarefa" && sucessorasAtivas.has(l.linha.id)}
                    tituloPorTarefaId={tituloPorTarefaId}
                    registrarBotao={(el) => registrarBotaoLinha(l.chave, el)}
                    onAtivar={() => alternarAtiva(l.chave)}
                  />
                ),
              )}
            </div>

            {/*
              Achado BAIXO #9 (rodada 4): não havia NENHUMA pista de que a
              escala continua além da borda — a 390/Semana, 3542px de
              conteúdo num painel de ~250px, sem afordância nenhuma (nem
              sombra, nem gradiente). Este wrapper `relative` fica FORA do
              scroller (não rola com o conteúdo) para hospedar os dois
              degradês de borda, cada um só quando há de fato mais conteúdo
              naquela direção.
            */}
            <div className="relative min-w-0 flex-1">
              {/* Painel da escala — SÓ ele rola na horizontal (o corpo da página nunca rola de lado); o cabeçalho vive fora e se sincroniza por `onScroll`. */}
              {/*
                P5f (achado MÉDIO A7, rodada 5): o painel rolava só com mouse
                ou gesto — quem navega por teclado não tinha COMO chegar ao
                resto da escala (o scroller não era sequer focável). Agora é
                uma região focável e anunciada, com as setas rolando, Home/End
                nas pontas e `H` voltando para hoje.
              */}
              <div
                ref={painelRef}
                tabIndex={0}
                role="region"
                aria-label="Linha do tempo — use as setas para rolar"
                className="w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
                onScroll={(e) => sincronizarComPainel(e.currentTarget)}
                onKeyDown={(e) => {
                  const el = e.currentTarget;
                  const irPara = (x: number): void => {
                    e.preventDefault();
                    rolarPara(el, x);
                  };
                  if (e.key === "ArrowRight") irPara(el.scrollLeft + PASSO_SCROLL_TECLADO_PX);
                  else if (e.key === "ArrowLeft") irPara(el.scrollLeft - PASSO_SCROLL_TECLADO_PX);
                  else if (e.key === "Home") irPara(0);
                  else if (e.key === "End") irPara(el.scrollWidth);
                  else if (e.key === "h" || e.key === "H") {
                    e.preventDefault();
                    irParaHoje();
                  }
                }}
              >
              <div style={{ width: totalWidth }} className="relative">
              <div style={{ height: alturaLinhas }} className="relative bg-navy-950">
                {/*
                  Rodada 11 (achado ALTO 1): a classe `lb-tl-guia-semana` e o
                  `data-lb-hoje` abaixo NÃO são enfeite — são a RÉGUA que a
                  guarda do navegador usa para amarrar pixel a data. As guias
                  são as segundas-feiras (7 dias exatos entre duas), e a faixa
                  do "Hoje" é o único pixel do canvas cuja data o componente
                  declara. Os dois vêm de caminhos que NÃO passam por `xFor`
                  (as guias nascem em `gerarEscalaEixo`, a faixa em `xHoje`),
                  então uma mentira dentro de `xFor` desloca as barras e deixa
                  a régua onde estava — que é exatamente o que a guarda mede.
                */}
                {guiasDentroDoEixo.map((x) => (
                  <div
                    key={x}
                    aria-hidden="true"
                    className="lb-tl-guia-semana absolute top-0 h-full border-l border-navy-800/70"
                    style={{ left: x }}
                  />
                ))}
                <div
                  aria-hidden="true"
                  data-lb-hoje={props.hoje}
                  className="lb-tl-hoje absolute top-0 h-full border-l-2 border-gold-500"
                  style={{ left: xHoje }}
                />

                {linhas.map((l, i) => {
                  if (l.tipo !== "linha") return null;
                  const top = i * ROW_H + (ROW_H - BAR_H) / 2;
                  if (l.linha.kind === "assunto") {
                    return (
                      <BarraAssunto
                        key={l.chave}
                        row={l.linha}
                        top={top}
                        ativo={ativaChave === l.chave}
                        onAtivar={() => alternarAtiva(l.chave)}
                        xFor={xFor}
                        foraDaJanela={foraDaJanela}
                        depoisDaJanela={depoisDaJanela}
                        fimDesenhado={fimDesenhado}
                        larguraTotal={totalWidth}
                        larguraErro={larguraErroMax}
                      />
                    );
                  }
                  return (
                    <BarraTarefa
                      key={l.chave}
                      row={l.linha}
                      top={top}
                      xFor={xFor}
                      foraDaJanela={foraDaJanela}
                      depoisDaJanela={depoisDaJanela}
                      fimDesenhado={fimDesenhado}
                      larguraTotal={totalWidth}
                      larguraErro={larguraErroMax}
                      ativo={ativaChave === l.chave}
                      predecessora={predecessorasAtivas.has(l.linha.id)}
                      sucessora={sucessorasAtivas.has(l.linha.id)}
                      onAtivar={() => alternarAtiva(l.chave)}
                    />
                  );
                })}

                {/*
                  P5b (achado ALTO #11): o `<svg>` NÃO leva `aria-hidden` —
                  isso apagaria o `aria-label` do conector em conflito para
                  todo leitor de tela. Cada `<Conector>` decide sozinho se é
                  decorativo (`aria-hidden`) ou anuncia o conflito (`role="img"`).
                */}
                <svg
                  className="pointer-events-none absolute inset-0"
                  width={totalWidth}
                  height={alturaLinhas}
                >
                  {conectores.map((c) => (
                    <Conector key={c.chave} c={c} tituloPorTarefaId={tituloPorTarefaId} />
                  ))}
                </svg>
              </div>
            </div>
            </div>
            {/* Achado BAIXO #9: degradê de borda SÓ quando há mais conteúdo
                naquela direção — nunca um enfeite estático que mente sobre
                painéis que já mostram tudo. */}
            {afordanciaScroll.esquerda ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-navy-950 to-transparent"
              />
            ) : null}
            {afordanciaScroll.direita ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-navy-950 to-transparent"
              />
            ) : null}
          </div>
        </div>
        </div>
        {/*
          P5f (achados MÉDIO A6 / BAIXO A11, rodada 5): a 390px a coluna de
          rótulos trunca os nomes em 2 linhas e não havia caminho nenhum para
          o texto inteiro nem para a página da tarefa. Rodada 7 (achado MÉDIO
          #7): o painel deixou de ser exclusivo das TAREFAS — ASSUNTO (PR),
          que é metade das linhas da tela, também abre, com nome completo,
          período, estado e o link externo como AÇÃO dentro do painel.
        */}
        {/*
          Rodada 7 (decisão D2): como coluna, o painel gruda logo ABAIXO da nav
          — que é `sticky top-0` e cuja altura é medida em runtime (`navAltura`,
          a mesma fonte que o cabeçalho da escala usa). Sem isto, a 768px o
          título do diálogo nascia por baixo da nav, cortado pela metade.
        */}
        {linhaAtiva ? (
          <PainelDetalheTarefa
            linha={linhaAtiva}
            onFechar={fecharDetalhe}
            topoSticky={navAltura + MARGEM_PAINEL_STICKY_PX}
          />
        ) : assuntoAtivo ? (
          <PainelDetalheAssunto
            linha={assuntoAtivo}
            onFechar={fecharDetalhe}
            topoSticky={navAltura + MARGEM_PAINEL_STICKY_PX}
          />
        ) : null}
        </div>
      )}
      {/*
        Rodada 9 (achado ALTO A1): o espaço que a PÁGINA precisa ter abaixo da
        última linha enquanto a folha inferior está aberta. Sem ele,
        `window.scrollBy` não tem para onde rolar na última linha — vira no-op
        silencioso e a folha fica em cima da barra (medido: 100% de cobertura a
        390px). Altura 0 em repouso, escrita pelo efeito a partir da altura
        REAL da folha; some sozinho quando o painel fecha ou vira coluna.
      */}
      <div ref={espacoFolhaRef} data-lb-espaco-folha="true" aria-hidden="true" style={{ height: 0 }} />
    </main>
  );
}

// ─── sub-componentes ─────────────────────────────────────────────────────────

/** "nenhum" ou a lista de TÍTULOS (nunca ids crus) — achado ALTO #11: o aria-label precisa dizer QUEM, não só QUANTOS. */
function listaDeNomes(ids: readonly string[], tituloPorId: ReadonlyMap<string, string>): string {
  if (ids.length === 0) return "nenhum";
  return ids.map((id) => tituloPorId.get(id) ?? id).join(", ");
}

function RotuloLinha({
  linha,
  ativo,
  destacadoPredecessora,
  destacadoSucessora,
  tituloPorTarefaId,
  registrarBotao,
  onAtivar,
}: {
  linha: LinhaDoTempoRow;
  ativo: boolean;
  destacadoPredecessora: boolean;
  destacadoSucessora: boolean;
  tituloPorTarefaId: ReadonlyMap<string, string>;
  /** P5g (achado ALTO A2, rodada 6): o dono do foco quando o painel de detalhe fecha. */
  registrarBotao?: (el: HTMLButtonElement | null) => void;
  onAtivar?: () => void;
}): JSX.Element {
  /*
    Rodada 7 (achado BAIXO #12): os CONTROLES da tela foram todos para 44px
    (zoom, "Hoje", "fechar", "Abrir tarefa"). A LINHA fica em 42px por
    justificativa escrita, como o achado permite: o alvo de toque aqui é a
    linha INTEIRA (o `<button>` ocupa 100% da largura da coluna — 140px no
    celular, 240px a partir de `sm`), então a área clicável é 140×42 = 5.880px²
    contra os 1.936px² de um alvo quadrado de 44. A altura de 42 é a MESMA
    constante (`ROW_H`) que posiciona a barra do Gantt à direita: subir para 44
    desalinharia rótulo e barra, ou custaria 2px × N linhas de altura de página
    — e a altura da linha não é o que dificulta o toque, a largura é.
  */
  const classeBase =
    "flex h-[42px] items-center gap-1 border-b border-navy-800 bg-navy-850 px-2 py-1 text-xs";
  const anelClasse = ativo
    ? "ring-1 ring-inset ring-gold-500"
    : destacadoPredecessora
      ? "ring-1 ring-inset ring-aresta-predecessor"
      : destacadoSucessora
        ? "ring-1 ring-inset ring-aresta-sucessao"
        : "";

  if (linha.kind === "assunto") {
    const cor = corDoAssunto(linha);
    return (
      <button
        type="button"
        ref={registrarBotao}
        onClick={onAtivar}
        /*
          Rodada 7 (achado BAIXO #9): `aria-pressed` descrevia um botão de
          alternância de ESTADO; o que este botão faz é ABRIR UM DIÁLOGO. O par
          certo é `aria-expanded` + `aria-haspopup="dialog"` — a mesma troca na
          linha de tarefa.
        */
        aria-expanded={ativo}
        aria-haspopup="dialog"
        /*
          Rodada 11 (achado MÉDIO 4): o rótulo era só `título — assunto em
          repo`, e as 28 barras são `aria-hidden` — mergeado, aberto, com data
          podre e com datas invertidas chegavam a um leitor de tela com a
          MESMA frase. Estado e período por extenso, da mesma função pura que
          alimenta a gaveta e o `title` da barra.
        */
        aria-label={rotuloAcessivelDoAssunto(linha, diaMesAnoCurto)}
        className={`${classeBase} ${anelClasse} w-full text-left text-bone-200 hover:text-bone-50`}
        title={rotuloAcessivelDoAssunto(linha, diaMesAnoCurto)}
      >
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${cor.barra}`} />
        {/*
          Achado MÉDIO #5 (rodada 4): a 390px, a coluna (108px) truncava 11 de
          22 nomes em ~10 caracteres. `line-clamp-2` (2 linhas antes de
          reticências) em vez de `truncate` (1 linha) — universal, não só
          abaixo de `sm`: combinar `truncate` e `line-clamp-*` por breakpoint
          arrisca a ordem de especificidade do CSS gerado (as duas mexem em
          `overflow`/`white-space`); 2 linhas na coluna larga (≥240px,
          `sm:w-[240px]`) raramente precisa da 2ª — a maioria dos títulos cabe
          numa só.
        */}
        <span
          /*
            P5h (achado MÉDIO 4, rodada 10): era `text-bone-500`. Medido no
            Chromium, `rgb(108,122,153)` sobre `rgb(18,26,48)` (navy-850) a
            12px, com o risco cortando os glifos: 4,01:1 — abaixo da régua da
            casa (4,5:1), e atingindo TODO assunto mergeado ou fechado, que é a
            maioria do histórico em "Mês" e "Trimestre". `bone-400` mede 6,79:1
            sobre a mesma superfície. O agravante era o medidor:
            `scripts/checar-contraste.mjs` já registrava este par exato como
            corrigido na P7 e rodava verde aqui, porque o par da P5 não estava
            na lista escrita à mão. Agora ele deriva do código quais tokens são
            usados como TEXTO e exige que cada um esteja na régua.
          */
          className={`line-clamp-2 break-words ${cor.riscado ? "text-bone-400 line-through" : ""}`}
        >
          {linha.titulo}
        </span>
      </button>
    );
  }

  // Achado ALTO #11: predecessores/sucessores por NOME no aria-label da linha
  // — o único lugar em que essa relação chegava a um leitor de tela antes era
  // a forma/cor do conector, que o `aria-hidden` do SVG tornava mudo.
  const ariaPreds = listaDeNomes(linha.predecessores, tituloPorTarefaId);
  const ariaSucs = listaDeNomes(linha.sucessores, tituloPorTarefaId);
  /*
    Rodada 11 (achado MÉDIO 3): quando a tarefa sai da grade por falta de
    dado, o motivo é DITO — no rótulo acessível e, logo abaixo, em texto
    visível na própria coluna. Uma linha sem barra não pode ser uma linha
    muda.
  */
  const foraDaGrade = motivoForaDaGrade(linha);
  const ariaExtra = [
    foraDaGrade ? `${foraDaGrade} — fora da grade do tempo` : null,
    linha.atrasada ? "atrasada" : null,
    linha.datasInconsistentes ? "datas inconsistentes" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const ariaLabel =
    `${linha.titulo} — predecessores: ${ariaPreds}; sucessores: ${ariaSucs}` +
    (ariaExtra ? `; ${ariaExtra}` : "");

  return (
    <button
      type="button"
      ref={registrarBotao}
      onClick={onAtivar}
      /* Rodada 7 (achado BAIXO #9): abre um DIÁLOGO — `aria-expanded` +
         `aria-haspopup`, nunca `aria-pressed` (que anuncia um interruptor). */
      aria-expanded={ativo}
      aria-haspopup="dialog"
      aria-label={ariaLabel}
      /*
        Rodada 11: quando a tarefa sai da grade, o rótulo passa a ser a ÚNICA
        superfície que fala dela no quadro (não há barra para apontar). Aí o
        `title` carrega a frase inteira do período; nas linhas com barra ele
        continua sendo só o nome, e quem fala do período é o `title` da barra.
      */
      title={foraDaGrade ? `${linha.titulo} — ${textoDoPeriodo(linha, diaMesAnoCurto)}` : linha.titulo}
      className={`${classeBase} ${anelClasse} w-full text-left text-bone-200 hover:text-bone-50`}
    >
      <span className="line-clamp-2 break-words">{linha.titulo}</span>
      {foraDaGrade ? (
        <span className="lb-tl-fora-da-grade shrink-0 rounded-full border border-navy-600 px-1 text-[12px] leading-4 text-bone-300">
          {foraDaGrade}
        </span>
      ) : null}
      {typeof linha.score === "number" ? (
        <span className="shrink-0 rounded-full border border-fonte-notes/45 bg-fonte-notes/10 px-1 font-mono text-[12px] text-fonte-notes">
          A {linha.score}
        </span>
      ) : null}
    </button>
  );
}

function BarraAssunto({
  row,
  top,
  xFor,
  foraDaJanela,
  depoisDaJanela,
  fimDesenhado,
  larguraTotal,
  larguraErro,
  ativo,
  onAtivar,
}: {
  row: LinhaDoTempoAssuntoRow;
  top: number;
  xFor: (iso: string) => number;
  foraDaJanela: (iso: string) => boolean;
  depoisDaJanela: (iso: string) => boolean;
  /** P5g (achado ALTO A3, rodada 6): o último dia REALMENTE desenhado — o que o `title` precisa nomear. */
  fimDesenhado: string;
  larguraTotal: number;
  larguraErro: number | undefined;
  /** Rodada 7 (achado MÉDIO #7): assunto também abre o painel de detalhe. */
  ativo: boolean;
  onAtivar: () => void;
}): JSX.Element {
  const cor = corDoAssunto(row);
  const x = xFor(row.inicio);

  // Achado MÉDIO #13: data inválida nunca vira "hoje" silenciosamente — sem
  // barra, só o aviso. A barra é o que o RÓTULO (mesmo href) continua sendo o
  // alvo de foco (achado ALTO #11: tabIndex={-1} aqui, nunca stop de Tab).
  if (row.dataInvalida) {
    return (
      <div
        tabIndex={-1}
        aria-hidden="true"
        className="lb-tl-erro absolute flex items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border border-dashed border-state-warning px-1 text-[12px] text-state-warning"
        style={{ left: 0, top, height: BAR_H, maxWidth: larguraErro }}
        title={`${row.titulo} — data inválida`}
      >
        data inválida
      </div>
    );
  }

  // Achado ALTO #8: `fim < início` de verdade (`mergeado_em < criado_em`)
  // nunca vira `Math.max(4, negativo)` fingindo uma barra positiva.
  if (row.datasInconsistentes) {
    return (
      <div
        tabIndex={-1}
        aria-hidden="true"
        className="lb-tl-erro absolute flex items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border border-dashed border-state-error px-1 text-[12px] text-state-error-fg"
        style={{ left: x, top, height: BAR_H, maxWidth: larguraErro }}
        title={`${row.titulo} — datas inconsistentes`}
      >
        datas inconsistentes
      </div>
    );
  }

  // Achados ALTO #2/#7 (rodada 3): assunto que começa ANTES da janela vigente
  // — nunca mais um coto de 4px grudado em `x=0` sem aviso nenhum. Chevron na
  // borda esquerda, com as datas REAIS no `title` (nunca cortado em silêncio).
  const periodoAssunto = textoDoPeriodoDoAssunto(row, diaMesAnoCurto);
  if (foraDaJanela(row.inicio)) {
    return (
      <div
        onClick={onAtivar}
        tabIndex={-1}
        aria-hidden="true"
        className={`lb-tl-fora-da-janela absolute flex cursor-pointer items-center text-[12px] font-semibold ${cor.texto}`}
        style={{ left: 0, top, height: BAR_H }}
        title={`${row.titulo} — ${periodoAssunto} (começa antes da janela)`}
      >
        ◀
      </div>
    );
  }

  // P5f (achado MÉDIO A5, rodada 5): o espelho do "◀" — um assunto que só
  // COMEÇA depois da janela era grudado na borda direita pelo clamp, sem
  // nenhum aviso de que a barra inteira está lá fora.
  if (depoisDaJanela(row.inicio)) {
    return (
      <div
        onClick={onAtivar}
        tabIndex={-1}
        aria-hidden="true"
        className={`lb-tl-fora-da-janela absolute flex cursor-pointer items-center text-[12px] font-semibold ${cor.texto}`}
        style={{ left: larguraTotal - 10, top, height: BAR_H }}
        title={`${row.titulo} — ${periodoAssunto} (começa depois da janela)`}
      >
        ▶
      </div>
    );
  }

  // Achado ALTO #8: PR do mesmo dia (`inicio === fim`) — losango, nunca a
  // barra de 4px que fingia duração.
  if (row.marco) {
    return (
      <div
        onClick={onAtivar}
        tabIndex={-1}
        aria-hidden="true"
        className={`lb-tl-marco absolute rotate-45 ${cor.barra}`}
        style={{ left: x - 5, top: top + (BAR_H - 10) / 2, width: 10, height: 10 }}
        title={`${row.titulo} — ${periodoAssunto}`}
      />
    );
  }

  /**
   * Rodada 11 (achado BAIXO 6): o piso de largura é UM SÓ nos dois grupos do
   * mesmo eixo. `BarraAssunto` usava `Math.max(4, …)` e `BarraTarefa`
   * `Math.max(12, …)` — medido a 390×844, um assunto de 1 dia media 8,38 px e
   * uma tarefa de 1 dia, 12 px: 43% de diferença para a MESMA duração, uma
   * linha abaixo da outra. O piso existe por legibilidade (uma barra de 4 px
   * não é clicável nem visível), e legibilidade não muda de valor conforme o
   * grupo.
   */
  const largura = Math.max(LARGURA_MINIMA_BARRA, xFor(row.fim) - x);
  // P5g (achado ALTO A3, rodada 6): "termina depois da janela" passou a ser
  // medido contra o FIM DESENHADO (o teto de dias corta o eixo antes de
  // `maxIso`) — era exatamente o corte mudo do crítico: uma barra de 400 dias
  // terminando no último pixel, arredondada, com 50 dias escondidos. Agora a
  // ponta direita é RETA (a barra "não acaba ali"), ganha "▶" DENTRO dela (o
  // glifo fora esticava o `scrollWidth` do painel) e o `title` nomeia as duas
  // datas: a real e o fim da janela.
  const terminaForaAssunto = depoisDaJanela(row.fim);
  const avisoFim = terminaForaAssunto
    ? ` — termina em ${diaMesAnoCurto(row.fim)} — depois do fim da janela (${diaMesAnoCurto(fimDesenhado)})`
    : "";
  return (
    <div
      onClick={onAtivar}
      tabIndex={-1}
      aria-hidden="true"
      /*
        Rodada 11 (achado ALTO 1): gancho de SELEÇÃO da guarda — só diz "isto
        é uma barra ancorada pelo início"; a data continua vindo do `title`,
        que é o que o operador lê, e o pixel do `getBoundingClientRect`.
      */
      data-lb-barra="assunto"
      className={`absolute cursor-pointer ${terminaForaAssunto ? "rounded-l-sm" : "rounded-sm"} ${cor.barra} ${ativo ? "ring-2 ring-gold-500" : ""} opacity-90 hover:opacity-100`}
      style={{ left: x, top, width: largura, height: BAR_H }}
      title={`${row.titulo} — ${periodoAssunto}${avisoFim}`}
    >
      {cor.riscado ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-navy-950/70" />
      ) : null}
      {terminaForaAssunto ? (
        <span
          aria-hidden="true"
          className={`lb-tl-fora-da-janela absolute right-0 top-0 text-[12px] font-semibold leading-4 ${cor.chevron}`}
        >
          ▶
        </span>
      ) : null}
    </div>
  );
}

function BarraTarefa({
  row,
  top,
  xFor,
  foraDaJanela,
  depoisDaJanela,
  fimDesenhado,
  larguraTotal,
  larguraErro,
  ativo,
  predecessora,
  sucessora,
  onAtivar,
}: {
  row: LinhaDoTempoTarefaRow;
  top: number;
  xFor: (iso: string) => number;
  foraDaJanela: (iso: string) => boolean;
  depoisDaJanela: (iso: string) => boolean;
  /** P5g (achado ALTO A3, rodada 6): último dia REALMENTE desenhado (o teto corta antes de `maxIso`). */
  fimDesenhado: string;
  larguraTotal: number;
  larguraErro: number | undefined;
  ativo: boolean;
  predecessora: boolean;
  sucessora: boolean;
  onAtivar: () => void;
}): JSX.Element | null {
  // Achados ALTO #4/#8/#11: bars nunca são o alvo de foco (o RÓTULO, mesmo
  // `onAtivar`, é quem fica no Tab — `tabIndex={-1}` + `aria-hidden` aqui em
  // TODO ramo desta função) e nunca fabricam geometria que a tarefa não tem.

  // Achado ALTO #8: `fim < início` (não alcançável hoje pela montagem — ver
  // `datasInconsistentes` em `core/timeline/linha-do-tempo.ts` — mas a VIEW
  // trata o caso de qualquer jeito, nunca um `Math.max(4, negativo)` mudo).
  if (row.datasInconsistentes) {
    return (
      <div
        tabIndex={-1}
        aria-hidden="true"
        onClick={onAtivar}
        className="lb-tl-erro absolute flex cursor-pointer items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-sm border border-dashed border-state-error px-1 text-[12px] text-state-error-fg"
        style={{ left: xFor(row.inicio), top, height: BAR_H, maxWidth: larguraErro }}
        title={`${row.titulo} — datas inconsistentes`}
      >
        datas inconsistentes
      </div>
    );
  }

  // Achado ALTO #4: `done` fora do CPM sem data nenhuma — nada desenhado
  // (nunca a barra fabricada "hoje → hoje+1" que o crítico pegou no futuro).
  if (row.semBarra) {
    if (!row.pontoConcluidoEm) return null;
    // Achado ALTO #7 (rodada 3): ponto de conclusão ANTES da janela vigente
    // — antes ficava "colado" em `left: -4` (metade cortada pela borda do
    // painel). Mesmo mecanismo do #2: chevron + data real no `title`.
    if (foraDaJanela(row.pontoConcluidoEm) || depoisDaJanela(row.pontoConcluidoEm)) {
      const antes = foraDaJanela(row.pontoConcluidoEm);
      return (
        <div
          tabIndex={-1}
          aria-hidden="true"
          onClick={onAtivar}
          className="lb-tl-fora-da-janela absolute flex cursor-pointer items-center text-[12px] font-semibold text-state-done"
          style={{ left: antes ? 0 : larguraTotal - 10, top, height: BAR_H }}
          title={`${row.titulo} — concluída em ${diaMesAnoCurto(row.pontoConcluidoEm)} (${antes ? "antes" : "depois"} da janela)`}
        >
          {antes ? "◀" : "▶"}
        </div>
      );
    }
    const cx = xFor(row.pontoConcluidoEm);
    return (
      <div
        tabIndex={-1}
        aria-hidden="true"
        onClick={onAtivar}
        className="lb-tl-ponto-concluida absolute cursor-pointer rounded-full bg-state-done"
        style={{ left: cx - 4, top: top + (BAR_H - 8) / 2, width: 8, height: 8 }}
        title={`${row.titulo} — concluída em ${diaMesAnoCurto(row.pontoConcluidoEm)}`}
      />
    );
  }

  /**
   * Rodada 11 (achado MÉDIO 3) — A DECISÃO: sem início ou sem duração, a
   * tarefa NÃO recebe barra. Posição e comprimento no eixo do tempo são
   * afirmações sobre datas; quem não tem a data não pode fazer a afirmação.
   * Até aqui ela recebia as duas, fabricadas: `left` = a faixa do "Hoje" e
   * `width` = exatamente 1 dia — indistinguível, na mesma tela, de uma tarefa
   * de 1 dia real (e a 390px, com o piso de largura, indistinguível também de
   * uma de 0,5 dia).
   *
   * Ela não some: o motivo vai POR EXTENSO para a coluna de rótulos e para o
   * `aria-label` (`motivoForaDaGrade`), e a gaveta continua com a frase
   * inteira. O que se perde é o início PROJETADO pelo CPM de uma tarefa sem
   * duração — que continua escrito, só não vira mais um retângulo.
   *
   * `semBarra` (concluída fora do CPM) já foi tratada acima: ela tem um ponto
   * de conclusão com data REAL, que é outro desenho e não afirma duração.
   */
  if (!desenhaBarraDeDuracao(row)) return null;

  // Achados ALTO #2/#7 (rodada 3): tarefa cujo início cai antes da janela
  // vigente — nunca mais um coto grudado em `x=0` sem nenhum aviso. Chevron
  // na borda esquerda, com as datas reais no `title`.
  const periodoTarefa = `${diaMesAnoCurto(row.inicio)} → ${diaMesAnoCurto(row.fim)}`;
  if (foraDaJanela(row.inicio) || depoisDaJanela(row.inicio)) {
    const antes = foraDaJanela(row.inicio);
    return (
      <div
        tabIndex={-1}
        aria-hidden="true"
        onClick={onAtivar}
        className={`lb-tl-fora-da-janela absolute flex cursor-pointer items-center text-[12px] font-semibold ${row.critico ? "text-aresta-critico" : "text-bone-300"}`}
        style={{ left: antes ? 0 : larguraTotal - 10, top, height: BAR_H }}
        title={`${row.titulo} — ${periodoTarefa} (${antes ? "começa antes" : "começa depois"} da janela)`}
      >
        {antes ? "◀" : "▶"}
      </div>
    );
  }

  const x = xFor(row.inicio);

  // Achado ALTO #8: duração zero (`done` no CPM) — losango, nunca 4px sólido.
  if (row.marco) {
    return (
      <div
        tabIndex={-1}
        aria-hidden="true"
        onClick={onAtivar}
        className={`lb-tl-marco absolute cursor-pointer rotate-45 ${row.critico ? "bg-aresta-critico" : "bg-gold-400"} ${
          ativo ? "ring-2 ring-gold-500" : ""
        }`}
        style={{ left: x - 6, top: top + (BAR_H - 12) / 2, width: 12, height: 12 }}
        title={`${row.titulo} — marco em ${diaMesAnoCurto(row.inicio)}`}
      />
    );
  }

  // Achado BAIXO #11 (rodada 2): piso de 12px, nunca os 4px antigos — uma
  // duração sub-dia (0,5 dia) tem largura de data ~0, mas ISTO NÃO é um marco
  // (marco é só duração zero de verdade, `core/timeline` já garante isso).
  const largura = Math.max(LARGURA_MINIMA_BARRA, xFor(row.fim) - x);
  const xFolga = xFor(row.fimComFolga);
  const larguraFolga = Math.max(0, xFolga - xFor(row.fim));

  // Achado ALTO #4: aberta sem estimativa → contorno tracejado + "sem data"
  // (nunca a barra sólida fabricada). Achado ALTO #5 (rodada 2): atrasada NÃO
  // troca o preenchimento — sobre CRÍTICO isso apagava o traço triplo/cor de
  // risco de prazo por um contorno tracejado igual ao de "sem data", como se
  // deixasse de ser crítica. Preenchimento é SEMPRE `preenchimento`
  // (crítico/status), exceto o caso "sem duração" (que já não tem uma cor de
  // status real para mostrar); atraso vira um MARCADOR aditivo, nunca troca.
  const preenchimento = row.critico
    ? "bg-aresta-critico"
    : row.status === "done"
      ? "bg-state-done"
      : row.status === "blocked"
        ? "bg-state-blocked"
        : row.status === "in_progress"
          ? "bg-state-progress"
          : "bg-state-open";
  /**
   * Rodada 11 (achado MÉDIO 3): as duas variantes TRACEJADAS sumiram daqui
   * junto com as barras que elas vestiam. Até a rodada 10 havia "sem data"
   * (contorno tracejado sobre fundo transparente) e "início não definido"
   * (tracejado + preenchimento a 30%) — as duas desenhavam comprimento e
   * posição que o dado não tinha, e a diferença para uma barra real era uma
   * borda de 2 px que some no piso de largura a 390px. Agora essas tarefas
   * não têm barra nenhuma (`desenhaBarraDeDuracao`), e toda barra que existe
   * é sólida e sustentada por duas datas.
   */
  const classesEstado = preenchimento;
  /**
   * P5g (achado ALTO A3, rodada 6): o "▶" de "continua além da janela" vive
   * DENTRO da barra. Com as variantes translúcidas fora (rodada 11), o fundo
   * atrás dele é sempre um preenchimento de estado/crítico — `navy-950` mede
   * ≥ 4,68:1 sobre todos eles (`scripts/checar-contraste.mjs`).
   */
  const corDoChevronDeFim = "text-navy-950";
  const rotuloLateral = row.atrasada ? "atrasada" : null;
  // P5g (achado ALTO A3, rodada 6): a mesma régua do assunto — o fim real é
  // comparado com o FIM DESENHADO, nunca com `maxIso`.
  const terminaForaTarefa = depoisDaJanela(row.fim);
  // Achado MÉDIO #7 (rodada 2): o rótulo lateral ficava em `left-full` (== o
  // início da hachura de folga) e a hachura o cobria. Quando há folga
  // desenhada, o rótulo vai depois DELA; senão, logo após a barra (como antes).
  const offsetRotulo = larguraFolga > 0 ? largura + larguraFolga : largura;
  /**
   * P5g (achado BAIXO A6, rodada 6): o badge lateral ("sem data"/"atrasada")
   * é `absolute` e nasce DEPOIS do fim da barra — quando a barra terminava no
   * fim do eixo ele esticava o `scrollWidth` do painel 44px além de
   * `totalWidth`, criando faixa de rolagem sem eixo nenhum. `posicaoDoBadge`
   * (pura, testada) prende o `x` ABSOLUTO do badge dentro do eixo; o `ml-1`
   * do próprio badge entra na largura reservada.
   */
  const MARGEM_BADGE_PX = 4;
  const larguraRotuloLateral = rotuloLateral
    ? larguraAproximada(rotuloLateral) + MARGEM_BADGE_PX
    : 0;
  const leftRotuloLateral =
    posicaoDoBadge(x + offsetRotulo, larguraRotuloLateral, larguraTotal) - x;

  const anel = ativo
    ? "ring-2 ring-gold-500"
    : predecessora
      ? "ring-2 ring-aresta-predecessor"
      : sucessora
        ? "ring-2 ring-aresta-sucessao"
        : "";

  // Achado MÉDIO #6 (rodada 2): o marcador de `dueDate` só faz sentido DENTRO
  // da barra — fora dela (prazo muito antes do início ou muito depois do fim)
  // o traço antigo aparecia centenas de px longe, sem nenhuma barra por perto
  // para "ancorar" visualmente. Dentro: o traço vertical de sempre. Fora: uma
  // seta pequena na borda mais próxima, com o prazo no `title`.
  const dueXRelativo = row.dueDate ? xFor(row.dueDate) - x : null;
  const dueDentroDaBarra = dueXRelativo !== null && dueXRelativo >= 0 && dueXRelativo <= largura;
  /** O mesmo clamp do badge lateral para a bandeira de prazo (⚑) depois do fim da barra. */
  const LARGURA_GLIFO_PX = 12;
  const leftBandeiraPrazo =
    dueXRelativo !== null && dueXRelativo < 0
      ? -10
      : posicaoDoBadge(x + largura, LARGURA_GLIFO_PX, larguraTotal) - x;

  // Achado MÉDIO #5 (rodada 3): título com datas legíveis (dd/MM), não só a
  // folga em dias. Achado MÉDIO #6: `folga: null` (fora do CPM) nunca lê como
  // "0 d" (que se confundia com "tão crítica quanto o caminho do goal") — o
  // tooltip diz explicitamente que não foi calculada.
  const folgaTexto = row.folga === null ? "folga não calculada" : `folga: ${row.folga} d`;
  /**
   * P5h (achados CRÍTICO 1 + ALTO 3, rodada 10): o `title` da barra e o campo
   * "Período" da gaveta passam pela MESMA função pura (`textoDoPeriodo`), que
   * só cita número digitado. Antes aqui havia `Math.max(1, diffDias(inicio,
   * fim))` chamado de "estimativa": devolvia "1 dia" para uma tarefa de 0,5
   * (barra de 12px, onde um dia real mede 42,77px) e "1 dia" para uma tarefa
   * que ninguém estimou — o texto contradizia o desenho na mesma tela.
   */
  const tituloBarra =
    `${row.titulo} — ` +
    textoDoPeriodo(row, diaMesAnoCurto) +
    ` (${folgaTexto})` +
    (terminaForaTarefa
      ? ` — termina em ${diaMesAnoCurto(row.fim)} — depois do fim da janela (${diaMesAnoCurto(fimDesenhado)})`
      : "") +
    (rotuloLateral ? ` — ${rotuloLateral}` : "");

  return (
    <div
      tabIndex={-1}
      aria-hidden="true"
      onClick={onAtivar}
      data-lb-barra="tarefa"
      className={`absolute cursor-pointer ${terminaForaTarefa ? "rounded-l-sm" : "rounded-sm"} ${classesEstado} ${anel} ${row.critico ? "lb-tl-bar-critico" : ""}`}
      style={{ left: x, top, width: largura, height: BAR_H }}
      title={tituloBarra}
    >
      {row.critico ? <TracoTriploCritico largura={largura} /> : null}
      {/*
        P5g (achado ALTO A3, rodada 6): barra cortada pelo fim desenhado —
        ponta reta (acima) + "▶" DENTRO da própria barra. Fora dela o glifo
        esticaria o `scrollWidth` do painel além do eixo (achado BAIXO A6);
        `navy-950` sobre qualquer preenchimento de barra mede ≥ 4,68:1
        (`scripts/checar-contraste.mjs`).
      */}
      {terminaForaTarefa ? (
        <span
          aria-hidden="true"
          className={`lb-tl-fora-da-janela absolute right-0 top-0 text-[12px] font-semibold leading-4 ${corDoChevronDeFim}`}
        >
          ▶
        </span>
      ) : null}
      {/* Achado ALTO #5 (rodada 2): marcador ADITIVO de atraso — nunca troca
          `classesEstado`, então uma barra crítica E atrasada continua com o
          preenchimento/traço triplo do crítico, só ganha esta borda extra.
          Achado BAIXO #8 (rodada 4): sobre a barra CRÍTICA (preenchimento
          vermelho `bg-aresta-critico` + o próprio traço triplo vermelho), o
          marcador vermelho de 2px ficava invisível — vermelho sobre vermelho.
          A 1ª tentativa (dourado, `gold-400`) mediu 1,70:1 contra o vermelho
          crítico — pior que o problema original. `navy-950` (o escuro da
          casa) mede 7,90:1 — escuro pontilhado sobre o vermelho claro do
          crítico lê com folga (par em `checar-contraste.mjs`); vermelho de
          sempre nos outros estados (fundo não-crítico já suficientemente
          escuro para o `state-error` de sempre contrastar). */}
      {row.atrasada ? (
        <span
          aria-hidden="true"
          className={
            row.critico
              ? "lb-tl-atrasada-marcador absolute inset-x-0 -top-2 h-0.5 rounded-full border-t-2 border-dotted border-navy-950"
              : "lb-tl-atrasada-marcador absolute inset-x-0 -top-1 h-0.5 rounded-full border-t-2 border-state-error"
          }
        />
      ) : null}
      {rotuloLateral ? (
        <span
          className="absolute top-0 ml-1 whitespace-nowrap text-[12px] leading-4 text-bone-300"
          style={{ left: leftRotuloLateral }}
        >
          {rotuloLateral}
        </span>
      ) : null}
      {row.atrasada && row.dueDate && dueDentroDaBarra ? (
        <div
          aria-hidden="true"
          className="lb-tl-atraso absolute -top-1 w-0.5 bg-state-error"
          style={{ left: dueXRelativo!, height: BAR_H + 2 }}
          title={`prazo ${diaMesAnoCurto(row.dueDate)}`}
        />
      ) : null}
      {/*
        P5f (achado MÉDIO A8, rodada 5): "◀" tinha DOIS sentidos na mesma
        tela — "fora da janela" (a barra continua para trás) e "o prazo é
        antes do início". Um glifo, dois conceitos, nenhuma forma de saber
        qual. O marcador de prazo vira "⚑" (dos dois lados, com entrada
        própria na legenda); "◀"/"▶" ficam só para a janela.
      */}
      {row.atrasada && row.dueDate && !dueDentroDaBarra ? (
        <div
          aria-hidden="true"
          className="lb-tl-atraso-seta absolute top-0 text-[12px] leading-4 text-state-error"
          style={{ left: leftBandeiraPrazo }}
          title={`prazo ${diaMesAnoCurto(row.dueDate)} — ${dueXRelativo! < 0 ? "antes do início" : "depois do fim"} da barra`}
        >
          ⚑
        </div>
      ) : null}
      {larguraFolga > 0 ? (
        <div
          aria-hidden="true"
          className="lb-tl-slack absolute top-0 h-full rounded-r-sm bg-folga-tracado/30 opacity-70 [background-image:repeating-linear-gradient(45deg,theme(colors.folga.tracado)_0_3px,transparent_3px_6px)]"
          style={{ left: largura, width: larguraFolga, height: BAR_H }}
        />
      ) : null}
    </div>
  );
}

/** Traço triplo — a mesma linguagem do grafo (P4: 3 linhas em cima e embaixo da barra). */
function TracoTriploCritico({ largura }: { largura: number }): JSX.Element {
  return (
    <span aria-hidden="true" style={{ width: largura }} className="pointer-events-none absolute inset-x-0">
      <span className="absolute -top-[5px] left-0 h-px w-full bg-aresta-critico" />
      <span className="absolute -top-[3px] left-0 h-px w-full bg-aresta-critico" />
      <span className="absolute -top-[1px] left-0 h-px w-full bg-aresta-critico" />
      <span className="absolute -bottom-[1px] left-0 h-px w-full bg-aresta-critico" />
      <span className="absolute -bottom-[3px] left-0 h-px w-full bg-aresta-critico" />
      <span className="absolute -bottom-[5px] left-0 h-px w-full bg-aresta-critico" />
    </span>
  );
}

interface DadosConector {
  origemId: string;
  destinoId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  critico: boolean;
  destacado: "predecessor" | "sucessor" | null;
  conflito: boolean;
  indefinido: boolean;
  /** P5e (achado MÉDIO #2, rodada 4): distingue "não sei" por dado fabricado × por ponta fora da janela vigente. */
  janelaIncompleta: boolean;
}

/**
 * P5c (achado ALTO #3, rodada 2): traço neutro para "não dá para saber" —
 * nunca o vermelho de conflito (isso afirmaria um erro que não foi provado).
 * Hex literal pela MESMA exceção documentada no topo do arquivo (stroke de
 * SVG não aceita classe Tailwind) — `bone-500` de `tailwind.config.ts`.
 */
const ARESTA_STROKE_INDEFINIDA = "#6C7A99";
/**
 * P5c (achado MÉDIO #9, rodada 2): antes, selecionar uma tarefa deixava seus
 * SUCESSORES na MESMA cor verde do default (`aresta.sucessao`) — só a
 * espessura mudava (1.4→2.25px), pouco perceptível num screenshot. Verde mais
 * claro/saturado, distinto a olho nu do verde-padrão, e reservado só para o
 * destaque de seleção (nunca usado fora daqui).
 */
const ARESTA_STROKE_SUCESSOR_ATIVO = "#8CFFC0";

type DirecaoSeta = "direita" | "baixo" | "cima";

/** Ponta da seta orientada — "direita" (chegada horizontal normal) ou "baixo"/"cima" (cotovelo vertical, achado ALTO #6). */
function pontosDaSeta(x: number, y: number, direcao: DirecaoSeta): string {
  if (direcao === "baixo") return `${x - 3.5},${y - 5} ${x},${y} ${x + 3.5},${y - 5}`;
  if (direcao === "cima") return `${x - 3.5},${y + 5} ${x},${y} ${x + 3.5},${y + 5}`;
  return `${x - 5},${y - 3.5} ${x},${y} ${x - 5},${y + 3.5}`;
}

/**
 * Achado ALTO #6: quando `x2 <= x1 + 8` (predecessora e sucessora quase/
 * totalmente coladas no eixo do tempo), o caminho antigo forçava um gancho de
 * 8px para a DIREITA antes de voltar — visualmente "sai da barra e recua".
 * Corrigido: cotovelo vertical simples na junção, com a seta entrando na
 * sucessora por CIMA ou por BAIXO (nunca pela lateral fingindo espaço que
 * não existe).
 */
function caminhoEChegada(c: DadosConector): { d: string; arrowX: number; arrowY: number; direcao: DirecaoSeta } {
  if (c.x2 > c.x1 + 8) {
    const xMeio = c.x1 + (c.x2 - c.x1) / 2;
    return {
      d: `M${c.x1},${c.y1} L${xMeio},${c.y1} L${xMeio},${c.y2} L${c.x2},${c.y2}`,
      arrowX: c.x2,
      arrowY: c.y2,
      direcao: "direita",
    };
  }
  const desce = c.y2 > c.y1;
  const yChegada = desce ? c.y2 - 6 : c.y2 + 6;
  return {
    d: `M${c.x1},${c.y1} L${c.x1},${yChegada} L${c.x2},${yChegada} L${c.x2},${c.y2}`,
    arrowX: c.x2,
    arrowY: c.y2,
    direcao: desce ? "baixo" : "cima",
  };
}

function Conector({
  c,
  tituloPorTarefaId,
}: {
  c: DadosConector;
  tituloPorTarefaId: ReadonlyMap<string, string>;
}): JSX.Element {
  const { d, arrowX, arrowY, direcao } = caminhoEChegada(c);

  // Achado ALTO #17: DESTACADO (seleção) vence a COR — antes `critico` sempre
  // ganhava, e selecionar um nó nunca deixava seus predecessores críticos
  // amarelos. O traço TRIPLO continua condicionado só a `critico`,
  // independente da cor (uma aresta pode ficar "amarela E tripla"). Achado
  // ALTO #5/#3 (rodada 2): CONFLITO real vence tudo (é um erro provado);
  // INDEFINIDO (data fabricada de um dos lados) é neutro — nunca a mesma cor
  // do erro provado, nunca a mesma cor de uma preferência de seleção.
  const cor = c.conflito
    ? ARESTA_STROKE_CRITICO
    : c.indefinido
      ? ARESTA_STROKE_INDEFINIDA
      : c.destacado === "predecessor"
        ? ARESTA_STROKE_DESTACADA
        : c.destacado === "sucessor"
          ? ARESTA_STROKE_SUCESSOR_ATIVO
          : c.critico
            ? ARESTA_STROKE_CRITICO
            : ARESTA_STROKE.sucessao;
  const largura = c.destacado || c.critico || c.conflito ? 2.25 : 1.4;

  const origemTitulo = tituloPorTarefaId.get(c.origemId) ?? c.origemId;
  const destinoTitulo = tituloPorTarefaId.get(c.destinoId) ?? c.destinoId;

  // Achado MÉDIO #2 (rodada 4): "não sei" tem DOIS motivos, e o hover/leitor
  // de tela precisa dizer QUAL — "predecessor fora da janela" (a data é real,
  // só não cabe na janela vigente) é uma informação acionável (mude de zoom
  // para ver); "data indefinida" (dado fabricado) não é.
  const rotuloIndefinido = c.janelaIncompleta
    ? `predecessor fora da janela: ${origemTitulo} → ${destinoTitulo}`
    : "data indefinida";

  return (
    <g
      className="lb-tl-connector"
      data-critico={c.critico}
      data-conflito={c.conflito}
      data-indefinido={c.indefinido}
      data-janela-incompleta={c.janelaIncompleta}
      {...(c.conflito
        ? { role: "img", "aria-label": `conflito de datas: ${destinoTitulo} começa antes de ${origemTitulo} terminar` }
        : c.indefinido
          ? { role: "img", "aria-label": rotuloIndefinido }
          : { "aria-hidden": true })}
    >
      {/* `<title>` — só o SVG `<g>` não aceita o atributo `title` nativo do HTML para tooltip no hover. */}
      {c.indefinido ? <title>{rotuloIndefinido}</title> : null}
      {c.critico ? (
        <>
          <path d={d} stroke={cor} strokeWidth={1.6} fill="none" transform="translate(0,-3)" />
          <path d={d} stroke={cor} strokeWidth={1.6} fill="none" />
          <path d={d} stroke={cor} strokeWidth={1.6} fill="none" transform="translate(0,3)" />
        </>
      ) : (
        <path
          d={d}
          stroke={cor}
          strokeWidth={largura}
          fill="none"
          strokeDasharray={c.indefinido ? "3 3" : undefined}
        />
      )}
      <polygon points={pontosDaSeta(arrowX, arrowY, direcao)} fill={cor} />
      {c.conflito ? (
        <text
          x={(c.x1 + c.x2) / 2}
          y={(c.y1 + c.y2) / 2 - 6}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill={ARESTA_STROKE_CRITICO}
        >
          ✕
        </text>
      ) : null}
    </g>
  );
}

/** `open` → "aberta" etc. — a tela nunca mostra o enum cru do banco. */
const ESTADO_EM_PORTUGUES: Record<LinhaDoTempoTarefaRow["status"], string> = {
  open: "aberta",
  in_progress: "em andamento",
  blocked: "bloqueada",
  done: "concluída",
};

/**
 * P5f (achados MÉDIO A6 / BAIXO A11, rodada 5): o painel de detalhe da linha
 * tocada. Resolve os dois de uma vez: o nome INTEIRO (a 390px a coluna corta
 * 11 de 25 títulos em 2 linhas, sem nenhum caminho para o texto) e a ponte da
 * linha do tempo para a PÁGINA da tarefa (`/tarefa/[id]`), que não existia em
 * lugar nenhum desta tela.
 *
 * `<a>` puro em vez de `next/link`: um clique por sessão não justifica o
 * router do App Router num componente que os testes renderizam sem contexto.
 */
export function PainelDetalheTarefa({
  linha,
  onFechar,
  topoSticky = 0,
}: {
  linha: LinhaDoTempoTarefaRow;
  onFechar: () => void;
  /** Altura da nav sticky + respiro — onde o painel-COLUNA gruda (≥768px). */
  topoSticky?: number;
}): JSX.Element {
  const marcas = [
    linha.critico ? "caminho crítico" : null,
    linha.atrasada ? "atrasada" : null,
    linha.semDuracao ? "sem estimativa" : null,
    linha.inicioEstimado ? "início não definido" : null,
    linha.foraDoCpm ? "fora do caminho até a meta" : null,
  ].filter((m): m is string => m !== null);
  /**
   * P5g (achado ALTO A2, rodada 6): o painel era injetado NO FLUXO, logo
   * abaixo da legenda — a 390px ele nascia ~600px ACIMA da viewport (o
   * operador tinha rolado até a linha lá embaixo), o toque "não fazia nada",
   * e a página ainda pulava 830 → 1024 porque o conteúdo crescia. Agora é um
   * diálogo NÃO-modal `position: fixed`: folha inferior abaixo de 768px,
   * painel lateral de 360px à direita a partir daí (a forma do Asana).
   * `fixed` não cresce o layout — `scrollY` não muda ao abrir.
   */
  const tituloRef = useRef<HTMLParagraphElement | null>(null);
  const tituloId = `lb-tl-detalhe-titulo-${linha.id}`;
  /** Ao abrir (ou ao trocar de linha), o foco vai para o título do diálogo. */
  useEffect(() => {
    tituloRef.current?.focus();
  }, [linha.id]);
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      data-lb-detalhe="true"
      style={{ ["--lb-tl-topo-painel" as string]: `${topoSticky}px` } as React.CSSProperties}
      className={CLASSE_PAINEL_DETALHE}
    >
      <CabecalhoDoDetalhe titulo={linha.titulo} tituloId={tituloId} tituloRef={tituloRef} onFechar={onFechar} />
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-bone-300">
        <div className="flex gap-1">
          <dt>Período:</dt>
          <dd className="text-bone-100">
            {/*
              P5h (achado CRÍTICO 1, rodada 10): esta era a linha que imprimia
              "21/09/2026 → 22/09/2026" para uma tarefa sem `iniciadoEm` e sem
              `estimativaDias` — os dois dias eram `hoje + DURACAO_PLACEHOLDER`,
              e a própria gaveta desmentia isso em cinza três linhas abaixo
              ("sem estimativa"). A mesma função pura do `title` da barra
              decide agora as duas superfícies, e elas não podem mais divergir.
            */}
            {textoDoPeriodo(linha, diaMesAnoCurto)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Folga:</dt>
          <dd className="text-bone-100">
            {linha.folga === null ? "não calculada" : `${linha.folga} d`}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Estado:</dt>
          <dd className="text-bone-100">{ESTADO_EM_PORTUGUES[linha.status]}</dd>
        </div>
        {linha.dueDate ? (
          <div className="flex gap-1">
            <dt>Prazo:</dt>
            <dd className="text-bone-100">{diaMesAnoCurto(linha.dueDate)}</dd>
          </div>
        ) : null}
      </dl>
      {marcas.length > 0 ? <p className="mt-1 text-bone-400">{marcas.join(" · ")}</p> : null}
      <a
        href={`/tarefa/${encodeURIComponent(linha.id)}`}
        className={CLASSE_ACAO_DETALHE}
      >
        Abrir tarefa
      </a>
    </div>
  );
}

/**
 * Rodada 7 (decisão D2): a forma do painel. Abaixo de 768px continua a FOLHA
 * INFERIOR `fixed` (a folha do celular, com a linha ativa rolando para cima
 * dela — achado MÉDIO #5). A partir de 768 ele deixa de ser `fixed` e vira uma
 * COLUNA de verdade (`md:static`), dentro do `flex md:flex-row` da tela: o
 * gráfico encolhe e se reajusta em vez de ficar 70% tapado. `z-40` só existe
 * enquanto ele é folha — como coluna, nunca disputa camada com o cabeçalho
 * sticky (`z-20`), que era o que cortava "13/09/202".
 *
 * 300px é a largura medida do conteúdo real (título em 2 linhas + 4 pares
 * rótulo/valor + marcas + botão), não os 360 da rodada 6.
 */
const CLASSE_PAINEL_DETALHE =
  "lb-tl-detalhe fixed bottom-0 left-0 right-0 z-40 max-h-[60vh] overflow-y-auto border-t border-navy-700 bg-navy-850 px-3 py-2 text-[12px] text-bone-200 shadow-2xl " +
  "md:sticky md:bottom-auto md:left-auto md:right-auto md:top-[var(--lb-tl-topo-painel)] md:z-auto md:max-h-none md:w-[240px] md:shrink-0 md:self-start md:overflow-visible md:rounded-lg md:border md:border-navy-700 md:shadow-none lg:w-[300px]";

/** Rodada 7 (achado BAIXO #12): toda ação do painel em 44px de altura mínima. */
const CLASSE_ACAO_DETALHE =
  "mt-2 inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-900 px-3 text-bone-100 hover:border-gold-600";

/** Título focável + botão fechar — o mesmo cabeçalho para tarefa e para assunto. */
function CabecalhoDoDetalhe({
  titulo,
  tituloId,
  tituloRef,
  onFechar,
}: {
  titulo: string;
  tituloId: string;
  tituloRef: React.RefObject<HTMLParagraphElement>;
  onFechar: () => void;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2">
      <p
        ref={tituloRef}
        id={tituloId}
        tabIndex={-1}
        className="break-words font-semibold text-bone-50 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
      >
        {titulo}
      </p>
      <button
        type="button"
        onClick={onFechar}
        className="min-h-[44px] min-w-[44px] shrink-0 rounded-md border border-navy-700 px-2 text-bone-300 hover:text-bone-50"
      >
        fechar
      </button>
    </div>
  );
}

/**
 * Rodada 7 (achado MÉDIO #7): o painel de detalhe do ASSUNTO (PR).
 *
 * Metade das linhas desta tela são assuntos, e elas não tinham painel nenhum
 * (`kind === "tarefa"` era a única condição que abria). A 390px o nome trunca
 * em `line-clamp-2` e os dois únicos caminhos para o texto inteiro eram o
 * `title` (que não existe no toque) e sair da aplicação para o GitHub. Aqui:
 * nome completo, repositório, período com ano, estado — e o link externo como
 * AÇÃO dentro do painel, não como o único caminho.
 */
export function PainelDetalheAssunto({
  linha,
  onFechar,
  topoSticky = 0,
}: {
  linha: LinhaDoTempoAssuntoRow;
  onFechar: () => void;
  /** Altura da nav sticky + respiro — onde o painel-COLUNA gruda (≥768px). */
  topoSticky?: number;
}): JSX.Element {
  const tituloRef = useRef<HTMLParagraphElement | null>(null);
  const tituloId = `lb-tl-detalhe-assunto-${linha.id}`;
  useEffect(() => {
    tituloRef.current?.focus();
  }, [linha.id]);
  /*
    Rodada 11 (achado MÉDIO 4): as duas frases vinham de um `?:` escrito aqui
    e de outro escrito na barra — a gaveta e o `title` podiam divergir, e o
    `aria-label` não dizia nem uma nem outra. Uma função pura para cada, e as
    três superfícies bebem dela.
  */
  const estado = estadoDoAssunto(linha);
  const periodo = textoDoPeriodoDoAssunto(linha, diaMesAnoCurto);
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      data-lb-detalhe="true"
      style={{ ["--lb-tl-topo-painel" as string]: `${topoSticky}px` } as React.CSSProperties}
      className={CLASSE_PAINEL_DETALHE}
    >
      <CabecalhoDoDetalhe titulo={linha.titulo} tituloId={tituloId} tituloRef={tituloRef} onFechar={onFechar} />
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-bone-300">
        <div className="flex gap-1">
          <dt>Repositório:</dt>
          <dd className="break-all text-bone-100">{linha.repo}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Período:</dt>
          <dd className="text-bone-100">{periodo}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Estado:</dt>
          <dd className="text-bone-100">{estado}</dd>
        </div>
      </dl>
      <a
        href={linha.url}
        target="_blank"
        rel="noreferrer"
        className={CLASSE_ACAO_DETALHE}
      >
        Abrir no GitHub
      </a>
    </div>
  );
}

/**
 * Amostras (achado ALTO #9): crítico · sucessão · folga · conflito · sem
 * data · marco · hoje · atrasada · fechado sem merge · indefinido — texto
 * ≥12px (achado MÉDIO #16). Os 4 últimos entraram na rodada 3 (achados
 * MÉDIO #5 e BAIXO #10): "hoje" e "atrasada" já apareciam na tela sem
 * nenhuma entrada que os decodificasse; "fechado sem merge" (cinza + traço)
 * e "indefinido" (cinza tracejado) usam o MESMO cinza (`bone-500` ==
 * `#6C7A99`) e só se distinguiam por forma — sem a legenda, ninguém sabia
 * que eram conceitos diferentes.
 */
function Legenda({
  aberta,
  onAlternar,
}: {
  aberta: boolean;
  onAlternar: (v: boolean) => void;
}): JSX.Element {
  const ITENS: readonly { chave: string; amostra: JSX.Element; label: string }[] = [
    {
      chave: "critico",
      amostra: <span aria-hidden="true" className="h-2 w-5 rounded-sm bg-aresta-critico" />,
      label: "crítico",
    },
    {
      chave: "sucessao",
      amostra: <span aria-hidden="true" className="h-0.5 w-5 rounded-sm bg-aresta-sucessao" />,
      label: "sucessão",
    },
    {
      chave: "folga",
      amostra: (
        <span
          aria-hidden="true"
          className="h-2 w-5 rounded-sm bg-folga-tracado/30 opacity-70 [background-image:repeating-linear-gradient(45deg,theme(colors.folga.tracado)_0_3px,transparent_3px_6px)]"
        />
      ),
      label: "folga",
    },
    {
      chave: "conflito",
      amostra: (
        <span aria-hidden="true" className="text-sm font-bold text-aresta-critico">
          ✕
        </span>
      ),
      label: "conflito",
    },
    {
      /*
        Rodada 11 (achado MÉDIO 3): a amostra deixou de ser uma BARRA
        tracejada — barra nenhuma se desenha mais para tarefa sem dado. O que
        a tela mostra agora é a etiqueta de texto na coluna de rótulos, e é
        ela que a legenda decodifica.
      */
      chave: "sem-data",
      amostra: (
        <span
          aria-hidden="true"
          className="rounded-full border border-navy-600 px-1 text-[12px] leading-4 text-bone-300"
        >
          sem data
        </span>
      ),
      label: "sem data: fora da grade do tempo",
    },
    {
      chave: "marco",
      amostra: <span aria-hidden="true" className="h-2.5 w-2.5 rotate-45 bg-gold-400" />,
      label: "marco",
    },
    {
      chave: "hoje",
      amostra: <span aria-hidden="true" className="h-2 w-0.5 rounded-sm bg-gold-500" />,
      label: "hoje",
    },
    {
      chave: "atrasada",
      amostra: <span aria-hidden="true" className="h-0.5 w-5 rounded-full border-t-2 border-state-error" />,
      label: "atrasada",
    },
    {
      chave: "fechado-sem-merge",
      amostra: (
        <span aria-hidden="true" className="relative h-2 w-5 rounded-sm bg-bone-500">
          <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-navy-950/70" />
        </span>
      ),
      label: "fechado sem merge",
    },
    {
      chave: "indefinido",
      amostra: <span aria-hidden="true" className="h-0.5 w-5 rounded-sm border-t-2 border-dashed border-bone-500" />,
      label: "data indefinida",
    },
    {
      // Achado MÉDIO #4 (rodada 4): o glifo mais repetido na tela ("◀", 6
      // ocorrências no fixture do crítico) não tinha entrada — a legenda
      // decodifica "fora da janela", mas nunca o próprio símbolo dela.
      chave: "fora-da-janela",
      amostra: (
        <span aria-hidden="true" className="text-[12px] font-semibold text-bone-300">
          ◀ ▶
        </span>
      ),
      label: "fora da janela",
    },
    {
      // Achado MÉDIO A8 (rodada 5): o marcador de prazo saiu do "◀" (que só
      // quer dizer "fora da janela") e ganhou glifo e entrada próprios — o
      // mesmo símbolo com dois sentidos era indistinguível na tela.
      chave: "prazo-fora-da-barra",
      amostra: (
        <span aria-hidden="true" className="text-[12px] font-semibold text-state-error">
          ⚑
        </span>
      ),
      label: "prazo antes do início ou depois do fim",
    },
  ];
  // Achado BAIXO #12 (rodada 2): a legenda inteira era `aria-hidden`, o que
  // apagava os RÓTULOS de texto para leitor de tela (não só as amostras
  // decorativas, que já levavam seu próprio `aria-hidden` individual — esse
  // continua). Removido do contêiner; `role="list"` deixa a estrutura clara.
  /*
    Rodada 7 (achado BAIXO #10): 13 itens de legenda custavam várias linhas do
    cabeçalho a 390px — parte dos 494px que empurravam a primeira linha do
    Gantt para fora da tela. Vira `<details>`: fechado no celular, aberto
    sozinho a partir de 768px (o pai decide, por `matchMedia`, DEPOIS do mount
    — o 1º render é igual no servidor e no cliente). O `<summary>` tem 44px de
    alvo de toque, como os outros controles.
  */
  return (
    <details
      open={aberta}
      onToggle={(e) => onAlternar((e.currentTarget as HTMLDetailsElement).open)}
      className="lb-tl-legenda mt-3"
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-[12px] text-bone-300 marker:content-none">
        Legenda ({ITENS.length} símbolos)
      </summary>
      <div
        role="list"
        aria-label="Legenda de símbolos da linha do tempo"
        className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-[12px] text-bone-400"
      >
        {ITENS.map((item) => (
          <span key={item.chave} role="listitem" className="inline-flex items-center gap-1.5">
            {item.amostra}
            {item.label}
          </span>
        ))}
      </div>
    </details>
  );
}
