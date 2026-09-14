/**
 * OS-LIFEBOARD · P4h — o CANVAS simulado (rodada 8).
 *
 * Não é arquivo de teste (nenhum `describe`): é o harness que `zoom-do-
 * operador.test.ts` e `enquadramento-maximiza.test.ts` usam para medir
 * COMPORTAMENTO — níveis de zoom depois de N cliques, cartões inteiros antes e
 * depois do botão — sem navegador.
 *
 * A régua de honestidade deste arquivo: **tudo o que decide alguma coisa vem
 * do código de produção**. O layout é `layoutDoGrafo`, o modo é
 * `tipografiaDoCartao`, o enquadramento é `enquadramentoDoAlvo`, a contagem é
 * `placarDeCartoes`, as dependências do efeito são
 * `dependenciasDoReenquadramento` e o corpo do efeito é
 * `aplicarReenquadramentoAutomatico` — as MESMAS funções que o componente
 * chama. O que é simulado aqui são só as duas coisas que o React faz e que não
 * cabem num teste de nó: comparar a lista de dependências entre dois renders e
 * rodar o efeito quando ela muda.
 *
 * É por isso que a mutação do achado CRÍTICO #1 (devolver `enquadrar` às
 * dependências) fica VERMELHA aqui: o simulador lê a lista de verdade.
 */

import {
  aplicarReenquadramentoAutomatico,
  dependenciasDoReenquadramento,
} from "@/components/graph/reenquadramento-automatico";
import {
  GAP_X,
  GAP_Y,
  GAP_Y_MINIMO,
  maxColunasParaLargura,
  NODE_W,
  opcoesDoAlvo,
  ZOOM_MAXIMO_DO_CANVAS,
  type AlvoDoEnquadramento,
} from "@/components/graph/dependency-graph";
import { tipografiaDoCartao } from "@/components/graph/tipografia-do-cartao";
import {
  enquadramentoDoAlvo,
  placarDeCartoes,
  type CartaoNaTela,
  type PlacarDeCartoes,
  type Pane,
} from "@/lib/enquadramento";
import { layoutDoGrafo, type ArestaParaRotear, type ResultadoLayout } from "@/lib/layout-do-grafo";
import { alturaDoCartao, ALTURA_DO_CARTAO } from "@/types/grafo-v3";

/**
 * Passo do botão de zoom do ReactFlow (`zoomIn()`/`zoomOut()` chamam
 * `d3Zoom.scaleBy(1.2)`). Confirmado pela medição da rodada 7 na rota real:
 * 0,6549 → 0,7858 é exatamente ×1,2.
 */
export const FATOR_DO_BOTAO_DE_ZOOM = 1.2;

export interface CenarioDoCanvas {
  ids: string[];
  edges: { origem: string; destino: string }[];
  todasArestas: ArestaParaRotear[];
  criticoIds: string[];
}

/** Uma sessão de canvas: o mesmo encadeamento zoom → modo → layout → caixa. */
export class CanvasSimulado {
  zoom = 1;
  x = 0;
  y = 0;
  alvo: AlvoDoEnquadramento;
  assinaturaDoFiltro = "";
  pane: Pane;
  nodesInitialized = false;
  /** Quantas vezes o efeito automático aplicou um enquadramento. */
  reenquadramentos = 0;

  private readonly cenario: CenarioDoCanvas;
  private readonly criticoSet: ReadonlySet<string>;
  private readonly cacheDeLayout = new Map<string, ResultadoLayout>();
  private depsAnteriores: readonly unknown[] | null = null;
  private modoDoEnquadrar: "cartao" | "mapa" | null = null;
  private enquadrarVivo: (alvo: AlvoDoEnquadramento, duracaoMs?: number) => void;

  constructor(params: {
    cenario: CenarioDoCanvas;
    pane: Pane;
    alvo?: AlvoDoEnquadramento;
    /** Se o simulador deve incluir a mutação do achado #1 (só para o teste). */
  }) {
    this.cenario = params.cenario;
    this.criticoSet = new Set(params.cenario.criticoIds);
    this.pane = params.pane;
    this.alvo = params.alvo ?? "critico";
    this.enquadrarVivo = this.criarEnquadrar();
  }

  get modo(): "cartao" | "mapa" {
    return tipografiaDoCartao(this.zoom).modo;
  }

  private layoutPara(altura: number): ResultadoLayout {
    const chave = `${altura}|${this.pane.largura}`;
    const pronto = this.cacheDeLayout.get(chave);
    if (pronto) return pronto;
    const feito = layoutDoGrafo({
      ids: this.cenario.ids,
      edges: this.cenario.edges,
      criticoIds: this.criticoSet,
      nodeW: NODE_W,
      nodeH: altura,
      gapX: GAP_X,
      gapY: Math.max(GAP_Y, GAP_Y_MINIMO),
      maxColunas: maxColunasParaLargura(this.pane.largura),
      todasArestas: this.cenario.todasArestas,
    });
    this.cacheDeLayout.set(chave, feito);
    return feito;
  }

