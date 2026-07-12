// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSeedBank, seedText } from "../src/seeds/parse.mjs";
import { tokenize, cosine } from "../src/seeds/similarity.mjs";
import { scoreAgainstSeeds } from "../src/seeds/score.mjs";
import { importSeeds } from "../src/seeds/import-seeds.mjs";

/**
 * Fixture SINTETICA — 2 seeds no formato antigo (YAML-ish + "-----") e 2 no
 * formato novo (heading H2 + campos em negrito). Reproduz as excentricidades
 * reais (indentacao inconsistente de `compoe_com:`, IDs embutidos em prosa
 * em "Componível com:") sem usar nenhum dado real do operador.
 */
const FIXTURE_MD = `# 🌱 FIXTURE SEED BANK (sintetica, para testes)

## ATIVAS

-----

id: S901
data: 2026-01-01
sessao: TEST-01
titulo: Motor de deteccao de assimetria em ideias capturadas
status: ativa
camada: ATIVA
destrava:

- Pipeline de captura sem triagem
- Score manual lento e subjetivo
- Falta de historico comparavel entre ideias
  compoe_com:
- S902
  tipo: canon
  horizonte: atemporal
  forja_tier: 1
  ultima_referencia: 2026-01-01

-----

Sistema deterministico que compara toda nova ideia capturada contra o banco de seeds historico, calculando assimetria (quantas frentes destrava) e sinergia (com quantas seeds compoe). Roda 100% offline, sem LLM, seguindo o principio CLI First do ecossistema.

-----

id: S902
data: 2026-01-02
sessao: TEST-01
titulo: Banco vivo de seeds versionado em markdown
status: ativa
camada: ATIVA
destrava:

- Conhecimento estrategico disperso em chats individuais
  compoe_com:
- S901
  tipo: bridge
  horizonte: 12m
  forja_tier: 2
  ultima_referencia: 2026-01-02

-----

Formato markdown simples, legivel por humano e por maquina, que acumula seeds ao longo do tempo sem nunca deletar entradas.

-----

## S910 — Score de assimetria via cluster reach

**Status:** ATIVA (canonizada em sessao de teste)
**Cluster:** K1 (Cluster de Teste)
**Captura:** 2026-01-03 sessao TEST-02
**Origem:** Necessidade de medir quantas frentes distintas uma ideia nova destrava, inferida via similaridade textual contra seeds ja canonizadas.
**Definição:** Metrica que combina alcance de clusters distintos e amplitude de seeds relacionadas para aproximar o criterio C1 (destrava >=3 frentes) do banco vivo original.
**Componível com:** S911 (fornece o sinal complementar de sinergia), S901 (motor de deteccao original)

-----

## S911 — Sinergia via similaridade textual entre ideias e seeds

**Status:** ATIVA
**Cluster:** (compoe latente, observar emergencia 30d)
**Captura:** 2026-01-04 sessao TEST-02
**Origem:** A media de similaridade entre a ideia nova e as seeds mais proximas aproxima o criterio C2 (compoe com >=2 seeds existentes) sem exigir embeddings ou LLM.
**Definição:** TF cosine sobre bag-of-words tokenizado, com stopwords pt/en removidas, e um limiar minimo de similaridade para considerar uma seed "casada" com a ideia nova.
**Componível com:** S910 (cluster reach), S902 (banco vivo versionado)

-----
`;

test("parseSeedBank parseia o formato antigo (YAML-ish + -----)", () => {
  const seeds = parseSeedBank(FIXTURE_MD);
  const f001 = seeds.find((s) => s.id === "S901");
  assert.ok(f001, "S901 deve ser encontrada");
  assert.equal(f001.titulo, "Motor de deteccao de assimetria em ideias capturadas");
  assert.deepEqual(f001.destrava, [
    "Pipeline de captura sem triagem",
    "Score manual lento e subjetivo",
    "Falta de historico comparavel entre ideias",
  ]);
  assert.deepEqual(f001.compoeCom, ["S902"]);
  assert.equal(f001.tipo, "canon");
  assert.equal(f001.forjaTier, 1);
  assert.equal(f001.status, "ativa");
  assert.ok(f001.body.includes("banco de seeds historico"));
  assert.equal(f001.cluster, null);
});

test("parseSeedBank parseia o formato novo (heading H2 + negrito)", () => {
  const seeds = parseSeedBank(FIXTURE_MD);
  const f010 = seeds.find((s) => s.id === "S910");
  assert.ok(f010, "S910 deve ser encontrada");
  assert.equal(f010.titulo, "Score de assimetria via cluster reach");
  assert.equal(f010.cluster, "K1");
  assert.deepEqual(f010.compoeCom.sort(), ["S901", "S911"]);
  assert.ok(f010.body.length > 0);
  assert.ok(/similaridade/i.test(f010.body));

  const f011 = seeds.find((s) => s.id === "S911");
  assert.ok(f011, "S911 deve ser encontrada");
  // "Cluster:" so tem prosa "(compoe latente...)" sem K-id explicito -> null
  assert.equal(f011.cluster, null);
  assert.deepEqual(f011.compoeCom.sort(), ["S910", "S902"].sort());
});

