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
  // P4b (achado ALTO #4 do crítico hostil): antes igual a `aresta.critico`
  // (mesmo #FF7A6B) — as duas só se distinguiam por FORMA (traço triplo × ❌),
  // e num screenshot real a olho nu liam-se como "a mesma cor". Matiz própria
  // (magenta) — `tailwind.config.ts` → `aresta.obsolescenciaHue` — mantém
  // ≥3:1 sobre navy-950 (checado em `scripts/checar-contraste.mjs`) e nunca
  // se confunde com o vermelho do crítico nem com o roxo da sinergia.
  obsolescencia: "#FF6EC7", // aresta.obsolescenciaHue
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

/**
 * P4b (achado CRÍTICO #2 do crítico hostil): a ordem antiga devolvia o
 * vermelho do crítico ANTES de checar destaque — selecionar um nó nunca
 * deixava seus predecessores críticos amarelos, porque `critica` sempre
 * ganhava a cor primeiro. Correto: DESTACAR vence a COR (amarelo — "isto é
 * predecessor do nó selecionado"); o traço TRIPLO (crítico) é uma decisão
 * independente, resolvida em `ArestaSvgGroup` pela flag `spec.critica`, não
 * por esta função — uma aresta pode ficar "amarela E tripla" ao mesmo tempo
 * (crítica E destacada), que é exatamente o caso que faltava cobrir.
 */
function corDaAresta(spec: ArestaSvgSpec): string {
  if (spec.destacadaPeloSelecionado && spec.camada === "sucessao") return ARESTA_STROKE_DESTACADA;
  if (spec.critica) return ARESTA_STROKE_CRITICO;
  return ARESTA_STROKE[spec.camada];
}

/**
 * Transforma que ESCALA em torno de `(x, y)` (nunca em torno da origem do
 * SVG) e SÓ DEPOIS gira — a mesma composição de sempre (`rotate` já fixa
 * `(x,y)`, então aplicar `scale` depois em torno da origem e recompor com
 * `translate` devolve `(x,y)` ao próprio lugar). É o que mantém o glifo
 * ANCORADO na ponta da aresta mesmo aumentando de tamanho.
 */
function transformAoRedorDoPonto(x: number, y: number, escala: number, anguloGraus: number): string {
  if (escala === 1) return `rotate(${anguloGraus} ${x} ${y})`;
  return `translate(${x * (1 - escala)} ${y * (1 - escala)}) scale(${escala}) rotate(${anguloGraus} ${x} ${y})`;
}

/**
 * Glifo no fim da aresta — a forma (não só a cor) que diz o tipo. `anguloGraus`
 * gira só as formas direcionais (seta/losango); círculo e ❌ são simétricos ou
 * já legíveis em qualquer ângulo, então nunca giram (o `transform` ainda leva
 * `rotate(0 …)`, identidade, para poder compor com a escala sem `if` extra).
 *
 * `escala` (P4b, achado ALTO #3/#4 do crítico hostil): o layout em grade
 * encolhe tudo pelo MESMO fator do zoom do canvas — a 0,43–0,51 (zoom real
 * medido pelo crítico) o ❌ de 13px de fonte vira ~6px de tela, ilegível. O
 * wrapper ReactFlow (`v3-edge.tsx`) lê o zoom real (`useViewport`) e passa
 * `escala = 1/zoom` (com piso 1 — nunca ENCOLHE abaixo do tamanho normal,
 * só CRESCE quando o zoom cai) para o glifo manter ≥12px DE TELA em
 * qualquer zoom. Chamado direto (fora do ReactFlow, como no teste de render)
 * usa o default 1 — mesmo tamanho de sempre.
 */
