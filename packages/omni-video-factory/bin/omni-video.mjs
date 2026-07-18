#!/usr/bin/env node
/**
 * omni-video — CLI da fabrica de videos Google OMNI.
 *
 * CLI First: toda a inteligencia vive aqui. Sem UI necessaria.
 *
 * Comandos:
 *   generate  Gera 1 video de um tema.
 *   loop      Gera N videos derivando angulos virais de um seed ("infinito").
 *   batch     Roda um arquivo de briefs (.json) ou temas (.txt).
 *   presets   Lista formatos disponiveis.
 *   personas  Lista personas ("comigo") disponiveis.
 *   doctor    Diagnostica ambiente (API key, ffmpeg, modelos).
 *
 * Flags comuns: --format <id> --persona <nome> --out <dir> --dry-run
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadConfig } from "../src/config.mjs";
import { loadFormats } from "../src/formats.mjs";
import { loadPersona, listPersonas } from "../src/persona.mjs";
import { runBrief } from "../src/pipeline.mjs";
import { runFactory, briefsFromSeed, loadBriefsFile } from "../src/factory.mjs";
import { parseEditorPlan, normalizePlan, planToClipSpecs } from "../src/plan.mjs";
import { hasFfmpeg, ensureDir, writeJson } from "../src/util.mjs";
import { readFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESET_DIR = join(HERE, "..", "presets");
const log = (m) => process.stdout.write(m + "\n");

main().catch((err) => {
  process.stderr.write(`\n✖ ${err.message}\n`);
  if (process.env.AIOX_DEBUG) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const formats = await loadFormats(PRESET_DIR);

  switch (cmd) {
    case "generate":
      return cmdGenerate(args, formats);
    case "loop":
      return cmdLoop(args, formats);
    case "batch":
      return cmdBatch(args, formats);
    case "from-plan":
      return cmdFromPlan(args, formats);
    case "presets":
      return cmdPresets(formats);
    case "personas":
      return cmdPersonas(args);
    case "doctor":
      return cmdDoctor(formats);
    case "help":
    case undefined:
    case "--help":
    case "-h":
      return usage();
    default:
      throw new Error(`Comando desconhecido: ${cmd}. Use 'omni-video help'.`);
  }
}

function buildCtx(args, formats) {
  const config = loadConfig({
    dryRun: !!args["dry-run"],
    outDir: args.out || undefined,
    personaDir: args["persona-dir"] || undefined,
  });
  const formatId = args.format || "reel-viral";
  const preset = formats[formatId];
  if (!preset) {
    throw new Error(
      `Formato "${formatId}" nao existe. Disponiveis: ${Object.keys(formats).join(", ")}`
    );
  }
  const persona = loadPersona(args.persona || "", config.personaDir);
  return { config, preset, persona, log };
}

async function cmdGenerate(args, formats) {
  const topic = args.topic || args._[0];
  if (!topic) throw new Error("Informe --topic \"seu tema\".");
  const ctx = buildCtx(args, formats);
  banner(ctx);
  const brief = {
    topic,
    hook: args.hook,
    scene: args.scene,
    action: args.action,
    cta: args.cta,
    style: args.style,
    language: args.language,
  };
  const res = await runBrief(brief, ctx);
  report([res], ctx);
}

async function cmdLoop(args, formats) {
  const seed = args.seed || args.topic || args._[0];
  if (!seed) throw new Error("Informe --seed \"tema base\".");
  const count = Number(args.count || 10);
  const ctx = buildCtx(args, formats);
  banner(ctx);
  log(`∞ derivando ${count} angulos de "${seed}"`);
  const briefs = briefsFromSeed(seed, count, {
    cta: args.cta,
    language: args.language,
  });
  const { results } = await runFactory(briefs, { ...ctx, resume: !args["no-resume"] });
  report(results, ctx);
}

async function cmdBatch(args, formats) {
  const file = args.file || args._[0];
  if (!file) throw new Error("Informe o arquivo: omni-video batch briefs.json");
  const ctx = buildCtx(args, formats);
  banner(ctx);
  const briefs = loadBriefsFile(file);
  log(`⇢ ${briefs.length} brief(s) carregado(s) de ${file}`);
  const { results } = await runFactory(briefs, { ...ctx, resume: !args["no-resume"] });
  report(results, ctx);
}

async function cmdFromPlan(args, formats) {
  // Ponte Editor OS -> máquina de vídeos: consome o plano do radar-editor-ia.
  const file = args.file || args._[0];
  if (!file) throw new Error("Informe o plano: omni-video from-plan plano.txt|plano.json");
  const ctx = buildCtx(args, formats);
  banner(ctx);

  const raw = readFileSync(file, "utf8");
  let plan;
  if (file.endsWith(".json")) {
    plan = normalizePlan(JSON.parse(raw));
  } else {
    plan = parseEditorPlan(raw, {
      tema: args.topic || "",
      aspectRatio: ctx.preset.aspectRatio,
      language: args.language || "pt-BR",
    });
  }

  const specs = planToClipSpecs(plan, ctx.persona);
  const slug = (args.topic || plan.tema || "editor-os").toString().slice(0, 40).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const dir = ensureDir(`${ctx.config.outDir}/plan-${slug}`);
  writeJson(`${dir}/plan.json`, plan);
  writeJson(`${dir}/clip-specs.json`, specs);

  log(`∷ plano lido: ${plan.cuts.length} corte(s), ${plan.totalSeconds}s total, ${plan.aspectRatio}`);
  for (const s of specs) {
    const tag = s.sourceType === "talking_head" ? "🗣  você" : "🎞  b-roll";
    log(`  [${s.index}] ${tag} ${s.durationSeconds}s ${s.block ? `<${s.block}>` : ""} — ${s.prompt.slice(0, 70)}…`);
  }
  log(`\n  ✓ estruturado: ${dir}/plan.json + clip-specs.json`);
  if (ctx.config.dryRun) {
    log("  (dry-run) specs prontos para render. Defina GEMINI_API_KEY/FAL_KEY para gerar os clipes.");
  }
}

function cmdPresets(formats) {
  log("Formatos disponiveis:\n");
  for (const p of Object.values(formats)) {
    log(
      `  ${p.id.padEnd(20)} ${p.aspectRatio}  ${p.targetSeconds}s  → ${p.provider}  (${p.label})`
    );
  }
}

function cmdPersonas(args) {
  const config = loadConfig({ personaDir: args["persona-dir"] || undefined });
  const names = listPersonas(config.personaDir);
  if (!names.length) {
    log(`Nenhuma persona em "${config.personaDir}".`);
    log(`Crie: ${config.personaDir}/<nome>/ com persona.json + ref-*.jpg`);
    return;
  }
  log(`Personas em ${config.personaDir}:`);
  for (const n of names) {
    const p = loadPersona(n, config.personaDir);
    log(`  ${n.padEnd(16)} ${p.references.length} ref(s)  ${p.loaded ? "✓" : "(texto)"}`);
  }
}

function cmdDoctor(formats) {
  const config = loadConfig();
  log("omni-video doctor\n");
  log(`  API key            ${config.apiKey ? "✓ presente" : "✗ ausente (modo dry-run)"}`);
  log(`  Modelo OMNI        ${config.omniModel}`);
  log(`  Modelo Veo         ${config.veoModel}`);
  log(`  ffmpeg             ${hasFfmpeg() ? "✓ instalado" : "✗ ausente (gera clips + assemble.sh)"}`);
  log(`  Out dir            ${config.outDir}`);
  log(`  Persona dir        ${config.personaDir}`);
  log(`  Formatos           ${Object.keys(formats).length}`);
  log("");
  log(config.apiKey ? "  Pronto para gerar." : "  Sem GEMINI_API_KEY: rode com --dry-run para validar prompts.");
}

function banner(ctx) {
  const mode = ctx.config.dryRun ? "DRY-RUN (offline)" : "LIVE";
  log(`\n🎬 omni-video · ${ctx.preset.label} · persona=${ctx.persona.name} · ${mode}\n`);
}

function report(results, ctx) {
  log("");
  for (const r of results) {
    log(`  • ${r.id} → ${r.status}`);
    if (r.finalVideo) log(`      video: ${r.finalVideo}`);
    log(`      manifest: ${r.manifest}`);
  }
  if (ctx.config.dryRun) {
    log("\n  (dry-run) Nenhuma chamada de API feita. Prompts em manifest.json.");
    log("  Defina GEMINI_API_KEY e remova --dry-run para gerar de verdade.");
  }
}

function usage() {
  log(`omni-video — fabrica de videos Google OMNI (Omni Flash + Veo 3.1)

Uso:
  omni-video generate --topic "tema" [--format reel-viral] [--persona lucas]
  omni-video loop --seed "tema base" --count 20 [--format shorts]
  omni-video batch briefs.json [--format youtube-horizontal]
  omni-video from-plan plano.txt [--persona lucas]   # ponte Editor OS -> vídeo
  omni-video presets
  omni-video personas
  omni-video doctor

Flags:
  --format <id>       reel-viral | shorts | youtube-horizontal | square
  --persona <nome>    pasta em personas/<nome> com ref-*.jpg (voce, "comigo")
  --out <dir>         diretorio de saida (default: output)
  --dry-run           nao chama API; so gera prompts/manifest (offline)
  --hook/--scene/--action/--cta/--style/--language   overrides do brief
  --count <n>         (loop) quantidade de angulos a derivar
  --no-resume         ignora state.json e regenera tudo

Sem GEMINI_API_KEY o CLI roda automaticamente em dry-run.`);
}

/** parser minimalista: --k v, --flag, e posicionais em _ */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}
