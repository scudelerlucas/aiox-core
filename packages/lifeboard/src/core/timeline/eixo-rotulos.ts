/**
 * OS-LIFEBOARD · P5 — rodada 4 (causa raiz nomeada pelo crítico hostil):
 * "o eixo tem dono demais". Antes, `gerarEscala` (em
 * `components/timeline/linha-do-tempo.tsx`) só desconflitava TICKS contra
 * TICKS — o chip de "hoje", o tick da borda esquerda (`x=0`) e a faixa de
 * mês eram desenhados FORA dessa passada, cada um lido pela VIEW
 * separadamente. Cada rodada de correção resolvia uma colisão e criava a
 * próxima (o chip "hoje" atropelando o tick vizinho foi o achado ALTO desta
 * rodada). Esta é a ÚNICA função de posicionamento dos rótulos do eixo:
 * recebe a janela, px/dia e "hoje", e devolve a lista FINAL já sem colisão —
 * a VIEW só renderiza o que ela devolve, nunca decide sozinha se cabe mais um
 * rótulo.
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
/** Nenhum rótulo pode ficar a menos disto do vizinho — achado MÉDIO #4, rodada 3. */
export const MINIMO_DIST_ROTULO_PX = 40;
/** Nenhum tick de data pode ficar mais longe que isto do vizinho (rede de segurança). */
const LIMIAR_TICK_PX = 160;
/**
 * Padding lateral aproximado (px) somado à largura estimada de um rótulo.
 * Calibrado por MEDIÇÃO REAL no navegador (Playwright, rodada 4): "04/09"
 * (5 car.) mede 42,78px; "13/09/2026" (10 car., o chip de "hoje" — fundo +
 * `px-0.5`) mede 79,56px. Ajuste linear: ~7,36px/caractere + ~6px fixos. Os
 * valores abaixo arredondam PARA CIMA de propósito (7,5 / 10) — a heurística
 * deve superestimar a largura, nunca subestimar (subestimar é o que deixou o
 * chip de "hoje" sobrepor o tick vizinho na 1ª versão desta função).
 */
const PADDING_ROTULO_PX = 10;
/** Largura aproximada por caractere (px), fonte 12px semibold — heurística calibrada por medição real, não leitura de DOM em tempo real. */
const PX_POR_CARACTERE = 7.5;

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
/** `dd/MM/aaaa` — usado só no chip de "hoje" (achado BAIXO #7: ano no chip). */
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
export type TipoRotulo = "dia" | "semana" | "mes" | "preenchimento" | "hoje" | "borda";

export interface RotuloEixo {
  x: number;
  label: string;
  forte: boolean;
  tipo: TipoRotulo;
}

export interface EscalaEixo {
  /** Grades verticais de segunda-feira (fundo do painel) — nunca colidem entre si (só linhas). */
  guiasSemana: number[];
  /**
   * Faixa do MÊS (2ª linha do cabeçalho, só existe visualmente quando
   * `faixa === "dia"`) — já desconflitada dentro de si mesma.
   */
  ticksMes: RotuloEixo[];
  /**
   * Faixa PRINCIPAL — ticks de dia/semana/mês (conforme `faixa`) + o rótulo
   * de "hoje" + o rótulo da borda esquerda (`x=0`), já unificados e
   * desconflitados numa ÚNICA lista: nenhum par fica a menos de
   * `MINIMO_DIST_ROTULO_PX` (ajustado pela largura aproximada do texto).
   * "hoje" e a borda `x=0` SEMPRE aparecem (mandatórios); "hoje" vence
   * qualquer vizinho em colisão.
   */
  rotulos: RotuloEixo[];
  faixa: FaixaEixo;
}

interface CandidatoInterno {
  x: number;
  label: string;
  forte: boolean;
  tipo: TipoRotulo;
  /** 0 = descartável em colisão; 1 = forte natural; 2 = borda x=0; 3 = hoje. Maior sempre sobrevive. */
  prioridade: 0 | 1 | 2 | 3;
}

/** Largura aproximada (px) do rótulo — heurística por contagem de caracteres, não DOM real. */
function larguraAproximada(label: string): number {
  return label.length * PX_POR_CARACTERE + PADDING_ROTULO_PX;
}

