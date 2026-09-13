import type { ArestaVisual, CamadaGrafo } from "@/lib/camadas-do-grafo";

/**
 * OS-LIFEBOARD · P4 — SVG puro de UMA aresta do grafo v3.
 *
 * Separado de `v3-edge.tsx` (o wrapper ReactFlow) de propósito: o ReactFlow só
 * hidrata nós/arestas depois de um efeito de layout (ResizeObserver) que não
 * roda em `renderToStaticMarkup` (confirmado por spike: `react-flow__nodes`
 * fica vazio sob SSR sem DOM) — então o teste de render (P4 item 4) instancia
 * ESTE componente direto, com coordenadas fixas, sem depender do motor do
 * ReactFlow. É o mesmo componente que `V3Edge` usa em produção (com as
 * coordenadas que o ReactFlow calcula de verdade) — nunca duas implementações.
 *
 * Cores: tokens `aresta.*` de `tailwind.config.ts`, repetidos aqui em hex
 * literal pela MESMA razão dos `EDGE_*` de `dependency-graph.tsx` (comentário
 * ali: "API da lib exige literal" — `stroke`/`fill` do SVG não aceitam classe
 * Tailwind). Contraste verificado em `scripts/checar-contraste.mjs`.
 */

/** [texto, fundo, mínimo, onde] — espelha exatamente os tokens usados abaixo. */
export const ARESTA_STROKE: Record<Exclude<CamadaGrafo, "critico">, string> = {
  sucessao: "#5FE39A", // aresta.sucessao == state.done — verde contínua
  correlacao: "#B9C4DC", // aresta.correlacao — "branca" honesta: bone-300
  sinergia: "#C58CFF", // aresta.sinergia — roxo pontilhado
  obsolescencia: "#FF7A6B", // aresta.obsolescencia == state.error — vermelha + ❌
};
/** Traço triplo do caminho crítico e destaque de seleção — tokens próprios. */
export const ARESTA_STROKE_CRITICO = "#FF7A6B"; // aresta.critico == state.error
export const ARESTA_STROKE_DESTACADA = "#F7CE73"; // aresta.predecessor == gold-400

/** Formas por camada (daltônico-safe: tracejado/sólido/triplo já diferem; isto soma glifo). */
type Forma = "seta" | "circulo" | "losango" | "x";
const FORMA_POR_CAMADA: Record<Exclude<CamadaGrafo, "critico">, Forma> = {
  sucessao: "seta",
  correlacao: "circulo",
  sinergia: "losango",
  obsolescencia: "x",
};

export interface ArestaSvgSpec extends Pick<ArestaVisual, "id" | "pesoPercent" | "destacadaPeloSelecionado"> {
  /** Camada BASE (nunca "critico" — isso vem do flag `critica`). */
  camada: Exclude<CamadaGrafo, "critico">;
  /** `true` quando esta aresta de sucessão está no caminho crítico E a camada "critico" está ativa. */
  critica: boolean;
}

const DASH_POR_CAMADA: Partial<Record<Exclude<CamadaGrafo, "critico">, string>> = {
  correlacao: "4 5",
  sinergia: "3 4",
};

function corDaAresta(spec: ArestaSvgSpec): string {
  if (spec.critica) return ARESTA_STROKE_CRITICO;
  if (spec.destacadaPeloSelecionado && spec.camada === "sucessao") return ARESTA_STROKE_DESTACADA;
  return ARESTA_STROKE[spec.camada];
}

/**
 * Glifo no fim da aresta — a forma (não só a cor) que diz o tipo. `anguloGraus`
 * gira só as formas direcionais (seta/losango); círculo e ❌ são simétricos ou
 * já legíveis em qualquer ângulo, então nunca giram.
 */
