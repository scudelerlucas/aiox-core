import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ANUNCIO_DE_SUCESSO,
  concluirEscrita,
  decidirEscrita,
  MENSAGEM_AGUARDE,
  MENSAGEM_INVALIDO,
  MENSAGEM_SEM_MUDANCA,
  mensagemDeRecusa,
  OPERACOES_DE_ESCRITA,
  recusarEscrita,
  type OperacaoDeEscrita,
} from "@/components/task/escrita";

/**
 * OS-LIFEBOARD · P6 — VARREDURA das escritas da página da tarefa.
 *
 * Nasce do veredito da rodada 6 do crítico hostil: *"consertou os 5 caminhos
 * que mediu e deixou os 3 gêmeos"*. A rodada 5 tratou 5 operações; as 3
 * CRIAÇÕES (nota, subtarefa, relação) continuaram jogando o foco no `<body>`
 * — por um segundo caminho (`disabled` por VALIDADE + o `aoSucesso` que
 * esvazia o campo) que a amostra não cobria.
 *
 * Por isso este arquivo não testa uma amostra: a lista `OPERACOES` abaixo é
 * TODA operação de escrita da página, por extenso, e cada uma passa pelas
 * mesmas quatro provas. Operação nova que não entre na lista quebra o 1º
 * teste; operação da lista cujo componente não chame `decidirEscrita` +
 * `concluirEscrita` quebra o teste de fiação.
 *
 * Ambiente: sem DOM. O repositório não tem jsdom nem `@testing-library`, e
 * `npm install` está proibido nesta rodada (regra de isolamento) — então o
 * `document` é um objeto falso injetado, e o `document.activeElement` de
 * verdade é medido no NAVEGADOR, com Playwright, para as mesmas 14 operações
 * desta lista.
 *
 * Reverter para ver falhar: em `notas-painel.tsx`, apagar a linha
 * `concluirEscrita("nota_criar", …)` — o teste de fiação quebra na hora.
 */

interface CasoDeEscrita {
  op: OperacaoDeEscrita;
  /** O arquivo que executa a operação (relativo a `src/`). */
  arquivo: string;
  /** Para onde o foco vai quando a operação dá certo — em português. */
  alvo: string;
  /** O plano B, quando o alvo não aceita foco (nó já fora da árvore). */
  alternativa: string | null;
}

const OPERACOES: readonly CasoDeEscrita[] = [
  {
    op: "nota_criar",
    arquivo: "components/task/notas-painel.tsx",
    alvo: "a textarea da nota nova (que acabou de esvaziar)",
    alternativa: null,
  },
  {
    op: "nota_excluir",
    arquivo: "components/task/notas-painel.tsx",
    alvo: "o botão excluir da nota seguinte",
    alternativa: "a textarea da nota nova",
  },
  {
    op: "nota_desfazer",
    arquivo: "components/task/notas-painel.tsx",
    alvo: "a textarea da nota nova",
    alternativa: null,
  },
  {
    op: "subtarefa_criar",
    arquivo: "components/task/subtarefas-painel.tsx",
    alvo: "o campo de título (que acabou de esvaziar)",
    alternativa: null,
  },
  {
    op: "relacao_criar",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o select de destino (que voltou a 'Escolha a tarefa…')",
    alternativa: "o botão Adicionar relação",
  },
  {
    op: "relacao_excluir",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o botão excluir da relação seguinte",
    alternativa: "o select de destino",
  },
  {
    op: "relacao_desfazer_criacao",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o botão Adicionar relação",
    alternativa: "o select de destino",
  },
  {
    op: "relacao_desfazer_exclusao",
    arquivo: "components/task/relacoes-painel.tsx",
    alvo: "o select de destino",
    alternativa: null,
  },
  {
    op: "status",
    arquivo: "components/task/status-form.tsx",
    alvo: "o botão de status que ficou marcado",
    alternativa: null,
  },
  {
    op: "mae",
    arquivo: "components/task/mae-form.tsx",
    alvo: "o select de tarefa mãe",
    alternativa: null,
  },
  {
    op: "meta",
    arquivo: "components/task/meta-form.tsx",
    alvo: "o botão da meta",
    alternativa: null,
  },
  {
    op: "duracao",
    arquivo: "components/task/duracao-form.tsx",
    alvo: "o botão Salvar duração",
    alternativa: null,
  },
  {
    op: "atomos_salvar",
    arquivo: "components/task/atomos-form.tsx",
    alvo: "o botão Salvar átomos",
    alternativa: null,
  },
  {
    op: "atomos_limpar",
    arquivo: "components/task/atomos-form.tsx",
    alvo: "o 1º botão do grupo Opcionalidade",
    alternativa: "o botão Salvar átomos",
  },
];

function fonte(arquivo: string): string {
  return readFileSync(fileURLToPath(new URL(`../../src/${arquivo}`, import.meta.url)), "utf8");
}