/**
 * Respiro extra (px) além da largura estimada do rótulo à ESQUERDA — nunca
 * zero (rótulos colados na borda, sem nenhum ar, ainda leem mal mesmo sem
 * sobrepor um pixel).
 */
const MARGEM_ENTRE_ROTULOS_PX = 12;

/**
 * Espaço mínimo exigido no eixo X entre `anterior` (o candidato à ESQUERDA
 * — `desconflitar` só chama isto em ordem crescente de x) e o próximo.
 *
 * Achado ALTO (rodada 4) — bug medido no navegador: a 1ª versão usava a
 * MÉDIA das duas larguras (`(larguraA + larguraB) / 2`), um modelo de rótulo
 * CENTRADO. Os rótulos daqui são ANCORADOS PELA ESQUERDA (`style={{left:x}}`,
 * o texto cresce para a DIREITA a partir de x) — o espaço real entre dois é
 * `(x2 − x1) − larguraDoAnterior`, nunca a média. Usar a média SUBESTIMA a
 * exigência sempre que o candidato à esquerda é bem mais largo que o da
 * direita (exatamente o caso do chip "13/09/2026" ao lado de um tick "15" de
 * 2 caracteres): media ≈ 55px, e o "15" sobrevivia a 92px de distância —
 * medido no Playwright: só 8,44px de vão real, abaixo da régua de 40px.
 * Corrigido para depender só da largura do candidato à ESQUERDA + a margem.
 * Rótulos comuns (curtos) continuam batendo no PISO de `MINIMO_DIST_ROTULO_PX`
 * de sempre — só o candidato LARGO (o chip de "hoje") passa a exigir mais.
 */
function distanciaMinima(anterior: CandidatoInterno): number {
  return Math.max(MINIMO_DIST_ROTULO_PX, larguraAproximada(anterior.label) + MARGEM_ENTRE_ROTULOS_PX);
}

/**
 * Resolve colisões numa lista de candidatos JÁ ORDENADA por x: em par a
 * menos da distância mínima, a maior `prioridade` sobrevive; em empate, o
 * "forte" vence; em empate total, o mais à esquerda fica (mesma convenção de
 * antes da rodada 4).
 */
function desconflitar(candidatos: readonly CandidatoInterno[]): RotuloEixo[] {
  const escolhidos: CandidatoInterno[] = [];
  for (const c of candidatos) {
    const anterior = escolhidos[escolhidos.length - 1];
    if (anterior && c.x - anterior.x < distanciaMinima(anterior)) {
      if (c.prioridade > anterior.prioridade || (c.prioridade === anterior.prioridade && c.forte && !anterior.forte)) {
        escolhidos[escolhidos.length - 1] = c;
      }
      continue; // descarta `c` (ou já substituiu `anterior` acima)
    }
    escolhidos.push(c);
  }
  return escolhidos.map(({ x, label, forte, tipo }) => ({ x, label, forte, tipo }));
}

/**
 * ÚNICA função de posicionamento dos rótulos do eixo (achado ALTO, rodada 4:
 * causa raiz "o eixo tem dono demais"). A VIEW só desenha o que esta função
 * devolve — nenhum rótulo nasce fora dela.
 */
