import { describe, expect, it } from "vitest";

import { contaTemEspacoPara, escolherConta } from "@/core/prompts/roteador";
import type { Complexidade, Conta, ConsumoConta } from "@/core/prompts/tipos";
import {
  CONTAS,
  CUSTO_ESTIMADO_POR_COMPLEXIDADE,
  MODELO_POR_COMPLEXIDADE,
  custoEstimadoParaComplexidade,
  espacoLivreUsd,
  textoEspacoLivre,
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
    estimativaUsd: 0,
    estimativaItens: 0,
    emEspera: 0,
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
      "Nenhuma conta tem US$ 120,00 livres para uma tarefa máxima contando a fila parada. " +
        "A mais folgada (Pandora) tem US$ 102,90.",
    );
  });

  // ── D29 (rodada 6): UMA RÉGUA — o espaço livre decide E fala ──────────────
  /**
   * Este bloco mudou de veredito na rodada 6, e o motivo está medido. D13
   * (rodada 4) mandou o HEADROOM decidir `cabeHoje` enquanto o ESPAÇO LIVRE
   * escolhia a conta. O crítico mostrou o preço disso: a frase saía do
   * headroom e dizia "nenhuma conta tem US$ 50,00 livres" com uma conta de US$
   * 150,00 de headroom e US$ 140,00 já na fila. D29: uma régua só — o espaço
   * livre escolhe, decide e fala; o headroom vira a EXPLICAÇÃO dentro da frase,
   * nunca o veredito. A metade de D13 que continua valendo (nada de número
   * negativo na tela) está no último bloco deste describe.
   */
  it("D29 — a fila parada escolhe a conta E decide se cabe hoje", () => {
    const r = escolherConta([consumo(LUCAS, 150), consumo(PANDORA, 0, 0, 149)], "alta");
    expect(r.conta).toBe(PANDORA);
    expect(r.headroomUsd).toBe(150);
    expect(r.espacoLivreUsd).toBe(1);
    expect(r.cabeHoje).toBe(false);
    // e o headroom aparece como explicação, sem virar veredito:
    expect(r.motivo).toBe(
      "Nenhuma conta tem US$ 50,00 livres para uma tarefa alta contando a fila parada. " +
        "A mais folgada (Pandora) tem US$ 1,00 (headroom de US$ 150,00 menos US$ 149,00 já na fila).",
    );
  });

  it("D29 — o cenário exato do crítico: a frase revela a conta folgada que não ganhou", () => {
    // Lucas: teto 150, medido 140, fila 0   -> headroom 10,  espaço 10
    // Pandora: teto 150, medido 0, fila 140 -> headroom 150, espaço 10
    // Empate no espaço; a ordem da casa entrega a Lucas. A frase antiga dizia
    // "Nenhuma conta tem US$ 50,00 livres hoje. A mais folgada (Lucas) tem
    // US$ 10,00." — e Pandora tinha US$ 150,00 livres agora.
    const r = escolherConta([consumo(LUCAS, 140), consumo(PANDORA, 0, 0, 140)], "alta");
    expect(r.conta).toBe(LUCAS);
    expect(r.cabeHoje).toBe(false);
    expect(r.motivo).toBe(
      "Nenhuma conta tem US$ 50,00 livres para uma tarefa alta contando a fila parada. " +
        "A mais folgada (Lucas) tem US$ 10,00; Pandora tem US$ 150,00 livres agora, " +
        "mas US$ 140,00 já na fila. Empate no espaço livre; vale a ordem da casa.",
    );
  });

  it("D29 — espaço 30 e uma tarefa de 5: cabe hoje (o caso do banco)", () => {
    const r = escolherConta([consumo(LUCAS, 0, 120)], "baixa"); // 150 − 120 = 30
    expect(r.headroomUsd).toBe(30);
    expect(r.espacoLivreUsd).toBe(30);
    expect(r.cabeHoje).toBe(true);
  });

  it("D13 — conta acima do teto: headroom negativo, e a TELA nunca mostra isso", () => {
    const estourada = consumo(LUCAS, 170);
    expect(escolherConta([estourada], "baixa").headroomUsd).toBe(-20);
    // O crítico mediu "US$ -20,00 livres" na tela — agora é impossível:
    expect(textoEspacoLivre(estourada)).toBe("sem espaço livre agora");
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

describe("contaTemEspacoPara — a mesma régua de escolherConta (D29)", () => {
  it("usa o ESPAÇO LIVRE: 999 parados na fila fazem a conta NÃO ter espaço hoje", () => {
    // 150 − 50 − 20 = 80 de headroom, mas 999 esperando: espaço livre negativo.
    expect(contaTemEspacoPara(consumo(LUCAS, 50, 20, 999), "alta")).toBe(false);
    // sem fila parada, o mesmo headroom de 80 cabe uma alta (50):
    expect(contaTemEspacoPara(consumo(LUCAS, 50, 20, 0), "alta")).toBe(true);
  });
  it("false quando nem o headroom cobre", () => {
    expect(contaTemEspacoPara(consumo(LUCAS, 100, 40), "alta")).toBe(false); // 10 < 50
  });
  it("aceita no EMPATE exato (medido + em_execucao + na_fila + estimado == teto)", () => {
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
 *
 * RODADA 4, rodados ao vivo em 13/09/2026 (mesma disciplina, com rollback):
 *  · D13 "uma régua só": teto ajustado para `medido + em_execucao + 30` e
 *    `painel_custo_estimado.media` em 20 → 1º item `cabe_hoje=true
 *    headroom=30.00 espaco_livre=30.00`; 3º item (fila já maior que o
 *    headroom) `cabe_hoje=true headroom=30.00 espaco_livre=-10.00` — o
 *    espaço negativo existe no SQL e a TELA o clampa (`textoEspacoLivre`).
 *  · D14 "código, não frase": auto/baixa → `motivo_codigo=auto_maior_espaco`;
 *    auto/alta com headroom 30 → `auto_nao_cabe_hoje`; manual/alta →
 *    `manual_nao_cabe_hoje`. As chaves devolvidas NÃO incluem `motivo`.
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
  {
    // Rodada 6 (D29): a fila parada escolhe a conta E decide o veredito — uma
    // régua só. Provado ao vivo contra `fila_prompts_enfileirar` da migration
    // 0015 no mesmo dia (ver o bloco de cenários logo acima).
    rotulo: "D29 — fila de 149 na Pandora tira a tarefa alta do dia (uma régua só)",
    consumos: [consumo(LUCAS, 150), consumo(PANDORA, 0, 0, 149), consumo(ALMA, 150)],
    complexidade: "alta",
    contaNoBanco: PANDORA,
    cabeHojeNoBanco: false,
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
      // D29: a régua é o ESPAÇO LIVRE da conta escolhida — a mesma comparação
      // que `fila_prompts_enfileirar` (migration 0015) faz depois de escolher.
      expect(noTs.cabeHoje).toBe(
        custoEstimadoParaComplexidade(complexidade) <= espacoLivreUsd(escolhida),
      );
    }
  });
});
