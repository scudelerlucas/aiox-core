"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ARESTA_STROKE,
  ARESTA_STROKE_CRITICO,
  ARESTA_STROKE_DESTACADA,
} from "@/components/graph/aresta-svg";
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
 * P5c (achado ALTO #4, rodada 2): 24px/dia é o ALVO do "auto" (a densidade
 * confortável quando a janela cabe), NUNCA o piso — o piso de verdade é
 * `PX_POR_DIA_AUTO_PISO`. Antes `Math.max(24, largura/dias)` fazia o 24
 * SEMPRE vencer em janelas largas (>~41 dias a 1280px), forçando overflow
 * horizontal que "auto" deveria evitar encolhendo a densidade.
 */
const PX_POR_DIA_AUTO_ALVO = 24;
/** Piso de verdade do "auto" — nunca encolhe além disto, mesmo com o horizonte inteiro. */
const PX_POR_DIA_AUTO_PISO = 6;
/** Janela mínima do "auto" quando não há tarefa nenhuma: hoje − 7 d → hoje + 14 d. */
const AUTO_MARGEM_PASSADO_DIAS = 7;
const AUTO_MARGEM_FUTURO_DIAS = 14;
/** Mesma margem de respiro que os zooms fixos dão (`minIsoDados`/`maxIsoDados`) — achado MÉDIO #8. */
const AUTO_MARGEM_RESPIRO_PASSADO_DIAS = 2;
const AUTO_MARGEM_RESPIRO_FUTURO_DIAS = 3;
/** Piso visual de uma barra de tarefa — achado BAIXO #11 (sub-dia vira barra curta, nunca diamante nem 4px cru). */
const LARGURA_MINIMA_BARRA = 12;
/** Nenhum tick de data pode ficar mais longe que isto do vizinho — achado CRÍTICO #1, rodada 2. */
const LIMIAR_TICK_PX = 160;
/**
 * P5d (achado MÉDIO #4, rodada 3): nenhum rótulo de data pode ficar a menos
 * de 40px do vizinho — antes, o preenchimento da rede de segurança acima
 * (`LIMIAR_TICK_PX`) podia cair perto o bastante de um tick NATURAL para os
 * textos se sobreporem visualmente ("jul" + "ago" virando "juago").
 */
const MINIMO_DIST_ROTULO_PX = 40;
/** Namespaced — mesma disciplina de qualquer outra chave de `localStorage` da casa. */
const CHAVE_ZOOM = "lifeboard:linha-do-tempo:zoom";

const ROW_H = 34;
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
/** Teto de dias na escala — rede de segurança contra datas podres/distantes. */
const TETO_DIAS_ESCALA = 420;
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
const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];
function mesCurto(iso: string): string {
  return MESES_PT[new Date(paraEpoch(iso)).getUTCMonth()] ?? "";
}

interface Tick {
  x: number;
  label: string;
  forte: boolean;
}

/**
 * P5c (achado CRÍTICO #1 do crítico hostil, rodada 2): a escala de ticks era
 * escolhida pelo NOME do zoom (`zoom === "semana" | "mes"`) — "auto" não batia
 * em nenhum dos dois nomes e caía no `else` (só início de mês), e num
 * horizonte de poucas semanas isso é ZERO ticks. A régua agora é a DENSIDADE
 * real (`pxPorDia`), não o nome: ≥24px/dia → rótulo por DIA; 8–24 → um rótulo
 * por SEMANA (dd/MM); <8 → rótulo por MÊS. Os 3 zooms fixos continuam caindo
 * nas mesmas faixas de antes (semana=46→dia, mes=16→semana, trimestre=6→mês) —
 * "auto" ganha a MESMA régua, nunca uma quarta regra à parte.
 *
 * Rede de segurança (mesmo achado): nenhum vão entre ticks pode passar de
 * `LIMIAR_TICK_PX` — sem isso, um horizonte que não cruza nenhum início de
 * mês (ex.: "auto" de 21 dias todo dentro do mesmo mês, na faixa <8px/dia)
 * ficaria com ZERO rótulos. Preenche o vão com ticks extras no mesmo formato.
 */
