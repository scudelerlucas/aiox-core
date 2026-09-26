import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * OS-LIFEBOARD · P5 — rodada 13, achado ALTO 2 (3ª entrega): A MEDIDA QUE
 * IMPEDE A VOLTA.
 *
 * O defeito: `paraDataCurta(iso) { return iso.slice(0, 10) }` — o dia em UTC —
 * enquanto `hoje` vinha de `hojeNoFusoDoOperador` (America/São Paulo). As duas
 * pontas da mesma tela em calendários diferentes; em dado real de produção
 * (`painel_frentes_prs`, 865 linhas) 121 PRs (14,0%) têm dia de criação
 * diferente entre os dois fusos. Nenhum portão via, porque o `title` e o pixel
 * saem do MESMO campo: os dois mentiam a mesma mentira.
 *
 * Uma correção pontual volta na próxima sessão que precisar de "só a data".
 * Esta medida fecha a CLASSE: **nenhum arquivo do caminho de data da linha do
 * tempo corta um ISO com `slice(0, 10)`** (nem `substring`, nem `substr`),
 * exceto o que estiver declarado aqui embaixo, com motivo escrito.
 *
 * O universo é DERIVADO, não listado: parte dos dois módulos que a tela usa e
 * segue os `import … from "@/…"` até o fecho transitivo. Um arquivo novo
 * entrando no caminho entra na varredura sozinho — que é o contrário de uma
 * lista escrita à mão, que envelhece em silêncio.
 *
 * As duas redes têm de fechar nos dois sentidos: ocorrência não declarada
 * REPROVA (é o defeito voltando), e declaração sem ocorrência TAMBÉM reprova
 * (é uma exceção morta guardando a porta aberta para outra coisa).
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * As portas de entrada da tela. Rodada 14 (achado BAIXO 6): eram DUAS — a
 * montagem pura e o componente — e faltava justamente **a rota**, que é onde
 * `hoje` NASCE (`hojeNoFusoDoOperador()` em `src/app/linha-do-tempo/page.tsx`)
 * e de onde ele desce para todo o resto. A varredura seguia os `import` a
 * partir das entradas, e a rota importa as entradas, não o contrário: o
 * arquivo que origina a data ficava fora do universo da medida que existe
 * para proteger a data. Um `slice(0, 10)` na rota — exatamente o defeito
 * original, no lugar mais provável dele — passava em silêncio.
 *
 * Entrando a rota, todo o caminho do servidor entra junto (CPM, repositórios,
 * `lib/frentes`), porque o fecho transitivo os puxa.
 */
const ENTRADAS = [
  "src/app/linha-do-tempo/page.tsx",
  "src/core/timeline/linha-do-tempo.ts",
  "src/components/timeline/linha-do-tempo.tsx",
];

/** `@/x/y` → o arquivo real, testando as extensões que o projeto usa. */
function resolver(spec: string): string | null {
  const base = join("src", spec.replace(/^@\//, ""));
  for (const candidato of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(join(RAIZ, candidato))) return candidato;
  }
  return null;
}

/** Fecho transitivo dos `@/…` a partir das entradas — o caminho de dado inteiro. */
function universo(): string[] {
  const vistos = new Set<string>();
  const fila = [...ENTRADAS];
  while (fila.length > 0) {
    const arquivo = fila.pop();
    if (arquivo === undefined || vistos.has(arquivo)) continue;
    vistos.add(arquivo);
    const fonte = readFileSync(join(RAIZ, arquivo), "utf8");
    for (const m of fonte.matchAll(/from\s+"(@\/[^"]+)"/g)) {
      const alvo = resolver(m[1] ?? "");
      if (alvo !== null && !vistos.has(alvo)) fila.push(alvo);
    }
  }
  return [...vistos].sort();
}

/**
 * As exceções. Cada uma é aritmética de dias sobre uma data que JÁ É
 * `AAAA-MM-DD` no fuso do operador, lida como meia-noite UTC: somar N dias
 * inteiros mantém o instante em meia-noite UTC, e o corte devolve o mesmo dia
 * de calendário que entrou, mais N. Não há instante de operador para
 * converter aqui — converter seria deslocar a conta um dia.
 */