function GlifoFim({
  x,
  y,
  forma,
  cor,
  anguloGraus,
}: {
  x: number;
  y: number;
  forma: Forma;
  cor: string;
  anguloGraus: number;
}): JSX.Element | null {
  switch (forma) {
    case "seta":
      return (
        <polygon
          className="lb-edge-glifo"
          points={`${x - 5},${y - 4} ${x + 5},${y} ${x - 5},${y + 4}`}
          fill={cor}
          transform={`rotate(${anguloGraus} ${x} ${y})`}
        />
      );
    case "circulo":
      return <circle className="lb-edge-glifo" cx={x} cy={y} r={3.5} fill={cor} />;
    case "losango":
      return (
        <polygon
          className="lb-edge-glifo"
          points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`}
          fill={cor}
          transform={`rotate(${anguloGraus} ${x} ${y})`}
        />
      );
    case "x":
      return (
        <text
          className="lb-edge-glifo lb-edge-marca-obsolescencia"
          x={x}
          y={y}
          fontSize={13}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          ❌
        </text>
      );
    default:
      return null;
  }
}

export interface ArestaSvgGroupProps {
  /** `d` do path (já calculado por `getSmoothStepPath` no wrapper ReactFlow). */
  path: string;
  /** Ponto médio do path — onde o rótulo de % da sinergia é ancorado. */
  midX: number;
  midY: number;
  /** Ponto final do path — onde o glifo (seta/círculo/losango/❌) é desenhado. */
  endX: number;
  endY: number;
  spec: ArestaSvgSpec;
  /** Ângulo (graus) da seta/losango no fim — 0 = apontando para a direita. */
  anguloGraus?: number;
  /**
   * Eixo do deslocamento perpendicular do traço triplo. Layout em grade
   * (`dependency-graph.tsx`, colunas por profundidade) produz sobretudo
   * arestas VERTICAIS ou HORIZONTAIS — nunca diagonais de verdade — então o
   * eixo dominante já resolve os dois casos comuns sem precisar calcular a
   * normal exata da curva smoothstep. Default "y": o mesmo comportamento de
   * antes de este prop existir (aresta horizontal é o caso mais comum fora
   * do grafo v3, ex. num teste isolado).
   */
  eixoDeslocamento?: "x" | "y";
}

/**
 * Grupo SVG de UMA aresta v3 — path(s) + glifo + rótulo. Traço triplo (crítico)
 * = 3 `<path>` com o MESMO `d`, deslocados PERPENDICULARMENTE ao eixo
 * dominante da aresta (`eixoDeslocamento`): deslocar em Y não separa uma
 * aresta vertical (desloca ALONG a própria linha, não ao lado dela — achado
 * ao conferir o screenshot do fixture, onde setup→build é uma reta vertical
 * e o traço triplo virava uma única linha). Aresta majoritariamente vertical
 * desloca em X; majoritariamente horizontal desloca em Y — os dois casos que
 * o layout em grade de `dependency-graph.tsx` de fato produz.
 */
export function ArestaSvgGroup({
  path,
  midX,
  midY,
  endX,
  endY,
  spec,
  anguloGraus = 0,
  eixoDeslocamento = "y",
}: ArestaSvgGroupProps): JSX.Element {
  const cor = corDaAresta(spec);
  const forma = FORMA_POR_CAMADA[spec.camada];
  const dasharray = spec.critica ? undefined : DASH_POR_CAMADA[spec.camada];
  const classes = [
    "lb-edge",
    `lb-edge-${spec.camada}`,
    spec.critica ? "lb-edge-critico-triplo" : "",
    spec.destacadaPeloSelecionado ? "lb-edge-destacada" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const deslocaMenos = eixoDeslocamento === "x" ? "translate(-3.5,0)" : "translate(0,-3.5)";
  const deslocaMais = eixoDeslocamento === "x" ? "translate(3.5,0)" : "translate(0,3.5)";

  return (
    <g className={classes} data-aresta-id={spec.id} data-camada={spec.camada} data-critica={spec.critica}>
      {spec.critica ? (
        <>
          <path className="lb-edge-path" d={path} stroke={cor} strokeWidth={2} fill="none" transform={deslocaMenos} />
          <path className="lb-edge-path" d={path} stroke={cor} strokeWidth={2} fill="none" />
          <path className="lb-edge-path" d={path} stroke={cor} strokeWidth={2} fill="none" transform={deslocaMais} />
        </>
      ) : (
        <path
          className="lb-edge-path"
          d={path}
          stroke={cor}
          strokeWidth={spec.destacadaPeloSelecionado ? 2.5 : 1.75}
          strokeDasharray={dasharray}
          fill="none"
        />
      )}
      <GlifoFim x={endX} y={endY} forma={forma} cor={cor} anguloGraus={anguloGraus} />
      {spec.camada === "sinergia" && typeof spec.pesoPercent === "number" ? (
        <text
          className="lb-edge-label lb-edge-label-sinergia"
          x={midX}
          y={midY}
          fontSize={10}
          textAnchor="middle"
          fill={cor}
        >
          {spec.pesoPercent}%
        </text>
      ) : null}
    </g>
  );
}
