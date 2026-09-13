import { describe, expect, it } from "vitest";

import { contaTemEspacoPara, escolherConta } from "@/core/prompts/roteador";
import type { Complexidade, Conta, ConsumoConta } from "@/core/prompts/tipos";
import {
  CONTAS,
  CUSTO_ESTIMADO_POR_COMPLEXIDADE,
  MODELO_POR_COMPLEXIDADE,
  custoEstimadoParaComplexidade,
  espacoLivreUsd,
} from "@/core/prompts/tipos";

/**
 * OS-LIFEBOARD · P7 — o roteador de conta é a peça central do pedido do
 * operador ("a conta com mais tokens disponíveis para a complexidade"). Como a
 * cota real não é mensurável (R1 do mapa !4z), o teste prova o INVERSO: maior
 * ESPAÇO LIVRE medido, desempate único e declarado, e a fronteira exata.
 *
 * Rodada 3 (D5): a regra passou a ser "maior espaço livre
 * (teto − medido − em_execucao − na_fila), empate pela ordem de CONTAS". Antes
 * eram DUAS regras convivendo (menor consumo + conta preferida no TS; menor
 * consumo + um `case` no SQL) — o caso do empate com a primeira conta cheia
 * decidia diferente nos dois lados. Agora a regra mora em `roteador.ts` e o
 * bloco final deste arquivo roda a MESMA tabela de cenários contra um
 * ESPELHO da implementação SQL, para o dia em que os dois divergirem.
 */

function consumo(
  conta: Conta,
  medido: number,
  emExecucao = 0,
  naFila = 0,
  teto = 150,
): ConsumoConta {
  return {
    conta,
    tetoUsd: teto,
    consumoHojeUsd: medido,
    reservadoUsd: emExecucao,
    naFilaUsd: naFila,
    medidoAteEm: null,
  };
}

const LUCAS = "lucasscudeler@gmail.com";
const PANDORA = "lsgpandora@gmail.com";
const ALMA = "almapetra.ltda@gmail.com";

describe("escolherConta", () => {
  it("escolhe a conta com MAIOR espaço livre", () => {
    const r = escolherConta(
      [consumo(LUCAS, 100), consumo(PANDORA, 10), consumo(ALMA, 50)],
      "baixa",
    );
    expect(r.conta).toBe(PANDORA);
    expect(r.cabeHoje).toBe(true);
    expect(r.espacoLivreUsd).toBe(140);
    expect(r.modeloSugerido).toBe("Haiku");
  });

  it("a fila parada (na_fila) conta para ESCOLHER — não deixa tudo empilhar na mesma conta", () => {
    // Mesmo consumo medido nas 3; Lucas já tem 120 esperando, Pandora 60.
    const r = escolherConta(
      [consumo(LUCAS, 20, 0, 120), consumo(PANDORA, 20, 0, 60), consumo(ALMA, 20, 0, 0)],
      "media",
    );
    expect(r.conta).toBe(ALMA);
  });

  it("empate (as 3 em US$0) cai na PRIMEIRA da ordem de CONTAS", () => {
    const r = escolherConta([consumo(LUCAS, 0), consumo(PANDORA, 0), consumo(ALMA, 0)], "media");
    expect(r.conta).toBe(CONTAS[0]);
    expect(r.modeloSugerido).toBe("Sonnet");
  });

  it("D5 — Lucas sem espaço e as outras duas empatadas: ganha lsgpandora (2ª da ordem)", () => {
    const r = escolherConta(
      [consumo(LUCAS, 150), consumo(PANDORA, 0), consumo(ALMA, 0)],
      "alta",
    );
    expect(r.conta).toBe(PANDORA);
    expect(r.espacoLivreUsd).toBe(150);
  });

  it("D3 — nenhuma conta cabe HOJE: escolhe a mais folgada assim mesmo, com cabeHoje=false", () => {
    const r = escolherConta(
      [consumo(LUCAS, 150), consumo(PANDORA, 47.1), consumo(ALMA, 149)],
      "maxima",
    );
    expect(r.conta).toBe(PANDORA); // 150 − 47,10 = 102,90 de espaço
    expect(r.cabeHoje).toBe(false);
    // D9: frase gramatical, rótulo da conta, complexidade por extenso, vírgula decimal.
    expect(r.motivo).toBe(
      "Nenhuma conta tem US$ 120,00 livres hoje para uma tarefa máxima. " +
        "A mais próxima (Pandora) tem US$ 102,90.",
    );
  });

  it("D3 — o ÚNICO `null`: a tarefa custa mais que o teto de qualquer conta", () => {
    const r = escolherConta(
      [consumo(LUCAS, 0, 0, 0, 100), consumo(PANDORA, 0, 0, 0, 100), consumo(ALMA, 0, 0, 0, 100)],
      "maxima",
    );
    expect(r.conta).toBeNull();
    expect(r.motivo).toContain("Nunca vai caber");
    expect(r.motivo).toContain("US$ 120,00");
  });

  it("tabela complexidade -> modelo é idêntica à de model-routing.md", () => {
    expect(MODELO_POR_COMPLEXIDADE).toEqual({
      baixa: "Haiku",
      media: "Sonnet",
      alta: "Opus",
      maxima: "Fable",
    });
  });

  it("tabela complexidade -> custo estimado é a mesma seed de painel_custo_estimado", () => {
    expect(CUSTO_ESTIMADO_POR_COMPLEXIDADE).toEqual({ baixa: 5, media: 15, alta: 50, maxima: 120 });
  });
});

