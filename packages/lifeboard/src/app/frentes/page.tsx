import type { Metadata } from "next";
import Link from "next/link";

import { Board } from "@/components/frentes/board";
import { composeAssuntos } from "@/lib/frentes/compose";
import { getFrentesRepository } from "@/lib/frentes/repository";

/**
 * PAINEL DE ASSUNTOS — a tela (Server Component).
 *
 * Lê os dados no servidor (demonstração ou Supabase real, decidido por
 * `LIFEBOARD_DATA_MODE`), monta o quadro com a função pura `composeAssuntos` e
 * entrega tudo pronto para o componente de cliente, que só cuida dos filtros.
 *
 * Dois cuidados que vêm de erro medido:
 *  • a falha de leitura é REGISTRADA no log do servidor (um `catch` mudo apagava
 *    a única pista do problema) e a pessoa vê uma frase de gente, nunca um JSON;
 *  • quando não veio absolutamente nada do banco, a tela diz que não conseguiu
 *    ler — jamais o "Nada esperando o Lucas 🎉", que seria uma mentira festiva.
 */
export const metadata: Metadata = {
  title: "Assuntos · ALMA PETRA",
  description: "O que está esperando o Lucas, o que está andando e o que já fechou.",
};

export const dynamic = "force-dynamic";

export default async function PaginaAssuntos(): Promise<JSX.Element> {
  let dados;
  try {
    dados = await getFrentesRepository().carregar();
  } catch (erro) {
    console.error("[frentes] falha ao ler os dados do painel:", erro);
    return <NaoConsegui />;
  }

  // Silêncio total das quatro consultas = leitura falhou de verdade.
  const semNada =
    dados.sync.length === 0 &&
    dados.prs.length === 0 &&
    dados.branches.length === 0 &&
    dados.sessoes.length === 0;
  if (semNada) {
    console.error("[frentes] as quatro consultas voltaram vazias (nenhuma linha).");
    return <NaoConsegui />;
  }

  const quadro = composeAssuntos(
    dados.prs,
    dados.branches,
    dados.sessoes,
    dados.sync,
    Date.now(),
  );

  return <Board quadro={quadro} />;
}

/** Aviso de leitura falhada: frase curta, sem detalhe técnico, com saída. */
function NaoConsegui(): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">Assuntos</h1>
      <div
        role="status"
        className="mt-4 rounded-lg border border-state-warning/50 px-4 py-3 text-sm text-bone-100"
      >
        Não consegui ler os dados agora — tente de novo em alguns minutos.
      </div>
      <Link
        href="/frentes"
        prefetch={false}
        className="mt-5 inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
      >
        tentar de novo
      </Link>
    </main>
  );
}
