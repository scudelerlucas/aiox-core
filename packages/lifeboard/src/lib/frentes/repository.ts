/**
 * PAINEL DE ASSUNTOS — de onde vêm os dados (fixture ou Supabase live).
 *
 * Mesmo padrão do resto do app (`lib/repositories/factory.ts`): UM ponto decide
 * a origem a partir de `env.LIFEBOARD_DATA_MODE`.
 *
 * No modo live a leitura vai na identidade de quem está logado (a RLS libera os
 * e-mails da allowlist) — por isso `server-only`. E nenhuma consulta é aberta:
 * sempre só as colunas usadas, com janela de tempo, ordem e teto. Sem isso, o
 * volume real (825 mudanças / 324 branches / 215 conversas, e crescendo) viraria
 * um `select *` de tabela inteira a cada carregamento de página.
 */

import "server-only";

import { env } from "@/config/env";
import { fixtureFrentes } from "@/lib/frentes/fixture";
import { ENCERRADAS } from "@/lib/frentes/compose";
import type {
  BranchSemPr,
  DadosFrentes,
  Pr,
  Sessao,
  Sync,
} from "@/lib/frentes/types";
import { createSupabaseUserClient } from "@/lib/supabase/user-server";

/** Colunas que a tela realmente lê — nada de `select("*")`. */
const COLUNAS_PR =
  "repo,numero,titulo,estado,rascunho,branch,url,atualizado_em,fechado_em,mergeado_em,checks";
const COLUNAS_BRANCH = "repo,branch,ultimo_commit_em,ultimo_commit_msg,tem_pr";
const COLUNAS_SESSAO =
  "sessao_id,conta,titulo,estado,estado_detalhe,precisa_de,branches,repos,url,criado_em,atualizado_em";
const COLUNAS_SYNC = "fonte,executado_em,ok,itens,erro";

/** Janela de leitura do quadro e tetos por tabela. */
const JANELA_LEITURA_DIAS = 90;
const TETO_PRS = 400;
const TETO_BRANCHES = 400;
const TETO_SESSOES = 600;
const TETO_SYNC = 20;
/** Teto do histórico (a tela corta ainda antes de virar prop). */
export const TETO_HISTORICO = 300;

export interface FrentesRepository {
  /** Dados do quadro: janela de 90 dias, com teto por tabela. */
  carregar(): Promise<DadosFrentes>;
  /** Dados do histórico: consulta própria, só o que já encerrou. */
  carregarHistorico(): Promise<DadosFrentes>;
}

/** Erro de leitura já com mensagem de gente (a tela mostra ela, nunca um JSON). */
export class FrentesIndisponivel extends Error {
  constructor(readonly detalhe: string) {
    super("Não deu para ler os assuntos agora.");
    this.name = "FrentesIndisponivel";
  }
}

class FixtureFrentesRepository implements FrentesRepository {
  async carregar(): Promise<DadosFrentes> {
    return fixtureFrentes(Date.now());
  }

  async carregarHistorico(): Promise<DadosFrentes> {
    const dados = fixtureFrentes(Date.now());
    return {
      prs: dados.prs.filter((p) => p.estado !== "aberto").slice(0, TETO_HISTORICO),
      branches: [],
      sessoes: dados.sessoes
        .filter((s) => ENCERRADAS.has(s.estado))
        .slice(0, TETO_HISTORICO),
      sync: dados.sync,
    };
  }
}

/** ISO de N dias atrás — o corte que vai no `.gte()`. */
function desde(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

class SupabaseFrentesRepository implements FrentesRepository {
  async carregar(): Promise<DadosFrentes> {
    const supabase = await createSupabaseUserClient();
    const corte = desde(JANELA_LEITURA_DIAS);

    const [prs, branches, sessoes, sync] = await Promise.all([
      supabase
        .from("painel_frentes_prs")
        .select(COLUNAS_PR)
        .gte("atualizado_em", corte)
        .order("atualizado_em", { ascending: false })
        .limit(TETO_PRS),
      supabase
        .from("painel_frentes_branches")
        .select(COLUNAS_BRANCH)
        .order("ultimo_commit_em", { ascending: false })
        .limit(TETO_BRANCHES),
      supabase
        .from("painel_frentes_sessoes")
        .select(COLUNAS_SESSAO)
        .gte("atualizado_em", corte)
        .order("atualizado_em", { ascending: false })
        .limit(TETO_SESSOES),
      supabase
        .from("painel_frentes_sync")
        .select(COLUNAS_SYNC)
        .order("executado_em", { ascending: false })
        .limit(TETO_SYNC),
    ]);

    const falha = [prs.error, branches.error, sessoes.error, sync.error].find(Boolean);
    if (falha) throw new FrentesIndisponivel(falha.message);

    return {
      prs: (prs.data ?? []) as unknown as Pr[],
      branches: (branches.data ?? []) as unknown as BranchSemPr[],
      sessoes: (sessoes.data ?? []) as unknown as Sessao[],
      sync: (sync.data ?? []) as unknown as Sync[],
    };
  }

  async carregarHistorico(): Promise<DadosFrentes> {
    const supabase = await createSupabaseUserClient();

    const [prs, sessoes] = await Promise.all([
      supabase
        .from("painel_frentes_prs")
        .select(COLUNAS_PR)
        .in("estado", ["mergeado", "fechado"])
        .order("atualizado_em", { ascending: false })
        .limit(TETO_HISTORICO),
      supabase
        .from("painel_frentes_sessoes")
        .select(COLUNAS_SESSAO)
        .in("estado", [...ENCERRADAS])
        .order("atualizado_em", { ascending: false })
        .limit(TETO_HISTORICO),
    ]);

    const falha = [prs.error, sessoes.error].find(Boolean);
    if (falha) throw new FrentesIndisponivel(falha.message);

    return {
      prs: (prs.data ?? []) as unknown as Pr[],
      branches: [],
      sessoes: (sessoes.data ?? []) as unknown as Sessao[],
      sync: [],
    };
  }
}

export function getFrentesRepository(): FrentesRepository {
  return env.LIFEBOARD_DATA_MODE === "live"
    ? new SupabaseFrentesRepository()
    : new FixtureFrentesRepository();
}