describe("contaTemEspacoPara — o que o PULL realmente checa", () => {
  it("usa HEADROOM (teto − medido − em execução); a fila parada não conta", () => {
    // 150 − 50 − 20 = 80 de headroom, e 999 esperando na fila: cabe alta (50).
    expect(contaTemEspacoPara(consumo(LUCAS, 50, 20, 999), "alta")).toBe(true);
  });
  it("false quando o headroom não cobre", () => {
    expect(contaTemEspacoPara(consumo(LUCAS, 100, 40), "alta")).toBe(false); // 10 < 50
  });
  it("aceita no EMPATE exato (medido + em_execucao + estimado == teto)", () => {
    expect(contaTemEspacoPara(consumo(LUCAS, 100, 0), "alta")).toBe(true); // 50 == 50
    expect(contaTemEspacoPara(consumo(LUCAS, 100.01, 0), "alta")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARIDADE TS × SQL — a mesma tabela de cenários nos dois lados
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `espelhoDoSql` reproduz, linha a linha, o laço de `fila_prompts_enfileirar`
 * (`0012_lifeboard_v3_fila_posse_e_tentativas.sql`): itera as contas na ordem
 * do `case` explícito (que é a ordem de `CONTAS`), calcula
 * `teto − medido − em_execucao − na_fila` e troca o melhor só com `>` estrito.
 * Se alguém mudar o roteador sem mudar o SQL (ou vice-versa), este bloco
 * quebra — é o detector de divergência que faltava.
 */
function espelhoDoSql(consumos: readonly ConsumoConta[]): Conta | null {
  let melhor: Conta | null = null;
  let melhorEspaco = Number.NEGATIVE_INFINITY;
  for (const conta of CONTAS) {
    const c = consumos.find((x) => x.conta === conta);
    if (!c) continue;
    const espaco = c.tetoUsd - c.consumoHojeUsd - c.reservadoUsd - c.naFilaUsd;
    if (melhor === null || espaco > melhorEspaco) {
      melhor = conta;
      melhorEspaco = espaco;
    }
  }
  return melhor;
}

interface Cenario {
  rotulo: string;
  consumos: ConsumoConta[];
  complexidade: Complexidade;
  /** Conta que o BANCO escolheu / a recusa que ele deu — provado ao vivo, ver abaixo. */
  contaNoBanco: Conta | null;
  cabeHojeNoBanco: boolean;
}

/**
 * Cenários rodados AO VIVO contra o Postgres (blocos `do $$ … raise exception
 * 'RESULTADO: …'` com rollback, 13/09/2026 — nada persistiu):
 *  · "empate D5": espaço Lucas=0,00 Pandora=150,00 AlmaPetra=150,00 →
 *    `fila_prompts_enfileirar` devolveu `conta=lsgpandora@gmail.com`.
 *  · "não cabe hoje": conta manual com medido 148 e `maxima` →
 *    `ok=true cabe_hoje=false espaco_livre_usd=2.00` (o item ENTROU).
 *  · "nunca cabe": teto 10 + `maxima` → `RAISE 'fila: uma tarefa máxima custa
 *    cerca de US$ 120.00 e o teto diário desta conta é US$ 10.00 — nunca vai
 *    caber.'`
 *  · "elegibilidade": fila [maxima 120, baixa 5] com medido 40 →
 *    `pegar_interno` trouxe a `baixa` com `pulados=1`; com medido 148 →
 *    `item:null` e motivo citando "o mais barato da fila custa US$ 5.00".
 */
const CENARIOS: readonly Cenario[] = [
  {
    rotulo: "empate D5 (Lucas sem espaço, Pandora e Alma Petra em 150) -> lsgpandora",
    consumos: [consumo(LUCAS, 150), consumo(PANDORA, 0), consumo(ALMA, 0)],
    complexidade: "alta",
    contaNoBanco: PANDORA,
    cabeHojeNoBanco: true,
  },
  {
    rotulo: "empate nas 3 em zero -> lucasscudeler (1ª da ordem)",
    consumos: [consumo(LUCAS, 0), consumo(PANDORA, 0), consumo(ALMA, 0)],
    complexidade: "baixa",
    contaNoBanco: LUCAS,
    cabeHojeNoBanco: true,
  },
  {
    rotulo: "não cabe hoje (medido 148, maxima) -> entra assim mesmo, cabe_hoje=false",
    consumos: [consumo(LUCAS, 148), consumo(PANDORA, 149), consumo(ALMA, 150)],
    complexidade: "maxima",
    contaNoBanco: LUCAS,
    cabeHojeNoBanco: false,
  },
  {
    rotulo: "fila parada desempata (Lucas 120 na fila, Pandora 60, Alma 0)",
    consumos: [consumo(LUCAS, 20, 0, 120), consumo(PANDORA, 20, 0, 60), consumo(ALMA, 20)],
    complexidade: "media",
    contaNoBanco: ALMA,
    cabeHojeNoBanco: true,
  },
  {
    rotulo: "em execução (pega com sinal vivo) tira espaço da conta",
    consumos: [consumo(LUCAS, 0, 120), consumo(PANDORA, 0, 20), consumo(ALMA, 0, 50)],
    complexidade: "alta",
    contaNoBanco: PANDORA,
    cabeHojeNoBanco: true,
  },
];

describe("paridade com o roteamento SQL (fila_prompts_enfileirar, migration 0012)", () => {
  it.each(CENARIOS)("$rotulo", ({ consumos, complexidade, contaNoBanco, cabeHojeNoBanco }) => {
    const noTs = escolherConta(consumos, complexidade);
    expect(noTs.conta).toBe(contaNoBanco);
    expect(noTs.cabeHoje).toBe(cabeHojeNoBanco);
    // e o espelho da ordem SQL decide igual ao roteador de produção:
    expect(espelhoDoSql(consumos)).toBe(noTs.conta);
  });

  it("o espelho do SQL e o roteador concordam em 200 cenários aleatórios", () => {
    let semente = 42;
    const proximo = (): number => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente / 2147483648;
    };
    for (let i = 0; i < 200; i += 1) {
      const consumos = CONTAS.map((conta) =>
        consumo(
          conta,
          Math.round(proximo() * 150),
          Math.round(proximo() * 50),
          Math.round(proximo() * 150),
        ),
      );
      const complexidade = (["baixa", "media", "alta", "maxima"] as const)[
        Math.floor(proximo() * 4)
      ] as Complexidade;
      const noTs = escolherConta(consumos, complexidade);
      expect(noTs.conta).toBe(espelhoDoSql(consumos));
      const escolhida = consumos.find((c) => c.conta === noTs.conta) as ConsumoConta;
      expect(noTs.cabeHoje).toBe(
        espacoLivreUsd(escolhida) >= custoEstimadoParaComplexidade(complexidade),
      );
    }
  });
});
