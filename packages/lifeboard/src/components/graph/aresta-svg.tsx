import {
  larguraDoTracoNominal,
  SEPARACAO_DA_TRIPLA_MUNDO,
  type TipoDeBanda,
} from "@/lib/geometria-da-aresta";
import type { ArestaVisual, CamadaGrafo } from "@/lib/camadas-do-grafo";
import type { Ponto } from "@/lib/layout-do-grafo";

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

export interface ArestaSvgSpec
  extends Pick<ArestaVisual, "id" | "origem" | "destino" | "pesoPercent" | "destacadaPeloSelecionado"> {
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
 * `escala = 1/zoom` (com piso 1 — nunca ENCOLHE abaixo do tamanho normal, só
 * CRESCE quando o zoom cai). Chamado direto (fora do ReactFlow, como no
 * teste de render) usa o default 1 — mesmo tamanho de sempre.
 *
 * P4d (achado BAIXO #8 do crítico hostil ROUND 3, medição real): perto de
 * zoom 1 (0,99) o piso "nunca escala abaixo de 1" não ajuda em nada (1/0,99 ≈
 * 1,01) — o ❌ media 10,1×10,1px de tela, abaixo do piso de 12px. A régua
 * certa é a BASE do desenho, não a escala: `meia-largura 6,5` (abaixo, no
 * `case "x"`) garante ≥12px de tela já em `escala=1`, e a escala continua
 * como reforço só para zoom baixo.
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
    case "x": {
      // P4c (achado ALTO #5 do crítico hostil ROUND 2): o `<text>❌` (emoji)
      // não tem `fill` — computa preto por padrão, invisível sobre o fundo
      // escuro (o crop DPR-1 do crítico deu ZERO pixel magenta). Um `<path>`
      // com `stroke={cor}` é zoom-invariante de verdade (a fonte do emoji
      // depende do sistema/navegador para escalar; um path SVG escala com o
      // `transform` que já existe aqui) e sempre pinta com a cor da camada.
      //
      // P4d (achado BAIXO #8 do crítico hostil ROUND 3): meia-largura 5 (10px
      // de lado, em `escala=1`) media 10,1×10,1px de TELA a zoom 0,99 — o
      // piso da `escala` (`Math.max(1, 1/zoom)`) mal ajuda perto de zoom 1.
      // 6,5 (13px de lado) garante ≥12px de tela JÁ na base, sem depender do
      // zoom cair o bastante para a escala compensar.
      //
      // P4e (achado ALTO #4 do crítico hostil ROUND 4): o ❌ ganha um alvo
      // RETANGULAR transparente do mesmo tamanho, com `pointer-events`
      // religado (o `<svg class="react-flow__edges">` desliga em todos os
      // descendentes). Sem ele, `document.elementsFromPoint` no centro do
      // glifo devolvia o CARTÃO de baixo mesmo com o glifo pintado por cima —
      // nenhuma ferramenta conseguia distinguir "está atrás do cartão" de
      // "está na frente mas não é clicável". Agora a pilha em qualquer ponto
      // do glifo começa pelo próprio glifo, e o `zIndex` da aresta de
      // obsolescência (`dependency-graph.tsx`) garante que a PINTURA também.
      const meiaLargura = 6.5;
      return (
        <g className="lb-edge-glifo-grupo" transform={transform} style={{ pointerEvents: "auto" }}>
          <rect
            className="lb-edge-glifo-alvo"
            x={x - meiaLargura}
            y={y - meiaLargura}
            width={meiaLargura * 2}
            height={meiaLargura * 2}
            fill="transparent"
          />
          <path
            className="lb-edge-glifo lb-edge-marca-obsolescencia"
            d={`M${x - meiaLargura},${y - meiaLargura} L${x + meiaLargura},${y + meiaLargura} M${x - meiaLargura},${y + meiaLargura} L${x + meiaLargura},${y - meiaLargura}`}
            stroke={cor}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    }
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
   * Piso do traço em px de MUNDO (`1px de tela / zoom`). D3 da rodada 6: a
   * largura do traço voltou a ser px de MUNDO (some o `non-scaling-stroke`),
   * então ela ENCOLHE com o zoom — e este piso é o que impede a linha de sumir
   * no zoom mínimo. Default 0: fora do canvas (legenda, teste de render) não
   * há zoom nenhum e o nominal já é o valor final.
   */
  pisoDeTracoMundo?: number;
  /**
   * Onde ancorar o rótulo de % da sinergia (px de mundo). `undefined` = usa
   * `midX/midY` (o comportamento de sempre, para quem instancia este
   * componente fora do canvas); `null` = o colocador (`rotulo-da-aresta.ts`)
   * NÃO achou lugar livre e o texto não é desenhado — o valor fica só no
   * rótulo acessível do grupo (achado MÉDIO #5 da rodada 6).
   */
  rotulo?: Ponto | null;
  /**
   * Fator de escala do glifo do fim (seta/círculo/losango/❌), ancorado no
   * próprio ponto — ver `GlifoFim`. Default 1 (tamanho normal, mesmo de
   * sempre). `v3-edge.tsx` passa `1/zoom` (piso 1) para o ❌ nunca cair
   * abaixo de ~12px de tela (achado ALTO #4).
   */
  glifoEscala?: number;
  /**
   * P4f (achado BAIXO #10 do crítico hostil ROUND 4, generalizado): o rótulo
   * de % da sinergia era o último texto do grafo com tamanho FIXO (12px) — a
   * 0,85 de zoom isso dá 10,2px de TELA, abaixo do piso de 11,4px. Agora
   * `v3-edge.tsx` passa o mesmo tamanho que o cartão usa naquele zoom
   * (`tipografia-do-cartao.ts`). Default 12: o valor de sempre para quem
   * instancia este componente fora do canvas (legenda, teste de render).
   */
  labelFontePx?: number;
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
  offsetPx = SEPARACAO_DA_TRIPLA_MUNDO,
  pisoDeTracoMundo = 0,
  rotulo,
  glifoEscala = 1,
  labelFontePx = 12,
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
  // D3 da rodada 6 (achado ALTO #3): a largura do traço é px de MUNDO — a
  // MESMA unidade da separação da tripla e do passo do canal (`FAIXA_PX`).
  // Antes eram três réguas em três unidades, e a zoom 0,5 a meia-banda da
  // tripla (5,0px de tela) engolia o passo do canal (3,0px de tela): o crítico
  // achou uma aresta verde pintada DENTRO da tripla vermelha. `max()` com o
  // piso mantém a linha visível quando o zoom encolhe o mundo.
  const tipoDoTraco: TipoDeBanda = spec.critica
    ? "critico"
    : spec.destacadaPeloSelecionado
      ? "destacada"
      : spec.camada;
  const larguraDoTraco = Math.max(larguraDoTracoNominal(tipoDoTraco), pisoDeTracoMundo);
  const rotuloX = rotulo === undefined ? midX : rotulo?.x;
  const rotuloY = rotulo === undefined ? midY : rotulo?.y;
  const temRotulo = spec.camada === "sinergia" && typeof spec.pesoPercent === "number";
  const textoDoRotulo = temRotulo ? `${spec.pesoPercent}%` : "";

  return (
    <g
      className={classes}
      data-aresta-id={spec.id}
      data-camada={spec.camada}
      data-critica={spec.critica}
      // P4c: `id` não é parseável de volta em origem/destino pra TODAS as
      // camadas (só "sucessao:origem->destino" é; sinergia/correlação/
      // obsolescência usam o id do dado bruto, ex. "sinergia:edge-xyz") —
      // isso fez o harness de medição do crítico ROUND 2 contar o próprio
      // nó de origem/destino como "invadido" (falso positivo de ~55-64px,
      // quase metade da altura do card). Estes dois atributos dão a
      // qualquer ferramenta de teste/medição os endpoints reais, sem
      // depender de parsear string.
      data-origem={spec.origem}
      data-destino={spec.destino}
      aria-label={temRotulo ? `sinergia ${textoDoRotulo}` : undefined}
    >
      {spec.critica ? (
        <>
          <path
            className="lb-edge-path"
            d={path}
            stroke={cor}
            strokeWidth={larguraDoTraco}
            fill="none"
            transform={deslocaMenos}
          />
          <path className="lb-edge-path" d={path} stroke={cor} strokeWidth={larguraDoTraco} fill="none" />
          <path
            className="lb-edge-path"
            d={path}
            stroke={cor}
            strokeWidth={larguraDoTraco}
            fill="none"
            transform={deslocaMais}
          />
        </>
      ) : (
        <path
          className="lb-edge-path"
          d={path}
          stroke={cor}
          strokeWidth={larguraDoTraco}
          strokeDasharray={dasharray}
          fill="none"
        />
      )}
      {/* O valor da sinergia vive no rótulo ACESSÍVEL do grupo, sempre — mesmo
          quando o colocador não achou lugar livre para o texto (achado MÉDIO
          #5): teclado e leitor de tela alcançam; o `<title>` também é o
          tooltip nativo do SVG. */}
      {temRotulo ? <title>{`sinergia ${textoDoRotulo}`}</title> : null}
      <GlifoFim x={endX} y={endY} forma={forma} cor={cor} anguloGraus={anguloGraus} escala={glifoEscala} />
      {temRotulo && rotuloX !== undefined && rotuloY !== undefined ? (
        <text
          className="lb-edge-label lb-edge-label-sinergia"
          x={rotuloX}
          y={rotuloY}
          // Tamanho pela régua única de tipografia do grafo (piso de 12px de
          // TELA em qualquer zoom) — ver `labelFontePx`.
          fontSize={labelFontePx}
          textAnchor="middle"
          fill={cor}
        >
          {textoDoRotulo}
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
    // Amostra decorativa da legenda — não há nó real nos dois lados.
    origem: "amostra-origem",
    destino: "amostra-destino",
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
