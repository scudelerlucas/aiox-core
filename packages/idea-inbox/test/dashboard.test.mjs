// @ts-check
/**
 * Testes do dashboard de progresso (api/dashboard.mjs). So exercita
 * `renderDashboard` (pura, sem I/O) — sem depender de HTTP nem do
 * roadmap.json real.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDashboard } from "../api/dashboard.mjs";

const roadmap = {
  title: "Meu Roadmap <Teste>",
  subtitle: "sub & titulo",
  updatedAt: "2026-01-01",
  round: 3,
  items: [
    { id: "A1", tier: 0, title: "Item um", discipline: "Disc", impact: 5, effort: 1, status: "done", note: "ok" },
    { id: "A2", tier: 0, title: "Item dois", discipline: "Disc", impact: 3, effort: 2, status: "planned" },
  ],
};

test("renderDashboard: HTML valido, titulo escapado, badge de status e progresso 50%", () => {
  const html = renderDashboard(roadmap);
  assert.ok(html.startsWith("<!doctype html"), "deve comecar com <!doctype html");
  assert.ok(html.includes("Meu Roadmap &lt;Teste&gt;"), "titulo deve estar escapado (XSS-safe)");
  assert.ok(html.includes('class="badge"'), "deve renderizar ao menos um badge de status");
  assert.ok(html.includes(">50%<"), "1 done de 2 itens -> 50%");
});

test("renderDashboard: roadmap sem items nao lanca e mostra 0%", () => {
  const html = renderDashboard({ title: "Vazio", items: [] });
  assert.ok(html.startsWith("<!doctype html"));
  assert.ok(html.includes(">0%<"));
});

test("renderDashboard: roadmap malformado (sem items array) nao lanca", () => {
  const html = renderDashboard({ title: "Sem items" });
  assert.ok(html.startsWith("<!doctype html"));
  assert.ok(html.includes(">0%<"));
});

test("renderDashboard: agrupa por tier e mostra contagem done/total do tier", () => {
  const html = renderDashboard({
    title: "Tiers",
    items: [
      { id: "T1", tier: 1, title: "x", discipline: "d", impact: 1, effort: 1, status: "done" },
      { id: "T2", tier: 1, title: "y", discipline: "d", impact: 1, effort: 1, status: "blocked" },
      { id: "T3", tier: 2, title: "z", discipline: "d", impact: 1, effort: 1, status: "needs_user" },
    ],
  });
  assert.ok(html.includes("Tier 1"));
  assert.ok(html.includes("Tier 2"));
  assert.ok(html.includes("1/2"), "tier 1 deve mostrar 1 done de 2");
  assert.ok(html.includes("0/1"), "tier 2 deve mostrar 0 done de 1");
});
