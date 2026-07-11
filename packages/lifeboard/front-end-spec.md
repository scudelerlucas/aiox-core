# Front-End Spec — OS-LIFEBOARD · Dashboard ALMA PETRA (E5)

> Especificação de front-end para o **E5 — Dashboard ALMA PETRA** (PRD §4/§8, architecture.md §3/§4/§7/§9).
> Grafo de dependências (React Flow) + lista "hoje" (HIERARQ) + filtro por fonte + degradação graciosa.
>
> **Autor:** Uma (UX-Design Expert) · **Comando:** `@ux-design-expert *create-front-end-spec` · **Data:** 2026-07-09
> **Fonte da verdade:** `packages/lifeboard/PRD.md` + `packages/lifeboard/architecture.md`. Este doc **não inventa requisitos** (Artigo IV — No Invention): cada seção rastreia ao PRD/arch. Dados sob o contrato real de `@/types/canonical` e `GET /api/today`.
> **Escopo:** apenas a spec. A implementação React é do `@dev` na sequência (Runbook Ordem 5, parte 2).

---

## 0. Princípios de design (ALMA PETRA)

ALMA PETRA é a marca **pessoal** de Lucas (não Pandora). O dashboard é dark-first, sóbrio, "pedra e alma": fundo **navy** profundo, texto **bone** (osso), acento **dourado fosco**. Nada de neon; a paleta é terrosa e de baixo brilho. O grafo é o herói visual (a "visão única" que o PRD §3 promete); a lista "hoje" é o call-to-action; o filtro e as flags de fonte são utilitários discretos.

- **Dark mode é o único modo na v1.0** (PRD §4: "dark mode"). Sem toggle de tema — YAGNI single-user.
- **Hierarquia por elevação e acento, não por cor gritante.** Superfícies em degraus de navy; o dourado marca só o que exige ação/atenção do usuário.
- **Acessível por padrão:** contraste AA mínimo em todo texto/UI (§7); grafo tem fallback de lista navegável por teclado.
- **Zero valor hardcoded** no código do `@dev`: tudo consome os tokens da §1.

---

## 1. Tokens de design ALMA PETRA

### 1.1 Paleta

Três famílias canônicas (navy/bone/dourado) expandidas em escalas para dark mode, mais um conjunto de cores de estado calibradas para contraste AA sobre o fundo navy.

#### Navy — fundo e superfícies (dark mode)

| Token | Hex | Uso |
|-------|-----|-----|
| `navy-950` | `#060D18` | Fundo raiz do app (`body`), canvas do grafo |
| `navy-900` | `#0A1628` | **Navy canônico (PRD §1)** — fundo base das zonas |
| `navy-850` | `#0F1E33` | Fundo de painel/sidebar |
| `navy-800` | `#13253D` | Superfície de card / nó do grafo / linha de lista |
| `navy-700` | `#1C3350` | Superfície elevada / hover de card / nó selecionado |
| `navy-600` | `#294463` | Borda forte / divisor de zona |
| `navy-500` | `#3A5878` | Borda sutil / trilho de aresta inativa |

#### Bone — texto e primeiro plano

| Token | Hex | Uso | Contraste s/ `navy-900` |
|-------|-----|-----|--------------------------|
| `bone-50` | `#FDFCFA` | Texto de ênfase máxima (título hero) | ~15:1 |
| `bone-100` | `#F5F2EC` | **Bone canônico (PRD §1)** — texto primário | ~14:1 |
| `bone-200` | `#E8E3D8` | Texto sobre acento dourado / hover de texto | ~12:1 |
| `bone-300` | `#D2C9BA` | Texto secundário (subtítulos, labels) | ~9:1 |
| `bone-400` | `#A9A091` | Texto terciário / muted (metadados, `reason`) | ~7:1 |
| `bone-500` | `#7C7566` | Desabilitado / placeholder (isento AA) | ~4:1 |

#### Dourado fosco — acento

| Token | Hex | Uso | Contraste s/ `navy-900` |
|-------|-----|-----|--------------------------|
| `gold-300` | `#C9AE82` | Hover do acento / foco em texto dourado | ~7:1 |
| `gold-400` | `#B89A6E` | **Anel de foco (focus ring)** / borda ativa | ~6.4:1 |
| `gold-500` | `#A8895A` | **Dourado canônico (PRD §1)** — acento primário, CTA, in_progress | ~5.5:1 |
| `gold-600` | `#8C6F45` | Pressed / acento sutil | — |
| `gold-700` | `#6B5433` | Fundo de chip/badge de acento (com texto `bone-100`) | — |

#### Cores de estado (calibradas AA sobre navy)

