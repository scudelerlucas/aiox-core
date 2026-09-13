/**
 * OS-LIFEBOARD · P5 — rodada 5 (causa raiz da rodada 4 MOVIDA, não fechada).
 *
 * A rodada 4 criou a função única do eixo, mas ela tinha DUAS passadas: a
 * primeira desconflitava por prioridade e a segunda (`preencherVaos`) inseria
 * rótulos de preenchimento comparando só `x₂ − x₁` com um limiar FIXO, sem
 * olhar a largura do vizinho — desfazendo a régua que a primeira acabara de
 * garantir (medido: `"19/09/2026"@108` seguido de `"03/10"@189`, 81px onde a
 * régua exige 97; e `jul/2026 → 19/07` com 21,44px de vão no Trimestre).
 *
 * Rodada 5: **um invariante, um portão**. Todo rótulo — o chip de "hoje", a
 * borda `x=0`, os ticks da faixa, os meses e os preenchimentos — entra na
 * lista final por UMA única função (`colocar`), que só aceita o candidato
 * quando a distância para os DOIS vizinhos já aceitos satisfaz
 * `distanciaMinima(esquerda, direita)` — a MESMA função de largura para
 * todos. Nada que já entrou é movido ou removido depois. O que não cabe, não
 * entra (e o vão maior é a informação, não o defeito).
 *
 * PURA — sem `Date.now()` escondido (`hojeIso` entra por parâmetro), nunca
 * lança. Fica FORA de `linha-do-tempo.ts` (que carrega `import "server-only"`)
 * porque este módulo também é consumido pelo Client Component
 * (`components/timeline/linha-do-tempo.tsx`) e por `tests/unit` — importar um
 * módulo `server-only` de um Client Component quebra o build do Next.
 */

const MS_POR_DIA = 86_400_000;
/** Teto de dias na escala — rede de segurança contra datas podres/distantes. */
export const TETO_DIAS_ESCALA = 420;
/** Piso absoluto entre dois rótulos, mesmo os dois curtíssimos ("13" e "14"). */
export const MINIMO_DIST_ROTULO_PX = 40;
/**
 * Vão acima do qual a escala tenta um rótulo de preenchimento no meio — o
 * operador nunca fica sem nenhuma pista de data por mais que isto. NÃO é uma
 * régua de colisão (essa é `distanciaMinima`): é só o gatilho que GERA o
 * candidato, que ainda precisa passar pelo mesmo portão de todo mundo.
 */
export const LIMIAR_TICK_PX = 160;
/**
 * Padding lateral aproximado (px) somado à largura estimada de um rótulo.
 *
 * Rodada 6 (achado BAIXO A5 do crítico): a calibração da rodada 4 (7,5px/car.
 * + 10px) SUBESTIMAVA o chip de mês grudado, contra o comentário que prometia
 * superestimar — "ago/2026" (8 car.) estimava 70px e MEDIA 74,72px. Duas
 * causas, as duas fechadas aqui: o chip tem `pl-1 pr-2` (12px de padding, não
 * 10) e a fonte semibold mede ~7,84px/caractere, não 7,5. Os três valores
 * abaixo são a FONTE ÚNICA: a estimativa usa `PX_POR_CHAR`/`PADDING_ROTULO_PX`
 * e o componente usa `PADDING_CHIP_PX` no padding INLINE do chip (nunca mais
 * classes Tailwind soltas que podem divergir do número usado na conta).
 * Limite superior real medido: 7,84 × nº de caracteres + 12.
 */
export const PADDING_ROTULO_PX = 12;
/** Largura aproximada por caractere (px), fonte 12px semibold — acima dos 7,84 medidos. */
export const PX_POR_CHAR = 8;
/**
 * Padding horizontal TOTAL do chip de mês grudado, em px, aplicado inline
 * (metade de cada lado). É a MESMA constante que entra na estimativa de
 * largura — o defeito da rodada 5 foi exatamente as duas se separarem.
 */
export const PADDING_CHIP_PX = 12;
/**
 * Respiro extra (px) além da largura estimada do rótulo à ESQUERDA — nunca
 * zero (rótulos colados, sem nenhum ar, ainda leem mal mesmo sem sobrepor).
 */
const MARGEM_ENTRE_ROTULOS_PX = 12;
/**
 * O chip de "hoje" é o único rótulo com FUNDO OPACO (`bg-navy-900/80`) — a
 * caixa dele encosta no texto vizinho antes de o texto encostar no texto.
 * Respiro extra de 4px em qualquer par que envolva o chip, dos dois lados.
 */
