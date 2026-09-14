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
 *
 * Rodada 7 (decisão D4): caiu de 160 para 104 px — a largura de UM rótulo
 * `dd/MM/aaaa` (92) mais a margem entre rótulos (12). Os 160 eram calibrados
 * para painel largo: a 390px o painel do Gantt tem só 218px úteis (140 da
 * coluna de rótulos + 32 de respiro saem dos 390), e um vão de 160 significa
 * UM rótulo por tela. Com 104, as janelas de 60/120/400/900 d mostram pelo
 * menos dois. Não afrouxa nada: o portão de colisão é o mesmo, e o que não
 * couber continua não entrando.
 */
export const LIMIAR_TICK_PX = 104;
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
 * Rótulo de uma data na faixa de BAIXO do eixo: sempre `dd/MM`.
 *
 * Rodada 7 (decisão D4) — a troca que esta rodada faz, com a conta na mão. Até
 * a rodada 6, um horizonte que pudesse repetir o mesmo `dd/MM` (≥ 364 dias)
 * punha o ANO em cada rótulo de data, porque não havia mais nada na tela que
 * dissesse o ano. Agora há: a faixa de CIMA existe em toda densidade, carrega
 * mês+ano em todo mês a partir de 366 dias, e o chip GRUDADO na borda esquerda
 * mostra o período da posição atual e nunca sai da tela. O ano subiu de andar.
 *
 * A conta que obriga a troca: a 390px o painel do Gantt tem 218px úteis (140
 * da coluna de rótulos + 32 de respiro saem dos 390). Para DOIS rótulos
 * caberem inteiros numa janela, é preciso `vão + largura ≤ janela`. Com
 * `dd/MM/aaaa` isso é 104 + 92 = 196 só no alinhamento perfeito, e
 * 2 × 104 + 92 = 300 > 218 para valer em QUALQUER posição do scroll — ou
 * seja: com o ano no rótulo de data, "≥ 2 rótulos a 390px num horizonte de
 * 400 dias" é fisicamente impossível, e o crítico mediu exatamente 1. Com
 * `dd/MM`: 2 × 64 + 52 = 180 ≤ 218 — cabe sempre.
 *
 * O que NÃO se perde: o ano continua obrigatório em todo rótulo de mês da
 * faixa de cima (`rotuloDeMes`) e no chip grudado (`rotuloDoPeriodoSuperior`,
 * sempre com ano). Dois `13/09` a um ano de distância ficam sob "set/2026" e
 * "set/2027" — a desambiguação mudou de lugar, não sumiu.
 *
 * Exportada (rodada 6, achado BAIXO A7): o teste de 280 combinações copiava
 * esta regra à mão e a cópia JÁ tinha divergido da produção.
 */
