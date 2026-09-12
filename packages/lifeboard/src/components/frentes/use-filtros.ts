"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * PAINEL DE ASSUNTOS — filtros guardados no endereço da página (?conta=&q=).
 *
 * Fica no endereço de propósito: apertar F5, voltar ou mandar o link para
 * alguém mantém exatamente a mesma visão.
 *
 * Duas decisões que se pagam na velocidade da tela:
 *  • o que manda na filtragem é o estado local — a lista muda na hora, sem
 *    esperar nada do servidor (os assuntos já vieram todos);
 *  • o endereço é só um espelho, escrito com `history.replaceState` (o texto
 *    com 300 ms de folga, para não gravar letra por letra). Trocar o endereço
 *    assim não refaz a página nem gera ida e volta ao servidor.
 */
export interface Filtros {
  /** Rótulo da conta selecionada; "" = todas. */
  conta: string;
  /** Texto digitado na busca. */
  busca: string;
  definirConta: (valor: string) => void;
  definirBusca: (valor: string) => void;
  /** Zera conta e busca de uma vez (botão "limpar filtros"). */
  limpar: () => void;
}

export function useFiltros(): Filtros {
  const params = useSearchParams();
  const [conta, definirConta] = useState(params.get("conta") ?? "");
  const [busca, definirBusca] = useState(params.get("q") ?? "");

  const espelhar = useCallback((proximaConta: string, proximaBusca: string) => {
    if (typeof window === "undefined") return;
    const atuais = new URLSearchParams(window.location.search);
    if (proximaConta === "") atuais.delete("conta");
    else atuais.set("conta", proximaConta);
    if (proximaBusca.trim() === "") atuais.delete("q");
    else atuais.set("q", proximaBusca);
    const query = atuais.toString();
    const destino = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (destino === `${window.location.pathname}${window.location.search}`) return;
    window.history.replaceState(null, "", destino);
  }, []);

  useEffect(() => {
    // Conta muda na hora; texto espera 300 ms de silêncio.
    const folga = (params.get("conta") ?? "") === conta ? 300 : 0;
    const timer = setTimeout(() => espelhar(conta, busca), folga);
    return () => clearTimeout(timer);
  }, [busca, conta, espelhar, params]);

  const limpar = useCallback(() => {
    definirConta("");
    definirBusca("");
  }, []);

  return { conta, busca, definirConta, definirBusca, limpar };
}

/** Uma linha da busca casa se o texto aparece no "palheiro" do assunto. */
export function casaBusca(palheiro: string, busca: string): boolean {
  const termo = busca.trim().toLowerCase();
  if (termo === "") return true;
  return palheiro.includes(termo);
}