const RESPIRO_CHIP_PX = 4;

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
function anoDoIso(iso: string): number {
  return new Date(paraEpoch(iso)).getUTCFullYear();
}
function diaMesCurto(iso: string): string {
  const d = new Date(paraEpoch(iso));
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** `dd/MM/aaaa` — o chip de "hoje" e o desempate de rótulos repetidos. */
function diaMesAnoCurto(iso: string): string {
  const d = new Date(paraEpoch(iso));
  return `${diaMesCurto(iso)}/${d.getUTCFullYear()}`;
}
const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
] as const;
function mesCurto(iso: string): string {
  return MESES_PT[new Date(paraEpoch(iso)).getUTCMonth()] ?? "";
}

export type FaixaEixo = "dia" | "semana" | "mes";

/**
 * Rodada 6 (achado ALTO A3): o TETO de dias cortava a janela em silêncio —
 * `gerarEscalaEixo` desenhava até `min(TETO, diff)`, mas a VIEW decidia "está
 * depois da janela?" comparando com `maxIso`. Uma barra de 400 dias terminava
 * no último pixel do eixo, com ponta arredondada, escondendo 50 dias.
 *
 * `diasDesenhados`/`fimDesenhadoIso` são a ÚNICA fonte do fim real da janela:
 * a escala, o clamp de `xFor`, o chevron "▶" e a contagem de itens fora da
 * janela passaram todos a olhar para ELES, nunca mais para `maxIso`.
 */
export function diasDesenhados(minIso: string, maxIso: string): number {
  return Math.min(TETO_DIAS_ESCALA, Math.max(1, diffDias(minIso, maxIso)));
}

/** Último dia REALMENTE desenhado (ISO curto) — `maxIso` quando o teto não corta. */
export function fimDesenhadoIso(minIso: string, maxIso: string): string {
  return somaDiasIso(minIso, diasDesenhados(minIso, maxIso));
}

/** `iso` cai DEPOIS do fim desenhado? (mutação: comparar com `maxIso` deixa 50 dias mudos). */
export function depoisDoFimDesenhado(iso: string, fimDesenhado: string): boolean {
  return paraEpoch(iso) > paraEpoch(fimDesenhado);
}

/** Densidade → faixa do eixo. Função de PRODUÇÃO — `gerarEscalaEixo` chama esta. */
export function faixaDoEixo(pxPorDia: number): FaixaEixo {
  return pxPorDia >= 24 ? "dia" : pxPorDia >= 8 ? "semana" : "mes";
}

/**
 * Rótulo de uma data no eixo. Horizonte que pode repetir o mesmo `dd/MM`
 * (≥ 364 dias) → o rótulo leva o ano. Exportada (rodada 6, achado BAIXO A7):
 * o teste de 200 combinações copiava esta regra à mão e a cópia JÁ tinha
 * divergido da produção — agora não existe segunda implementação.
 */
export function rotuloDeData(iso: string, totalDias: number): string {
  return totalDias >= 364 ? diaMesAnoCurto(iso) : diaMesCurto(iso);
}

/**
 * Rótulo de um mês no eixo. Rodada 6 (achado BAIXO A8): `primeiraVezNoAno`
 * sozinho deixava DOIS "ago" idênticos na mesma régua num horizonte de mais
 * de um ano (só janeiro ganhava o ano). Horizonte desenhado ≥ 366 dias →
 * TODO rótulo de mês leva o ano, a mesma disciplina que o `dd/MM` já tinha.
 */
export function rotuloDeMes(iso: string, totalDias: number, primeiraVezNoAno: boolean): string {
  return totalDias >= 366 || primeiraVezNoAno ? `${mesCurto(iso)}/${anoDoIso(iso)}` : mesCurto(iso);
}

/**
 * O rótulo que a borda `x=0` teria nesta escala — exatamente o que
 * `gerarEscalaEixo` coloca lá. Exportada para o teste provar que a borda só
 * cede quando PROVADAMENTE não cabe, medindo contra a largura do rótulo REAL
 * (a cópia manual do teste acrescentava/omitia o ano por conta própria).
 */
