/**
 * OS-LIFEBOARD · P5 — rodada 10. A FOLHA INFERIOR do celular: quanto espaço
 * ela pode ocupar, quanto a página precisa rolar para a linha tocada sair de
 * baixo dela, e quanto espaço precisa EXISTIR abaixo da última linha para que
 * essa rolagem seja possível — e para que FECHAR a folha não mexa a página.
 *
 * Histórico curto das três rodadas que chegaram até aqui:
 *
 * - Rodada 8 pedia `window.scrollBy({ top: excesso })` e parava aí. Com a
 *   página no fim (`scrollY === scrollHeight − innerHeight`), `scrollBy` é
 *   NO-OP SILENCIOSO: a folha ficava em cima da última linha.
 * - Rodada 9 reservou, abaixo da última linha, uma faixa da altura da folha —
 *   e resolveu o caso da LARGURA (folha inferior × coluna ≥768px).
 * - Rodada 10 (esta) fecha os dois buracos que o crítico mediu na rota real:
 *
 *   | achado | medida na rota real |
 *   |---|---|
 *   | A ALTURA da janela mudou com a folha aberta (teclado virtual: 390×844 → 390×500) e nada recalculou | a folha voltou a tapar **42.946 px²** do painel do Gantt, e a linha tocada saiu inteira da viewport (topo 599 numa janela de 500) |
 *   | FECHAR a folha encolhe o documento e o navegador clampa o `scrollY` | o conteúdo saltava **139 px** a 390×844 e a 390×500 |
 *
 *   As duas correções são geométricas e vivem aqui:
 *
 *   1. **Teto de altura da folha em função da ALTURA da janela**
 *      (`alturaMaximaDaFolha`). `max-h-[60vh]` sozinho é proporcional: numa
 *      janela baixa, 60% continuam sendo 60%. O teto garante uma FAIXA MÍNIMA
 *      de linha do tempo acima da folha em qualquer altura — inclusive quando
 *      a altura muda com a folha já aberta.
 *   2. **Reserva com ÂNCORA DE FECHAMENTO** (`ancoraDeFechamento`). A reserva
 *      não cai direto a zero quando a folha fecha: ela cai até o mínimo que
 *      mantém o `scrollY` ATUAL alcançável. Sem isso o navegador clampa e o
 *      conteúdo desce sozinho. A âncora nunca CRESCE (é sempre ≤ a reserva que
 *      já existe) e se dissolve sozinha conforme o operador rola para cima.
 *
 * PURA: sem DOM, sem `window`, nunca lança. O navegador entra só como quem
 * mede retângulos.
 */

/** O `DOMRect` que interessa — só os quatro números, nunca o objeto do DOM. */
export interface RetanguloMedido {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
}

/**
 * O anel de seleção é `ring-1 ring-inset`, mas a borda precisa respirar: a
 * linha tocada sobe este tanto A MAIS do que o estritamente necessário.
 */
export const MARGEM_ANEL_PX = 6;

/**
 * A faixa de linha do tempo que NUNCA pode ficar embaixo da folha, em px.
 * Régua, não gosto: o cabeçalho da escala mede 58px e uma linha mede 42px —
 * 200px deixam o cabeçalho, a linha tocada e as duas vizinhas à vista mesmo
 * numa janela de 390px de altura (celular deitado, ou teclado aberto).
 */
export const FAIXA_MINIMA_DA_LINHA_PX = 200;

/** Abaixo disto a folha deixa de ser folha e vira uma tira ilegível. */
export const ALTURA_MINIMA_DA_FOLHA_PX = 120;

/** A fração de janela que a folha pode ocupar quando há altura de sobra (o `60vh` do CSS). */
export const FRACAO_MAXIMA_DA_FOLHA = 0.6;

