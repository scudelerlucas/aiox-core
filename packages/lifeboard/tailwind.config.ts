import type { Config } from "tailwindcss";

/**
 * OS-LIFEBOARD — Tokens de design ALMA PETRA.
 *
 * **v2, 13/09/2026 — ordem do operador:** "hierarquia visual, paleta colorida e
 * dopaminérgica de alto contraste e divertida". A v1 era navy + osso + dourado
 * apagado: bonita e monótona, com os cinco estados quase indistinguíveis e
 * nenhuma cor por fonte — dar uma batida de olho não dizia nada. A v2 mantém a
 * base escura (a identidade da casa) e sobe o contraste dela, e injeta cor onde
 * ela **informa**: uma cor viva por FONTE e uma por ESTADO.
 *
 * Regra que continua valendo: nenhum hex fora deste arquivo.
 * Contraste: todo par texto×fundo usado na interface é verificado contra 4,5:1
 * (régua de UI/UX, §3) — ver `scripts/checar-contraste.mjs`.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /** Fundos e superfícies. Escada mais larga que a v1: cada degrau é visível. */
        navy: {
          950: "#05070F", // fundo da aplicação
          900: "#0A1020", // painel
          850: "#121A30", // cartão
          800: "#1B2542", // cartão elevado / hover
          700: "#465E9E", // borda de cartão — calibrada em 3,21:1 sobre o fundo
          600: "#6078B8", // borda forte — 4,01:1 sobre o cartão
          500: "#8AA0DC", // borda de foco / divisor claro
        },
        /** Texto. bone-100 é o principal; 300 o secundário; 400 o terciário. */
        bone: {
          50: "#FFFFFF",
          100: "#EDF1FA",
          200: "#DCE3F2",
          300: "#B9C4DC",
          400: "#94A3C0",
          500: "#6C7A99",
        },
        /** Dourado da marca — agora vivo, reservado para a AÇÃO e para o 1º lugar. */
        gold: {
          300: "#FFE3A3",
          400: "#F7CE73",
          500: "#E0AE4A",
          600: "#B98A32",
          700: "#8A6522",
        },
        /**
         * Estado da tarefa. Cada um com matiz próprio e luminosidade alta o
         * bastante para passar 4,5:1 sobre navy-850/800 — cor NUNCA é o único
         * sinal (há sempre ícone + texto), mas agora ela ajuda de verdade.
         */
        state: {
          open: "#7FB8FF",
          progress: "#FFC145",
          blocked: "#FF7A6B",
          done: "#5FE39A",
          success: "#5FE39A",
          "success-fg": "#5FE39A",
          warning: "#FFC145",
          error: "#FF7A6B",
          "error-fg": "#FF9C90",
          neutral: "#94A3C0",
        },
        /**
         * Cor por FONTE — o que dá o colorido e permite bater o olho e saber de
         * onde a tarefa veio, sem ler. `neutra` cobre qualquer kind novo no
         * banco (mesma disciplina do conserto de 13/09).
         */
        fonte: {
          calendar: "#4FD1FF",
          gmail: "#FF7AB6",
          drive: "#FFC145",
          notes: "#B69BFF",
          chat: "#7CE38B",
          lms: "#FF9B54",
          neutra: "#9AA8C4",
        },
        /**
         * Aresta do grafo v3 (P4, 13/09/2026) — as 6 arestas do doc §5. "Predecessor"
         * (destaque amarelo ao selecionar) e "sucessão" (verde, default) são a MESMA
         * aresta lida dos dois lados — por isso não há um token "predecessor" e outro
         * "sucessao" concorrentes: o segundo É o primeiro, só que sem destaque.
         * "Crítico" reusa o vermelho de obsolescência — as duas se distinguem por
         * FORMA (traço triplo × ❌), não por matiz (régua daltônico-safe).
         */
        aresta: {
          sucessao: "#5FE39A",
          predecessor: "#F7CE73",
          correlacao: "#B9C4DC",
          sinergia: "#C58CFF",
          obsolescencia: "#FF7A6B",
          critico: "#FF7A6B",
          /**
           * P4b (13/09/2026, achado ALTO #4 do crítico hostil contra Asana
           * Timeline): `obsolescencia` acima é IDÊNTICA a `critico` — as duas só
           * se distinguiam por FORMA (traço triplo × ❌), e num screenshot real
           * liam-se como a mesma cor. Matiz própria (magenta), ≥3:1 sobre
           * navy-950 para traço e ≥4,5:1 para texto — ver
           * `scripts/checar-contraste.mjs`. ADITIVO: `obsolescencia` acima
           * fica como está (não editado, só somado) — só `aresta-svg.tsx`
           * (P4, dono do arquivo) passou a consumir esta chave nova.
           */
          obsolescenciaHue: "#FF6EC7",
          /**
           * P5c (13/09/2026, achado MÉDIO #9 do crítico hostil, rodada 2 —
           * Gantt): antes, selecionar uma tarefa deixava seus SUCESSORES na
           * MESMA cor verde do default (`aresta.sucessao`) — só a espessura
           * do traço mudava, pouco perceptível. Verde mais claro/saturado,
           * reservado ao destaque de seleção. ADITIVO — nenhum token acima mudou.
           */
          sucessaoAtiva: "#8CFFC0",
        },
        /**
         * P5b (13/09/2026, achado ALTO #7 do crítico hostil contra Asana
         * Timeline): a hachura de FOLGA do Gantt reusava `aresta.critico` a
         * 25% (`bg-aresta-critico/25` + `rgba(255,122,107,0.35)` literal em
         * `className`) — 2,71:1 contra `navy-950` (abaixo da régua de 3:1
         * para traço/hachura) E o MESMO matiz do crítico para o conceito
         * OPOSTO (folga = margem de segurança; crítico = risco de prazo).
         * Ciano dessaturado, nunca usado como texto corrido (só traço/
         * hachura) — por isso a régua em `scripts/checar-contraste.mjs` é
         * 3:1, contra `navy-950` (canvas) E contra `navy-850` (base da
         * barra). ADITIVO — grupo novo, nenhum token existente mudou.
         */
        folga: {
          tracado: "#57C9C0",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SF Mono", "JetBrains Mono", "monospace"],
      },
      borderRadius: { sm: "6px", md: "10px", lg: "16px", xl: "22px" },
      boxShadow: {
        node: "0 1px 2px rgba(0,0,0,.5)",
        panel: "0 8px 32px rgba(0,0,0,.55)",
        card: "0 2px 10px rgba(0,0,0,.35)",
        /** Brilho do 1º lugar da fila — o único elemento com glow na tela. */
        heroi: "0 0 0 1px #E0AE4A, 0 6px 26px -6px rgba(224,174,74,.55)",
        focus: "0 0 0 2px #F7CE73",
      },
      transitionTimingFunction: { almapetra: "cubic-bezier(.4,0,.2,1)" },
    },
  },
};

export default config;
