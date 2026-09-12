import type { Metadata } from "next";
import Link from "next/link";

import { HistoricoLista } from "@/components/frentes/historico-lista";
import { composeAssuntos } from "@/lib/frentes/compose";
import { TETO_HISTORICO, getFrentesRepository } from "@/lib/frentes/repository";

/**
 * PAINEL DE ASSUNTOS — histórico completo (Server Component).
 *
 * Consulta PRÓPRIA (só o que já encerrou, com teto), composta pela mesma função
 * pura e cortada AQUI, no servidor, antes de virar prop: a tela nunca recebe
 * mais de `TETO_HISTORICO` cartões.
 */
export const metadata: Metadata = {
  title: "Tudo o que já fechou · ALMA PETRA",
  description: "Lista completa dos assuntos encerrados, do mais novo para o mais antigo.",
};

export const dynamic = "force-dynamic";

export default async function PaginaHistorico(): Promise<JSX.Element> {
  let dados;
  try {
    dados = await getFrentesRepository().carregarHistorico();
  } catch (erro) {
    console.error("[frentes/historico] falha ao ler o histórico:", erro);
    return <NaoConsegui />;
  }

  // Erro de leitura já saiu acima (exceção). Consulta que respondeu com zero
  // linhas é histórico vazio de verdade: a lista diz "Nada fechou ainda.".

  const quadro = composeAssuntos(
    dados.prs,
    dados.branches,
    dados.sessoes,
    dados.sync,
    Date.now(),
  );

  return (
    <HistoricoLista
      historico={quadro.historico.slice(0, TETO_HISTORICO)}
      contas={quadro.contas}
      cortouNoTeto={dados.cortouNoTeto}
      teto={TETO_HISTORICO}
    />
  );
}

function NaoConsegui(): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
        Tudo o que já fechou
      </h1>
      <div
        role="status"
        className="mt-4 rounded-lg border border-state-warning/50 px-4 py-3 text-sm text-bone-100"
      >
        Não consegui ler os dados agora — tente de novo em alguns minutos.
      </div>
      <Link
        href="/frentes/historico"
        prefetch={false}
        className="mt-5 inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
      >
        tentar de novo
      </Link>
    </main>
  );
}
