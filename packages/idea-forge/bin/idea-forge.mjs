#!/usr/bin/env node
// @ts-check
/**
 * IdeaForge CLI — Sistema Agentico de Ideias.
 * CLI First: toda a inteligencia roda por aqui. Zero-dep.
 *
 * Uso:
 *   idea-forge run --source telegram --text "minha ideia..."
 *   idea-forge run --file ideia.txt
 *   idea-forge run --demo
 *   idea-forge resume <runId>
 *   idea-forge show <runId>
 *   idea-forge stages
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Store } from "../src/store.mjs";
import { createRun, runAll } from "../src/orchestrator.mjs";
import { STAGES } from "../src/index.mjs";
import { isOffline } from "../src/llm.mjs";

const DEMO_IDEA =
  "Quero um sistema onde eu gravo um audio com uma ideia, ela e atomizada pra ter maximo sinal e minimo ruido, " +
  "esteroidada com TGM, OP3LIF e antifragilidade, arquitetada em AIOX PRO com quality gates, e despachada no Claude Code " +
  "pra virar projeto e deploy. Depois roda simulacao end to end ate percentil 99.9, corrige bugs e quebras de fluxo, " +
  "roda RETROFORJA-P com dados do banco ou banco sintetico, e entrega relatorio final grafico em linguagem simples. " +
  "No fim, o fluxo deve ser canonizado pra replicar em outros operadores e projetos.";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    } else args._.push(a);
  }
  return args;
}

function baseDir(args) {
  return args.dir || process.env.IDEAFORGE_DIR || join(process.cwd(), ".idea-forge");
}

function newRunId() {
  const stamp = (process.env.IDEAFORGE_NOW || new Date().toISOString()).replace(/[^0-9]/g, "").slice(0, 14);
  return `if-${stamp}`;
}

async function cmdRun(args) {
  const store = new Store(baseDir(args));
  let text = args.text ? String(args.text) : "";
  if (args.file) text = readFileSync(String(args.file), "utf8");
  if (args.demo) text = DEMO_IDEA;
  if (!text) {
    console.error("erro: forneca --text, --file <path> ou --demo");
    process.exit(1);
  }
  const source = args.source ? String(args.source) : args.demo ? "audio-file" : "text";
  const runId = args["run-id"] ? String(args["run-id"]) : newRunId();
  const state = createRun({ runId, source, text, audioRef: args.audio ? String(args.audio) : null });
  store.save(state);

  console.log(`\n🔨 IdeaForge — run ${runId}`);
  console.log(`   canal: ${source} · modo: ${isOffline() ? "offline (fallback deterministico)" : "LLM habilitado"}\n`);

  await runAll(state, { store });
  printSummary(state, store);
  return state;
}

async function cmdResume(args) {
  const store = new Store(baseDir(args));
  const runId = args._[1];
  if (!runId) return fail("uso: idea-forge resume <runId>");
  const state = store.load(runId);
  console.log(`\n🔨 Retomando run ${runId} a partir do estagio "${state.stage}"\n`);
  await runAll(state, { store });
  printSummary(state, store);
}

function cmdShow(args) {
  const store = new Store(baseDir(args));
  const runId = args._[1];
  if (!runId) return fail("uso: idea-forge show <runId>");
  const state = store.load(runId);
  printSummary(state, store);
  console.log("\nLog:\n" + state.log.map((l) => "  " + l).join("\n"));
}

function printSummary(state, store) {
  const sc = state.scored, sim = state.simulation, rf = state.retroforja;
  console.log("─".repeat(58));
  console.log(`Projeto      : ${state.blueprint?.name}`);
  console.log(`Score gate   : ${sc?.score}/100 (conf ${sc?.confidence}) ${sc?.passed ? "✅ APROVADO" : "⚠️  gaps"} · ${sc?.iterations} self-heal`);
  console.log(`Simulacao E2E: percentil ${sim?.percentile}% em ${sim?.iterations} iteracoes ${sim?.reachedTarget ? "✅" : "⚠️"} · ${sim?.fixedBreaks?.length} quebras corrigidas`);
  console.log(`RETROFORJA-P : ${rf?.backwardScore}/100 · dados ${rf?.dataSource} (conf ${rf?.dataConfidence}%)`);
  console.log(`Dispatch     : ${state.dispatch?.branch} ${state.dispatch?.blocked ? "🚫 bloqueado" : "🚀 liberado"} · deploy ${state.dispatch?.deployTargets?.join(", ")}`);
  console.log("─".repeat(58));
  if (state.report) console.log(`Relatorio    : ${state.report.reportPath}`);
  if (state.report) console.log(`Guia         : ${state.report.guidePath}`);
  if (state.canon) console.log(`Fluxo canon  : ${state.canon.canonPath}`);
  console.log(`Run dir      : ${join(store.runsDir, state.runId)}\n`);
}

function cmdStages() {
  console.log("\nEstagios do fluxo canonico:\n");
  STAGES.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s}`));
  console.log("");
}

function help() {
  console.log(`
🔨 IdeaForge — Sistema Agentico de Ideias (CLI First)

  idea-forge run --demo                     roda o pipeline completo na ideia-demo
  idea-forge run --text "..."               roda a partir de um texto
  idea-forge run --file ideia.txt           roda a partir de um arquivo
  idea-forge run --source telegram --text   define o canal de captura
  idea-forge resume <runId>                 retoma um run interrompido
  idea-forge show <runId>                   mostra o resumo + log de um run
  idea-forge stages                         lista os estagios

  Opcoes: --dir <path> (base, default .idea-forge) · --run-id <id> · --audio <ref>
  Env: ANTHROPIC_API_KEY (liga LLM) · IDEAFORGE_OFFLINE=1 (forca offline) · IDEAFORGE_MODEL
`);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const cmd = args._[0];
  try {
    switch (cmd) {
      case "run": await cmdRun(args); break;
      case "resume": await cmdResume(args); break;
      case "show": cmdShow(args); break;
      case "stages": cmdStages(); break;
      case undefined:
      case "help":
      case "--help":
      case "-h": help(); break;
      default: fail(`comando desconhecido: ${cmd}\nrode "idea-forge help"`);
    }
  } catch (err) {
    fail(`erro: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main();