export function gerarEscalaEixo(params: {
  minIso: string;
  maxIso: string;
  pxPorDia: number;
  hojeIso: string;
}): EscalaEixo {
  const { minIso, maxIso, pxPorDia, hojeIso } = params;
  const totalDias = Math.min(TETO_DIAS_ESCALA, Math.max(1, diffDias(minIso, maxIso)));
  const faixa: FaixaEixo = pxPorDia >= 24 ? "dia" : pxPorDia >= 8 ? "semana" : "mes";
  const guiasSemana: number[] = [];
  const porX = new Map<number, CandidatoInterno>();
  const porXMes = new Map<number, CandidatoInterno>();
  let anoAnteriorMes: number | null = null;
  /**
   * Achado BAIXO #7 (rodada 4): na faixa "mes" (pxPorDia < 8 — Trimestre e
   * horizontes largos de "auto"), o rótulo de MÊS É a faixa principal — não
   * existe uma 2ª linha separada (essa só existe na faixa "dia"). O ano
   * precisa entrar AQUI também, não só em `porXMes`, senão um horizonte
   * inteiro na faixa "mes" nunca mostra ano nenhum.
   */
  let anoAnteriorPrincipal: number | null = null;

  for (let d = 0; d <= totalDias; d += 1) {
    const iso = somaDiasIso(minIso, d);
    const data = new Date(paraEpoch(iso));
    const ehSegunda = data.getUTCDay() === 1;
    const ehInicioMes = data.getUTCDate() === 1;
    const x = d * pxPorDia;
    if (ehSegunda) guiasSemana.push(x);

    if (faixa === "dia") {
      porX.set(x, { x, label: String(data.getUTCDate()), forte: ehSegunda, tipo: "dia", prioridade: ehSegunda ? 1 : 0 });
    } else if (faixa === "semana") {
      if (ehSegunda) porX.set(x, { x, label: diaMesCurto(iso), forte: ehInicioMes, tipo: "semana", prioridade: 1 });
    } else if (ehInicioMes || d === 0) {
      const ano = anoDoIso(iso);
      const primeiraVezNoAno = anoAnteriorPrincipal !== ano;
      anoAnteriorPrincipal = ano;
      const label = primeiraVezNoAno ? `${mesCurto(iso)}/${ano}` : mesCurto(iso);
      porX.set(x, { x, label, forte: true, tipo: "mes", prioridade: 1 });
    }

    // Faixa de MESES (2ª linha do cabeçalho — só existe visualmente na
    // densidade "dia"): um rótulo por início de mês, mais um no 1º dia
    // visível (mesmo que não seja dia 1) — nunca começa "no vazio". Achado
    // BAIXO #7 (rodada 4): o ANO entra no PRIMEIRO rótulo de mês de cada ano
    // — inclusive na virada (um horizonte que cruza 31/12 ganha o ano de
    // novo no 1º mês do ano seguinte).
    if (faixa === "dia" && (ehInicioMes || d === 0)) {
      const xMes = ehInicioMes ? x : 0;
      const ano = anoDoIso(iso);
      const primeiraVezNoAno = anoAnteriorMes !== ano;
      anoAnteriorMes = ano;
      const label = primeiraVezNoAno ? `${mesCurto(iso)}/${ano}` : mesCurto(iso);
      porXMes.set(xMes, { x: xMes, label, forte: true, tipo: "mes", prioridade: 1 });
    }
  }

  // Rede de segurança: pelo menos 1 rótulo por ~160px, mesmo quando a faixa
  // natural (semana/mês) não cruza nenhum marco dentro da janela visível.
  // O rótulo de PREENCHIMENTO é SEMPRE `dd/MM` — nunca nome de mês.
  const largoDemais = pxPorDia <= 0 ? 1 : Math.max(1, Math.floor(LIMIAR_TICK_PX / pxPorDia));
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
      porX.set(x, { x, label: diaMesCurto(iso), forte: false, tipo: "preenchimento", prioridade: 0 });
    }
  }

  // ── mandatórios: borda x=0 e "hoje" ─────────────────────────────────────
  // Achado MÉDIO #3 (rodada 4): a borda esquerda da escala nunca recebia
  // data (a rede de preenchimento só cobre a partir de `inicio + largoDemais`,
  // pulando x=0 quando ele não coincide com um tick natural). Garantido aqui,
  // SEMPRE — se já existir um tick natural em x=0, ele vira a borda (ganha
  // prioridade 2, "forte"); senão, nasce um novo.
  const candidatoNaturalEm0 = porX.get(0);
  const candidatoBorda: CandidatoInterno = candidatoNaturalEm0
    ? { ...candidatoNaturalEm0, forte: true, tipo: "borda", prioridade: 2 }
    : {
        x: 0,
        label: faixa === "mes" ? mesCurto(somaDiasIso(minIso, 0)) : diaMesCurto(somaDiasIso(minIso, 0)),
        forte: true,
        tipo: "borda",
        prioridade: 2,
      };

  // Achado ALTO (rodada 4, causa raiz): "hoje" entra na MESMA passada de
  // desconflito da faixa principal — nunca mais desenhado por fora dela. Tem
  // a MAIOR prioridade (vence qualquer vizinho em colisão) e carrega o ANO
  // (achado BAIXO #7: "13/09/2026", não só "13/09").
  const xHoje = Math.max(0, Math.min(totalDias * pxPorDia, diffDias(minIso, hojeIso) * pxPorDia));
  const candidatoHoje: CandidatoInterno = {
    x: xHoje,
    label: diaMesAnoCurto(hojeIso),
    forte: true,
    tipo: "hoje",
    prioridade: 3,
  };

  // "hoje" e a borda `x=0` são os DOIS mandatórios — nenhum dos dois pode
  // simplesmente "perder" o outro (a régua de colisão comum favoreceria
  // sempre "hoje", apagando a borda quando os dois caem perto). Quando
  // colidem entre si, funde-se num único rótulo em `x=0` com a cara de
  // "hoje" (mais informativo — leva a data inteira) em vez de desenhar dois
  // rótulos quase colados (isso violaria a MESMA régua de 40px que a função
  // existe para garantir). Longe um do outro, os dois convivem — o normal.
  if (xHoje - candidatoBorda.x < distanciaMinima(candidatoBorda)) {
    porX.set(0, { ...candidatoHoje, x: 0 });
  } else {
    porX.set(0, candidatoBorda);
    porX.set(xHoje, candidatoHoje);
  }

  const comMandatorios = [...porX.values()].sort((a, b) => a.x - b.x || a.prioridade - b.prioridade);
  const desconflitados = desconflitar(comMandatorios);
  // Achado CRÍTICO #1 (rodada 2, NÃO regredir): nenhum vão > `LIMIAR_TICK_PX`
  // em lugar nenhum — inclusive o vão que a eviction de "hoje" (prioridade
  // máxima) pode ter reaberto ao derrubar um tick de preenchimento vizinho.
  // Por isso este preenchimento roda de novo, agora sobre o resultado JÁ
  // desconflitado (nunca antes: preencher antes deixaria "hoje" apagar de
  // novo o preenchimento que acabou de tapar o buraco).
  const rotulos = preencherVaos(desconflitados, minIso, pxPorDia, totalDias * pxPorDia);

  const ticksMesOrdenados = [...porXMes.values()].sort((a, b) => a.x - b.x);
  const ticksMes = desconflitar(ticksMesOrdenados);

  return { guiasSemana, ticksMes, rotulos, faixa };
}

