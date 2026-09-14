"use client";
import { Layers, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AmostraDeAresta } from "@/components/graph/aresta-svg";
import {
  CAMADAS_DEFAULT,
  CAMADAS_TODAS,
  CAMADA_LABEL,
  type CamadaGrafo,
} from "@/lib/camadas-do-grafo";
import { useFecharPopover } from "@/lib/use-fechar-popover";

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
            // P4c (achado BAIXO #10): 14×14 (h-3.5 w-3.5) e linha de 28px são
            // menores que o alvo de toque de 44×44 (régua UI/UX). `h-5 w-5` +
            // `min-h-[44px]` dão o alvo inteiro, não só o quadradinho visível.
            className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-bone-200"
          >
            <input
              type="checkbox"
              checked={ativas.has(camada)}
              onChange={() => alternar(camada)}
              className="h-5 w-5 accent-gold-500"
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
 * P4c (achado BAIXO #9 do crítico hostil ROUND 2): a v P4b renderizava os
 * DOIS `role="dialog"` (popover desktop ancorado + folha mobile) sempre que
 * `expandido`, um escondido por CSS (`hidden lg:block` / `lg:hidden`) — dois
 * elementos com o MESMO `aria-label` no DOM ao mesmo tempo. `matchMedia`
 * decide qual variante existe de verdade; SSR-safe (default = desktop, o
 * mesmo breakpoint que os dois usavam via Tailwind `lg` = 1024px) — no
 * primeiro paint do servidor não há `window`, então o hook só liga depois de
 * montar, igual ao padrão já usado em `useCamadasDoGrafo` pro localStorage.
 */
function useEhMobile(larguraCorte = 1024): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${larguraCorte - 1}px)`);
    const atualizar = (): void => setMobile(mq.matches);
    atualizar();
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, [larguraCorte]);
  return mobile;
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
export interface LayerTogglePanelProps extends UseCamadasDoGrafo {
  /**
   * P4d (achado BAIXO #9 do crítico hostil ROUND 3): incrementa a cada
   * clique/toque no canvas (`dependency-graph.tsx`) — o painel fecha em
   * resposta, para nunca ficar plantado sobre um cartão depois que o
   * operador já saiu para o grafo.
   */
  fecharSinal: number;
}

/** Seletor de elementos focáveis dentro do popover/folha (botão, input, ou tabindex explícito). */
const SELETOR_FOCAVEL = 'button, input, [tabindex]:not([tabindex="-1"])';

export function LayerTogglePanel({ ativas, alternar, fecharSinal }: LayerTogglePanelProps): JSX.Element {
  const [expandido, setExpandido] = useState(false);
  const mobile = useEhMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const fechar = useCallback(() => {
    setExpandido(false);
    // P4d (achado BAIXO #10/#11): o foco volta ao pill que abriu o popover/
    // folha — em QUALQUER via de fechamento (X, backdrop, ESC, clique fora,
    // canvas).
    window.requestAnimationFrame(() => pillRef.current?.focus());
  }, []);

  // P4d (achado BAIXO #9): fecha ao clicar/tocar no canvas.
  useEffect(() => {
    if (fecharSinal > 0) setExpandido(false);
  }, [fecharSinal]);
  // P4d (achado BAIXO #11, popover desktop): ESC e clique fora fecham — antes
  // só o próprio botão de toggle fechava. Mobile já tinha ESC (achado BAIXO
  // #10 da rodada anterior) e o backdrop cobre o "clique fora"; o hook cobre
  // os dois casos de um jeito só, sem duplicar listener.
  useFecharPopover(expandido, containerRef, fechar);

  // P4d (achado BAIXO #10 do crítico hostil ROUND 3): armadilha de foco na
  // folha mobile — `aria-modal="true"` prometia isso e não entregava (Tab
  // depois do último checkbox ia para o BODY). Foca o 1º elemento ao abrir;
  // Tab no último volta ao 1º, Shift+Tab no 1º vai ao último.
  useEffect(() => {
    if (!expandido || !mobile) return;
    const raiz = sheetRef.current;
    if (!raiz) return;
    const primeiro = raiz.querySelector<HTMLElement>(SELETOR_FOCAVEL);
    primeiro?.focus();
    const aoTeclarTab = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") return;
      const focaveis = Array.from(raiz.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL));
      if (focaveis.length === 0) return;
      const inicio = focaveis[0]!;
      const fim = focaveis[focaveis.length - 1]!;
      if (e.shiftKey && document.activeElement === inicio) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault();
        inicio.focus();
      }
    };
    window.addEventListener("keydown", aoTeclarTab);
    return () => window.removeEventListener("keydown", aoTeclarTab);
  }, [expandido, mobile]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={pillRef}
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={expandido}
        // P4g (achado MÉDIO #8): 44px é o alvo de toque da régua da casa — o
        // pill media 36 e era o MAIOR controle do grafo a 390. Abaixo de 640px
        // o rótulo recolhe para a barra caber numa linha; o nome acessível
        // continua no `aria-label`.
        aria-label="Camadas"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md border border-navy-600 bg-navy-850/90 px-3 text-xs font-medium text-bone-200 shadow-panel"
      >
        <Layers size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Camadas</span>
      </button>

      {expandido && !mobile ? (
        // Desktop/tablet: painel flutuante ancorado no pill.
        <div
          role="dialog"
          aria-label="Camadas do grafo"
          className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-md border border-navy-600 bg-navy-850/95 px-3 py-2 shadow-panel"
        >
          <Checkboxes ativas={ativas} alternar={alternar} />
        </div>
      ) : null}

      {expandido && mobile ? (
        <>
          {/* P4c (achado BAIXO #10): backdrop que fecha a folha ao tocar fora —
              não existia antes (a folha só fechava pelo botão "Fechar"). */}
          <div
            aria-hidden="true"
            onClick={fechar}
            className="fixed inset-0 z-40 bg-navy-950/60"
          />
          {/* Celular: folha por cima do grafo inteiro — o painel ancorado não cabe a 390px. */}
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Camadas do grafo"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-navy-600 bg-navy-900 p-4 shadow-panel"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-bone-100">Camadas</span>
              <button
                type="button"
                aria-label="Fechar"
                onClick={fechar}
                className="flex h-11 w-11 items-center justify-center rounded-md text-bone-400 hover:bg-navy-800 hover:text-bone-100"
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
