/**
 * OS-LIFEBOARD · P4 — A PROMESSA DA PEÇA, ESCRITA UMA VEZ, FORA DAS TABELAS.
 *
 * ── Por que este arquivo existe (rodada 15, achados ALTO 1 e ALTO 2) ───────
 *
 * A guarda de navegador já exigia que as DUAS tabelas de cor do grafo
 * concordassem entre si: o hex de `aresta-svg.tsx` (o que o grafo pinta) e o
 * token `aresta.*` de `tailwind.config.ts` (o que o tema declara). Concordar
 * é necessário e não é suficiente: **as duas tabelas são do produto**, então
 * trocar as duas no mesmo ato faz a régua trocar junto. O crítico hostil
 * provou com duas linhas — `ARESTA_STROKE_CRITICO` e `aresta.critico`, os
 * dois de `#FF7A6B` para `#5FE39A`. Todos os portões verdes, inclusive
 * `checar-contraste.mjs` imprimindo `ok 12,40:1` (ele mede o hex NOVO), e na
 * tela os pixels na cor do caminho crítico caíam de 1661 para 832: o traço
 * triplo ficava do mesmo verde das arestas de sucessão. **Nada, em lugar
 * nenhum do repositório, afirmava que o caminho crítico é vermelho.**
 *
 * O mesmo buraco existia nos NOMES. `CAMADA_LABEL` alimenta o painel, a lista
 * acessível e a própria guarda; o único teste comparava o rótulo da lista com
 * `CAMADA_LABEL` — de novo a fonte consigo mesma. Trocar "Sucessão" e
 * "Correlação" de lugar passava em tudo, e quem opera por teclado passava a
 * ler **"Correlação: habilita X"** (verbo com direção numa relação simétrica)
 * e **"Sucessão: com Y"** (verbo simétrico na única camada com direção) — a
 * dependência anunciada ao contrário.
 *
 * ── O que este arquivo é, e o que ele NÃO é ───────────────────────────────
 *
 * Ele é a promessa em palavras: *o caminho crítico é vermelho*, *sucessão tem
 * direção e as outras três não*. Ele **não** guarda hex nenhum e **não**
 * guarda nome de camada nenhum — guarda a FAMÍLIA da cor (faixa de matiz,
 * saturação e luminância mínimas) e a DIREÇÃO de cada nome. Ajustar o tom do
 * vermelho (`#FF7A6B` → `#F2685C`) se faz nas duas tabelas de cor e não
 * encosta aqui; trocar o vermelho por verde exige vir aqui e **escrever que o
 * caminho crítico deixou de ser vermelho** — que é uma declaração, não um
 * ajuste fino.
 *
 * Quem cobra: `tests/unit/promessa-do-grafo.test.ts` (portão de unidade) e
 * `scripts/guarda-no-navegador.mjs` (§0 do contrato e §10 da lista acessível),
 * que leem daqui e nunca das tabelas que este arquivo audita.
 */

/** Uma família de cor, em HSL. `hueDe > hueAte` significa faixa que dá a volta no zero. */
export interface FamiliaDeCor {
  /** Início da faixa de matiz, em graus (inclusivo). */
  hueDe: number;
  /** Fim da faixa de matiz, em graus (inclusivo). Menor que `hueDe` = dá a volta. */
  hueAte: number;
  satMin: number;
  satMax: number;
  lumMin: number;
  lumMax: number;
  /** Como um humano chamaria esta família — é isto que aparece na reprovação. */
  emPortugues: string;
}

/**
 * As famílias. Note que as cromáticas exigem `satMin ≥ 0.45` e a neutra exige
 * `satMax ≤ 0.40`: é o que torna as seis DISJUNTAS por construção (conferido
 * por `familiasSeSobrepoem`, e cobrado pelo teste e pela guarda) — sem isso,
 * "declarar o crítico na família do verde" seria um ajuste e não uma troca de
 * promessa.
 */
export const FAMILIAS_DE_COR = {
  vermelho: { hueDe: 345, hueAte: 15, satMin: 0.45, satMax: 1, lumMin: 0.35, lumMax: 0.82, emPortugues: "vermelho" },
  verde: { hueDe: 95, hueAte: 175, satMin: 0.45, satMax: 1, lumMin: 0.3, lumMax: 0.85, emPortugues: "verde" },
  roxo: { hueDe: 255, hueAte: 295, satMin: 0.45, satMax: 1, lumMin: 0.35, lumMax: 0.88, emPortugues: "roxo" },
  magenta: { hueDe: 300, hueAte: 340, satMin: 0.45, satMax: 1, lumMin: 0.35, lumMax: 0.85, emPortugues: "magenta" },
  dourado: { hueDe: 30, hueAte: 60, satMin: 0.45, satMax: 1, lumMin: 0.35, lumMax: 0.85, emPortugues: "dourado" },
  neutroClaro: { hueDe: 0, hueAte: 360, satMin: 0, satMax: 0.4, lumMin: 0.6, lumMax: 0.95, emPortugues: "clara e sem cor própria" },
} as const satisfies Record<string, FamiliaDeCor>;

export type NomeDeFamilia = keyof typeof FAMILIAS_DE_COR;