  /** A mesma `cartoesParaAltura` do componente (mesma filtragem por alvo). */
  cartoesParaAltura(altura: number, alvo: AlvoDoEnquadramento): CartaoNaTela[] {
    const daAltura = this.layoutPara(altura);
    const querCritico = alvo === "critico" && this.criticoSet.size > 0;
    const nos = [...daAltura.nodes.values()].filter((n) => !querCritico || this.criticoSet.has(n.id));
    return (nos.length > 0 ? nos : [...daAltura.nodes.values()]).map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      largura: NODE_W,
      altura,
    }));
  }

  /** Os cartões como estão desenhados AGORA (altura do modo vivo). */
  cartoesNaTela(): CartaoNaTela[] {
    return this.cartoesParaAltura(this.alturaDoModo(this.modo), "tudo");
  }

  private alturaDoModo(m: "cartao" | "mapa"): number {
    return m === "mapa" ? alturaDoCartao("mapa") : ALTURA_DO_CARTAO;
  }

  /**
   * `enquadrar` nasce de novo sempre que o MODO muda — é a cadeia real
   * (`useEnquadramentos` → `cartoesParaAltura` → `layout` → `nodeHEfetivo` →
   * `modo` → zoom vivo) que fez o efeito competir com o dedo do operador.
   */
  private criarEnquadrar(): (alvo: AlvoDoEnquadramento, duracaoMs?: number) => void {
    return (alvo: AlvoDoEnquadramento) => {
      const previsao = enquadramentoDoAlvo({
        cartoesParaAltura: (altura) => this.cartoesParaAltura(altura, alvo),
        pane: this.pane,
        opcoes: opcoesDoAlvo(alvo),
        alturaCartao: this.alturaDoModo("cartao"),
        alturaMapa: this.alturaDoModo("mapa"),
        criticoIds: this.criticoSet,
        prioridade: alvo === "critico" ? "criticos" : "inteiros",
        viewportAtual: { x: this.x, y: this.y, zoom: this.zoom },
      });
      this.alvo = alvo;
      this.x = previsao.x;
      this.y = previsao.y;
      this.zoom = previsao.zoom;
    };
  }

  /**
   * Um render do React: a identidade de `enquadrar` se refaz quando o modo
   * muda, as deps são comparadas com as do render anterior e, se mudaram, o
   * efeito roda. Aplicar o efeito muda o zoom → muda o modo → o React
   * renderiza de novo: o laço abaixo é essa cascata, que era exatamente o que
   * o bug usava para se realimentar (por isso ele para sozinho quando o
   * gatilho é só filtro/tamanho, e só então).
   */
  render(): void {
    for (let passe = 0; passe < 8; passe++) {
      if (this.modoDoEnquadrar !== this.modo) {
        this.modoDoEnquadrar = this.modo;
        this.enquadrarVivo = this.criarEnquadrar();
      }
      const gatilho = {
        nodesInitialized: this.nodesInitialized,
        assinaturaDoFiltro: this.assinaturaDoFiltro,
        larguraDoPane: this.pane.largura,
        alturaDoPane: this.pane.altura,
        enquadrar: this.enquadrarVivo,
        alvo: this.alvo,
      };
      const deps = dependenciasDoReenquadramento(gatilho);
      const anteriores = this.depsAnteriores;
      const mudou =
        anteriores === null ||
        anteriores.length !== deps.length ||
        deps.some((d, i) => !Object.is(d, anteriores[i]));
      this.depsAnteriores = deps;
      if (!mudou) return;
      this.reenquadramentos += 1;
      aplicarReenquadramentoAutomatico(gatilho);
    }
  }

  /** Monta: o ReactFlow mede os nós e o 1º enquadramento acontece. */
  montar(): this {
    this.render();
    this.nodesInitialized = true;
    this.render();
    return this;
  }

  /** Um clique em "Aumentar zoom" (o `zoomIn()` do ReactFlow, ×1,2). */
  aumentarZoom(): number {
    const alvo = Math.min(ZOOM_MAXIMO_DO_CANVAS, this.zoom * FATOR_DO_BOTAO_DE_ZOOM);
    // O zoom do botão ancora no centro do pane — o pan acompanha.
    const k = alvo / this.zoom;
    this.x = this.pane.largura / 2 - (this.pane.largura / 2 - this.x) * k;
    this.y = this.pane.altura / 2 - (this.pane.altura / 2 - this.y) * k;
    this.zoom = alvo;
    this.render();
    return this.zoom;
  }

  /** O operador clica no botão de enquadrar. */
  clicarEnquadrar(alvo: AlvoDoEnquadramento): void {
    this.enquadrarVivo(alvo);
    this.render();
  }

  /** Redimensionar o painel (o gatilho legítimo do reenquadramento). */
  redimensionar(pane: Pane): void {
    this.pane = pane;
    this.render();
  }

  /** Trocar o filtro de fontes (o outro gatilho legítimo). */
  trocarFiltro(assinatura: string): void {
    this.assinaturaDoFiltro = assinatura;
    this.render();
  }

  placar(): PlacarDeCartoes {
    return placarDeCartoes(
      this.cartoesNaTela(),
      { x: this.x, y: this.y, zoom: this.zoom },
      this.pane,
      this.criticoSet,
    );
  }
}
