"use client";
import { useMemo, useState } from "react";

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

type Zoom = "semana" | "mes" | "trimestre";

const ZOOM_OPCOES: readonly { id: Zoom; label: string }[] = [
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "trimestre", label: "Trimestre" },
];
const PX_POR_DIA: Record<Zoom, number> = { semana: 46, mes: 16, trimestre: 6 };
/** Namespaced — mesma disciplina de qualquer outra chave de `localStorage` da casa. */
const CHAVE_ZOOM = "lifeboard:linha-do-tempo:zoom";

const ROW_H = 34;
const BAR_H = 16;
const HEADER_H = 40;
const MS_POR_DIA = 86_400_000;
/** Teto de dias na escala — rede de segurança contra datas podres/distantes. */
const TETO_DIAS_ESCALA = 420;

function ehZoomValido(v: unknown): v is Zoom {
  return v === "semana" || v === "mes" || v === "trimestre";
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

/** Escala de dias → posições de tick, sempre com guias de SEMANA (segunda-feira). */
function gerarEscala(
  minIso: string,
  maxIso: string,
  zoom: Zoom,
  pxPorDia: number,
): { guiasSemana: number[]; ticks: Tick[] } {
  const totalDias = Math.min(TETO_DIAS_ESCALA, Math.max(1, diffDias(minIso, maxIso)));
  const guiasSemana: number[] = [];
  const ticks: Tick[] = [];
  for (let d = 0; d <= totalDias; d += 1) {
    const iso = somaDiasIso(minIso, d);
    const data = new Date(paraEpoch(iso));
    const ehSegunda = data.getUTCDay() === 1;
    const ehInicioMes = data.getUTCDate() === 1;
    const x = d * pxPorDia;
    if (ehSegunda) guiasSemana.push(x);
    if (zoom === "semana") {
      ticks.push({ x, label: String(data.getUTCDate()), forte: ehSegunda });
    } else if (zoom === "mes") {
      if (ehSegunda) ticks.push({ x, label: diaMesCurto(iso), forte: ehInicioMes });
    } else if (ehInicioMes) {
      ticks.push({ x, label: mesCurto(iso), forte: true });
    }
  }
  return { guiasSemana, ticks };
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

function corDoAssunto(row: LinhaDoTempoAssuntoRow): { barra: string; texto: string } {
  if (row.estado === "mergeado") return { barra: "bg-state-done", texto: "text-state-done" };
  if (row.estado === "fechado") return { barra: "bg-state-error", texto: "text-state-error-fg" };
  return { barra: "bg-state-open", texto: "text-state-open" }; // aberto
}

export function LinhaDoTempoView(props: LinhaDoTempoProps): JSX.Element {
  const [zoom, setZoom] = useState<Zoom>(() => lerZoomSalvo() ?? "mes");
  const [ativoId, setAtivoId] = useState<string | null>(null);

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

  const { minIso, maxIso } = useMemo(() => {
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

  const pxPorDia = PX_POR_DIA[zoom];
  const { guiasSemana, ticks } = useMemo(
    () => gerarEscala(minIso, maxIso, zoom, pxPorDia),
    [minIso, maxIso, zoom, pxPorDia],
  );
  const totalDias = Math.min(TETO_DIAS_ESCALA, Math.max(1, diffDias(minIso, maxIso)));
  const totalWidth = totalDias * pxPorDia;
  const alturaLinhas = linhas.length * ROW_H;
  const xHoje = diffDias(minIso, props.hoje) * pxPorDia;

  const xFor = (iso: string): number => diffDias(minIso, iso) * pxPorDia;

  const indicePorTarefaId = useMemo(() => {
    const m = new Map<string, number>();
    linhas.forEach((l, i) => {
      if (l.tipo === "linha" && l.linha.kind === "tarefa") m.set(l.linha.id, i);
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
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    critico: boolean;
    destacado: "predecessor" | "sucessor" | null;
  }
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
      conectores.push({
        chave: `${origem.id}->${destino.id}`,
        x1: xFor(origem.fim),
        y1: j * ROW_H + ROW_H / 2,
        x2: xFor(destino.inicio),
        y2: i * ROW_H + ROW_H / 2,
        critico: origem.critico && destino.critico,
        destacado,
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
      </div>

      {!linhas.some((l) => l.tipo === "linha") ? (
        <div
          role="status"
          className="mt-6 rounded-lg border border-navy-700 bg-navy-850 px-4 py-3 text-sm text-bone-300"
        >
          Nada para mostrar na linha do tempo ainda.
        </div>
      ) : (
        <div className="mt-6 flex w-full items-stretch">
          {/* Coluna de rótulos — fora do scroll horizontal, encolhe no celular. */}
          <div className="w-[108px] shrink-0 border-r border-navy-700 sm:w-[240px]">
            <div style={{ height: HEADER_H }} className="border-b border-navy-700 bg-navy-900" />
            {linhas.map((l) =>
              l.tipo === "cabecalho" ? (
                <div
                  key={l.chave}
                  style={{ height: ROW_H }}
                  className="flex items-center bg-navy-900 px-2 text-[11px] font-semibold uppercase tracking-wide text-bone-300"
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
                  onAtivar={l.linha.kind === "tarefa" ? () => setAtivoId((a) => (a === l.linha.id ? null : l.linha.id)) : undefined}
                />
              ),
            )}
          </div>

          {/* Painel da escala — SÓ ele rola na horizontal (o corpo da página nunca rola de lado). */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div style={{ width: totalWidth }} className="relative">
              <div
                style={{ height: HEADER_H }}
                className="relative border-b border-navy-700 bg-navy-900"
              >
                {ticks.map((t) => (
                  <div
                    key={t.x}
                    className={
                      t.forte
                        ? "absolute top-0 flex h-full items-center border-l border-navy-600 pl-1 text-[11px] font-semibold text-bone-200"
                        : "absolute top-0 flex h-full items-center border-l border-navy-800 pl-1 text-[10px] text-bone-400"
                    }
                    style={{ left: t.x }}
                  >
                    {t.label}
                  </div>
                ))}
                <div
                  data-timeline-hoje="true"
                  className="lb-tl-hoje absolute top-0 h-full border-l-2 border-gold-500"
                  style={{ left: xHoje }}
                  title="Hoje"
                />
              </div>

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
                      />
                    );
                  }
                  return (
                    <BarraTarefa
                      key={l.chave}
                      row={l.linha}
                      top={top}
                      xFor={xFor}
                      ativo={ativoId === l.linha.id}
                      predecessora={predecessorasAtivas.has(l.linha.id)}
                      sucessora={sucessorasAtivas.has(l.linha.id)}
                      onAtivar={() => setAtivoId((a) => (a === l.linha.id ? null : l.linha.id))}
                    />
                  );
                })}

                <svg
                  className="pointer-events-none absolute inset-0"
                  width={totalWidth}
                  height={alturaLinhas}
                  aria-hidden="true"
                >
                  {conectores.map((c) => (
                    <Conector key={c.chave} c={c} />
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── sub-componentes ─────────────────────────────────────────────────────────

function RotuloLinha({
  linha,
  ativo,
  destacadoPredecessora,
  destacadoSucessora,
  onAtivar,
}: {
  linha: LinhaDoTempoRow;
  ativo: boolean;
  destacadoPredecessora: boolean;
  destacadoSucessora: boolean;
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
        <span className="truncate">{linha.titulo}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onAtivar}
      aria-pressed={ativo}
      title={`${linha.titulo}${linha.semDuracao ? " — estimativa faltando" : ""}`}
      className={`${classeBase} ${anelClasse} w-full text-left text-bone-200 hover:text-bone-50`}
    >
      <span className="truncate">{linha.titulo}</span>
      {typeof linha.score === "number" ? (
        <span className="shrink-0 rounded-full border border-fonte-notes/45 bg-fonte-notes/10 px-1 font-mono text-[9px] text-fonte-notes">
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
}: {
  row: LinhaDoTempoAssuntoRow;
  top: number;
  xFor: (iso: string) => number;
}): JSX.Element {
  const cor = corDoAssunto(row);
  const x = xFor(row.inicio);
  const largura = Math.max(4, xFor(row.fim) - x);
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noreferrer"
      className={`absolute rounded-sm ${cor.barra} opacity-90 hover:opacity-100`}
      style={{ left: x, top, width: largura, height: BAR_H }}
      title={`${row.titulo} — ${row.inicio} → ${row.aberto ? "em aberto" : row.fim}`}
      aria-label={`${row.titulo}, assunto ${row.aberto ? "aberto" : row.estado}`}
    />
  );
}

function BarraTarefa({
  row,
  top,
  xFor,
  ativo,
  predecessora,
  sucessora,
  onAtivar,
}: {
  row: LinhaDoTempoTarefaRow;
  top: number;
  xFor: (iso: string) => number;
  ativo: boolean;
  predecessora: boolean;
  sucessora: boolean;
  onAtivar: () => void;
}): JSX.Element {
  const x = xFor(row.inicio);
  const largura = Math.max(4, xFor(row.fim) - x);
  const xFolga = xFor(row.fimComFolga);
  const larguraFolga = Math.max(0, xFolga - xFor(row.fim));

  const preenchimento = row.critico
    ? "bg-aresta-critico"
    : row.status === "done"
      ? "bg-state-done"
      : row.status === "blocked"
        ? "bg-state-blocked"
        : row.status === "in_progress"
          ? "bg-state-progress"
          : "bg-state-open";

  const anel = ativo
    ? "ring-2 ring-gold-500"
    : predecessora
      ? "ring-2 ring-aresta-predecessor"
      : sucessora
        ? "ring-2 ring-aresta-sucessao"
        : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAtivar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAtivar();
        }
      }}
      aria-pressed={ativo}
      aria-label={`${row.titulo}${row.critico ? ", no caminho crítico" : ""}${row.semDuracao ? ", estimativa faltando" : ""}`}
      className={`absolute rounded-sm ${preenchimento} ${anel} ${row.critico ? "lb-tl-bar-critico" : ""}`}
      style={{ left: x, top, width: largura, height: BAR_H }}
      title={`${row.titulo} — folga: ${row.folga} d`}
    >
      {row.critico ? <TracoTriploCritico largura={largura} /> : null}
      {larguraFolga > 0 ? (
        <div
          aria-hidden="true"
          className="lb-tl-slack absolute top-0 h-full rounded-r-sm bg-aresta-critico/25 [background-image:repeating-linear-gradient(45deg,rgba(255,122,107,0.35)_0_3px,transparent_3px_6px)]"
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

function Conector({
  c,
}: {
  c: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    critico: boolean;
    destacado: "predecessor" | "sucessor" | null;
  };
}): JSX.Element {
  const xMeio = c.x1 + Math.max(8, (c.x2 - c.x1) / 2);
  const d = `M${c.x1},${c.y1} L${xMeio},${c.y1} L${xMeio},${c.y2} L${c.x2},${c.y2}`;
  const cor = c.critico
    ? ARESTA_STROKE_CRITICO
    : c.destacado === "predecessor"
      ? ARESTA_STROKE_DESTACADA
      : ARESTA_STROKE.sucessao;
  const largura = c.destacado || c.critico ? 2.25 : 1.4;

  return (
    <g className="lb-tl-connector" data-critico={c.critico}>
      {c.critico ? (
        <>
          <path d={d} stroke={cor} strokeWidth={1.6} fill="none" transform="translate(0,-3)" />
          <path d={d} stroke={cor} strokeWidth={1.6} fill="none" />
          <path d={d} stroke={cor} strokeWidth={1.6} fill="none" transform="translate(0,3)" />
        </>
      ) : (
        <path d={d} stroke={cor} strokeWidth={largura} fill="none" />
      )}
      <polygon
        points={`${c.x2 - 5},${c.y2 - 3.5} ${c.x2},${c.y2} ${c.x2 - 5},${c.y2 + 3.5}`}
        fill={cor}
      />
    </g>
  );
}