test("parseSeedBank nunca lanca em markdown vazio/malformado", () => {
  assert.deepEqual(parseSeedBank(""), []);
  assert.deepEqual(parseSeedBank("lixo qualquer\nsem estrutura nenhuma"), []);
  // @ts-expect-error entrada invalida proposital
  assert.deepEqual(parseSeedBank(null), []);
});

test("parseSeedBank extrai as 4 seeds da fixture (sem duplicatas)", () => {
  const seeds = parseSeedBank(FIXTURE_MD);
  const ids = seeds.map((s) => s.id).sort();
  assert.deepEqual(ids, ["S901", "S902", "S910", "S911"]);
});

test("seedText concatena titulo + destrava + corpo", () => {
  const seeds = parseSeedBank(FIXTURE_MD);
  const f002 = seeds.find((s) => s.id === "S902");
  const text = seedText(f002);
  assert.ok(text.includes("Banco vivo de seeds"));
  assert.ok(text.includes("Conhecimento estrategico disperso"));
  assert.ok(text.includes("Formato markdown simples"));
});

test("tokenize: minusculas, sem acento, remove stopwords e tokens curtos", () => {
  const tokens = tokenize("A Ideia é Ótima e Assimétrica, não é?");
  assert.ok(!tokens.includes("a"));
  assert.ok(!tokens.includes("e"));
  assert.ok(!tokens.includes("nao"));
  assert.ok(tokens.includes("ideia"));
  assert.ok(tokens.includes("otima"));
  assert.ok(tokens.includes("assimetrica"));
});

test("tokenize: entrada vazia/invalida devolve array vazio", () => {
  assert.deepEqual(tokenize(""), []);
  // @ts-expect-error entrada invalida proposital
  assert.deepEqual(tokenize(null), []);
});

test("cosine: textos identicos ~1, textos sem overlap = 0", () => {
  const a = tokenize("motor de deteccao de assimetria em ideias");
  const b = tokenize("motor de deteccao de assimetria em ideias");
  assert.ok(cosine(a, b) > 0.99);

  const c = tokenize("motor de deteccao de assimetria");
  const d = tokenize("receita de bolo de cenoura com cobertura");
  assert.equal(cosine(c, d), 0);

  assert.equal(cosine([], ["x"]), 0);
  assert.equal(cosine(["x"], []), 0);
});

test("scoreAgainstSeeds devolve scores 0-100 e matched ordenado desc por similaridade", () => {
  const seeds = parseSeedBank(FIXTURE_MD);
  const idea = "Quero um motor deterministico que detecta assimetria e sinergia comparando ideias novas contra um banco vivo de seeds versionado em markdown.";
  const result = scoreAgainstSeeds(idea, seeds);

  assert.ok(result.asymmetry_score >= 0 && result.asymmetry_score <= 100);
  assert.ok(result.synergy_score >= 0 && result.synergy_score <= 100);
  assert.ok(result.cluster_reach >= 0);
  assert.ok(Array.isArray(result.matched));
  assert.ok(result.matched.length > 0, "a ideia sintetica deve casar com pelo menos 1 seed da fixture");

  for (let i = 1; i < result.matched.length; i++) {
    assert.ok(result.matched[i - 1].similarity >= result.matched[i].similarity, "matched deve estar ordenado desc");
  }
  for (const m of result.matched) {
    assert.ok(m.similarity >= 0.08);
    assert.ok(typeof m.id === "string" && m.id.length > 0);
  }
});

test("scoreAgainstSeeds: ideia sem nenhuma relacao com o banco -> scores baixos/zero e matched vazio", () => {
  const seeds = parseSeedBank(FIXTURE_MD);
  const result = scoreAgainstSeeds("receita de bolo de cenoura com cobertura de chocolate", seeds);
  assert.equal(result.matched.length, 0);
  assert.equal(result.synergy_score, 0);
  assert.equal(result.asymmetry_score, 0);
  assert.equal(result.cluster_reach, 0);
});

test("scoreAgainstSeeds: banco vazio nunca lanca", () => {
  const result = scoreAgainstSeeds("qualquer ideia", []);
  assert.deepEqual(result.matched, []);
  assert.equal(result.asymmetry_score, 0);
  assert.equal(result.synergy_score, 0);
});

test("importSeeds: sem supabaseUrl/serviceKey so parseia (parse-only)", async () => {
  const result = await importSeeds({ md: FIXTURE_MD });
  assert.equal(result.via, "sem-supabase");
  assert.equal(result.upserted, 0);
  assert.equal(result.parsed, 4);
});

test("importSeeds: nunca lanca mesmo com markdown vazio", async () => {
  const result = await importSeeds({ md: "" });
  assert.equal(result.parsed, 0);
  assert.equal(result.via, "sem-supabase");
});