function GlifoFim({
  x,
  y,
  forma,
  cor,
  anguloGraus,
  escala = 1,
}: {
  x: number;
  y: number;
  forma: Forma;
  cor: string;
  anguloGraus: number;
  escala?: number;
}): JSX.Element | null {
  const transform = transformAoRedorDoPonto(x, y, escala, anguloGraus);
  switch (forma) {
    case "seta":
      return (
        <polygon
          className="lb-edge-glifo"
          points={`${x - 5},${y - 4} ${x + 5},${y} ${x - 5},${y + 4}`}
          fill={cor}
          transform={transform}
        />
      );
    case "circulo":
      return (
        <circle className="lb-edge-glifo" cx={x} cy={y} r={3.5} fill={cor} transform={transform} />
      );
    case "losango":
      return (
        <polygon
          className="lb-edge-glifo"
          points={`${x},${y - 5} ${x + 5},${y} ${x},${y + 5} ${x - 5},${y}`}
          fill={cor}
          transform={transform}
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
          transform={transform}
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
  /**
   * Deslocamento perpendicular (em unidades de mundo do SVG) de cada linha
   * lateral do traço triplo, em relação à linha central. Default 3.5 — o
   * MESMO valor fixo de antes desta prop existir (compat com o teste de
   * render, que instancia `ArestaSvgGroup` direto, fora do ReactFlow, sem
   * zoom nenhum). O wrapper `v3-edge.tsx` calcula este valor como
   * `pxDeTelaAlvo / zoom` (achado ALTO #3 do crítico: a 0,43–0,51 de zoom
   * real, um offset fixo em unidades de mundo encolhe junto e as 3 linhas
   * viram uma mancha de 3,4–4,1px) — passando já pronto aqui, este
   * componente nunca precisa saber que zoom existe.
   */
  offsetPx?: number;
  /**
   * Fator de escala do glifo do fim (seta/círculo/losango/❌), ancorado no
   * próprio ponto — ver `GlifoFim`. Default 1 (tamanho normal, mesmo de
   * sempre). `v3-edge.tsx` passa `1/zoom` (piso 1) para o ❌ nunca cair
   * abaixo de ~12px de tela (achado ALTO #4).
   */
  glifoEscala?: number;
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
  offsetPx = 3.5,
  glifoEscala = 1,
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
  const deslocaMenos = eixoDeslocamento === "x" ? `translate(-${offsetPx},0)` : `translate(0,-${offsetPx})`;
  const deslocaMais = eixoDeslocamento === "x" ? `translate(${offsetPx},0)` : `translate(0,${offsetPx})`;
  // `vector-effect="non-scaling-stroke"` (achado ALTO #3): a LARGURA do
  // traço passa a ser lida em px de TELA pelo navegador, ignorando a escala
  // do pane do ReactFlow — sem isto, os 2px de largura viravam ~1px a
  // zoom 0,5 e a separação (já corrigida por `offsetPx`) não bastava sozinha.
  const naoEscalarTraco = { vectorEffect: "non-scaling-stroke" as const };

  return (
    <g className={classes} data-aresta-id={spec.id} data-camada={spec.camada} data-critica={spec.critica}>
      {spec.critica ? (
        <>
          <path
            className="lb-edge-path"
            d={path}
            stroke={cor}
            strokeWidth={2}
            fill="none"
            transform={deslocaMenos}
            {...naoEscalarTraco}
          />
          <path className="lb-edge-path" d={path} stroke={cor} strokeWidth={2} fill="none" {...naoEscalarTraco} />
          <path
            className="lb-edge-path"
            d={path}
            stroke={cor}
            strokeWidth={2}
            fill="none"
            transform={deslocaMais}
            {...naoEscalarTraco}
          />
        </>
      ) : (
        <path
          className="lb-edge-path"
          d={path}
          stroke={cor}
          strokeWidth={spec.destacadaPeloSelecionado ? 2.5 : 1.75}
          strokeDasharray={dasharray}
          fill="none"
          {...naoEscalarTraco}
        />
      )}
      <GlifoFim x={endX} y={endY} forma={forma} cor={cor} anguloGraus={anguloGraus} escala={glifoEscala} />
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

/**
 * P4b (achado ALTO #5 do crítico hostil): amostra em miniatura de UMA das 6
 * arestas, desenhada com o MESMO `ArestaSvgGroup` de produção — nunca uma
 * segunda implementação de "como cada aresta parece". Usada por
 * `layer-toggle-panel.tsx` (um exemplo ao lado de cada checkbox — o painel
 * vira a legenda) e por `GraphLegend` (`dependency-graph.tsx`, tira compacta
 * de 3 itens em telas ≥768px).
 */
export function AmostraDeAresta({
  camada,
  critica = false,
}: {
  camada: Exclude<CamadaGrafo, "critico">;
  critica?: boolean;
}): JSX.Element {
  const spec: ArestaSvgSpec = {
    id: `amostra-${camada}-${critica ? "critica" : "base"}`,
    camada,
    critica,
    destacadaPeloSelecionado: false,
    pesoPercent: camada === "sinergia" ? 50 : undefined,
  };
  return (
    <svg
      width={40}
      height={14}
      viewBox="0 0 40 14"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <ArestaSvgGroup path="M2,7 L34,7" midX={18} midY={4} endX={34} endY={7} spec={spec} anguloGraus={0} />
    </svg>
  );
}