export function labelDaBordaDoEixo(minIso: string, maxIso: string, pxPorDia: number): string {
  const totalDias = diasDesenhados(minIso, maxIso);
  const faixa = faixaDoEixo(pxPorDia);
  if (faixa === "dia") return String(new Date(paraEpoch(minIso)).getUTCDate());
  if (faixa === "mes") return rotuloDeMes(minIso, totalDias, true);
  return rotuloDeData(minIso, totalDias);
}

export type TipoRotulo = "dia" | "semana" | "mes" | "preenchimento" | "hoje" | "borda";

export interface RotuloEixo {
  x: number;
  label: string;
  forte: boolean;
  tipo: TipoRotulo;
}

export interface EscalaEixo {
  /** Grades verticais de segunda-feira (fundo do painel) — só linhas, nunca colidem. */
  guiasSemana: number[];
  /** Faixa do MÊS (2ª linha do cabeçalho, só visível quando `faixa === "dia"`). */
  ticksMes: RotuloEixo[];
  /**
   * Faixa PRINCIPAL — ticks da faixa + o chip de "hoje" + a borda `x=0`,
   * TODOS colocados pelo mesmo portão: nenhum par adjacente fica a menos de
   * `distanciaMinima(anterior, atual)`. "hoje" é o único rótulo que nunca
   * cede (prioridade máxima) e nunca muda de `x`; a borda `x=0` cede quando
   * não cabe ao lado dele (aí o próprio "hoje" é a primeira data da tela).
   */
  rotulos: RotuloEixo[];
  faixa: FaixaEixo;
}

/**
 * Prioridade de COLOCAÇÃO (quem escolhe o lugar primeiro), nunca de desenho:
 * 4 = hoje · 3 = borda `x=0` · 2 = mês/ano · 1 = tick da faixa · 0 = preenchimento.
 */
type Prioridade = 0 | 1 | 2 | 3 | 4;
interface Candidato extends RotuloEixo {
  prioridade: Prioridade;
}

/** Largura aproximada (px) do rótulo — heurística por caracteres, a MESMA para todos. */
export function larguraAproximada(label: string): number {
  return label.length * PX_POR_CHAR + PADDING_ROTULO_PX;
}

/**
 * O ÚNICO invariante do eixo: espaço mínimo, em px, entre um rótulo à
 * ESQUERDA e o seu vizinho imediato à DIREITA.
 *
 * Os rótulos são ANCORADOS PELA ESQUERDA (`style={{left:x}}`, o texto cresce
 * para a direita) — o espaço real entre dois é `(x₂ − x₁) − largura(esquerda)`.
 * Por isso a largura que manda é a do candidato da ESQUERDA; o da direita
 * entra pelo piso e pelo respiro do chip (o único rótulo com fundo opaco).
 * Exportada de propósito: o teste afirma o vão contra ESTA função, nunca
 * contra a constante de piso (achado BAIXO #10 da rodada 4).
 */
export function distanciaMinima(
  esquerda: Pick<RotuloEixo, "label" | "tipo">,
  direita: Pick<RotuloEixo, "label" | "tipo">,
): number {
  const respiro = esquerda.tipo === "hoje" || direita.tipo === "hoje" ? RESPIRO_CHIP_PX : 0;
  return (
    Math.max(MINIMO_DIST_ROTULO_PX, larguraAproximada(esquerda.label) + MARGEM_ENTRE_ROTULOS_PX) +
    respiro
  );
}

/**
 * O portão único. Mantém a lista ordenada por `x` e só aceita o candidato
 * quando ele respeita `distanciaMinima` contra os DOIS vizinhos já aceitos.
 * Nada que já entrou é movido, trocado ou removido — não existe segunda
 * passada que desfaça esta.
 */
function criarColocador(): {
  aceitos: Candidato[];
  colocar: (c: Candidato) => boolean;
} {
  const aceitos: Candidato[] = [];
  return {
    aceitos,
    colocar(c: Candidato): boolean {
      let i = 0;
      while (i < aceitos.length && aceitos[i]!.x < c.x) i += 1;
      const esquerda = aceitos[i - 1];
      const direita = aceitos[i];
      if (esquerda && c.x - esquerda.x < distanciaMinima(esquerda, c)) return false;
      if (direita && direita.x - c.x < distanciaMinima(c, direita)) return false;
      aceitos.splice(i, 0, c);
      return true;
    },
  };
}