function numero(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/**
 * A folha é a INFERIOR (celular) e não a coluna lateral (≥768px)? Régua
 * medida, não suposta: ocupa a largura toda e encosta na borda esquerda.
 */
export function ehFolhaInferior(folha: RetanguloMedido, larguraJanela: number): boolean {
  return numero(folha.left) <= 1 && numero(folha.width) >= numero(larguraJanela) - 2;
}

/**
 * O TETO de altura da folha para esta janela — a correção do achado da altura.
 *
 * Três leis, nesta ordem: (a) nunca mais que `FRACAO_MAXIMA_DA_FOLHA` da
 * janela (é o `60vh` de sempre, agora calculado e testável); (b) nunca ao
 * ponto de sobrar menos que `FAIXA_MINIMA_DA_LINHA_PX` de linha do tempo
 * acima dela; (c) nunca menos que `ALTURA_MINIMA_DA_FOLHA_PX`, senão numa
 * janela muito baixa a folha some e o operador perde o painel inteiro.
 *
 * (c) vence (b) de propósito: numa janela de 260px não existe divisão que
 * satisfaça os dois, e um painel ilegível é pior que uma faixa curta.
 */
export function alturaMaximaDaFolha(alturaJanela: number): number {
  const altura = numero(alturaJanela);
  if (!(altura > 0)) return ALTURA_MINIMA_DA_FOLHA_PX;
  const porFracao = altura * FRACAO_MAXIMA_DA_FOLHA;
  const porFaixa = altura - FAIXA_MINIMA_DA_LINHA_PX;
  return Math.max(ALTURA_MINIMA_DA_FOLHA_PX, Math.min(porFracao, porFaixa));
}

/**
 * Quanto a página precisa rolar para a linha tocada (mais o anel) ficar
 * INTEIRA entre o topo da janela e o topo da folha.
 *
 * Positivo = rolar para baixo (a linha está atrás da folha). Negativo =
 * rolar para cima (a linha saiu por cima, que é o que acontece quando a
 * janela ENCOLHE e ninguém recalcula). `0` = já está no lugar.
 */
export function excessoSobreAFolha(params: {
  bottomDoBotao: number;
  topDaFolha: number;
  topoDoBotao?: number | null;
  margem?: number;
}): number {
  const margem = Math.max(0, params.margem ?? MARGEM_ANEL_PX);
  const abaixo = numero(params.bottomDoBotao) + margem - numero(params.topDaFolha);
  if (abaixo > 0) return abaixo;
  const topo = params.topoDoBotao;
  if (typeof topo === "number" && Number.isFinite(topo) && topo - margem < 0) return topo - margem;
  return 0;
}

/**
 * O ESPAÇO que precisa existir abaixo da última linha enquanto a folha está
 * aberta.
 *
 * Por que a altura da folha + a margem é o número certo, e não um chute: o
 * pior caso é a linha tocada encostada no fim da viewport
 * (`bottom === innerHeight`). Aí o excesso é
 * `innerHeight + margem − (innerHeight − altura) = altura + margem`. Reservar
 * isto faz o `scrollBy` sempre ter para onde ir; reservar menos deixa o
 * no-op silencioso de volta para a última linha.
 */
export function espacoAbaixoDaUltimaLinha(alturaDaFolha: number, margem = MARGEM_ANEL_PX): number {
  return Math.max(0, Math.ceil(numero(alturaDaFolha) + Math.max(0, margem)));
}

/**
 * O espaço MÍNIMO que precisa continuar existindo para que o `scrollY` atual
 * siga alcançável — a correção do salto de 139px ao fechar.
 *
 * Quando o espaçador encolhe, o documento encolhe junto; se o `scrollY` atual
 * passar do novo máximo, o NAVEGADOR o clampa e o conteúdo desce sozinho na
 * tela. Medido: 139px a 390×844 e a 390×500, exatamente o tanto que o
 * espaçador (203px) excedia o que a página tinha de rolagem.
 *
 * Esta âncora nunca faz o espaçador CRESCER: como `scrollY` já é limitado por
 * `alturaSemEspacador + espaçadorAtual − alturaJanela`, o resultado é sempre
 * ≤ o espaçador que já existe. Ela só impede que ele encolha DEMAIS de uma
 * vez — e vai a zero sozinha conforme o operador rola de volta para cima.
 */
export function ancoraDeFechamento(params: {
  scrollY: number;
  alturaJanela: number;
  /** `scrollHeight` do documento MENOS o espaçador atual. */
  alturaSemEspacador: number;
}): number {
  const precisa =
    numero(params.scrollY) + numero(params.alturaJanela) - numero(params.alturaSemEspacador);
  return Math.max(0, Math.ceil(precisa));
}

/** O que o componente aplica ao DOM — uma decisão só, nunca contas soltas. */
export interface PlanoDaFolha {
  /** A folha aberta é a inferior (celular)? */
  ehInferior: boolean;
  /** `height` do espaçador abaixo da última linha, em px. */
  espacoReservado: number;
  /** Quanto rolar a página (`window.scrollBy`). `0` = não mexer. Pode ser negativo. */
  rolar: number;
  /**
   * `max-height` a escrever na folha, em px — `null` quando não há folha
   * inferior (fechada ou coluna ≥768px), e aí a escrita é apagada.
   */
  alturaMaxima: number | null;
}

/** Tudo o que o navegador mede e este módulo precisa. Nada de DOM aqui dentro. */
export interface MedidasDaFolha {
  folha: RetanguloMedido | null;
  bottomDoBotao: number | null;
  topoDoBotao?: number | null;
  larguraJanela: number;
  alturaJanela: number;
  scrollY: number;
  /** `document.documentElement.scrollHeight` — JÁ inclui o espaçador atual. */
  alturaDoDocumento: number;
  /** A altura que o espaçador tem AGORA (para descontar do documento). */
  espacoAtual: number;
  /**
   * A janela acabou de mudar de tamanho e não há âncora viva para repor a
   * linha? Então é AQUI que ela se repõe — inclusive quando o painel é
   * COLUNA (≥768px), onde não há folha tapando nada mas a linha tocada
   * simplesmente sai da tela ao girar o telefone (medido: 390×844 → 844×390
   * deixava a linha em `top: 709` numa janela de 390px).
   */
  manterLinhaVisivel?: boolean;
  margem?: number;
}

/**
 * Quanto rolar para um retângulo `[topo, base]` caber INTEIRO entre `0` e
 * `limiteInferior`, mexendo o mínimo possível. Positivo = rolar para baixo.
 * `0` quando já cabe — nunca um pulo à toa.
 */
export function rolagemParaCaber(params: {
  topo: number;
  base: number;
  limiteInferior: number;
  margem?: number;
}): number {
  const margem = Math.max(0, params.margem ?? MARGEM_ANEL_PX);
  const topo = numero(params.topo);
  const base = numero(params.base);
  const limite = numero(params.limiteInferior);
  if (base + margem > limite) {
    const desce = base + margem - limite;
    // Não adianta descer tanto que o topo saia por cima: aí o mínimo é o topo.
    return topo - desce < margem ? Math.min(desce, Math.max(0, topo - margem)) : desce;
  }
  if (topo - margem < 0) return topo - margem;
  return 0;
}

/**
 * A decisão inteira, num lugar só.
 *
 * Folha fechada ou folha-COLUNA (≥768px): nada de teto, nada de rolagem — só
 * a âncora de fechamento, que é justamente o que mantém `ΔscrollY = 0` no
 * momento em que o espaçador encolhe.
 */
export function planoDaFolhaInferior(medidas: MedidasDaFolha): PlanoDaFolha {
  const { folha, bottomDoBotao, larguraJanela, alturaJanela } = medidas;
  const margem = Math.max(0, medidas.margem ?? MARGEM_ANEL_PX);
  const alturaSemEspacador = numero(medidas.alturaDoDocumento) - numero(medidas.espacoAtual);
  const ancora = ancoraDeFechamento({
    scrollY: numero(medidas.scrollY),
    alturaJanela: numero(alturaJanela),
    alturaSemEspacador,
  });
  if (!folha || !ehFolhaInferior(folha, larguraJanela)) {
    const repor =
      medidas.manterLinhaVisivel === true &&
      typeof bottomDoBotao === "number" &&
      Number.isFinite(bottomDoBotao)
        ? rolagemParaCaber({
            topo: numero(medidas.topoDoBotao ?? bottomDoBotao),
            base: bottomDoBotao,
            limiteInferior: numero(alturaJanela),
            margem,
          })
        : 0;
    return { ehInferior: false, espacoReservado: ancora, rolar: repor, alturaMaxima: null };
  }
  const teto = alturaMaximaDaFolha(alturaJanela);
  // A folha pode estar medida ANTES do teto entrar (primeiro quadro depois de
  // abrir, ou o quadro em que a janela encolheu). A geometria que vale é a que
  // ela vai TER, não a que ela tinha.
  const alturaEfetiva = Math.min(numero(folha.height), teto);
  const topoEfetivo = numero(alturaJanela) - alturaEfetiva;
  const espacoReservado = Math.max(ancora, espacoAbaixoDaUltimaLinha(alturaEfetiva, margem));
  if (bottomDoBotao === null || bottomDoBotao === undefined || !Number.isFinite(bottomDoBotao)) {
    // Sem linha tocada medida: a reserva e o teto valem do mesmo jeito (a
    // folha está aberta), mas nada rola.
    return { ehInferior: true, espacoReservado, rolar: 0, alturaMaxima: teto };
  }
  const rolar = excessoSobreAFolha({
    bottomDoBotao,
    topDaFolha: topoEfetivo,
    topoDoBotao: medidas.topoDoBotao ?? null,
    margem,
  });
  return { ehInferior: true, espacoReservado, rolar, alturaMaxima: teto };
}

/** A interface MÍNIMA do espaçador — só o que se escreve nele. */
export interface EspacadorDeFolha {
  style: { height: string };
}

/** A interface MÍNIMA da folha — só o que se escreve nela. */
export interface FolhaEstilavel {
  style: { maxHeight: string };
}

/** Quem o plano precisa para virar tela. Injetado: nada de DOM aqui dentro. */
export interface AplicadorDaFolha {
  /** O elemento reservado abaixo da última linha (`null` antes do 1º paint). */
  espacador: EspacadorDeFolha | null;
  /** A própria folha, para receber o teto de altura (`null` quando fechada). */
  folha?: FolhaEstilavel | null;
  /** `window.scrollBy({ top })` — a única rolagem de PÁGINA da tela. */
  rolarPagina: (px: number) => void;
}

/**
 * O mesmo plano, sem a rolagem — o que o evento de `scroll` aplica.
 *
 * Existe porque a reserva precisa ser recalculada enquanto o operador rola (é
 * assim que a âncora de fechamento se dissolve), mas RE-ROLAR a cada quadro
 * de rolagem puxaria o operador de volta para a linha tocada toda vez que ele
 * tentasse sair dela. Recalcular geometria e MOVER a página são duas coisas,
 * e só a primeira pertence ao `scroll`.
 */
export function semRolagem(plano: PlanoDaFolha): PlanoDaFolha {
  return { ...plano, rolar: 0 };
}

/** Abaixo disto a rolagem é ruído de subpixel e não se pede ao navegador. */
export const FOLGA_DE_ROLAGEM_PX = 1;

/**
 * Aplica o plano. A ORDEM é a correção do no-op silencioso: o teto de altura
 * PRIMEIRO (a folha encolhe antes de qualquer conta valer), a reserva DEPOIS
 * (é ela que dá à página para onde rolar) e só então a rolagem.
 */
export function aplicarPlanoDaFolha(plano: PlanoDaFolha, aplicador: AplicadorDaFolha): void {
  if (aplicador.folha) {
    aplicador.folha.style.maxHeight = plano.alturaMaxima === null ? "" : `${plano.alturaMaxima}px`;
  }
  if (aplicador.espacador) aplicador.espacador.style.height = `${plano.espacoReservado}px`;
  if (Math.abs(plano.rolar) > FOLGA_DE_ROLAGEM_PX) aplicador.rolarPagina(plano.rolar);
}