| Papel | Token | Hex | Contraste s/ `navy-900` | Onde aparece |
|-------|-------|-----|--------------------------|--------------|
| **Sucesso / done** | `state-success` | `#4FA97B` | ~6.3:1 | Nó de tarefa concluída, badge "done" |
| Sucesso (texto sutil) | `state-success-fg` | `#7FC4A0` | ~8:1 | Texto verde em fundo escuro |
| **Aviso / fonte desatualizada** | `state-warning` | `#D99A3E` | ~7.5:1 | `StaleSourceFlag` (severity `warning`), badge de sync antigo |
| **Erro / falha de sync / ciclo** | `state-error` | `#CF5C48` | ~4.6:1 | Ciclo de dependência, `StaleSourceFlag` (severity `error`), status `blocked` |
| Erro (texto sutil) | `state-error-fg` | `#E08472` | ~6.5:1 | Texto de erro em fundo escuro (small text) |
| **Info / neutro / open** | `state-neutral` | `#8593A8` | ~5.9:1 | Borda/ponto de tarefa `open` (sem cor de destaque) |

> **Nota de contraste (§7):** `state-error #CF5C48` fica em 4.6:1 (passa AA normal por margem estreita). Para **texto pequeno** de erro use `state-error-fg #E08472` (~6.5:1). Bordas/ícones de estado são UI non-text (mínimo 3:1) e todos passam folgado.

#### Cores de status de tarefa (mapa canônico)

O `TaskStatus` de `@/types/canonical` (`"open" | "in_progress" | "blocked" | "done"`) mapeia direto para tokens. **Atenção:** o status `blocked` (declarado na tarefa) é distinto do estado **derivado** "bloqueada por predecessor aberto" (calculado pelo DAG) — ver §3.2.

| `TaskStatus` | Token de cor | Tratamento visual do nó |
|--------------|--------------|--------------------------|
| `open` | `state-neutral` `#8593A8` | Borda neutra 1px, fill `navy-800`, texto `bone-100` |
| `in_progress` | `gold-500` `#A8895A` | Borda dourada 2px, leve glow interno dourado, texto `bone-100` |
| `blocked` | `state-error` `#CF5C48` | Borda terracota 1.5px, ícone `Ban`, texto `bone-200` |
| `done` | `state-success` `#4FA97B` | Borda verde 1px, fill `navy-850`, título com `line-through`, opacity 0.7 |

### 1.2 Tipografia

Sistema de fontes (sem web-font externa na v1.0 — performance + privacidade; single-user).

| Token | Valor | Uso |
|-------|-------|-----|
| `font-sans` | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | UI geral, corpo, listas |
| `font-mono` | `ui-monospace, "SF Mono", "JetBrains Mono", monospace` | Score HIERARQ, IDs, `dueDate` |

| Escala | rem / px | line-height | Uso |
|--------|----------|-------------|-----|
| `text-xs` | 0.75 / 12 | 1.4 | Metadados, `reason`, contadores |
| `text-sm` | 0.875 / 14 | 1.5 | Corpo de lista, labels de filtro |
| `text-base` | 1 / 16 | 1.5 | Texto padrão |
| `text-lg` | 1.125 / 18 | 1.4 | Título de nó / item de lista |
| `text-xl` | 1.25 / 20 | 1.3 | Título de zona ("Hoje", "Grafo") |
| `text-2xl` | 1.5 / 24 | 1.25 | Header do dashboard ("ALMA PETRA") |

Pesos: `font-normal` (400) corpo, `font-medium` (500) labels/títulos de item, `font-semibold` (600) títulos de zona. **Sem `font-bold`** — a marca é sóbria.

### 1.3 Espaçamento, raios, sombras, motion

| Categoria | Tokens |
|-----------|--------|
| Espaçamento (base 4px) | `space-1`=4 · `space-2`=8 · `space-3`=12 · `space-4`=16 · `space-6`=24 · `space-8`=32 · `space-12`=48 |
| Raio de borda | `radius-sm`=4 · `radius-md`=8 (cards/nós) · `radius-lg`=12 (painéis) · `radius-full`=9999 (chips/badges) |
| Sombra (dark) | `shadow-node`= `0 1px 2px rgba(0,0,0,.4)` · `shadow-panel`= `0 4px 16px rgba(0,0,0,.5)` · `shadow-focus`= `0 0 0 2px #B89A6E` (gold-400) |
| Foco (a11y) | `ring-focus`: outline `2px solid gold-400` + offset `2px` — **nunca** removido (`outline:none` proibido) |
| Motion | `motion-fast`=120ms · `motion-base`=200ms · `motion-slow`=320ms · easing `cubic-bezier(.4,0,.2,1)`. Respeitar `prefers-reduced-motion` (desliga transições de pan/zoom e glow) |

### 1.4 `tailwind.config.ts` (tokens prontos)

Tailwind 4. Duas formas equivalentes — o `@dev` escolhe conforme o setup final do package (o preset `nextjs-react` usa Tailwind 4). **Forma A** (config JS `theme.extend`) e **Forma B** (`@theme` em `globals.css`, CSS-first do Tailwind 4). O `@dev` **não** deve hardcodar hex fora daqui.