export function rotuloDeData(iso: string, _totalDias: number): string {
  return diaMesCurto(iso);
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
 * Rodada 7 (decisão D4): o período da FAIXA SUPERIOR do cabeçalho. Ela existe
 * em TODA densidade e carrega sempre o período MAIOR — o mês quando ele cabe;
 * trimestre ou ano quando não cabe (densidades minúsculas, horizontes longos).
 */
export type PeriodoSuperior = "mes" | "trimestre" | "ano";

/** `T3/2026` — o trimestre do ISO, com ano (é rótulo de ancoragem: ano nunca é opcional). */
export function rotuloDeTrimestre(iso: string): string {
  const d = new Date(paraEpoch(iso));
  return `T${Math.floor(d.getUTCMonth() / 3) + 1}/${d.getUTCFullYear()}`;
}

/** `2026` — o ano do ISO, o período maior de todos. */
export function rotuloDeAno(iso: string): string {
  return String(anoDoIso(iso));
}

/**
 * O rótulo do período superior para o dia `dias` depois de `minIso` — a MESMA
 * função que alimenta o chip GRUDADO na borda esquerda e os rótulos da faixa
 * de cima. Uma fonte só: chip e faixa nunca podem discordar de formato.
 */
export function rotuloDoPeriodoSuperior(
  minIso: string,
  dias: number,
  periodo: PeriodoSuperior,
): string {
  const iso = somaDiasIso(minIso, Math.max(0, Math.floor(dias)));
  if (periodo === "ano") return rotuloDeAno(iso);
  if (periodo === "trimestre") return rotuloDeTrimestre(iso);
  return `${mesCurto(iso)}/${anoDoIso(iso)}`;
}

/**
 * O rótulo que a borda `x=0` teria nesta escala — exatamente o que
 * `gerarEscalaEixo` coloca lá. Exportada para o teste provar que a borda só
 * cede quando PROVADAMENTE não cabe, medindo contra a largura do rótulo REAL
 * (a cópia manual do teste acrescentava/omitia o ano por conta própria).
 *
 * Rodada 7 (decisão D4): a faixa de BAIXO carrega o período MENOR em toda
 * densidade — na faixa "mes" ela deixou de repetir os nomes de mês (que agora
 * vivem na faixa de cima, onde é o lugar deles) e passou a mostrar datas.
 */
export function labelDaBordaDoEixo(minIso: string, maxIso: string, pxPorDia: number): string {
  const totalDias = diasDesenhados(minIso, maxIso);
  const faixa = faixaDoEixo(pxPorDia);
  if (faixa === "dia") return String(new Date(paraEpoch(minIso)).getUTCDate());
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
  /**
   * Faixa SUPERIOR do cabeçalho (1ª linha). Rodada 7, decisão D4: existe em
   * TODA densidade — antes só nascia acima de 24px/dia, e no celular (6px/dia
   * no "auto") a tela ficava com faixa ÚNICA, sem mês nenhum, com 2 rótulos
   * em 390px. Carrega sempre o período MAIOR (`periodoSuperior`).
   */
  rotulosSuperiores: RotuloEixo[];
  /** Qual período a faixa de cima está mostrando — o chip grudado usa o MESMO. */
  periodoSuperior: PeriodoSuperior;
  /**
   * Faixa INFERIOR (principal) — ticks da faixa + o chip de "hoje" + a borda `x=0`,
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
    } else if (ehSegunda) {
      /**
       * Rodada 7 (decisão D4): a faixa de BAIXO carrega o período MENOR em
       * toda densidade. Antes, abaixo de 8px/dia ela repetia os NOMES DE MÊS
       * — o mesmo período que a faixa de cima carrega — e a tela ficava sem
       * nenhuma data: a 390px, janela de 60 d, "auto" (6px/dia), o crítico
       * mediu 2 rótulos visíveis e nenhuma faixa de mês. Agora as duas
       * densidades sem-dia ("semana" e "mes") propõem DATAS (`dd/MM`, com ano
       * quando o horizonte pode repetir); a densidade é que decide quantas
       * cabem, pelo mesmo portão de sempre, e o mês vive na faixa de cima.
       */
      candidatos.push({
        x,
        label: rotuloDeDataDaEscala(iso),
        forte: ehInicioMes,
        tipo: "semana",
        prioridade: ehInicioMes ? 2 : 1,
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
  /**
   * Rodada 7 (decisão D4): o chip de "hoje" passa a usar a MESMA regra de
   * rótulo de data do resto do eixo (`rotuloDeData`) — `dd/MM` quando o
   * horizonte não repete datas, `dd/MM/aaaa` a partir de 364 dias. Motivo
   * medido: ele é o rótulo mais LARGO da faixa (92px com ano) e, por ser
   * prioridade máxima, a clareira de 108px que ele exige à direita engolia o
   * vizinho seguinte — a 390px (218px de painel útil) sobrava 1 único rótulo
   * na tela, que é o defeito que a decisão D4 manda fechar. O ano não se
   * perde: ele está no chip GRUDADO da faixa de cima, que nunca sai da tela.
   */
  candidatos.push({
    x: xHoje,
    label: rotuloDeData(hojeIso, totalDias),
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

  const semPrioridade = ({ x, label, forte, tipo }: Candidato): RotuloEixo => ({ x, label, forte, tipo });
  const superior = gerarFaixaSuperior(minIso, totalDias, pxPorDia);
  return {
    guiasSemana,
    rotulosSuperiores: superior.rotulos.map(semPrioridade),
    periodoSuperior: superior.periodo,
    rotulos: principal.aceitos.map(semPrioridade),
    faixa,
  };
}

/** Dia (offset a partir de `minIso`) em que cada período superior REALMENTE começa. */
function iniciosDoPeriodo(minIso: string, totalDias: number, periodo: PeriodoSuperior): number[] {
  const dias: number[] = [];
  for (let d = 0; d <= totalDias; d += 1) {
    const data = new Date(paraEpoch(somaDiasIso(minIso, d)));
    if (data.getUTCDate() !== 1) continue;
    const mes = data.getUTCMonth();
    if (periodo === "mes") dias.push(d);
    else if (periodo === "trimestre" && mes % 3 === 0) dias.push(d);
    else if (periodo === "ano" && mes === 0) dias.push(d);
  }
  return dias;
}

/**
 * A FAIXA SUPERIOR (decisão D4 da rodada 7): sempre existe, sempre carrega o
 * período MAIOR, e o rótulo dela passa pelo MESMO portão de colisão de todo
 * mundo (`criarColocador`) — nunca uma régua paralela.
 *
 * A escolha do período é medida, não chutada: tenta o MÊS; se havia dois ou
 * mais meses para mostrar e o portão só deixou passar um (a densidade é
 * pequena demais para nomes de mês), sobe para TRIMESTRE; e, na mesma régua,
 * para ANO. "Nada de faixa única": o pior caso possível é a faixa de cima com
 * um único rótulo de ano, que ainda diz mais do que faixa nenhuma.
 */
function gerarFaixaSuperior(
  minIso: string,
  totalDias: number,
  pxPorDia: number,
): { periodo: PeriodoSuperior; rotulos: Candidato[] } {
  const ordem: readonly PeriodoSuperior[] = ["mes", "trimestre", "ano"];
  /** Os candidatos do período, na ordem do eixo — o dia 0 entra como BORDA. */
  const candidatosDe = (periodo: PeriodoSuperior): { reais: Candidato[]; borda: Candidato } => {
    let anoAnterior: number | null = null;
    const rotular = (iso: string): string => {
      const ano = anoDoIso(iso);
      const primeiraVezNoAno = anoAnterior !== ano;
      anoAnterior = ano;
      if (periodo === "ano") return rotuloDeAno(iso);
      if (periodo === "trimestre") return rotuloDeTrimestre(iso);
      return rotuloDeMes(iso, totalDias, primeiraVezNoAno);
    };
    const inicios = iniciosDoPeriodo(minIso, totalDias, periodo);
    /*
      A BORDA `x=0` da faixa: o período em que o 1º dia visível cai — para a
      faixa nunca "começar no vazio" quando `minIso` cai no meio de um mês. Ela
      é rotulada ANTES dos inícios reais (a ordem do eixo), porque é ela quem
      "gasta" a primeira aparição do ano: sem isso, uma janela que começa em
      05/01 produzia "jan/2026" na borda E "fev/2026" no início seguinte, dois
      rótulos com ano no mesmo ano — a régua que a rodada 6 fechou.
    */
    const temInicioNoDiaZero = inicios[0] === 0;
    const borda: Candidato = {
      x: 0,
      label: rotular(minIso),
      forte: true,
      tipo: "mes",
      prioridade: 1,
    };
    const reais = (temInicioNoDiaZero ? inicios.slice(1) : inicios).map((d) => {
      const iso = somaDiasIso(minIso, d);
      return { x: d * pxPorDia, label: rotular(iso), forte: true, tipo: "mes", prioridade: 2 } as Candidato;
    });
    // Quando o dia 0 JÁ é um início real, a borda é esse início (mesma `x`,
    // mesmo rótulo) — e a régua de "cabe" tem de contá-la como tal.
    return { reais: temInicioNoDiaZero ? [borda, ...reais] : reais, borda };
  };
  /**
   * O período CABE quando TODO par de inícios reais consecutivos respeita a
   * mesma régua de colisão do eixo. É a medida honesta: um "mês" que só
   * consegue mostrar dois janeiros a um ano de distância não é uma faixa de
   * meses — é uma faixa de anos com rótulo errado. (Foi por aí que a primeira
   * versão desta função passou: contava "≥ 2 aceitos" e ficava no mês.)
   */
  const cabe = (reais: Candidato[]): boolean => {
    for (let i = 1; i < reais.length; i += 1) {
      const esq = reais[i - 1]!;
      const dir = reais[i]!;
      if (dir.x - esq.x < distanciaMinima(esq, dir)) return false;
    }
    return true;
  };
  const montar = (periodo: PeriodoSuperior): { periodo: PeriodoSuperior; rotulos: Candidato[] } => {
    const { reais, borda } = candidatosDe(periodo);
    const colocador = criarColocador();
    for (const c of reais) colocador.colocar(c);
    colocador.colocar(borda);
    return { periodo, rotulos: colocador.aceitos };
  };
  for (const periodo of ordem) {
    if (cabe(candidatosDe(periodo).reais)) return montar(periodo);
  }
  // Nenhum cabe inteiro (densidade absurda): fica o maior de todos, com o
  // portão derrubando o que colidir. Uma faixa com um único rótulo de ano
  // ainda diz mais do que faixa nenhuma — "nada de faixa única" vale aqui.
  return montar("ano");
}

/** A janela visível do cabeçalho, em coordenadas do conteúdo do eixo. */
export interface JanelaVisivel {
  /** `scrollLeft` do painel — a borda ESQUERDA da janela. */
  scrollLeft: number;
  /** Largura visível do cabeçalho (== a do painel). `0` = ainda não medida. */
  larguraVisivel: number;
}

/**
 * O rótulo cabe INTEIRO na janela visível? (decisão D3 da rodada 7.)
 *
 * A rodada 6 guardava só a borda ESQUERDA (`if (t.x < scrollLeft) return null`)
 * — e o crítico mediu 28 de 60 combos com rótulo cortado ao meio pela borda
 * DIREITA: "nov/2026" com 1px visível, "28/09/2026" com 4px, "jan/2027" com 6.
 * Com o `scrollLeft` no máximo, o cortado era SEMPRE o último rótulo do eixo —
 * a data em que a meta termina. Aqui a lei é a mesma dos dois lados: ou cabe
 * inteiro, ou não é desenhado (e quem cede já foi decidido pelo portão do
 * eixo, que é quem escolhe QUEM ocupa cada lugar).
 *
 * A largura entra por `larguraAproximada` — a MESMA heurística que o portão
 * usa, que superestima de propósito (8px/caractere contra os 7,84 medidos).
 * Superestimar aqui erra para o lado seguro: esconde um rótulo que caberia
 * raspando, nunca desenha um cortado.
 */
export function cabeInteiroNaJanela(
  rotulo: Pick<RotuloEixo, "x" | "label">,
  janela: JanelaVisivel,
): boolean {
  const { scrollLeft, larguraVisivel } = janela;
  // Antes da 1ª medição real do painel (SSR / sem `ResizeObserver`) não há
  // janela para comparar — esconder tudo seria pior que o problema.
  if (!(larguraVisivel > 0)) return true;
  /*
    Rodada 9 (achado MÉDIO A2): existia aqui um `margemEsquerda` — o espaço do
    chip grudado — e quem o passava (a faixa de cima) APAGAVA todo mês que
    caísse atrás do chip. O parâmetro foi REMOVIDO do contrato, não só deixado
    de usar: enquanto ele existisse, reintroduzir o defeito era uma linha. O
    chip agora é EMPURRADO (`posicaoDoChipGrudado`) e não come o lugar de
    ninguém.
  */
  if (rotulo.x < scrollLeft) return false;
  return rotulo.x + larguraAproximada(rotulo.label) <= scrollLeft + larguraVisivel;
}

/** `cabeInteiroNaJanela` aplicada a uma faixa inteira — o que a VIEW desenha. */
export function rotulosNaJanela<T extends Pick<RotuloEixo, "x" | "label">>(
  rotulos: readonly T[],
  janela: JanelaVisivel,
): T[] {
  return rotulos.filter((r) => cabeInteiroNaJanela(r, janela));
}

/**
 * Rodada 7 (achado MÉDIO #6): o aviso de itens fora da janela terminava
 * sempre em *"— Mês/Trimestre mostra o histórico"* quando o zoom era "auto".
 * Medido pelo crítico com uma janela de 900 dias a 1280px: em "auto", 5 itens
 * fora e fim desenhado em 29/10/2027; seguindo o conselho, em "Mês" são SEIS
 * itens fora e o fim RECUA para 09/01/2027 — Trimestre e Semana idênticos.
 * Não existe zoom em que a meta a 900 dias caiba, porque quem corta ali não é
 * o recorte do "auto": é o TETO de dias da escala. E nada dizia isso.
 *
 * Esta função é a ÚNICA a decidir a frase. Quando o corte vem do teto, o
 * aviso diz a verdade (a janela desenhada tem 420 dias; N itens ficam fora em
 * QUALQUER zoom) e não sugere um zoom que piora.
 */
export function avisoDeItensFora(params: {
  itensFora: number;
  /** Último dia realmente desenhado, já formatado (`dd/MM/aaaa`). */
  fimDesenhadoFormatado: string;
  /** O teto de dias mordeu? (`diasDesenhados === TETO_DIAS_ESCALA`) */
  tetoMordeu: boolean;
  zoom: "auto" | "fixo";
}): string | null {
  const { itensFora, fimDesenhadoFormatado, tetoMordeu, zoom } = params;
  if (!(itensFora > 0)) return null;
  const plural = itensFora > 1;
  if (tetoMordeu) {
    return (
      `A janela desenhada é de ${TETO_DIAS_ESCALA} dias (até ${fimDesenhadoFormatado}): ` +
      `${itensFora} ${plural ? "itens ficam" : "item fica"} fora dela em qualquer zoom.`
    );
  }
  return (
    `${itensFora} ${plural ? "itens começam" : "item começa"} ou termina${plural ? "m" : ""} ` +
    `fora da janela desenhada (até ${fimDesenhadoFormatado})` +
    (zoom === "auto" ? " — Mês/Trimestre mostra o histórico" : "")
  );
}

/** O teto de dias mordeu esta janela? (o corte NÃO é do recorte do "auto".) */
export function tetoMordeu(minIso: string, maxIso: string): boolean {
  return diasDesenhados(minIso, maxIso) >= TETO_DIAS_ESCALA;
}

/**
 * Rodada 9 (achado MÉDIO A2): o CHIP GRUDADO deixa de APAGAR o mês que entra
 * e passa a ser EMPURRADO por ele — como faz a referência.
 *
 * O defeito, medido pelo crítico: a faixa de cima era filtrada com
 * `margemEsquerda = larguraMesGrudado`, então TODO rótulo de mês que caísse
 * atrás do chip era descartado. Em 320 de 730 posições de scroll (43,8%) havia
 * um mês começando dentro da janela sem nenhum rótulo na faixa de cima; em 48
 * posições o portador de ano mais próximo declarava ano diferente do real (82
 * rótulos). Caso canônico (1280px, zoom Mês, janela de 400 d, `scrollLeft`
 * 3333): a régua lia `dez/2026 … 04/01 11/01 18/01 25/01 … fev/2027` — janeiro
 * de 2027 INTEIRO sem cabeçalho.
 *
 * A lei nova: nenhum rótulo da faixa de cima é escondido por causa do chip. O
 * chip é que sai de cena, deslizando para a esquerda, quando o próximo período
 * chega perto o bastante para encostar nele. `x` é o `left` do chip DENTRO da
 * janela visível (0 em repouso, negativo enquanto é empurrado); `visivel` é
 * `false` só quando o rótulo REAL daquele período está exatamente na borda —
 * aí quem fala é ele, e o chip seria o mesmo nome desenhado duas vezes.
 */
export function posicaoDoChipGrudado(params: {
  /** A faixa de cima INTEIRA (não a filtrada) — o chip precisa saber quem vem a seguir. */
  rotulosSuperiores: readonly Pick<RotuloEixo, "x">[];
  /** `scrollLeft` do painel — a borda esquerda da janela. */
  scrollLeft: number;
  /** Largura estimada do chip (`larguraAproximada` do rótulo dele). */
  larguraChip: number;
}): { x: number } {
  const borda = Number.isFinite(params.scrollLeft) ? params.scrollLeft : 0;
  const largura = Number.isFinite(params.larguraChip) ? Math.max(0, params.larguraChip) : 0;
  let proximo: number | null = null;
  for (const r of params.rotulosSuperiores) {
    // Quem empurra é só quem vem DEPOIS da borda: o rótulo que está em cima
    // dela (ou atrás) fala do mesmo período que o chip, e o chip é quem manda
    // (é o único que carrega o ano sempre).
    if (!Number.isFinite(r.x) || r.x <= borda) continue;
    if (proximo === null || r.x < proximo) proximo = r.x;
  }
  if (proximo === null) return { x: 0 };
  // Encostou: o chip cede o lugar deslizando para fora, nunca apagando o outro.
  return { x: Math.min(0, proximo - borda - largura) };
}

/**
 * Rodada 9 (achado MÉDIO A2, o PRONTO QUANDO da decisão): "toda coluna
 * visível tem o seu mês na faixa de cima", virado em número.
 *
 * Devolve o `x` de cada coluna DESENHADA na faixa de baixo cujo período não
 * está nomeado em cima — nem por um rótulo desenhado da faixa superior, nem
 * pelo chip grudado (que fala pelo período da borda esquerda). Pura: é a
 * mesma conta que a varredura das 730 posições de scroll usa, para o número
 * da entrega e o número do teste nunca virem de duas réguas diferentes.
 *
 * Medido nesta rodada (1280px, zoom Mês, janela de 400 d, 730 posições de
 * scroll): 716 posições órfãs ANTES (a faixa de cima era filtrada pelo espaço
 * do chip), 0 DEPOIS.
 */
export function colunasSemMes(params: {
  /** A faixa de cima INTEIRA, como `gerarEscalaEixo` devolveu. */
  rotulosSuperiores: readonly Pick<RotuloEixo, "x">[];
  /** O que a faixa de cima de fato desenhou (já filtrado pela janela). */
  superioresDesenhados: readonly Pick<RotuloEixo, "x">[];
  /** O que a faixa de BAIXO desenhou — as colunas que o operador vê. */
  colunasDesenhadas: readonly Pick<RotuloEixo, "x">[];
  janela: JanelaVisivel;
}): number[] {
  const { scrollLeft, larguraVisivel } = params.janela;
  if (!(larguraVisivel > 0)) return [];
  const inicios = params.rotulosSuperiores
    .map((r) => r.x)
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
  const desenhados = new Set(params.superioresDesenhados.map((r) => r.x));
  // O chip fala pelo período que cobre a borda esquerda.
  const inicioDoChip = inicios.filter((x) => x <= scrollLeft).pop();
  if (inicioDoChip !== undefined) desenhados.add(inicioDoChip);
  const orfas: number[] = [];
  for (const col of params.colunasDesenhadas) {
    if (col.x < scrollLeft || col.x > scrollLeft + larguraVisivel) continue;
    const meu = inicios.filter((x) => x <= col.x).pop();
    if (meu === undefined || !desenhados.has(meu)) orfas.push(col.x);
  }
  return orfas;
}

/** `set/2026` → `["set","2026"]`; qualquer outro formato → `null`. */
const MES_COM_ANO = /^([^/]{1,4})\/(\d{4})$/;

/** O ano que o rótulo declara, quando ele declara um. */
function anoDoRotulo(label: string | undefined): string | undefined {
  if (!label) return undefined;
  return /\/(\d{4})$/.exec(label)?.[1];
}

/**
 * Rodada 9 (achado MÉDIO A2, a metade da BORDA DIREITA): a faixa de cima é
 * filtrada pela janela como todo mundo — mas um mês que ENTRA pela direita
 * com menos de uma largura de rótulo sobrando sumia inteiro, e com ele o
 * cabeçalho das colunas que já estão na tela. Medido: depois de tirar a
 * margem do chip, sobravam 8 de 730 posições com coluna visível sem mês na
 * faixa de cima — todas nessa fresta.
 *
 * A régua nova, na ordem: cabe inteiro → desenha; não cabe → ENCURTA (o mês
 * sem o ano) e desenha se o curto couber; o curto também não cabe, ou
 * encurtar MENTIRIA sobre o ano (o ano deste rótulo é diferente do último ano
 * declarado na tela), → não desenha. Nunca um rótulo cortado: as duas bordas
 * continuam com a mesma lei da decisão D3 da rodada 7.
 */
export function rotulosSuperioresNaJanela(
  rotulos: readonly RotuloEixo[],
  janela: JanelaVisivel & { /** Rótulo do chip grudado — é ele quem ancora o ano na borda esquerda. */ rotuloDaBorda?: string },
): RotuloEixo[] {
  const { scrollLeft, larguraVisivel } = janela;
  if (!(larguraVisivel > 0)) return [...rotulos];
  const direita = scrollLeft + larguraVisivel;
  const saida: RotuloEixo[] = [];
  let ultimoAno = anoDoRotulo(janela.rotuloDaBorda);
  for (const r of rotulos) {
    if (r.x < scrollLeft) continue;
    if (r.x + larguraAproximada(r.label) <= direita) {
      saida.push(r);
      ultimoAno = anoDoRotulo(r.label) ?? ultimoAno;
      continue;
    }
    const partes = MES_COM_ANO.exec(r.label);
    if (!partes) continue;
    const [, mes, ano] = partes;
    if (ano !== ultimoAno) continue; // encurtar aqui faria o leitor ler o ano errado
    if (r.x + larguraAproximada(mes!) > direita) continue;
    saida.push({ ...r, label: mes! });
  }
  return saida;
}

/**
 * Rodada 9 (achado MÉDIO A2): TUDO o que a faixa de cima mostra, numa decisão
 * só — o chip (rótulo, largura e o quanto ele já foi empurrado) e os rótulos
 * que de fato aparecem. Existe para o componente não ter escolha nenhuma a
 * fazer aqui: a rodada 8 tinha duas chamadas soltas na VIEW (uma delas com a
 * margem do chip, que apagava o mês que entrava) e nenhum teste via o que a
 * VIEW escolhia. Agora a escolha é esta função, e ela é testada.
 */
export function faixaSuperiorDaTela(params: {
  /** A faixa de cima INTEIRA, como `gerarEscalaEixo` devolveu. */
  rotulosSuperiores: readonly RotuloEixo[];
  minIso: string;
  pxPorDia: number;
  periodo: PeriodoSuperior;
  janela: JanelaVisivel;
}): { chip: { label: string; largura: number; x: number }; rotulos: RotuloEixo[] } {
  const { rotulosSuperiores, minIso, pxPorDia, periodo, janela } = params;
  const label = rotuloDoPeriodoSuperior(
    minIso,
    pxPorDia > 0 ? janela.scrollLeft / pxPorDia : 0,
    periodo,
  );
  const largura = larguraAproximada(label);
  const { x } = posicaoDoChipGrudado({
    rotulosSuperiores,
    scrollLeft: janela.scrollLeft,
    larguraChip: largura,
  });
  return {
    chip: { label, largura, x },
    rotulos: rotulosSuperioresNaJanela(rotulosSuperiores, { ...janela, rotuloDaBorda: label }),
  };
}