function gerarEscala(
  minIso: string,
  maxIso: string,
  pxPorDia: number,
): { guiasSemana: number[]; ticks: Tick[]; ticksMes: Tick[]; faixa: "dia" | "semana" | "mes" } {
  const totalDias = Math.min(TETO_DIAS_ESCALA, Math.max(1, diffDias(minIso, maxIso)));
  const faixa: "dia" | "semana" | "mes" = pxPorDia >= 24 ? "dia" : pxPorDia >= 8 ? "semana" : "mes";
  const guiasSemana: number[] = [];
  const porX = new Map<number, Tick>();
  const porXMes = new Map<number, Tick>();
  for (let d = 0; d <= totalDias; d += 1) {
    const iso = somaDiasIso(minIso, d);
    const data = new Date(paraEpoch(iso));
    const ehSegunda = data.getUTCDay() === 1;
    const ehInicioMes = data.getUTCDate() === 1;
    const x = d * pxPorDia;
    if (ehSegunda) guiasSemana.push(x);
    if (faixa === "dia") {
      porX.set(x, { x, label: String(data.getUTCDate()), forte: ehSegunda });
    } else if (faixa === "semana") {
      if (ehSegunda) porX.set(x, { x, label: diaMesCurto(iso), forte: ehInicioMes });
    } else if (ehInicioMes) {
      porX.set(x, { x, label: mesCurto(iso), forte: true });
    }
    // P5d (achado MÉDIO #5, rodada 3): faixa de MESES — só existe (o chamador
    // só a renderiza) na densidade "dia", onde os rótulos abaixo são números
    // soltos sem nenhum contexto de mês. Um rótulo por início de mês, mais um
    // no 1º dia visível (mesmo que não seja dia 1) — nunca começa "no vazio".
    if (faixa === "dia" && (ehInicioMes || d === 0)) {
      const xMes = ehInicioMes ? x : 0;
      porXMes.set(xMes, { x: xMes, label: mesCurto(iso), forte: true });
    }
  }

  // Rede de segurança: pelo menos 1 rótulo por ~160px, mesmo quando a faixa
  // natural (semana/mês) não cruza nenhum marco dentro da janela visível.
  // P5d (achado MÉDIO #4, rodada 3): o rótulo de PREENCHIMENTO é SEMPRE
  // `dd/MM` — nunca nome de mês (`mesCurto`). Um "ago" de preenchimento do
  // lado de um "ago" natural virava "juago" ilegível (dois rótulos de MÊS
  // colados, cada um só um dígito visualmente distinguível do outro).
  const largoDemais = pxPorDia * 1 <= 0 ? 1 : Math.max(1, Math.floor(LIMIAR_TICK_PX / pxPorDia));
  const xsOrdenados = [...porX.keys()].sort((a, b) => a - b);
  const fronteiras = [0, ...xsOrdenados, totalDias * pxPorDia];
  for (let i = 0; i < fronteiras.length - 1; i += 1) {
    const inicio = fronteiras[i]!;
    const fim = fronteiras[i + 1]!;
    if (fim - inicio <= LIMIAR_TICK_PX) continue;
    for (let x = inicio + largoDemais * pxPorDia; x < fim; x += largoDemais * pxPorDia) {
      if (porX.has(x)) continue;
      const d = Math.round(x / pxPorDia);
      const iso = somaDiasIso(minIso, d);
      porX.set(x, { x, label: diaMesCurto(iso), forte: false });
    }
  }

  // P5d (achado MÉDIO #4, rodada 3): rede de segurança FINAL — nenhum rótulo
  // pode ficar a menos de `MINIMO_DIST_ROTULO_PX` do vizinho já escolhido,
  // mesmo vindo de fontes diferentes (natural × preenchimento). Em colisão, o
  // "forte" (início de mês/semana) vence; em empate, o mais à esquerda fica.
  const todosOrdenados = [...porX.values()].sort((a, b) => a.x - b.x);
  const ticks: Tick[] = [];
  for (const t of todosOrdenados) {
    const anterior = ticks[ticks.length - 1];
    if (anterior && t.x - anterior.x < MINIMO_DIST_ROTULO_PX) {
      if (t.forte && !anterior.forte) ticks[ticks.length - 1] = t;
      continue;
    }
    ticks.push(t);
  }

  const ticksMes = [...porXMes.values()].sort((a, b) => a.x - b.x);
  return { guiasSemana, ticks, ticksMes, faixa };
}

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
} {
  if (row.estado === "mergeado") return { barra: "bg-state-done", texto: "text-state-done", riscado: false };
  if (row.estado === "fechado") return { barra: "bg-bone-500", texto: "text-bone-400", riscado: true };
  return { barra: "bg-state-open", texto: "text-state-open", riscado: false }; // aberto
}