**Forma A — `tailwind.config.ts`:**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class", // sempre ativo: <html class="dark"> fixo na v1.0
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060D18", 900: "#0A1628", 850: "#0F1E33", 800: "#13253D",
          700: "#1C3350", 600: "#294463", 500: "#3A5878",
        },
        bone: {
          50: "#FDFCFA", 100: "#F5F2EC", 200: "#E8E3D8", 300: "#D2C9BA",
          400: "#A9A091", 500: "#7C7566",
        },
        gold: {
          300: "#C9AE82", 400: "#B89A6E", 500: "#A8895A", 600: "#8C6F45", 700: "#6B5433",
        },
        state: {
          success: "#4FA97B", "success-fg": "#7FC4A0",
          warning: "#D99A3E",
          error: "#CF5C48", "error-fg": "#E08472",
          neutral: "#8593A8",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "JetBrains Mono", "monospace"],
      },
      borderRadius: { sm: "4px", md: "8px", lg: "12px" },
      boxShadow: {
        node: "0 1px 2px rgba(0,0,0,.4)",
        panel: "0 4px 16px rgba(0,0,0,.5)",
        focus: "0 0 0 2px #B89A6E",
      },
      transitionTimingFunction: { almapetra: "cubic-bezier(.4,0,.2,1)" },
    },
  },
};
export default config;
```

**Forma B — `src/app/globals.css` (`@theme`, Tailwind 4 CSS-first):**

```css
@import "tailwindcss";

@theme {
  --color-navy-950: #060D18; --color-navy-900: #0A1628; --color-navy-850: #0F1E33;
  --color-navy-800: #13253D; --color-navy-700: #1C3350; --color-navy-600: #294463;
  --color-navy-500: #3A5878;
  --color-bone-50: #FDFCFA; --color-bone-100: #F5F2EC; --color-bone-200: #E8E3D8;
  --color-bone-300: #D2C9BA; --color-bone-400: #A9A091; --color-bone-500: #7C7566;
  --color-gold-300: #C9AE82; --color-gold-400: #B89A6E; --color-gold-500: #A8895A;
  --color-gold-600: #8C6F45; --color-gold-700: #6B5433;
  --color-state-success: #4FA97B; --color-state-success-fg: #7FC4A0;
  --color-state-warning: #D99A3E;
  --color-state-error: #CF5C48; --color-state-error-fg: #E08472;
  --color-state-neutral: #8593A8;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-mono, "SF Mono", "JetBrains Mono", monospace;
  --radius-md: 8px; --radius-lg: 12px;
}

