"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ContaChip } from "@/components/frentes/conta-chip";
import { Filtros } from "@/components/frentes/filtros";
import { casaBusca, useFiltros } from "@/components/frentes/use-filtros";
import {
  PRIMEIRO_PAINT_CELULAR,
  PRIMEIRO_PAINT_DESKTOP,
  TETO_VISIVEL,
} from "@/lib/frentes/compose";
import type { Assunto, Coluna, ColunaId, QuadroAssuntos } from "@/lib/frentes/types";

/**
 * PAINEL DE ASSUNTOS — o quadro.
 *
 * Responde três perguntas sem ninguém explicar nada: o que está esperando o
 * Lucas, o que está andando, o que fechou. Um assunto = um cartão. Nenhuma
 * palavra de bastidor na tela.
 *
 * O que o volume real obrigou a existir aqui: um resumo em uma linha no topo
 * (senão a primeira leitura é uma parede de cartões), teto de 25 cartões por
 * coluna, bloco recolhido "mais antigos" e, no celular, "Parado" e "Fechou esta
 * semana" nascendo fechados — a tela do celular não pode ter três metros.
 */
const RECOLHIDAS_NO_CELULAR: ColunaId[] = ["parado", "fechado"];

function Cartao({ assunto }: { assunto: Assunto }): JSX.Element {
  return (
    <article className="rounded-lg border border-navy-700 bg-navy-850 p-3 shadow-node">
      <h3 className="text-[15px] font-medium leading-snug text-bone-100">
        {assunto.titulo}
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-state-neutral">
        <ContaChip texto={assunto.etiqueta} cor={assunto.corConta} />
        <span>
          {assunto.contaFiltro && assunto.repo ? `${assunto.repo} · ` : ""}
          {assunto.atividadeTexto}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-snug text-bone-300">{assunto.situacao}</p>

      {assunto.links.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-4">
          {assunto.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center text-[13px] text-gold-300 underline decoration-gold-600 underline-offset-2 hover:text-bone-50 sm:min-h-[28px]"
            >
              {link.rotulo}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Uma coluna: cabeçalho colado no topo, cartões, "mostrar mais" e "mais antigos". */
function ColunaQuadro({
  coluna,
  temLeituraOk,
  filtroAtivo,
  recolhida,
  podeRecolher,
  primeiroPaint,
  alternar,
}: {
  coluna: Coluna;
  temLeituraOk: boolean;
  filtroAtivo: boolean;
  recolhida: boolean;
  podeRecolher: boolean;
  primeiroPaint: number;
  alternar: () => void;
}): JSX.Element {
  // Quantos cartões a mais que o primeiro paint já foram pedidos.
  const [extra, setExtra] = useState(0);
  const total = coluna.assuntos.length + coluna.antigos.length;
  const visiveis = coluna.assuntos.slice(0, primeiroPaint + extra);
  const faltam = coluna.assuntos.length - visiveis.length;

  const rotulo = (
    <>
      <span>{coluna.nome}</span>
      <span className="text-xs font-normal text-state-neutral">
        {coluna.assuntos.length}
        {coluna.antigos.length > 0 ? ` (+${coluna.antigos.length})` : ""}
        {recolhida ? " · mostrar" : ""}
      </span>
    </>
  );

  return (
    <section aria-labelledby={`coluna-${coluna.id}`}>
      <div className="sticky top-0 z-10 -mx-1 border-b border-navy-700 bg-navy-950/95 px-1 pb-2 pt-1 backdrop-blur">
        <h2 id={`coluna-${coluna.id}`} className="text-sm font-semibold text-bone-100">
          {podeRecolher ? (
            // No celular o cabeçalho é o botão do acordeão…
            <button
              type="button"
              onClick={alternar}
              aria-expanded={!recolhida}
              aria-controls={`lista-${coluna.id}`}
              className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
            >
              {rotulo}
            </button>
          ) : (
            // …e no desktop é só um título: nada de botão focável que não faz nada.
            <span className="flex items-baseline justify-between gap-2">{rotulo}</span>
          )}
        </h2>
      </div>

      <div id={`lista-${coluna.id}`} hidden={recolhida} className="mt-3 flex flex-col gap-3">
        {total === 0 ? (
          filtroAtivo ? null : (
            <p className="rounded-lg border border-dashed border-navy-700 px-3 py-4 text-[13px] text-state-neutral">
              {temLeituraOk ? coluna.vazio : "Sem leitura recente."}
            </p>
          )
        ) : (
          visiveis.map((assunto) => <Cartao key={assunto.id} assunto={assunto} />)
        )}

        {faltam > 0 ? (
          <button
            type="button"
            onClick={() => setExtra((v) => v + TETO_VISIVEL)}
            className="min-h-[44px] rounded-md border border-navy-700 bg-navy-850 px-3 text-[13px] text-bone-100 hover:border-gold-600 sm:min-h-[36px]"
          >
            mostrar mais (+{faltam})
          </button>
        ) : null}

        {coluna.antigos.length > 0 ? (
          <details className="rounded-lg border border-navy-800 bg-navy-900/60 px-3 py-2">
            <summary className="flex min-h-[36px] cursor-pointer items-center text-[13px] text-state-neutral">
              mais antigos ({coluna.antigos.length})
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {coluna.antigos.slice(0, TETO_VISIVEL).map((assunto) => (
                <Cartao key={assunto.id} assunto={assunto} />
              ))}
              {coluna.antigos.length > TETO_VISIVEL ? (
                <p className="text-xs text-state-neutral">
                  e mais {coluna.antigos.length - TETO_VISIVEL} sem movimento há mais de
                  21 dias.
                </p>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

export function Board({ quadro }: { quadro: QuadroAssuntos }): JSX.Element {
  const { conta, busca, definirConta, definirBusca, limpar } = useFiltros();
  const [celular, setCelular] = useState(false);
  const [recolhidas, setRecolhidas] = useState<Partial<Record<ColunaId, boolean>>>({});

  // No celular, as duas últimas colunas nascem recolhidas (só o contador).
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 639px)");
    const aplicar = (): void => setCelular(consulta.matches);
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  const colunas = useMemo(
    () =>
      quadro.colunas.map((coluna) => {
        const filtra = (a: Assunto): boolean =>
          (conta === "" || a.contaFiltro === conta) && casaBusca(a.busca, busca);
        return {
          ...coluna,
          assuntos: coluna.assuntos.filter(filtra),
          antigos: coluna.antigos.filter(filtra),
        };
      }),
    [busca, conta, quadro.colunas],
  );

  const contagem = useMemo(() => {
    // O resumo conta o que a coluna realmente mostra (a janela) — somar os
    // "mais antigos" inflava o número que ele lê primeiro.
    const numero = (id: ColunaId): number =>
      colunas.find((x) => x.id === id)?.assuntos.length ?? 0;
    return {
      esperando: numero("esperando"),
      andando: numero("andando"),
      parado: numero("parado"),
      fechado: numero("fechado"),
      antigos: colunas.reduce((soma, c) => soma + c.antigos.length, 0),
      total: colunas.reduce((soma, c) => soma + c.assuntos.length + c.antigos.length, 0),
    };
  }, [colunas]);

  const filtroAtivo = conta !== "" || busca.trim() !== "";

  // Aviso de dados velhos respeita o filtro: filtrando por Pandora, não se fala
  // da Alma Petra. O aviso do GitHub vale para todo mundo.
  const avisos = quadro.frescor.avisos.filter(
    (aviso) => conta === "" || aviso.conta === null || aviso.conta === conta,
  );

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-5 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-bone-50">Assuntos</h1>
        <p className="mt-1 text-sm text-bone-300">as três contas, num só lugar</p>
        <p className="mt-1 text-xs text-state-neutral">
          {quadro.frescor.atualizadoTexto
            ? `Atualizado ${quadro.frescor.atualizadoTexto}`
            : "Sem leitura registrada ainda"}
          {" · "}
          <Link
            href="/frentes/historico"
            prefetch={false}
            className="inline-flex min-h-[44px] items-center text-gold-300 underline decoration-gold-600 underline-offset-2 hover:text-bone-50 sm:min-h-[24px]"
          >
            tudo o que já fechou
          </Link>
        </p>
      </header>

      {/* O resumo é a primeira coisa que se lê — daí o tamanho. */}
      <p className="mt-4 text-lg leading-snug text-bone-100 sm:text-xl">
        <strong className="text-2xl font-semibold text-bone-50 sm:text-3xl">
          {contagem.esperando}
        </strong>{" "}
        esperando você · {contagem.andando} andando · {contagem.parado} parados ·{" "}
        {contagem.fechado} fechados esta semana
      </p>
      {contagem.antigos > 0 ? (
        <p className="mt-1 text-xs text-state-neutral">
          + {contagem.antigos} mais antigos, guardados no fim de cada coluna
        </p>
      ) : null}

      {avisos.length > 0 ? (
        <div
          role="status"
          className="mt-2 border-l-2 border-state-warning/70 pl-3 text-xs text-state-warning"
        >
          {avisos.map((aviso) => (
            <p key={aviso.texto}>{aviso.texto}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <Filtros
          contas={quadro.contas}
          conta={conta}
          busca={busca}
          onConta={definirConta}
          onBusca={definirBusca}
        />
      </div>

      {filtroAtivo && contagem.total === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-navy-700 px-4 py-6">
          <p className="text-sm text-bone-300">Nenhum assunto com esse filtro.</p>
          <button
            type="button"
            onClick={limpar}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
          >
            limpar filtros
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
          {colunas.map((coluna) => {
            // Acordeão só existe no celular; no desktop a coluna é sempre aberta.
            const nasceFechada =
              RECOLHIDAS_NO_CELULAR.includes(coluna.id) && !filtroAtivo;
            const recolhida = celular
              ? (recolhidas[coluna.id] ?? nasceFechada)
              : false;
            return (
              <ColunaQuadro
                key={coluna.id}
                coluna={coluna}
                temLeituraOk={quadro.frescor.temLeituraOk}
                filtroAtivo={filtroAtivo}
                recolhida={recolhida}
                podeRecolher={celular}
                primeiroPaint={celular ? PRIMEIRO_PAINT_CELULAR : PRIMEIRO_PAINT_DESKTOP}
                alternar={() => {
                  if (!celular) return;
                  setRecolhidas((atual) => ({
                    ...atual,
                    [coluna.id]: !(atual[coluna.id] ?? nasceFechada),
                  }));
                }}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