export function LinhaDoTempoView(props: LinhaDoTempoProps): JSX.Element {
  // "auto" é o default quando nada foi salvo (achado CRÍTICO #3) — persiste a
  // escolha do operador do jeito que já era feito para os zooms fixos.
  const [zoom, setZoom] = useState<Zoom>(() => lerZoomSalvo() ?? "auto");
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const painelRef = useRef<HTMLDivElement | null>(null);
  const [larguraPainel, setLarguraPainel] = useState(0);
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
  const sincronizarHeaderComPainel = (scrollLeft: number): void => {
    const el = headerTicksRef.current;
    if (el) el.style.transform = `translateX(${-scrollLeft}px)`;
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
      if (e.key === "Escape") setAtivoId(null);
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
  // horizonte não cabe no painel a essa densidade, "auto" agora ENCOLHE
  // (nunca abaixo de `PX_POR_DIA_AUTO_PISO`) em vez de forçar overflow
  // horizontal fingindo que ainda é "auto".
  const pxPorDiaAuto = useMemo(() => {
    const totalDiasAuto = Math.max(1, diffDias(minIsoAuto, maxIsoAuto));
    if (larguraPainel <= 0) return PX_POR_DIA_AUTO_FALLBACK;
    const ideal = larguraPainel / totalDiasAuto;
    return Math.min(PX_POR_DIA_AUTO_ALVO, Math.max(PX_POR_DIA_AUTO_PISO, ideal));
  }, [minIsoAuto, maxIsoAuto, larguraPainel]);

  const pxPorDia = zoom === "auto" ? pxPorDiaAuto : PX_POR_DIA_FIXO[zoom];
  const { guiasSemana, ticks, ticksMes, faixa } = useMemo(
    () => gerarEscala(minIso, maxIso, pxPorDia),
    [minIso, maxIso, pxPorDia],
  );
  /** P5d (achado MÉDIO #5, rodada 3): 2ª faixa (nome do mês) só na densidade "dia". */
  const mostrarLinhaMeses = faixa === "dia";
  const alturaHeaderTotal = HEADER_H + (mostrarLinhaMeses ? HEADER_MES_H : 0);
  const totalDias = Math.min(TETO_DIAS_ESCALA, Math.max(1, diffDias(minIso, maxIso)));
  const totalWidth = totalDias * pxPorDia;
  const alturaLinhas = linhas.length * ROW_H;
  const xHoje = diffDias(minIso, props.hoje) * pxPorDia;

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
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

  useEffect(() => {
    const el = painelRef.current;
    if (!el) return;
    const largura = el.clientWidth || larguraPainel;
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
    el.scrollLeft = novoScrollLeft;
    sincronizarHeaderComPainel(novoScrollLeft);
    // `pxPorDia` muda em toda troca de zoom (inclusive "auto" recalculando)
    // — reancorar em "hoje" sempre que a escala muda é o que resolve o
    // "Semana" esvaziando a tela (achado CRÍTICO #2: a âncora era perdida).
  }, [xHoje, pxPorDia, larguraPainel, xFimAlvo]);

  /**
   * P5d (achado ALTO #2, rodada 3): quantos ASSUNTOS começam antes da janela
   * vigente — só interessa em "auto" (os zooms fixos já mostram o histórico
   * inteiro por construção, `minIsoDados`). Alimenta o aviso sob o seletor de
   * zoom; cada assunto em si já ganha o chevron "◀ fora da janela" (com as
   * datas reais no `title`) em vez de ser cortado em silêncio.
   */
  const assuntosForaDaJanela = (() => {
    let n = 0;
    for (const l of linhas) {
      if (l.tipo !== "linha" || l.linha.kind !== "assunto") continue;
      if (l.linha.dataInvalida || l.linha.datasInconsistentes) continue;
      if (foraDaJanela(l.linha.inicio)) n += 1;
    }
    return n;
  })();

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

  const linhaAtiva = useMemo(
    () =>
      linhas.find(
        (l): l is LinhaExibicaoDado & { linha: LinhaDoTempoTarefaRow } =>
          l.tipo === "linha" && l.linha.kind === "tarefa" && l.linha.id === ativoId,
      )?.linha ?? null,
    [linhas, ativoId],
  );
  const predecessorasAtivas = new Set(linhaAtiva?.predecessores ?? []);
  const sucessorasAtivas = new Set(linhaAtiva?.sucessores ?? []);

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
        ativoId === destino.id ? "predecessor" : ativoId === origem.id ? "sucessor" : null;
      const x1 = xFor(origem.fim);
      const x2 = xFor(destino.inicio);
      const forasDeOrdem = x2 < x1;
      const datasConfiaveis = temDataReal(origem) && temDataReal(destino);
      conectores.push({
        chave: `${origem.id}->${destino.id}`,
        origemId: origem.id,
        destinoId: destino.id,
        x1,
        y1: j * ROW_H + ROW_H / 2,
        x2,
        y2: i * ROW_H + ROW_H / 2,
        critico: origem.critico && destino.critico,
        destacado,
        conflito: forasDeOrdem && datasConfiaveis,
        indefinido: forasDeOrdem && !datasConfiaveis,
      });
    }
  });

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
            Linha do tempo
          </h1>
          <p className="mt-1 text-sm text-bone-300">
            Progressão dos assuntos e das tarefas — predecessores em{" "}
            <span className="text-aresta-predecessor">amarelo</span>, sucessores em{" "}
            <span className="text-aresta-sucessao">verde</span>, caminho crítico em{" "}
            <span className="text-aresta-critico">vermelho triplo</span>.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
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
                onClick={() => mudarZoom(op.id)}
                className={
                  zoom === op.id
                    ? "min-h-[36px] border-l border-navy-700 bg-navy-850 px-3 text-xs font-semibold text-gold-300 first:border-l-0"
                    : "min-h-[36px] border-l border-navy-700 bg-navy-900 px-3 text-xs text-bone-300 first:border-l-0 hover:text-bone-100"
                }
              >
                {op.label}
              </button>
            ))}
          </div>
          {/*
            Achado ALTO #2 (rodada 3): "auto" recorta a janela pelo horizonte
            das TAREFAS — nunca clampa um assunto mais antigo em silêncio (ele
            ganha o chevron "◀ fora da janela"), mas o aviso aqui diz QUANTOS
            e para onde ir para ver o histórico inteiro.
          */}
          {zoom === "auto" && assuntosForaDaJanela > 0 ? (
            <p role="note" className="max-w-[280px] text-right text-[12px] text-bone-400">
              {assuntosForaDaJanela} assunto{assuntosForaDaJanela > 1 ? "s" : ""} começa
              {assuntosForaDaJanela > 1 ? "m" : ""} antes da janela — Mês/Trimestre mostra o
              histórico
            </p>
          ) : null}
        </div>
      </div>

      <Legenda />

      {!linhas.some((l) => l.tipo === "linha") ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-navy-700 bg-navy-850 px-4 py-3 text-sm text-bone-300"
        >
          Nada para mostrar na linha do tempo ainda.
        </div>
      ) : (
        <div className="mt-6 flex w-full flex-col">
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
            <div className="w-[108px] shrink-0 border-b border-r border-navy-700 bg-navy-900 sm:w-[240px]" />
            {/* Célula do cabeçalho da escala — clip (nunca scroll próprio) + conteúdo deslocado por `transform` para acompanhar o `scrollLeft` do painel. */}
            <div className="relative min-w-0 flex-1 overflow-hidden border-b border-navy-700 bg-navy-900">
              <div
                ref={headerTicksRef}
                style={{ width: totalWidth, height: alturaHeaderTotal }}
                className="relative"
              >
                {/*
                  Achado MÉDIO #5 (rodada 3): faixa do MÊS — só na densidade
                  "dia" (≥24px/dia), onde a faixa de baixo é só números soltos
                  ("13", "14"…) sem nenhum contexto de mês.
                */}
                {mostrarLinhaMeses ? (
                  <div
                    className="absolute inset-x-0 top-0 border-b border-navy-800"
                    style={{ height: HEADER_MES_H }}
                  >
                    {ticksMes.map((t) => (
                      <div
                        key={`mes-${t.x}`}
                        className="absolute top-0 flex h-full items-center border-l border-navy-700 pl-1 text-[12px] font-semibold text-bone-300"
                        style={{ left: t.x }}
                      >
                        {t.label}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div
                  className="absolute inset-x-0"
                  style={{ top: mostrarLinhaMeses ? HEADER_MES_H : 0, height: HEADER_H }}
                >
                  {ticks.map((t) => (
                    <div
                      key={t.x}
                      className={
                        t.forte
                          ? "absolute top-0 flex h-full items-center border-l border-navy-600 pl-1 text-[12px] font-semibold text-bone-200"
                          : "absolute top-0 flex h-full items-center border-l border-navy-800 pl-1 text-[12px] text-bone-400"
                      }
                      style={{ left: t.x }}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
                <div
                  data-timeline-hoje="true"
                  className="lb-tl-hoje absolute top-0 h-full border-l-2 border-gold-500"
                  style={{ left: xHoje }}
                  title="Hoje"
                >
                  {/* Achado MÉDIO #5 (rodada 3): a linha de "hoje" ganha uma data legível, não só a cor. */}
                  <span className="absolute left-1 top-0 whitespace-nowrap rounded-sm bg-navy-900/80 px-0.5 text-[12px] font-semibold text-gold-300">
                    {diaMesCurto(props.hoje)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full items-stretch">
            {/* Coluna de rótulos — fora do scroll horizontal, encolhe no celular. */}
            <div className="w-[108px] shrink-0 border-r border-navy-700 sm:w-[240px]">
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
                    ativo={ativoId === l.linha.id}
                    destacadoPredecessora={l.linha.kind === "tarefa" && predecessorasAtivas.has(l.linha.id)}
                    destacadoSucessora={l.linha.kind === "tarefa" && sucessorasAtivas.has(l.linha.id)}
                    tituloPorTarefaId={tituloPorTarefaId}
                    onAtivar={l.linha.kind === "tarefa" ? () => setAtivoId((a) => (a === l.linha.id ? null : l.linha.id)) : undefined}
                  />
                ),
              )}
            </div>

            {/* Painel da escala — SÓ ele rola na horizontal (o corpo da página nunca rola de lado); o cabeçalho vive fora e se sincroniza por `onScroll`. */}
            <div
              ref={painelRef}
              className="min-w-0 flex-1 overflow-x-auto"
              onScroll={(e) => sincronizarHeaderComPainel(e.currentTarget.scrollLeft)}
            >
              <div style={{ width: totalWidth }} className="relative">
              <div style={{ height: alturaLinhas }} className="relative bg-navy-950">
                {guiasSemana.map((x) => (
                  <div
                    key={x}
                    aria-hidden="true"
                    className="absolute top-0 h-full border-l border-navy-800/70"
                    style={{ left: x }}
                  />
                ))}
                <div
                  aria-hidden="true"
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
                        xFor={xFor}
                        foraDaJanela={foraDaJanela}
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
                      larguraErro={larguraErroMax}
                      ativo={ativoId === l.linha.id}
                      predecessora={predecessorasAtivas.has(l.linha.id)}
                      sucessora={sucessorasAtivas.has(l.linha.id)}
                      onAtivar={() => setAtivoId((a) => (a === l.linha.id ? null : l.linha.id))}
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
        </div>
        </div>
      )}
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
  onAtivar,
}: {
  linha: LinhaDoTempoRow;
  ativo: boolean;
  destacadoPredecessora: boolean;
  destacadoSucessora: boolean;
  tituloPorTarefaId: ReadonlyMap<string, string>;
  onAtivar?: () => void;
}): JSX.Element {
  const classeBase =
    "flex h-[34px] items-center gap-1 border-b border-navy-800 bg-navy-850 px-2 text-xs";
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
      <a
        href={linha.url}
        target="_blank"
        rel="noreferrer"
        className={`${classeBase} truncate text-bone-200 hover:text-bone-50`}
        title={`${linha.titulo} — ${linha.repo}`}
      >
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${cor.barra}`} />
        <span className={`truncate ${cor.riscado ? "text-bone-500 line-through" : ""}`}>
          {linha.titulo}
        </span>
      </a>
    );
  }

  // Achado ALTO #11: predecessores/sucessores por NOME no aria-label da linha
  // — o único lugar em que essa relação chegava a um leitor de tela antes era
  // a forma/cor do conector, que o `aria-hidden` do SVG tornava mudo.
  const ariaPreds = listaDeNomes(linha.predecessores, tituloPorTarefaId);
  const ariaSucs = listaDeNomes(linha.sucessores, tituloPorTarefaId);
  const ariaExtra = [
    linha.semDuracao ? "sem data" : null,
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
      onClick={onAtivar}
      aria-pressed={ativo}
      aria-label={ariaLabel}
      title={`${linha.titulo}${linha.semDuracao ? " — estimativa faltando" : ""}`}
      className={`${classeBase} ${anelClasse} w-full text-left text-bone-200 hover:text-bone-50`}
    >
      <span className="truncate">{linha.titulo}</span>
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
  larguraErro,
}: {
  row: LinhaDoTempoAssuntoRow;
  top: number;
  xFor: (iso: string) => number;
  foraDaJanela: (iso: string) => boolean;
  larguraErro: number | undefined;
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
  if (foraDaJanela(row.inicio)) {
    return (
      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        tabIndex={-1}
        aria-hidden="true"
        className={`lb-tl-fora-da-janela absolute flex items-center text-[12px] font-semibold ${cor.texto}`}
        style={{ left: 0, top, height: BAR_H }}
        title={`${row.titulo} — ${diaMesCurto(row.inicio)} → ${row.aberto ? "em aberto" : diaMesCurto(row.fim)} (fora da janela)`}
      >
        ◀
      </a>
    );
  }

  // Achado ALTO #8: PR do mesmo dia (`inicio === fim`) — losango, nunca a
  // barra de 4px que fingia duração.
  if (row.marco) {
    return (
      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        tabIndex={-1}
        aria-hidden="true"
        className={`lb-tl-marco absolute rotate-45 ${cor.barra}`}
        style={{ left: x - 5, top: top + (BAR_H - 10) / 2, width: 10, height: 10 }}
        title={`${row.titulo} — ${diaMesCurto(row.inicio)} (mesmo dia)`}
      />
    );
  }

  const largura = Math.max(4, xFor(row.fim) - x);
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer"
      tabIndex={-1}
      aria-hidden="true"
      className={`absolute rounded-sm ${cor.barra} opacity-90 hover:opacity-100`}
      style={{ left: x, top, width: largura, height: BAR_H }}
      title={`${row.titulo} — ${diaMesCurto(row.inicio)} → ${row.aberto ? "em aberto" : diaMesCurto(row.fim)}`}
    >
      {cor.riscado ? (
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-navy-950/70" />
      ) : null}
    </a>
  );
}

function BarraTarefa({
  row,
  top,
  xFor,
  foraDaJanela,
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
    if (foraDaJanela(row.pontoConcluidoEm)) {
      return (
        <div
          tabIndex={-1}
          aria-hidden="true"
          onClick={onAtivar}
          className="lb-tl-fora-da-janela absolute flex cursor-pointer items-center text-[12px] font-semibold text-state-done"
          style={{ left: 0, top, height: BAR_H }}
          title={`${row.titulo} — concluída em ${diaMesCurto(row.pontoConcluidoEm)} (fora da janela)`}
        >
          ◀
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
        title={`${row.titulo} — concluída em ${diaMesCurto(row.pontoConcluidoEm)}`}
      />
    );
  }

  // Achados ALTO #2/#7 (rodada 3): tarefa cujo início cai antes da janela
  // vigente — nunca mais um coto grudado em `x=0` sem nenhum aviso. Chevron
  // na borda esquerda, com as datas reais no `title`.
  if (foraDaJanela(row.inicio)) {
    return (
      <div
        tabIndex={-1}
        aria-hidden="true"
        onClick={onAtivar}
        className={`lb-tl-fora-da-janela absolute flex cursor-pointer items-center text-[12px] font-semibold ${row.critico ? "text-aresta-critico" : "text-bone-300"}`}
        style={{ left: 0, top, height: BAR_H }}
        title={`${row.titulo} — ${diaMesCurto(row.inicio)} → ${diaMesCurto(row.fim)} (fora da janela)`}
      >
        ◀
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
        title={`${row.titulo} — marco em ${diaMesCurto(row.inicio)}`}
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
  const classesEstado =
    row.semDuracao && !row.critico ? "border-2 border-dashed border-bone-400 bg-transparent" : preenchimento;
  const rotuloLateral = row.atrasada ? "atrasada" : row.semDuracao ? "sem data" : null;
  // Achado MÉDIO #7 (rodada 2): o rótulo lateral ficava em `left-full` (== o
  // início da hachura de folga) e a hachura o cobria. Quando há folga
  // desenhada, o rótulo vai depois DELA; senão, logo após a barra (como antes).
  const offsetRotulo = larguraFolga > 0 ? largura + larguraFolga : largura;

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

  // Achado MÉDIO #5 (rodada 3): título com datas legíveis (dd/MM), não só a
  // folga em dias. Achado MÉDIO #6: `folga: null` (fora do CPM) nunca lê como
  // "0 d" (que se confundia com "tão crítica quanto o caminho do goal") — o
  // tooltip diz explicitamente que não foi calculada.
  const folgaTexto = row.folga === null ? "folga não calculada" : `folga: ${row.folga} d`;
  const tituloBarra =
    `${row.titulo} — ${diaMesCurto(row.inicio)} → ${diaMesCurto(row.fim)} (${folgaTexto})` +
    (rotuloLateral ? ` — ${rotuloLateral}` : "");

  return (
    <div
      tabIndex={-1}
      aria-hidden="true"
      onClick={onAtivar}
      className={`absolute cursor-pointer rounded-sm ${classesEstado} ${anel} ${row.critico ? "lb-tl-bar-critico" : ""}`}
      style={{ left: x, top, width: largura, height: BAR_H }}
      title={tituloBarra}
    >
      {row.critico ? <TracoTriploCritico largura={largura} /> : null}
      {/* Achado ALTO #5 (rodada 2): marcador ADITIVO de atraso — nunca troca
          `classesEstado`, então uma barra crítica E atrasada continua com o
          preenchimento/traço triplo do crítico, só ganha esta borda extra. */}
      {row.atrasada ? (
        <span
          aria-hidden="true"
          className="lb-tl-atrasada-marcador absolute inset-x-0 -top-1 h-0.5 rounded-full border-t-2 border-state-error"
        />
      ) : null}
      {rotuloLateral ? (
        <span
          className="absolute top-0 ml-1 whitespace-nowrap text-[12px] leading-4 text-bone-300"
          style={{ left: offsetRotulo }}
        >
          {rotuloLateral}
        </span>
      ) : null}
      {row.atrasada && row.dueDate && dueDentroDaBarra ? (
        <div
          aria-hidden="true"
          className="lb-tl-atraso absolute -top-1 w-0.5 bg-state-error"
          style={{ left: dueXRelativo!, height: BAR_H + 2 }}
          title={`prazo ${diaMesCurto(row.dueDate)}`}
        />
      ) : null}
      {row.atrasada && row.dueDate && !dueDentroDaBarra ? (
        <div
          aria-hidden="true"
          className="lb-tl-atraso-seta absolute top-0 text-[12px] leading-4 text-state-error"
          style={{ left: dueXRelativo! < 0 ? -8 : largura }}
          title={`prazo ${diaMesCurto(row.dueDate)}`}
        >
          {dueXRelativo! < 0 ? "◀" : "▶"}
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

  return (
    <g
      className="lb-tl-connector"
      data-critico={c.critico}
      data-conflito={c.conflito}
      data-indefinido={c.indefinido}
      {...(c.conflito
        ? { role: "img", "aria-label": `conflito de datas: ${destinoTitulo} começa antes de ${origemTitulo} terminar` }
        : c.indefinido
          ? { role: "img", "aria-label": "data indefinida" }
          : { "aria-hidden": true })}
    >
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
function Legenda(): JSX.Element {
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
      chave: "sem-data",
      amostra: <span aria-hidden="true" className="h-2 w-5 rounded-sm border-2 border-dashed border-bone-400" />,
      label: "sem data",
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
  ];
  // Achado BAIXO #12 (rodada 2): a legenda inteira era `aria-hidden`, o que
  // apagava os RÓTULOS de texto para leitor de tela (não só as amostras
  // decorativas, que já levavam seu próprio `aria-hidden` individual — esse
  // continua). Removido do contêiner; `role="list"` deixa a estrutura clara.
  return (
    <div
      role="list"
      aria-label="Legenda de símbolos da linha do tempo"
      className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-bone-400"
    >
      {ITENS.map((item) => (
        <span key={item.chave} role="listitem" className="inline-flex items-center gap-1.5">
          {item.amostra}
          {item.label}
        </span>
      ))}
    </div>
  );
}
