"use client";
import { Layers, X } from "lucide-react";
import { useEffect, useState } from "react";

import { AmostraDeAresta } from "@/components/graph/aresta-svg";
import {
  CAMADAS_DEFAULT,
  CAMADAS_TODAS,
  CAMADA_LABEL,
  type CamadaGrafo,
} from "@/lib/camadas-do-grafo";

/**
 * P4b (achado ALTO #5): amostra do traço de cada camada, ao lado do rótulo —
 * "Caminho crítico" mostra o traço triplo (`critica: true` sobre `sucessao`,
 * já que crítico NUNCA é um tipo de dado próprio — spec §5). O painel vira a
 * legenda; nenhuma segunda lista de "o que cada linha significa" em outro
 * lugar da tela.
 */
const AMOSTRA_POR_CAMADA: Record<CamadaGrafo, { camada: Exclude<CamadaGrafo, "critico">; critica: boolean }> = {
  sucessao: { camada: "sucessao", critica: false },
  correlacao: { camada: "correlacao", critica: false },
  sinergia: { camada: "sinergia", critica: false },
  obsolescencia: { camada: "obsolescencia", critica: false },
  critico: { camada: "sucessao", critica: true },
};

/**
 * OS-LIFEBOARD · P4 — Painel "Camadas": um checkbox por camada de aresta.
 *
 * Persistência: `localStorage`, chave namespaced — per-viewer, nunca crítico
 * (default cai em `CAMADAS_DEFAULT` se ausente/corrompido/bloqueado). `try/catch`
 * em toda leitura/escrita (régua: localStorage pode lançar em janela privada).
 *
 * Responsivo (P4 §2, mobile 390px): ≥ lg mostra os 5 checkboxes lado a lado;
 * < lg colapsa num botão "Camadas" que abre uma folha (sheet) por cima do
 * grafo — nada de painel fixo competindo por largura com o canvas a 390px.
 */
const CHAVE_STORAGE = "lifeboard:grafo:camadas:v1";

function lerCamadasSalvas(): CamadaGrafo[] | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return null;
    const parsed: unknown = JSON.parse(bruto);
    if (!Array.isArray(parsed)) return null;
    const validas = parsed.filter((v): v is CamadaGrafo => CAMADAS_TODAS.includes(v as CamadaGrafo));
    return validas.length > 0 ? validas : null;
  } catch {
    return null;
  }
}

function salvarCamadas(camadas: readonly CamadaGrafo[]): void {
  try {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(camadas));
  } catch {
    // Privada/bloqueada/cheia: segue sem persistir — nunca quebra a tela.
  }
}

export interface UseCamadasDoGrafo {
  ativas: Set<CamadaGrafo>;
  alternar: (camada: CamadaGrafo) => void;
}

/** Hook: estado das camadas ativas + persistência. Usado por `DependencyGraph`. */
export function useCamadasDoGrafo(): UseCamadasDoGrafo {
  const [ativas, setAtivas] = useState<Set<CamadaGrafo>>(() => new Set(CAMADAS_DEFAULT));

  // Lê o localStorage só depois de montar (evita hydration mismatch SSR × client).
  useEffect(() => {
    const salvas = lerCamadasSalvas();
    if (salvas) setAtivas(new Set(salvas));
  }, []);

  const alternar = (camada: CamadaGrafo): void => {
    setAtivas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(camada)) proximo.delete(camada);
      else proximo.add(camada);
      salvarCamadas([...proximo]);
      return proximo;
    });
  };

  return { ativas, alternar };
}

function Checkboxes({
  ativas,
  alternar,
  className = "",
}: {
  ativas: Set<CamadaGrafo>;
  alternar: (c: CamadaGrafo) => void;
  className?: string;
}): JSX.Element {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {CAMADAS_TODAS.map((camada) => {
        const amostra = AMOSTRA_POR_CAMADA[camada];
        return (
          <label
            key={camada}
            className="flex min-h-[28px] cursor-pointer items-center gap-2 text-xs text-bone-200"
          >
            <input
              type="checkbox"
              checked={ativas.has(camada)}
              onChange={() => alternar(camada)}
              className="h-3.5 w-3.5 accent-gold-500"
            />
            <AmostraDeAresta camada={amostra.camada} critica={amostra.critica} />
            {CAMADA_LABEL[camada]}
          </label>
        );
      })}
    </div>
  );
}

/**
 * P4b (achado ALTO #9 do crítico hostil): a v1 mostrava os 5 checkboxes
 * ABERTOS por padrão no desktop (`hidden ... lg:block`, sem `sheetAberta`) —
 * a 1280px, o painel ficava plantado em cima de um nó e de uma aresta o
 * tempo todo, mesmo sem o operador ter pedido nada. Agora o padrão é
 * SEMPRE colapsado (pill "Camadas"), em qualquer largura — desktop abre um
 * painel flutuante ANCORADO no pill (não cobre nada até o clique); celular
 * continua com a folha inteira (o painel ancorado não cabe a 390px).
 */
export function LayerTogglePanel({ ativas, alternar }: UseCamadasDoGrafo): JSX.Element {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={expandido}
        className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-navy-600 bg-navy-850/90 px-2.5 text-xs font-medium text-bone-200 shadow-panel"
      >
        <Layers size={14} aria-hidden="true" />
        Camadas
      </button>

      {expandido ? (
        <>
          {/* Desktop/tablet: painel flutuante ancorado no pill, some ao recolher. */}
          <div
            role="dialog"
            aria-label="Camadas do grafo"
            className="absolute right-0 top-full z-40 mt-1.5 hidden w-56 rounded-md border border-navy-600 bg-navy-850/95 px-3 py-2 shadow-panel lg:block"
          >
            <Checkboxes ativas={ativas} alternar={alternar} />
          </div>

          {/* Celular: folha por cima do grafo inteiro — o painel ancorado não cabe a 390px. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Camadas do grafo"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-navy-600 bg-navy-900 p-4 shadow-panel lg:hidden"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-bone-100">Camadas</span>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setExpandido(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-bone-400 hover:bg-navy-800 hover:text-bone-100"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <Checkboxes ativas={ativas} alternar={alternar} />
          </div>
        </>
      ) : null}
    </div>
  );
}