/* dark-only: fixa o fundo raiz ALMA PETRA */
html { color-scheme: dark; }
body { background: var(--color-navy-950); color: var(--color-bone-100); }
```

### 1.5 Ícones (AUTO-DECISION)

`[AUTO-DECISION]` O `packages/lifeboard/` **não tem** `app/components/ui/icons/icon-map.ts` (só a app do quiz tem). Regra "não inventar ícone" → mapear a um catálogo real: **`lucide-react`** (já vem com o setup shadcn/ui-style do preset `nextjs-react`, arch §4). O `@dev` importa só destes nomes; nenhum ícone inventado:

| Papel | Ícone lucide |
|-------|--------------|
| Fonte calendar | `CalendarDays` |
| Fonte gmail | `Mail` |
| Fonte drive | `FolderOpen` |
| Fonte notes | `NotebookPen` |
| Fonte claude_chat | `MessagesSquare` |
| Status blocked | `Ban` |
| Bloqueada por predecessor | `Lock` |
| Ciclo de dependência (erro) | `AlertTriangle` |
| Fonte desatualizada | `CloudOff` |
| In progress | `Loader` (estático, sem spin se reduced-motion) |
| Done | `CheckCircle2` |
| Aresta / dependência | `ArrowRight` (adorno de legenda) |
| Zoom in/out/fit | `ZoomIn` `ZoomOut` `Maximize2` |

---

## 2. Layout do dashboard

### 2.1 Zonas (split view + header + rail de filtro)

Layout **desktop-first** (uso pessoal, tela grande). Grid de 3 regiões sob um header fixo:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HEADER (navy-850, h=56)                                                        │
│  ▪ ALMA PETRA · OS-LIFEBOARD      [ StaleSourceFlag(s) inline ]   ⟳ sync  ?     │
├───────────────┬────────────────────────────────────────────────────────────────┤
│  LEFT RAIL     │  MAIN — SPLIT VIEW                                              │
│  (w=260,       │  ┌────────────────────────────────────┬──────────────────────┐ │
│   navy-850)    │  │  ZONA A — GRAFO DAG (flex ~ 62%)     │  ZONA B — HOJE (~38%)│ │
│                │  │  React Flow canvas (navy-950)        │  (navy-900)          │ │
│  SourceFilter  │  │                                      │  ▸ Hoje (título)     │ │
│  ▸ Fontes      │  │   ●──▶●──▶●                          │  ┌──────────────────┐│ │
│   ☑ Calendar 12│  │    ╲                                 │  │ 1 · task-build   ││ │
│   ☑ Gmail    3 │  │     ▶●   ●                           │  │   S 125 · reason ││ │
│   ☑ Drive    5 │  │                                      │  ├──────────────────┤│ │
│   ☑ Notes    2 │  │  [zoom −  fit  +]  (bottom-left)      │  │ 2 · task-docs    ││ │
│   ☑ Claude   4 │  │  [legenda de status] (bottom-right)  │  │   S 60 · reason  ││ │
│                │  │                                      │  └──────────────────┘│ │
│  [Limpar]      │  └────────────────────────────────────┴──────────────────────┘ │
├───────────────┴────────────────────────────────────────────────────────────────┤
│  FOOTER (opcional, h=28): "última sync: …"  ·  contagem de tarefas               │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Header** (`navy-850`, altura 56px, `shadow-panel`): marca à esquerda; **`StaleSourceFlag`(s)** ao centro/direita quando houver fonte desatualizada (§6); botão `⟳ sync` (dispara `POST /api/sync`) e ajuda à direita.
- **Left rail** (`navy-850`, largura 260px): o **`SourceFilter`** (multi-select das 5 fontes com contadores). Colapsável em telas estreitas (vira drawer).
- **Zona A — Grafo** (~62% da main, fundo `navy-950`): o `DependencyGraph` (React Flow) ocupa toda a área; controles de zoom no canto inferior-esquerdo, legenda de status no inferior-direito.
- **Zona B — Hoje** (~38% da main, fundo `navy-900`, borda esquerda `navy-600` 1px): o `TodayList`, scroll vertical independente.
- **Split** com divisória `navy-600`; proporção fixa na v1.0 (sem resize handle — YAGNI).

`[AUTO-DECISION]` Grafo à esquerda / lista à direita (não o contrário) → o grafo é a "visão única" (PRD §3), merece a área nobre de leitura primária (esquerda, maior); a lista "hoje" é a coluna de ação, à direita, como um "checkout". Razão: espelha o fluxo panorama→ação.

### 2.2 Responsividade (degradê simples)

Single-user desktop é o alvo. Breakpoints mínimos, sem redesenho:
- **≥1280px (padrão):** layout acima.
- **768–1279px:** rail vira drawer (ícone hambúrguer no header); split A/B mantém, proporção 55/45.
- **<768px:** empilha vertical — `TodayList` primeiro (ação), grafo abaixo em altura fixa 60vh com pan/zoom; `SourceFilter` em drawer. (Suporte "melhor esforço"; não é requisito do PRD.)

### 2.3 Layout page (arch §3 — `src/app/page.tsx`)

`page.tsx` é Server Component: busca inicial de `tasks`/`sources` server-side, hidrata o dashboard. `PageLayout`/shell dark vem de `layout.tsx` (`<html class="dark">` fixo). Os componentes interativos (`DependencyGraph`, `SourceFilter`, `TodayList`) são Client Components (`'use client'`) — **jamais** importam `core/prioritize/**` nem `lib/mcp/**` (fronteira server-only, arch §3/§6). Dados chegam via `/api/today` (TanStack Query) e via props hidratadas do server.

---

## 3. Componente do grafo de dependências (React Flow)

Arquivos: `src/components/graph/dependency-graph.tsx` + `src/components/graph/task-node.tsx`.

### 3.1 Nó de tarefa (`task-node.tsx`)

Custom node do React Flow. Card compacto (`radius-md`, `shadow-node`), largura fixa ~200px:

```
┌─────────────────────────────┐   ← borda = cor do status (§1.1)
│ [icon fonte]  task-build   ⋯ │   ← título (text-sm/medium, bone-100)
│ Implementar motor HIERARQ    │   ← subtítulo opcional (text-xs, bone-400)
│ ─────────────────────────    │
│ S 125   ● in_progress        │   ← score mono (bone-200) + chip de status
└─────────────────────────────┘
```

**Cor por status** (mapa §1.1): a **borda** e o **chip de status** carregam a cor (`open`→neutral, `in_progress`→gold, `blocked`→error, `done`→success). Fill do card sempre em degrau de navy (nunca a cor de estado como fundo cheio — sobriedade + contraste do texto).

**Bloqueada por predecessor aberto** (estado **derivado**, PRD §4/§8, distinto do status `blocked`):
- Borda **tracejada** (`dashed`) na cor de status + **ícone `Lock`** no canto superior-direito.
- Opacity do card reduzida para `0.55`.
- Badge inline "aguardando: {título do predecessor}" (text-xs, `bone-400`).
- Esta tarefa **nunca** aparece no `TodayList` (o HIERARQ já a omite) — o grafo é o único lugar onde ela é visível, com este tratamento.

**Ciclo de dependência** (erro, PRD §11 stress-1): nós em `cycleTaskIds` recebem borda `state-error` + ícone `AlertTriangle` + tooltip "ciclo de dependência — não priorizável". Nunca renderiza a aresta de volta que fecharia o ciclo (o `dag.ts` já os exclui de "hoje").

**Ênfase "top hoje"** (`isTopToday`): o nó rank-0 da lista ganha um anel `gold-400` (`shadow-focus`) para amarrar grafo↔lista.

**Filtrado** (`isFilteredOut`): opacity `0.2`, sem interação (ver §5).

**Handles** (React Flow): `target` no topo (entra a aresta do predecessor), `source` na base (sai para o sucessor).

### 3.2 Aresta antecedência → posterioridade

- **Direção:** `predecessor → task` (a mesma semântica de `dag.ts`: `y.predecessorIds ∋ x ⇒ x → y`, e `x.successorIds ∋ y ⇒ x → y`). A ponta da seta (`markerEnd: ArrowClosed`) aponta para o **sucessor** (a posterioridade).
- **Estilo:** aresta `smoothstep`, cor `navy-500` (repouso), 1.5px. Ao selecionar/hover um nó, as arestas incidentes acendem em `gold-500` (2px) para revelar a cadeia.
- **Aresta que sai de predecessor NÃO-`done`** (dependência ainda "viva"): cor `state-neutral`, `strokeDasharray` animado (respeitando reduced-motion) — sinaliza "esta precedência ainda bloqueia".
- **Aresta cuja origem está `done`** (precedência satisfeita): cor `state-success`, sólida — "caminho liberado".
- **Deduplicação:** as duas representações (`predecessorIds` e `successorIds`) podem descrever a mesma aresta; o componente deduplica por `(from,to)` (igual ao trigger SQL / `dag.ts`), renderizando uma só.
- **Layout:** auto-layout dirigido top-down (predecessores acima, sucessores abaixo). `[AUTO-DECISION]` usar layout topológico simples (por "camadas" de profundidade de predecessor) calculado no client a partir de `predecessorIds`; se o grafo crescer, adotar `dagre`/`elkjs` — nomeado como débito, fora do escopo v1.0 (single-user, poucas tarefas).

### 3.3 Pan / zoom / interação

- **Pan:** arrastar o fundo (drag no canvas) ou scroll+shift; **zoom:** scroll do mouse ou controles `[− fit +]` (canto inferior-esquerdo, ícones `ZoomOut`/`Maximize2`/`ZoomIn`).
- **Fit view** ao montar e ao trocar o filtro de fonte (reenquadra só os nós visíveis).
- **Seleção:** clicar um nó chama `onSelectTask(id)`; o mesmo id destaca a linha correspondente no `TodayList` (estado compartilhado, §4). Clicar no fundo limpa (`onSelectTask(null)`).
- **`minZoom` 0.3 / `maxZoom` 1.8**; `nodesDraggable` **false** (posição é derivada do grafo, não editável na v1.0 — evita estado de layout persistido).
- **MiniMap** desligado na v1.0 (poluição visual; volume pequeno). `Background` dots em `navy-800` sutil.
- **Legenda** (canto inferior-direito): chips estáticos "open / in_progress / blocked / done / bloqueada / ciclo" com suas cores — orienta a leitura do grafo.

---

## 4. Componente da lista "hoje" (`today-list.tsx`)

Consome **literalmente** `GET /api/today` → `{ items: [{ task, reason }], excludedCycles: string[] }` (arch §7; retorno de `buildTodayList`). Já vem **ordenada** por HIERARQ e **sem** tarefas bloqueadas/cíclicas (o motor fez isso; a UI **não reordena nem refiltra** — só renderiza).

### 4.1 Item da lista

```
┌──────────────────────────────────────────────┐
│ ①  Implementar motor HIERARQ      [icon fonte] │  ← rank + título (text-lg/medium)
│    S 125 · sem dependência aberta              │  ← score mono + reason (text-xs, bone-400)
│    ● in_progress   ·   vence: 09/07            │  ← chip status + dueDate (se houver)
└──────────────────────────────────────────────┘
```

- **Ordenação visual:** exatamente a ordem do array `items` (o HIERARQ decidiu). Cada item mostra o **número de rank** (①②③…) num círculo `gold-700`/`bone-100` — reforça "prioridade de hoje".
- **`reason` (justificativa):** renderizada em `text-xs`, `bone-400`, logo abaixo do título, prefixada pelo score mono `S {s1×s2×s3}`. Os textos reais vêm do `today.ts` ("S alto (125) e sem dependência aberta", "desempate por s1", "único item pendente" etc.) — a UI **exibe verbatim**, não os reescreve.
- **Chip de status:** mesmo mapa de cor da §1.1. `dueDate` (quando não-null) em `font-mono`, `bone-300`; se vencida (`< hoje`), o texto fica `state-warning`.
- **Fonte:** ícone lucide da fonte (§1.5) à direita do título, com `aria-label` "fonte: {label}".
- **Interação:** hover/click sincroniza com o grafo (`onSelectTask`); o nó correspondente ganha o anel dourado. Item selecionado: fundo `navy-700`, borda-esquerda `gold-500` 3px.

### 4.2 Estado vazio (sem tarefa acionável hoje)

`items.length === 0 && !isLoading && !error`. **Não** é erro — é sucesso ("nada trava hoje"). Ilustração discreta + copy empática (voz ALMA PETRA):

```
        ✓ (CheckCircle2, state-success, 32px)
   Nada acionável para hoje.
   Ou tudo que existe está aguardando um predecessor,
   ou você já venceu a fila. Respire.  🌿
   [ Ver grafo completo ]  (botão gold, foca a Zona A)
```

- Se **existem** tarefas mas todas estão bloqueadas por predecessor: subcopy "N tarefa(s) aguardando dependência — veja no grafo" com link que destaca os nós bloqueados.

### 4.3 Estados de carga e erro

- **Loading** (`isLoading`): 3 skeletons de item (shimmer `navy-800`↔`navy-700`, respeita reduced-motion).
- **Erro de fetch** (`error != null`, ex.: `/api/today` 500): banner `state-error` "não consegui montar a lista de hoje" + botão "tentar de novo". **Aplicar gotcha:** o hook de fetch checa `response.ok` **antes** de `.json()` (gotcha "Fetch Error Handling"); o `useEffect`/query usa cleanup com flag `cancelled` (gotcha "useEffect Cleanup") — ou preferencialmente `useQuery` do TanStack, que já cobre race/cleanup.
- **Ciclos excluídos** (`excludedCycles.length > 0`): nota discreta no rodapé da lista — `state-error-fg`, ícone `AlertTriangle`: "N tarefa(s) fora da fila por ciclo de dependência" com link para destacá-las no grafo. Degradação graciosa: a lista **não quebra**, só sinaliza.

---

## 5. Filtro por fonte (`source-filter.tsx`)

Multi-select das 5 fontes canônicas (`SourceKind`: `calendar | gmail | drive | notes | claude_chat`). Vive no left rail (§2.1).

- **Comportamento:** cada fonte é um checkbox com ícone (§1.5), label e **contador** de tarefas daquela fonte. Estado inicial: **todas marcadas** (equivalente a "sem filtro"). Desmarcar oculta aquela fonte.
- **Semântica de "vazio":** `selected` vazio **OU** todas marcadas ⇒ mostra tudo (o filtro só restringe quando um subconjunto próprio está ativo). Botão **[Limpar]** volta a "todas".
- **Efeito simultâneo em grafo + lista** (requisito PRD §4/§8): o filtro é a **única** fonte de verdade de visibilidade e alimenta os dois componentes ao mesmo tempo:
  - **Grafo:** nós de fonte não-selecionada recebem `isFilteredOut` (opacity 0.2, sem interação); arestas ligadas a eles esmaecem. **Não** removemos o nó — preserva a topologia/contexto (você vê "há algo ali, mas filtrado"). `fitView` reenquadra nos visíveis.
  - **Lista "hoje":** itens de fonte não-selecionada são **ocultados** (removidos da lista, não esmaecidos — a lista é curta e acionável; ruído não ajuda). A ordenação HIERARQ dos remanescentes é preservada (não recalcula pesos, só filtra a exibição).
- **Estado (Zustand):** o filtro é UI-state client (arch §4 — Zustand). **Aplicar gotcha "Zustand Persist Type Inference":** `create<SourceFilterState>()(persist((set) => ({...}), { name: "lifeboard-source-filter" }))` — com parâmetro de tipo **e** parênteses extras. Persistir em `localStorage` para o filtro sobreviver a reload.
- **Flag de stale inline:** se a fonte está desatualizada (§6), um ponto `state-warning` aparece ao lado do label do filtro (não desabilita a fonte — só sinaliza).

---

## 6. Estado de degradação — flag "fonte desatualizada" (`stale-source-flag.tsx`)

PRD §9 + §11 stress-4: se uma fonte falha no sync, o dashboard **segue de pé** com as demais e mostra uma flag "fonte X desatualizada desde …". Fonte da verdade: `Source.lastSyncAt` + o último `SyncLog.ok/error` daquela fonte.

- **Onde aparece:** (a) **header** — um cluster compacto de flags para todas as fontes stale (visibilidade global); (b) **inline no `SourceFilter`** — ponto de aviso ao lado da fonte afetada. O componente `StaleSourceFlag` é reutilizado nos dois lugares (mesmo componente, tamanho `sm`/`md`).
- **Regra de "stale":**
  - `severity: "error"` quando o **último `sync_log.ok === false`** (a última sync daquela fonte falhou) → cor `state-error`, ícone `CloudOff`.
  - `severity: "warning"` quando a última sync foi OK mas **antiga** (ex.: `lastSyncAt` > 26h atrás — o PRD promete sync ≤1×/dia; passou de ~1 dia = desatualizado) → cor `state-warning`.
- **Conteúdo:** chip `radius-full`, `bg` = tint da severidade (`gold-700`-like fundo escuro), ícone + texto: **"{label} desatualizada — última sync {tempo relativo}"** (ex.: "Drive desatualizada — há 2 dias"). Tooltip no hover expõe o `lastError` (se houver) e o timestamp absoluto (`font-mono`).
- **Nunca bloqueia a UI.** É informativo. As tarefas já ingeridas daquela fonte continuam no grafo/lista (último estado bom, PRD §9).
- **A11y:** `role="status"` + `aria-live="polite"` no cluster do header, para que leitores de tela anunciem a degradação sem roubar foco.

---

## 7. Acessibilidade (WCAG 2.1 AA — baseline)

- **Contraste:** todo texto/UI passa AA (§1.1 traz os ratios). Texto normal ≥ 4.5:1 (`bone-*` sobre navy: 7–15:1; `gold-500` 5.5:1). Componentes/estado non-text ≥ 3:1. Erro pequeno usa `state-error-fg` (6.5:1), não `state-error` cru.
- **Foco visível:** anel `gold-400` (`shadow-focus`, 2px + offset) em **todo** elemento interativo (nós, itens de lista, checkboxes, botões). `outline:none` é **proibido**.
- **Navegação por teclado no grafo** (React Flow não é teclado-friendly nativamente). Duas garantias:
  1. **Nós tabáveis:** cada `TaskNode` é focável (`tabIndex=0`), `Enter`/`Space` seleciona (dispara `onSelectTask`), setas movem foco entre nós conectados (predecessor/sucessor).
  2. **Fallback obrigatório — lista alternativa navegável** (`accessibleFallback`): uma tabela/lista linear de todas as tarefas (título, status, fonte, predecessores, sucessores) que representa o mesmo grafo em ordem topológica, 100% navegável por teclado e leitor de tela. Acessível por um toggle "ver como lista" e automaticamente para `prefers-reduced-motion` / leitores de tela. Isto satisfaz o requisito "navegação por teclado no grafo (ou fallback: lista alternativa navegável)".
- **ARIA labels (mínimos):**
  - Grafo: `role="application"` + `aria-label="Grafo de dependências de tarefas"`; cada nó `aria-label="{título}, status {status}, fonte {label}{, bloqueada por {predecessor}}"`.
  - `TodayList`: `<ol aria-label="Tarefas priorizadas para hoje">`, cada item `<li>` com `aria-posinset`/`aria-setsize`; a `reason` associada via texto (não só cor).
  - `SourceFilter`: `<fieldset>` + `<legend>Filtrar por fonte</legend>`, cada checkbox com `aria-label="{label}, {count} tarefas{, desatualizada}"`.
  - `StaleSourceFlag`: `role="status"`, `aria-live="polite"`.
- **Cor nunca é o único sinal:** status também tem **ícone + texto** (chip com label); bloqueio tem ícone `Lock` + texto; stale tem ícone + texto. Daltônico-safe.
- **Reduced motion:** `prefers-reduced-motion: reduce` desliga glow, dash animado das arestas, shimmer de skeleton e transições de pan/zoom.
- **Alvos de toque:** interativos ≥ 40×40px (checkboxes do filtro com área ampliada).

---

## 8. Contratos de componentes (para o `@dev`)

Mapeamento 1:1 aos arquivos previstos em architecture.md §3. **Todos** importam tipos de `@/types/canonical` (coding standard §11 — nunca redefinem `Task`/`Source`/etc.). Componentes são Client Components; **nenhum** importa `core/prioritize/**` ou `lib/mcp/**` (fronteira server-only).

### 8.1 `src/components/graph/task-node.tsx`

```typescript
"use client";
import type { NodeProps } from "reactflow";
import type { SourceKind, Task } from "@/types/canonical";

/** Estado DERIVADO do grafo (não persistido na Task). */
export interface TaskNodeData {
  task: Task;
  /** Fonte da tarefa (para ícone/badge). */
  sourceKind: SourceKind;
  sourceLabel: string;
  /** Derivado (dag): ≥1 predecessor ainda não 'done' → não acionável. */
  blockedByPredecessor: boolean;
  /** Título do 1º predecessor aberto, para o badge "aguardando: …". */
  blockingPredecessorTitle?: string;
  /** Derivado (dag): participa de ciclo de dependência (erro). */
  inCycle: boolean;
  /** É o rank-0 da lista "hoje" (anel de ênfase gold). */
  isTopToday?: boolean;
  /** Esmaecido por filtro de fonte inativo (§5). */
  isFilteredOut?: boolean;
}

