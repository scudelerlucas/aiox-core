// @ts-check
/**
 * Executor REALIZE — fecha o laco: pega o DispatchManifest de um run concluido e
 * ACIONA a construcao do projeto-filho (o "despachar no Claude Code").
 *
 * Dois modos:
 *  - Executor configurado (env IDEAFORGE_EXECUTOR): um comando headless — tipicamente
 *    `claude -p` — recebe o KICKOFF e constroi o projeto de fato. spawn real.
 *  - Sem executor: retorna o HANDOFF (branch, dir, kickoff, comando sugerido) para um
 *    agente/humano executar. Nunca inventa deploy: reporta o que aconteceu.
 *
 * O executor recebe por env: KICKOFF_FILE, TARGET_DIR, BRANCH, RUN_ID.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, isAbsolute } from "node:path";

/**
 * @param {import("../types.mjs").PipelineState} state
 * @param {{store:any, targetDir?:string, executor?:string}} ctx
 */
export function realize(state, ctx) {
  const store = ctx.store;
  const dispatch = state.dispatch;
  const bp = state.blueprint;
  if (!dispatch || !bp) throw new Error("run sem dispatch/blueprint — rode o pipeline ate 'dispatch' antes de realize");

  const runDir = join(store.runsDir, state.runId);
  const kickoffPath = join(runDir, "KICKOFF.md");
  if (!existsSync(kickoffPath)) throw new Error(`KICKOFF.md ausente em ${runDir}`);

  const targetDir = ctx.targetDir
    ? isAbsolute(ctx.targetDir)
      ? ctx.targetDir
      : join(process.cwd(), ctx.targetDir)
    : join(process.cwd(), bp.slug);
  mkdirSync(targetDir, { recursive: true });

  const executor = ctx.executor || process.env.IDEAFORGE_EXECUTOR || "";
  const handoff = {
    runId: state.runId,
    branch: dispatch.branch,
    targetDir,
    kickoffPath,
    filesToCreate: dispatch.filesToCreate,
    deployTargets: dispatch.deployTargets,
    blocked: dispatch.blocked,
    suggestedCommand: `IDEAFORGE_EXECUTOR="claude -p" idea-forge realize ${state.runId} --target ${targetDir}`,
  };

  if (dispatch.blocked) {
    const rec = { ...handoff, executed: false, note: `BLOQUEADO pelo gate de qualidade: ${dispatch.note}` };
    store.writeArtifact(state.runId, "realize.json", JSON.stringify(rec, null, 2));
    return rec;
  }

  // B.2 — gate de qualidade do auto-deploy: mesmo que o dispatch nao esteja
  // marcado como bloqueado, um executor real NUNCA deve construir/deployar um
  // blueprint cujo score nao passou (state.scored.passed === false). So se
  // aplica quando ha executor configurado — sem executor, o handoff (abaixo)
  // ja deixa claro que e so um handoff pendente, nao uma execucao.
  if (executor && state.scored && state.scored.passed === false) {
    const rec = {
      ...handoff,
      executed: false,
      note: `RECUSADO pelo gate de qualidade (B.2): score ${state.scored.score} nao passou — executor NAO foi chamado.`,
    };
    store.writeArtifact(state.runId, "realize.json", JSON.stringify(rec, null, 2));
    return rec;
  }

  if (!executor) {
    const rec = { ...handoff, executed: false, note: "sem IDEAFORGE_EXECUTOR — handoff pronto para agente/humano executar" };
    store.writeArtifact(state.runId, "realize.json", JSON.stringify(rec, null, 2));
    return rec;
  }

  // Executor real: constroi o projeto-filho.
  const started = Date.now();
  const res = spawnSync("sh", ["-c", executor], {
    cwd: targetDir,
    env: { ...process.env, KICKOFF_FILE: kickoffPath, TARGET_DIR: targetDir, BRANCH: dispatch.branch, RUN_ID: state.runId },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const rec = {
    ...handoff,
    executed: true,
    exitCode: res.status,
    durationMs: Date.now() - started,
    ok: res.status === 0,
    stdoutTail: tail(res.stdout || "", 4000),
    stderrTail: tail(res.stderr || "", 2000),
    note: res.status === 0 ? "executor concluiu com sucesso" : `executor falhou (exit ${res.status})`,
  };
  store.writeArtifact(state.runId, "realize.json", JSON.stringify(rec, null, 2));
  return rec;
}

function tail(s, n) {
  return s.length > n ? s.slice(-n) : s;
}

export default { realize };
