"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
 * (senão a primeira leitura é uma parede de cartões), primeiro paint de 6
 * cartões por coluna no desktop e 4 no celular (o "mostrar mais" revela de 25
 * em 25), bloco recolhido "mais antigos" e, no celular, "Parado" e "Fechou esta
 * semana" nascendo fechados — a tela do celular não pode ter três metros.
 *
 * Tudo o que depende do tamanho da tela é CSS, nunca estado de JavaScript: o
 * servidor e o navegador desenham a MESMA coisa e nada salta depois de carregar.
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

/**
 * Uma coluna: cabeçalho colado no topo, cartões, "mostrar mais" e "mais antigos".
 *
 * O acordeão do celular é uma caixa de seleção escondida + `peer-checked` do
 * Tailwind: HTML e CSS, zero JavaScript, zero salto no primeiro paint. Acima de
 * `sm` o conteúdo é sempre visível (`sm:flex`) e o rótulo "mostrar" desaparece.
 */
function ColunaQuadro({
  coluna,
  temLeituraOk,
  filtroAtivo,
  recolhivelNoCelular,
}: {
  coluna: Coluna;
  temLeituraOk: boolean;
  filtroAtivo: boolean;
  recolhivelNoCelular: boolean;
}): JSX.Element {
  // Quantos cartões a mais que o primeiro paint já foram pedidos.
  const [extra, setExtra] = useState(0);
  const total = coluna.assuntos.length + coluna.antigos.length;

  const limiteDesktop = PRIMEIRO_PAINT_DESKTOP + extra;
  const limiteCelular = PRIMEIRO_PAINT_CELULAR + extra;
  const visiveis = coluna.assuntos.slice(0, limiteDesktop);
  const faltamNoDesktop = coluna.assuntos.length - limiteDesktop;
  const faltamNoCelular = coluna.assuntos.length - limiteCelular;

  const contador = (
    <span className="text-xs font-normal text-state-neutral">
      {coluna.assuntos.length}
      {coluna.antigos.length > 0 ? ` (+${coluna.antigos.length})` : ""}
      {recolhivelNoCelular ? (
        <span className="sm:hidden">
          {/* Os dois rótulos são irmãos; o CSS do input troca qual aparece. */}
          <span className="lb-mostrar"> · mostrar</span>
          <span className="lb-esconder hidden"> · esconder</span>
        </span>
      ) : null}
    </span>
  );

  const cabecalho = (
    <>
      <span>{coluna.nome}</span>
      {contador}
    </>
  );

  return (
    <section aria-labelledby={`coluna-${coluna.id}`} className="relative">
      {recolhivelNoCelular ? (
        // Transparente em vez de `sr-only`: assim o anel de foco do teclado
        // aparece no cabeçalho (`peer-focus-visible` abaixo).
        <input
          type="checkbox"
          id={`abrir-${coluna.id}`}
          className="peer absolute left-2 top-2 h-6 w-6 opacity-0"
          aria-label={`Mostrar ou esconder a coluna ${coluna.nome}`}
        />
      ) : null}

      <div
        className={`sticky top-0 z-10 -mx-1 border-b border-navy-700 bg-navy-950 px-1 pb-2 pt-1 ${
          recolhivelNoCelular
            ? "rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-gold-400 peer-checked:[&_.lb-mostrar]:hidden peer-checked:[&_.lb-esconder]:inline"
            : ""
        }`}
      >
        <h2 id={`coluna-${coluna.id}`} className="text-sm font-semibold text-bone-100">
          {recolhivelNoCelular ? (
            <label
              htmlFor={`abrir-${coluna.id}`}
              className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 sm:min-h-[24px] sm:cursor-default"
            >
              {cabecalho}
            </label>
          ) : (
            <span className="flex min-h-[24px] items-baseline justify-between gap-2">
              {cabecalho}
            </span>
          )}
        </h2>
      </div>

      <div
        className={
          recolhivelNoCelular
            ? "mt-3 hidden flex-col gap-3 peer-checked:flex sm:flex"
            : "mt-3 flex flex-col gap-3"
        }
      >
        {total === 0 ? (
          filtroAtivo ? null : (
            <p className="rounded-lg border border-dashed border-navy-700 px-3 py-4 text-[13px] text-state-neutral">
              {temLeituraOk ? coluna.vazio : "Sem leitura recente."}
            </p>
          )
        ) : (
          visiveis.map((assunto, indice) => (
            // Do 5º cartão em diante: só no desktop (no celular nascem 4).
            <div
              key={assunto.id}
              className={indice >= limiteCelular ? "hidden sm:block" : undefined}
            >
              <Cartao assunto={assunto} />
            </div>
          ))
        )}

        {/* Dois botões, um por tamanho de tela: o número tem de bater com o que
            aquela tela está escondendo. Só um deles é visível de cada vez. */}
        {faltamNoCelular > 0 ? (
          <button
            type="button"
            onClick={() => setExtra((v) => v + TETO_VISIVEL)}
            className="min-h-[44px] rounded-md border border-navy-700 bg-navy-850 px-3 text-[13px] text-bone-100 hover:border-gold-600 sm:hidden"
          >
            mostrar mais (+{faltamNoCelular})
          </button>
        ) : null}
        {faltamNoDesktop > 0 ? (
          <button
            type="button"
            onClick={() => setExtra((v) => v + TETO_VISIVEL)}
            className="hidden min-h-[36px] rounded-md border border-navy-700 bg-navy-850 px-3 text-[13px] text-bone-100 hover:border-gold-600 sm:block"
          >
            mostrar mais (+{faltamNoDesktop})
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

  // Mesma regra para as contas que ainda não publicaram: filtrando por uma
  // conta, não se fala das outras.
  const contasFaltando = quadro.frescor.contasSemLeitura.filter(
    (c) => conta === "" || c === conta,
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

      {/* Conta que ainda não publicou não é dado velho: é dado que não chegou.
          Uma linha cinza, e ela desaparece no dia em que a conta publicar. */}
      {contasFaltando.length > 0 ? (
        <p className="mt-2 text-xs text-state-neutral">
          {contasFaltando.length === 1
            ? `As conversas da conta ${contasFaltando[0]} ainda não entram aqui.`
            : `As conversas das contas ${contasFaltando
                .slice(0, -1)
                .join(", ")} e ${contasFaltando.at(-1)} ainda não entram aqui.`}
        </p>
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
          {colunas.map((coluna) => (
            <ColunaQuadro
              key={coluna.id}
              coluna={coluna}
              temLeituraOk={quadro.frescor.temLeituraOk}
              filtroAtivo={filtroAtivo}
              recolhivelNoCelular={RECOLHIDAS_NO_CELULAR.includes(coluna.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