/** `set/2026` — o rótulo do mês do dia `dias` depois de `minIso` (sempre com ano). */
export function rotuloMesAno(minIso: string, dias: number): string {
  const iso = somaDiasIso(minIso, Math.max(0, Math.floor(dias)));
  return `${mesCurto(iso)}/${anoDoIso(iso)}`;
}

/**
 * ÚNICA função de posicionamento dos rótulos do eixo. A VIEW só desenha o que
 * ela devolve — nenhum rótulo nasce fora daqui, e nenhum é recolocado depois.
 */
export function gerarEscalaEixo(params: {
  minIso: string;
  maxIso: string;
  pxPorDia: number;
  hojeIso: string;
}): EscalaEixo {
  const { minIso, maxIso, pxPorDia, hojeIso } = params;
  const totalDias = diasDesenhados(minIso, maxIso);
  const larguraTotal = totalDias * pxPorDia;
  const faixa: FaixaEixo = faixaDoEixo(pxPorDia);
  const guiasSemana: number[] = [];

  // ── 1. candidatos ────────────────────────────────────────────────────────
  /**
   * "0 dd/MM repetidos" (não regredir, rodada 3): num horizonte de 364 dias
   * ou mais o MESMO `dd/MM` cai duas vezes na mesma tela — e aí ele não
   * identifica data nenhuma. Regra por CONSTRUÇÃO, decidida antes de
   * qualquer colocação (nunca um desempate depois, que mudaria a largura de
   * um rótulo já colocado e quebraria a régua contra o vizinho da direita):
   * horizonte que pode repetir → todo rótulo de data leva o ano.
   */
  const rotuloDeDataDaEscala = (iso: string): string => rotuloDeData(iso, totalDias);

  const candidatos: Candidato[] = [];
  const candidatosMes: Candidato[] = [];
  let anoAnteriorMes: number | null = null;
  let anoAnteriorPrincipal: number | null = null;

  for (let d = 0; d <= totalDias; d += 1) {
    const iso = somaDiasIso(minIso, d);
    const data = new Date(paraEpoch(iso));
    const ehSegunda = data.getUTCDay() === 1;
    const ehInicioMes = data.getUTCDate() === 1;
    const x = d * pxPorDia;
    if (ehSegunda) guiasSemana.push(x);

    if (faixa === "dia") {
      candidatos.push({
        x,
        label: String(data.getUTCDate()),
        forte: ehSegunda,
        tipo: "dia",
        prioridade: ehSegunda ? 2 : 1,
      });
    } else if (faixa === "semana") {
      if (ehSegunda) {
        candidatos.push({
          x,
          label: rotuloDeDataDaEscala(iso),
          forte: ehInicioMes,
          tipo: "semana",
          prioridade: ehInicioMes ? 2 : 1,
        });
      }
    } else if (ehInicioMes || d === 0) {
      const ano = anoDoIso(iso);
      const primeiraVezNoAno = anoAnteriorPrincipal !== ano;
      anoAnteriorPrincipal = ano;
      candidatos.push({
        x,
        label: rotuloDeMes(iso, totalDias, primeiraVezNoAno),
        forte: true,
        tipo: "mes",
        prioridade: 2,
      });
    }

    // Faixa de MESES (2ª linha do cabeçalho — só na densidade "dia"): um
    // rótulo por início de mês, mais um no 1º dia visível (nunca começa "no
    // vazio"). O ANO entra no primeiro rótulo de cada ano (inclusive na virada).
    if (faixa === "dia" && (ehInicioMes || d === 0)) {
      const xMes = ehInicioMes ? x : 0;
      const ano = anoDoIso(iso);
      const primeiraVezNoAno = anoAnteriorMes !== ano;
      anoAnteriorMes = ano;
      candidatosMes.push({
        x: xMes,
        label: rotuloDeMes(iso, totalDias, primeiraVezNoAno),
        forte: true,
        tipo: "mes",
        prioridade: 2,
      });
    }
  }

  // Borda `x=0` — a primeira data da tela. Prioridade abaixo só de "hoje":
  // quando os dois não cabem lado a lado, é ELA que cede (achado ALTO A2 da
  // rodada 5: antes o chip de "hoje" é que era movido para x=0 e passava a
  // "dizer" a data da borda, com a linha dourada 50px à direita dele).
  const bordaNatural = candidatos.find((c) => c.x === 0);
  candidatos.push({
    x: 0,
    label: bordaNatural?.label ?? labelDaBordaDoEixo(minIso, maxIso, pxPorDia),
    forte: true,
    tipo: "borda",
    prioridade: 3,
  });

  // "hoje": prioridade máxima, escolhe o lugar primeiro e NUNCA muda de `x` —
  // é a única coisa na tela que a linha dourada vertical também marca, e as
  // duas têm de ficar no mesmo pixel.
  const xHoje = Math.max(0, Math.min(larguraTotal, diffDias(minIso, hojeIso) * pxPorDia));
  candidatos.push({
    x: xHoje,
    label: diaMesAnoCurto(hojeIso),
    forte: true,
    tipo: "hoje",
    prioridade: 4,
  });

  // ── 2. colocação: UMA passada, um portão ─────────────────────────────────
  candidatos.sort((a, b) => b.prioridade - a.prioridade || a.x - b.x);
  const principal = criarColocador();
  for (const c of candidatos) principal.colocar(c);

  // ── 3. preenchimento: candidatos NOVOS, o MESMO portão ───────────────────
  // Não é uma segunda passada de posicionamento: nada já aceito é movido nem
  // removido. Vão > `LIMIAR_TICK_PX` gera candidatos `dd/MM` distribuídos
  // igualmente dentro dele; cada um ainda precisa caber pela mesma régua. O
  // que não couber simplesmente não entra — o vão maior é honesto (é o que a
  // largura dos vizinhos permite), nunca um rótulo sobreposto.
  if (pxPorDia > 0) {
    /**
     * Varre DIA a dia dentro de um vão (o rótulo precisa cair num dia real —
     * data interpolada seria data inventada) e tenta colocar o primeiro que
     * fica a pelo menos `espacoDesejado` do último colocado. Recusa do portão
     * NÃO desiste do vão: tenta o dia seguinte. Devolve quantos entraram.
     */
    const varrer = (inicio: number, fim: number, espacoDesejado: number): number => {
      let ancora = inicio;
      let entraram = 0;
      const primeiroDia = Math.ceil(inicio / pxPorDia);
      const ultimoDia = Math.min(totalDias, Math.floor(fim / pxPorDia));
      for (let d = primeiroDia; d <= ultimoDia; d += 1) {
        const x = d * pxPorDia;
        if (x <= inicio || x >= fim) continue;
        if (x - ancora < espacoDesejado) continue;
        const entrou = principal.colocar({
          x,
          label: rotuloDeDataDaEscala(somaDiasIso(minIso, d)),
          forte: false,
          tipo: "preenchimento",
          prioridade: 0,
        });
        if (entrou) {
          ancora = x;
          entraram += 1;
        }
      }
      return entraram;
    };
    const vaosAcimaDoLimiar = (): { inicio: number; fim: number }[] => {
      const out: { inicio: number; fim: number }[] = [];
      for (let i = 0; i < principal.aceitos.length; i += 1) {
        const atual = principal.aceitos[i]!;
        const fim = i + 1 < principal.aceitos.length ? principal.aceitos[i + 1]!.x : larguraTotal;
        if (fim - atual.x > LIMIAR_TICK_PX) out.push({ inicio: atual.x, fim });
      }
      return out;
    };
    // 1ª varredura: espaçamento BONITO (o vão dividido em partes iguais).
    for (const vao of vaosAcimaDoLimiar()) {
      const largura = vao.fim - vao.inicio;
      const n = Math.max(1, Math.ceil(largura / LIMIAR_TICK_PX) - 1);
      varrer(vao.inicio, vao.fim, largura / (n + 1));
    }
    // 2ª varredura, só no que sobrou grande: espaçamento RELAXADO — vale mais
    // um rótulo fora do meio do vão do que 180px sem nenhuma pista de data.
    // Mesmo portão, mesma régua; o que não couber continua não entrando.
    for (const vao of vaosAcimaDoLimiar()) varrer(vao.inicio, vao.fim, 0);
  }

  candidatosMes.sort((a, b) => b.prioridade - a.prioridade || a.x - b.x);
  const meses = criarColocador();
  for (const c of candidatosMes) meses.colocar(c);

  const semPrioridade = ({ x, label, forte, tipo }: Candidato): RotuloEixo => ({ x, label, forte, tipo });
  return {
    guiasSemana,
    ticksMes: meses.aceitos.map(semPrioridade),
    rotulos: principal.aceitos.map(semPrioridade),
    faixa,
  };
}
