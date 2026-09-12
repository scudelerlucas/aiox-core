"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { ContaChip } from "@/components/frentes/conta-chip";
import { Filtros } from "@/components/frentes/filtros";
import { casaBusca, useFiltros } from "@/components/frentes/use-filtros";
import { FUSO } from "@/lib/frentes/compose";
import type { Assunto } from "@/lib/frentes/types";

/**
 * PAINEL DE ASSUNTOS — tudo o que já fechou, do mais novo para o mais antigo.
 *
 * Lista simples, agrupada por mês, com os mesmos filtros do quadro (conta +
 * busca, guardados no endereço). Mostra 50 por vez para a página não pesar.
 */
const PASSO = 50;

/** "setembro de 2026" — no fuso da casa (São Paulo). */
function mesAno(iso: string | null): string {
  if (!iso) return "sem data";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: FUSO,
  }).format(data);
}

/** "11/09/2026" */
function dataCompleta(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO }).format(data);
}

export function HistoricoLista({
  historico,
  contas,
}: {
  historico: Assunto[];
  contas: string[];
}): JSX.Element {
  const { conta, busca, definirConta, definirBusca, limpar } = useFiltros();
  const [visiveis, setVisiveis] = useState(PASSO);

  const filtrados = useMemo(
    () =>
      historico.filter(
        (a) => (conta === "" || a.contaFiltro === conta) && casaBusca(a.busca, busca),
      ),
    [busca, conta, historico],
  );

  const mostrados = filtrados.slice(0, visiveis);

  // Marca a primeira linha de cada mês para desenhar o cabeçalho do grupo.
  const grupos = useMemo(() => {
    const vistos = new Set<string>();
    return mostrados.map((assunto) => {
      const mes = mesAno(assunto.atividadeEm);
      const primeiro = !vistos.has(mes);
      vistos.add(mes);
      return { assunto, mes, primeiro };
    });
  }, [mostrados]);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-5 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
          Tudo o que já fechou
        </h1>
        <p className="mt-1 text-sm text-bone-300">
          do mais novo para o mais antigo ·{" "}
          <Link
            href="/frentes"
            prefetch={false}
            className="inline-flex min-h-[44px] items-center text-gold-300 underline decoration-gold-600 underline-offset-2 hover:text-bone-50 sm:min-h-[24px]"
          >
            voltar aos assuntos
          </Link>
        </p>
      </header>

      <div className="mt-4">
        <Filtros
          contas={contas}
          conta={conta}
          busca={busca}
          onConta={definirConta}
          onBusca={definirBusca}
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-navy-700 px-4 py-6">
          <p className="text-sm text-bone-300">
            {conta !== "" || busca.trim() !== ""
              ? "Nenhum assunto encerrado com esse filtro."
              : "Nada fechou ainda."}
          </p>
          {conta !== "" || busca.trim() !== "" ? (
            <button
              type="button"
              onClick={limpar}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
            >
              limpar filtros
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-state-neutral">
          {`${filtrados.length} ${filtrados.length === 1 ? "assunto" : "assuntos"} · mostrando ${mostrados.length}`}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <caption className="sr-only">
            Assuntos encerrados: quando, qual assunto, onde, desfecho e link
          </caption>
          <thead>
            <tr className="border-b border-navy-700 text-xs uppercase tracking-wide text-state-neutral">
              <th scope="col" className="py-2 pr-3 font-medium">
                quando
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                assunto
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                onde
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                desfecho
              </th>
              <th scope="col" className="py-2 font-medium">
                link
              </th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ assunto, mes, primeiro }) => (
              <Fragment key={assunto.id}>
                {primeiro ? (
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={5}
                      className="pb-1 pt-5 text-left text-xs font-semibold uppercase tracking-wide text-gold-300"
                    >
                      {mes}
                    </th>
                  </tr>
                ) : null}
                <tr className="border-b border-navy-800 align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-state-neutral">
                    {dataCompleta(assunto.atividadeEm)}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-bone-100">{assunto.titulo}</span>
                    {assunto.contaFiltro ? (
                      <span className="ml-2 inline-block align-middle">
                        <ContaChip texto={assunto.etiqueta} cor={assunto.corConta} />
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-xs text-bone-300">
                    {assunto.repo ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-bone-300">
                    {assunto.desfecho ?? "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-col">
                      {assunto.links.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] items-center text-xs text-gold-300 underline decoration-gold-600 underline-offset-2 hover:text-bone-50 sm:min-h-[28px]"
                        >
                          {link.rotulo}
                        </a>
                      ))}
                      {assunto.links.length === 0 ? (
                        <span className="text-xs text-state-neutral">—</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filtrados.length > mostrados.length ? (
        <button
          type="button"
          onClick={() => setVisiveis((v) => v + PASSO)}
          className="mt-5 min-h-[44px] rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
        >
          mostrar mais
        </button>
      ) : null}
    </main>
  );
}