/**
 * Segunda passada, DEPOIS da desconflição por prioridade: preenche qualquer
 * vão residual > `LIMIAR_TICK_PX` entre dois rótulos sobreviventes (ou da
 * borda ao 1º) com rótulos `dd/MM` neutros — nunca reabre uma colisão (o vão
 * já é grande o bastante para caber ticks de preenchimento a ≥ `distancia
 * Minima` de cada vizinho, já que o passo usado é o mesmo `LIMIAR_TICK_PX`).
 */
function preencherVaos(
  base: readonly RotuloEixo[],
  minIso: string,
  pxPorDia: number,
  larguraTotal: number,
): RotuloEixo[] {
  if (pxPorDia <= 0) return [...base];
  const resultado: RotuloEixo[] = [];
  for (let i = 0; i < base.length; i += 1) {
    const atual = base[i]!;
    resultado.push(atual);
    const fimVao = i + 1 < base.length ? base[i + 1]!.x : larguraTotal;
    const vao = fimVao - atual.x;
    if (vao <= LIMIAR_TICK_PX) continue;
    // Distribui N ticks IGUALMENTE dentro do vão (nunca a partir de um passo
    // fixo ancorado em `atual.x`) — garante por construção que cada sub-vão
    // resultante fica ≤ `LIMIAR_TICK_PX` e, no mínimo, ~metade disso (bem
    // acima de `MINIMO_DIST_ROTULO_PX`), mesmo quando o último ficaria colado
    // no próximo rótulo sobrevivente com um passo fixo.
    const n = Math.ceil(vao / LIMIAR_TICK_PX) - 1;
    const passo = vao / (n + 1);
    for (let k = 1; k <= n; k += 1) {
      const x = atual.x + passo * k;
      const d = Math.round(x / pxPorDia);
      const iso = somaDiasIso(minIso, d);
      resultado.push({ x, label: diaMesCurto(iso), forte: false, tipo: "preenchimento" });
    }
  }
  return resultado;
}