/** Node customizado do React Flow. Puro de apresentação. */
export type TaskNodeProps = NodeProps<TaskNodeData>;
```

### 8.2 `src/components/graph/dependency-graph.tsx`

```typescript
"use client";
import type { Source, SourceKind, Task } from "@/types/canonical";

export interface DependencyGraphProps {
  /** Universo de tarefas (modelo canônico). Arestas são derivadas internamente
   *  de predecessorIds/successorIds e deduplicadas por (from,to). */
  tasks: Task[];
  /** Fontes (para label/ícone por nó e legenda). */
  sources: Source[];
  /** Filtro ativo (§5). Vazio OU todas = sem filtro (mostra tudo). */
  activeSourceKinds: SourceKind[];
  /** IDs em ciclo (de GET /api/today → excludedCycles). Marca nós como erro. */
  cycleTaskIds?: string[];
  /** IDs da lista "hoje" em ordem de rank (para ênfase e sync com a lista). */
  todayTaskIds?: string[];
  /** Seleção compartilhada com TodayList. */
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
  /** Renderiza a lista alternativa acessível em vez do canvas (§7). */
  accessibleFallback?: boolean;
}
```

### 8.3 `src/components/dashboard/today-list.tsx`

```typescript
"use client";
import type { Task } from "@/types/canonical";