/**
 * O CÓDIGO, sem os comentários — estes arquivos explicam por escrito o
 * `disabled` que causou o achado, e a explicação não pode fazer o teste
 * confundir a história com o código vivo.
 */
function codigo(arquivo: string): string {
  return fonte(arquivo)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** Um elemento falso: `focavel: false` imita um nó que saiu da árvore. */
function elementoFalso(nome: string, focavel: boolean, doc: { activeElement: unknown }) {
  const el = {
    nome,
    focus: (): void => {
      if (focavel) doc.activeElement = el;
    },
  };
  return el;
}

const BODY = { nome: "<body>", focus: (): void => undefined };

describe("a lista de escritas é a página inteira, não uma amostra", () => {
  it("PRONTO QUANDO: as 14 operações da página estão na lista, sem sobra nem falta", () => {
    expect(OPERACOES.map((c) => c.op)).toEqual([...OPERACOES_DE_ESCRITA]);
    expect(OPERACOES).toHaveLength(14);
  });

  it("toda operação da lista tem um anúncio em português, não vazio", () => {
    for (const { op } of OPERACOES) {
      expect(ANUNCIO_DE_SUCESSO[op].length, op).toBeGreaterThan(3);
      expect(ANUNCIO_DE_SUCESSO[op].endsWith("."), op).toBe(true);
    }
  });
});

describe("depois do sucesso, o foco NUNCA fica no <body> — as 14 operações", () => {
  for (const caso of OPERACOES) {
    it(`PRONTO QUANDO: ${caso.op} entrega o foco a ${caso.alvo}`, () => {
      const doc = { activeElement: BODY as unknown };
      const alvo = elementoFalso(caso.alvo, true, doc);
      const alternativa =
        caso.alternativa === null ? null : elementoFalso(caso.alternativa, true, doc);
      const anunciados: string[] = [];
      concluirEscrita(caso.op, alvo, alternativa, (t) => anunciados.push(t), undefined, doc);
      expect(doc.activeElement).not.toBe(BODY);
      expect((doc.activeElement as { nome: string }).nome).toBe(caso.alvo);
      expect(anunciados).toEqual([ANUNCIO_DE_SUCESSO[caso.op]]);
    });

    it(`${caso.op}: alvo que já saiu da árvore cai na alternativa, nunca no <body>`, () => {
      const doc = { activeElement: BODY as unknown };
      const alvo = elementoFalso(caso.alvo, false, doc); // não aceita foco
      const alternativa =
        caso.alternativa === null ? null : elementoFalso(caso.alternativa, true, doc);
      concluirEscrita(caso.op, alvo, alternativa, () => undefined, undefined, doc);
      if (caso.alternativa === null) {
        // Sem plano B: o foco fica ONDE ESTAVA. Isso só é seguro porque
        // nenhum controle desta página vira `disabled` (ver o teste de
        // fiação abaixo) — se virasse, "onde estava" seria o `<body>`.
        expect(doc.activeElement).toBe(BODY);
      } else {
        expect(doc.activeElement).not.toBe(BODY);
        expect((doc.activeElement as { nome: string }).nome).toBe(caso.alternativa);
      }
    });
  }
});

describe("fiação: cada operação está de fato ligada no componente que a executa", () => {
  for (const caso of OPERACOES) {
    it(`PRONTO QUANDO: ${caso.arquivo} chama concluirEscrita e recusarEscrita para "${caso.op}"`, () => {
      const src = fonte(caso.arquivo);
      // O sucesso entrega o foco e anuncia…
      expect(new RegExp(`concluirEscrita\\(\\s*"${caso.op}"`).test(src), caso.op).toBe(true);
      // …e a recusa (gravação em curso, inválido, nada mudou) fala.
      expect(new RegExp(`recusarEscrita\\(\\s*"${caso.op}"`).test(src), caso.op).toBe(true);
      expect(src, caso.op).toContain("decidirEscrita({");
    });
  }

  it("PRONTO QUANDO: o segmentado não engole mais o clique durante a gravação (BAIXO #4)", () => {
    // Até a rodada 5, `aoClicar` tinha `if (desabilitado) return;` — a recusa
    // funcionava e era MUDA. Agora o clique chega ao handler de quem usa, que
    // recusa por `decidirEscrita` e diz "Aguarde…" na região viva.
    const src = codigo("components/task/controle-segmentado.tsx");
    expect(src).not.toContain("if (desabilitado) return");
    expect(src).toContain("aoMudar(valor)");
  });

  it("PRONTO QUANDO: nenhum componente da página usa o atributo `disabled` (ALTO #1)", () => {
    // É ESTE atributo que faz o navegador tirar o foco do elemento — inclusive
    // quando ele vira `disabled` NO INSTANTE DO SUCESSO, que é como as 3
    // criações mandavam o foco para o `<body>` mesmo depois da rodada 5.
    const arquivos = [...new Set(OPERACOES.map((c) => c.arquivo))].concat([
      "components/task/controle-segmentado.tsx",
    ]);
    for (const arquivo of arquivos) {
      const semAria = codigo(arquivo).replace(/aria-disabled/g, "");
      expect(semAria.includes("disabled="), arquivo).toBe(false);
    }
  });
});

describe("decidirEscrita — a porta única de toda escrita", () => {
  it("PRONTO QUANDO: gravação em curso recusa com 'aguardar' (e a recusa FALA — BAIXO #4)", () => {
    expect(decidirEscrita({ pendente: true })).toBe("aguardar");
    expect(mensagemDeRecusa("mae", "aguardar")).toBe(MENSAGEM_AGUARDE);
    for (const { op } of OPERACOES) {
      expect(mensagemDeRecusa(op, "aguardar"), op).toBe(MENSAGEM_AGUARDE);
    }
  });

  it("PRONTO QUANDO: valor igual ao confirmado não grava (MÉDIO #3 — 6 Enters, 6 POSTs)", () => {
    expect(decidirEscrita({ pendente: false, mudou: false })).toBe("sem_mudanca");
    expect(decidirEscrita({ pendente: false, mudou: true })).toBe("gravar");
    // Seleção (status/mãe/meta): recusa silenciosa — o valor pedido já está na
    // tela. Botão de salvar (duração/átomos): a região viva responde.
    expect(mensagemDeRecusa("status", "sem_mudanca")).toBeNull();
    expect(mensagemDeRecusa("mae", "sem_mudanca")).toBeNull();
    expect(mensagemDeRecusa("meta", "sem_mudanca")).toBeNull();
    expect(MENSAGEM_SEM_MUDANCA.duracao).toBeDefined();
    expect(MENSAGEM_SEM_MUDANCA.atomos_salvar).toBeDefined();
  });

  it("PRONTO QUANDO: formulário inválido recusa com frase em português, não com um botão morto", () => {
    expect(decidirEscrita({ pendente: false, valido: false })).toBe("invalido");
    for (const op of ["nota_criar", "subtarefa_criar", "relacao_criar", "atomos_salvar"] as const) {
      expect(MENSAGEM_INVALIDO[op], op).toBeDefined();
      expect(mensagemDeRecusa(op, "invalido"), op).toBe(MENSAGEM_INVALIDO[op]);
    }
  });

  it("a ordem das recusas: gravação em curso vence validade, que vence 'nada mudou'", () => {
    expect(decidirEscrita({ pendente: true, valido: false, mudou: false })).toBe("aguardar");
    expect(decidirEscrita({ pendente: false, valido: false, mudou: false })).toBe("invalido");
    expect(decidirEscrita({ pendente: false, valido: true, mudou: false })).toBe("sem_mudanca");
    expect(decidirEscrita({ pendente: false })).toBe("gravar");
  });

  it("recusarEscrita põe cada mensagem no canal certo: erro no alerta, notícia na região viva", () => {
    const anunciado: string[] = [];
    const alertado: string[] = [];
    const sinais = {
      anunciar: (t: string) => anunciado.push(t),
      alertar: (t: string) => alertado.push(t),
    };
    recusarEscrita("nota_criar", "invalido", sinais);
    recusarEscrita("nota_criar", "aguardar", sinais);
    recusarEscrita("duracao", "sem_mudanca", sinais);
    recusarEscrita("status", "sem_mudanca", sinais); // silenciosa por desenho
    expect(alertado).toEqual([MENSAGEM_INVALIDO.nota_criar]);
    expect(anunciado).toEqual([MENSAGEM_AGUARDE, MENSAGEM_SEM_MUDANCA.duracao]);
  });
});

describe("desfazer não mente sobre o que restaurou (BAIXO #5)", () => {
  it("PRONTO QUANDO: a frase do desfazer diz '(como nova)' — id novo, data de agora", () => {
    // `nota_add`/`aresta_add` (migrations 0006/0008/0010) inserem uma linha
    // NOVA: não há campo de data no payload. Enquanto isso for verdade no
    // banco, a tela diz a verdade em vez de fingir que a linha voltou igual.
    expect(ANUNCIO_DE_SUCESSO.nota_desfazer).toContain("como nova");
    expect(ANUNCIO_DE_SUCESSO.relacao_desfazer_exclusao).toContain("como nova");
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          "../../supabase/migrations/0010_lifeboard_v3_escrita_ajustes_2.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    const notaAdd = migration.slice(migration.indexOf("if p_op = 'nota_add'"));
    const insert = notaAdd.slice(0, notaAdd.indexOf("nota_del"));
    expect(insert).toContain("insert into public.task_notes (task_id, texto, autor, owner)");
    expect(insert).not.toContain("criado_em");
    expect(insert).not.toContain("created_at");
  });
});