const TRUNCAMENTOS_DECLARADOS = [
  {
    arquivo: "src/core/timeline/linha-do-tempo.ts",
    trecho: "dataFinal.toISOString().slice(0, 10)",
    motivo: "`somaDias`: a base é `AAAA-MM-DD` parseada como meia-noite UTC; o resultado é dia + N, não um instante",
  },
  {
    arquivo: "src/components/timeline/linha-do-tempo.tsx",
    trecho: "new Date(paraEpoch(iso) + dias * MS_POR_DIA).toISOString().slice(0, 10)",
    motivo: "`somaDias` da view: `paraEpoch` monta `${iso}T00:00:00.000Z` de propósito — aritmética de dia, nunca instante",
  },
  {
    arquivo: "src/core/timeline/eixo-rotulos.ts",
    trecho: "new Date(paraEpoch(iso) + dias * MS_POR_DIA).toISOString().slice(0, 10)",
    motivo: "idem, para gerar as colunas do eixo a partir do primeiro dia da janela",
  },
] as const;

const RE_CORTE = /\.(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)/;

/** Linha de comentário (`//`, `/*`, `*`) não é código — e não vira falso vermelho. */
function ehComentario(linha: string): boolean {
  const t = linha.trim();
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
}

interface Ocorrencia {
  arquivo: string;
  linha: number;
  texto: string;
}

function ocorrencias(): Ocorrencia[] {
  const achados: Ocorrencia[] = [];
  for (const arquivo of universo()) {
    const linhas = readFileSync(join(RAIZ, arquivo), "utf8").split("\n");
    linhas.forEach((texto, i) => {
      if (!ehComentario(texto) && RE_CORTE.test(texto)) {
        achados.push({ arquivo, linha: i + 1, texto: texto.trim() });
      }
    });
  }
  return achados;
}

describe("nenhum caminho de data da linha do tempo corta um ISO por `slice`", () => {
  it("o universo é derivado de verdade: as entradas puxam o resto do caminho", () => {
    const arquivos = universo();
    /* Se a derivação quebrar (um `import` mudando de forma), ela devolveria só
       as entradas — e a varredura aprovaria por vazio. Este é o piso. */
    expect(arquivos.length).toBeGreaterThan(10);
    expect(arquivos).toContain("src/lib/fuso.ts");
    expect(arquivos).toContain("src/core/timeline/eixo-rotulos.ts");
    /* A rota está DENTRO do universo — é lá que `hoje` nasce (achado BAIXO 6). */
    expect(arquivos).toContain("src/app/linha-do-tempo/page.tsx");
    expect(arquivos).toContain("src/core/prioritize/caminho-critico.ts");
    expect(relative(RAIZ, join(RAIZ, arquivos[0] ?? ""))).toBe(arquivos[0]);
  });

  it("toda ocorrência de `slice(0, 10)` está declarada, com motivo escrito", () => {
    const naoDeclaradas = ocorrencias().filter(
      (o) =>
        !TRUNCAMENTOS_DECLARADOS.some((d) => d.arquivo === o.arquivo && o.texto.includes(d.trecho)),
    );
    expect(
      naoDeclaradas.map((o) => `${o.arquivo}:${String(o.linha)} → ${o.texto}`),
      "corte de ISO sem declaração: ou use `diaNoFusoDoOperador` (@/lib/fuso), ou declare aqui por que este corte não é um dia de calendário",
    ).toEqual([]);
  });

  it("toda declaração ainda existe no código — exceção morta reprova igual", () => {
    const achadas = ocorrencias();
    const mortas = TRUNCAMENTOS_DECLARADOS.filter(
      (d) => !achadas.some((o) => o.arquivo === d.arquivo && o.texto.includes(d.trecho)),
    );
    expect(mortas.map((d) => `${d.arquivo} → ${d.trecho}`)).toEqual([]);
  });

  it("a montagem da linha do tempo converte pelo fuso, e não por corte de string", () => {
    const fonte = readFileSync(join(RAIZ, "src/core/timeline/linha-do-tempo.ts"), "utf8");
    expect(fonte).toContain('from "@/lib/fuso"');
    expect(fonte).toContain("diaNoFusoDoOperador");
  });
});