/** Uma linha da lista "hoje" — espelha item de GET /api/today
 *  (retorno de buildTodayList: { task, reason }). Cliente NÃO pode importar
 *  o TodayItem de core/prioritize/today.ts (server-only); replicamos a forma. */
export interface TodayListItem {
  task: Task;
  /** Justificativa verbatim do motor HIERARQ (ex.: "desempate por s1"). */
  reason: string;
}

export interface TodayListProps {
  items: TodayListItem[];
  /** IDs excluídos por ciclo (GET /api/today → excludedCycles) — nota degradada. */
  excludedCycleIds?: string[];
  isLoading?: boolean;
  error?: Error | null;
  /** Seleção compartilhada com o grafo. */
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string) => void;
}
```

### 8.4 `src/components/dashboard/source-filter.tsx`

```typescript
"use client";
import type { SourceKind } from "@/types/canonical";

export interface SourceFilterOption {
  kind: SourceKind;
  label: string;
  /** Nº de tarefas dessa fonte (badge). */
  count: number;
  /** Fonte desatualizada → ponto de aviso inline (§6). */
  isStale?: boolean;
}

export interface SourceFilterProps {
  options: SourceFilterOption[];
  /** Multi-select. Vazio = todas visíveis (sem filtro). */
  selected: SourceKind[];
  onChange: (next: SourceKind[]) => void;
}
```

> Estado interno recomendado (Zustand, gotcha aplicado):
> ```typescript
> interface SourceFilterState { selected: SourceKind[]; setSelected: (s: SourceKind[]) => void; }
> const useSourceFilter = create<SourceFilterState>()(
>   persist((set) => ({ selected: [], setSelected: (selected) => set({ selected }) }),
>           { name: "lifeboard-source-filter" }),
> );
> ```

### 8.5 `src/components/dashboard/stale-source-flag.tsx`

```typescript
"use client";
import type { SourceKind } from "@/types/canonical";

