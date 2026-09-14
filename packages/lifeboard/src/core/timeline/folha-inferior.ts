/**
 * OS-LIFEBOARD · P5 — rodada 9. A FOLHA INFERIOR do celular: quanto a página
 * precisa rolar para a linha tocada sair de baixo dela, e — o que faltava —
 * quanto espaço precisa EXISTIR abaixo da última linha para que essa rolagem
 * seja possível.
 *
 * Por que existe (achado ALTO A1 da rodada 9, medido na rota real com fixture
 * de 25 linhas): a rodada 8 pedia a rolagem com `window.scrollBy({ top:
 * excesso })` e parava aí. Quando a página já está no fim
 * (`scrollY === scrollHeight − innerHeight`) o `scrollBy` é um NO-OP
 * SILENCIOSO — o navegador não tem para onde rolar, não avisa, e a folha fica
 * em cima da linha. Atinge exatamente a ÚLTIMA linha, que é onde o goal mora:
 * 9 de 9 casos (larguras 360/390/767 × as 3 últimas linhas), resíduo de 9 a
 * 133px; a 390px a barra da linha tocada ficava 2.880 de 2.880 px² coberta
 * (100%) e o rótulo sumia inteiro.
 *
 * A correção não é pedir a rolagem com mais força — é garantir que ela seja
 * POSSÍVEL: enquanto a folha está aberta, a página reserva abaixo da última
 * linha uma faixa da altura da folha. O pior excesso possível é exatamente
 * `altura da folha + margem do anel` (a linha tocada encostada no fim da
 * viewport), então essa reserva é suficiente por construção — e a asserção do
 * teste é o RESULTADO geométrico (a barra 100% visível, resíduo 0px), nunca a
 * chamada de rolagem.
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
 * Quanto a página precisa rolar para a linha tocada (mais o anel) ficar ACIMA
 * da folha. `0` ou menos = já está acima, nada a fazer.
 */
export function excessoSobreAFolha(params: {
  bottomDoBotao: number;
  topDaFolha: number;
  margem?: number;
}): number {
  const margem = Math.max(0, params.margem ?? MARGEM_ANEL_PX);
  return numero(params.bottomDoBotao) + margem - numero(params.topDaFolha);
}

/**
 * O ESPAÇO que precisa existir abaixo da última linha enquanto a folha está
 * aberta — a correção-carro-chefe desta rodada.
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

/** O que o componente aplica ao DOM — uma decisão só, nunca duas contas soltas. */
export interface PlanoDaFolha {
  /** A folha aberta é a inferior (celular)? */
  ehInferior: boolean;
  /** `height` do espaçador abaixo da última linha, em px. `0` fecha a reserva. */
  espacoReservado: number;
  /** Quanto rolar a página (`window.scrollBy`). `0` = não mexer. */
  rolar: number;
}

/**
 * A decisão inteira, num lugar só. `folha === null` (fechada) ou folha-COLUNA
 * (≥768px) devolvem plano vazio: nada reservado, nada rolado — é o que mantém
 * o `ΔscrollY = 0` que o crítico confirmou no desktop.
 */
export function planoDaFolhaInferior(params: {
  folha: RetanguloMedido | null;
  bottomDoBotao: number | null;
  larguraJanela: number;
  margem?: number;
}): PlanoDaFolha {
  const { folha, bottomDoBotao, larguraJanela } = params;
  const margem = Math.max(0, params.margem ?? MARGEM_ANEL_PX);
  const vazio: PlanoDaFolha = { ehInferior: false, espacoReservado: 0, rolar: 0 };
  if (!folha || !ehFolhaInferior(folha, larguraJanela)) return vazio;
  const espacoReservado = espacoAbaixoDaUltimaLinha(folha.height, margem);
  if (bottomDoBotao === null || !Number.isFinite(bottomDoBotao)) {
    // Sem linha tocada medida: a reserva vale do mesmo jeito (a folha está
    // aberta, e quem rolar a página até o fim precisa do espaço), mas nada rola.
    return { ehInferior: true, espacoReservado, rolar: 0 };
  }
  const excesso = excessoSobreAFolha({ bottomDoBotao, topDaFolha: folha.top, margem });
  return { ehInferior: true, espacoReservado, rolar: excesso > 0 ? excesso : 0 };
}

/** A interface MÍNIMA do espaçador — só o que se escreve nele. */
export interface EspacadorDeFolha {
  style: { height: string };
}

/** Quem o plano precisa para virar tela. Injetado: nada de DOM aqui dentro. */
export interface AplicadorDaFolha {
  /** O elemento reservado abaixo da última linha (`null` antes do 1º paint). */
  espacador: EspacadorDeFolha | null;
  /** `window.scrollBy({ top })` — a única rolagem de PÁGINA da tela. */
  rolarPagina: (px: number) => void;
}

/**
 * Rodada 9 (achado MÉDIO A3, generalizado): o componente não escreve mais
 * geometria no DOM — ele passa os elementos para cá. Isto existe porque o
 * mutante "não reserva espaço" derrubava ZERO testes enquanto a escrita
 * morava dentro do `useEffect`: nenhum teste de unidade alcança um efeito de
 * React sem DOM. Com a aplicação aqui, a cadeia inteira (medir → decidir →
 * aplicar → rolar) roda num teste, e a guarda de fonte proíbe qualquer
 * `\`.style.<algo> =\`` dentro do componente.
 *
 * A ORDEM importa e é a correção do achado ALTO A1: reserva PRIMEIRO, rola
 * DEPOIS — `scrollBy` só funciona onde já existe para onde rolar.
 */
export function aplicarPlanoDaFolha(plano: PlanoDaFolha, aplicador: AplicadorDaFolha): void {
  if (aplicador.espacador) aplicador.espacador.style.height = `${plano.espacoReservado}px`;
  if (plano.ehInferior && plano.rolar > 0) aplicador.rolarPagina(plano.rolar);
}