/**
 * A promessa de cor de cada PAPEL de aresta (os papéis de `TIPOS_DE_BANDA`,
 * em `geometria-da-aresta.ts`). Em palavras: o caminho crítico é **vermelho**;
 * a sucessão é **verde**; a obsolescência é **magenta**; a sinergia é
 * **roxa**; a correlação é **clara e sem cor própria**; e o predecessor do
 * cartão selecionado é **dourado**.
 */
export const FAMILIA_EXIGIDA_POR_PAPEL = {
  sucessao: "verde",
  correlacao: "neutroClaro",
  sinergia: "roxo",
  obsolescencia: "magenta",
  destacada: "dourado",
  critico: "vermelho",
} as const satisfies Record<string, NomeDeFamilia>;

/**
 * A promessa de DIREÇÃO, indexada pelo NOME que o humano lê — nunca pela
 * chave da camada. É o que fecha a troca de rótulos: quem trocar "Sucessão" e
 * "Correlação" de lugar em `CAMADA_LABEL` vai ter a camada de verbo
 * direcional carregando um nome declarado aqui como simétrico.
 *
 * "direcional" = a relação tem um lado que vem antes e um que vem depois, e a
 * tela promete isso com um verbo que aponta e com um glifo de seta.
 * "simetrica" = os dois lados são intercambiáveis para quem lê.
 */
export const DIRECAO_POR_ROTULO = {
  "Sucessão": "direcional",
  "Correlação": "simetrica",
  "Sinergia": "simetrica",
  "Obsolescência": "simetrica",
  "Caminho crítico": "direcional",
} as const satisfies Record<string, "direcional" | "simetrica">;

export type DirecaoDeRelacao = (typeof DIRECAO_POR_ROTULO)[keyof typeof DIRECAO_POR_ROTULO];

/** Os verbos com que a lista acessível abre um item de relação DIRECIONAL. */
export const VERBOS_DIRECIONAIS = ["depende de", "habilita", "vem de", "segue para"] as const;
/** O verbo com que ela abre um item de relação SIMÉTRICA. */
export const VERBOS_SIMETRICOS = ["com"] as const;

/** As formas de glifo que AFIRMAM direção. Qualquer outra é simétrica. */
export const FORMAS_DIRECIONAIS = ["seta"] as const;

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** `#RRGGBB` → HSL (h em graus, s e l em 0–1). `null` se não for um hex de 6 dígitos. */
export function hexParaHsl(hex: string): Hsl | null {
  const limpo = hex.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(limpo)) return null;
  const r = Number.parseInt(limpo.slice(1, 3), 16) / 255;
  const g = Number.parseInt(limpo.slice(3, 5), 16) / 255;
  const b = Number.parseInt(limpo.slice(5, 7), 16) / 255;
  const maior = Math.max(r, g, b);
  const menor = Math.min(r, g, b);
  const l = (maior + menor) / 2;
  const d = maior - menor;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - maior - menor) : d / (maior + menor);
  let h: number;
  if (maior === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (maior === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function matizNaFaixa(h: number, de: number, ate: number): boolean {
  const g = ((h % 360) + 360) % 360;
  return de <= ate ? g >= de && g <= ate : g >= de || g <= ate;
}

/**
 * A cor pertence à família? Cor sem saturação nenhuma (cinza puro) só cabe na
 * família cujo `satMin` é 0 — o matiz de um cinza não quer dizer nada.
 */
export function corNaFamilia(hex: string, familia: FamiliaDeCor): boolean {
  const hsl = hexParaHsl(hex);
  if (hsl === null) return false;
  if (hsl.s < familia.satMin || hsl.s > familia.satMax) return false;
  if (hsl.l < familia.lumMin || hsl.l > familia.lumMax) return false;
  if (familia.satMin === 0) return true;
  return matizNaFaixa(hsl.h, familia.hueDe, familia.hueAte);
}

/**
 * Duas famílias se sobrepõem? Usado para provar que a promessa DISTINGUE os
 * papéis: se "vermelho" e "verde" pudessem valer para a mesma cor, dizer "o
 * caminho crítico é vermelho" não excluiria nada.
 */
export function familiasSeSobrepoem(a: FamiliaDeCor, b: FamiliaDeCor): boolean {
  if (a.satMin > b.satMax || b.satMin > a.satMax) return false;
  if (a.lumMin > b.lumMax || b.lumMin > a.lumMax) return false;
  if (a.satMin === 0 || b.satMin === 0) return true;
  for (let h = 0; h < 360; h += 1) {
    if (matizNaFaixa(h, a.hueDe, a.hueAte) && matizNaFaixa(h, b.hueDe, b.hueAte)) return true;
  }
  return false;
}

/** O verbo com que um item da lista acessível abre — `null` se não reconhecer nenhum. */
export function direcaoDoVerbo(item: string): DirecaoDeRelacao | null {
  const texto = item.trim();
  for (const v of VERBOS_DIRECIONAIS) if (texto.startsWith(`${v} `)) return "direcional";
  for (const v of VERBOS_SIMETRICOS) if (texto.startsWith(`${v} `)) return "simetrica";
  return null;
}