export interface StaleSourceFlagProps {
  sourceLabel: string;
  sourceKind: SourceKind;
  /** Source.lastSyncAt (ISO) — null = nunca sincronizada. */
  lastSyncAt: string | null;
  /** Último SyncLog.error da fonte (tooltip). */
  lastError?: string | null;
  /** 'error' = última sync falhou (sync_log.ok=false); 'warning' = OK porém antiga. */
  severity?: "warning" | "error";
  /** Tamanho: 'sm' inline no filtro, 'md' no header. */
  size?: "sm" | "md";
}
```

### 8.6 Componentes auxiliares (derivados dos primitivos `ui/`)

Não são novos arquivos-requisito, mas o `@dev` os comporá dos primitivos shadcn tematizados (`ui/`): `StatusChip` (chip cor+ícone+label por `TaskStatus`), `SourceIcon` (map `SourceKind`→lucide, §1.5), `RankBadge` (círculo numerado), `GraphControls` (zoom/fit), `GraphLegend`, `AccessibleGraphList` (fallback §7). Todos consomem tokens da §1 — **zero hex hardcoded**.

---

## 9. Rastreabilidade (No Invention — Artigo IV)

| Seção deste spec | Origem no PRD / arch |
|------------------|----------------------|
| §1 Tokens ALMA PETRA | PRD §1 (navy/bone/dourado, dark mode) · PRD §4 ("paleta ALMA PETRA, dark mode") |
| §2 Layout split (grafo + hoje + filtro) | PRD §4 ("grafo gigante + a lista hoje") · arch §2.4 |
| §3 Grafo DAG, status por cor, bloqueio, arestas | PRD §4 (predecessor/successor, DAG) · arch §8 · `dag.ts` |
| §4 Lista "hoje" com `reason`, ordenação, vazio | PRD §4 (HIERARQ + justificativa) · `today.ts` / `GET /api/today` (arch §7) |
| §5 Filtro por fonte (grafo+lista) | PRD §4/§8 (filtro por fonte) · arch §4 (Zustand) |
| §6 Flag "fonte desatualizada" | PRD §9 + §11 stress-4 · arch §5.2/§3 (`stale-source-flag.tsx`) |
| §7 Acessibilidade | Persona core_principle "WCAG AA" · boa prática (não inventa feature de produto) |
| §8 Contratos de componentes | arch §3 (arquivos) · `@/types/canonical` · `GET /api/today` |

**Débitos nomeados (fora do escopo v1.0):** auto-layout `dagre`/`elkjs` no grafo; MiniMap; tema claro; edição de posição de nós; resize do split. Todos justificados por volume single-user (YAGNI).

---

*Front-End Spec OS-LIFEBOARD v1.0 — Uma (UX-Design Expert) — ALMA PETRA — 2026-07-09.*
*Deriva de `packages/lifeboard/PRD.md` + `architecture.md`. Nenhum requisito inventado (Artigo IV). Próximo passo: `@dev` implementa os 5 componentes da §8 (Runbook Ordem 5, parte 2).*
*— Uma, desenhando com empatia 💝*
