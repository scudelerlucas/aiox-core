import { describe, expect, it } from "vitest";

import {
  CONTAS_CONHECIDAS,
  ENCERRADAS,
  JANELA_ATIVA_DIAS,
  JANELA_FECHADO_DIAS,
  PRIMEIRO_PAINT_CELULAR,
  PRIMEIRO_PAINT_DESKTOP,
  TETO_VISIVEL,
  composeAssuntos,
  dataCurta,
  limparTitulo,
  repoCurto,
  rotuloDaConta,
} from "@/lib/frentes/compose";
import { fixtureFrentes } from "@/lib/frentes/fixture";
import { unirBranches, unirPrs } from "@/lib/frentes/unir-leituras";
import type {
  Assunto,
  BranchSemPr,
  Coluna,
  ColunaId,
  Pr,
  QuadroAssuntos,
  Sessao,
  Sync,
} from "@/lib/frentes/types";

/** Instante de referência fixo — nenhum teste depende do relógio da máquina. */
const AGORA = Date.parse("2026-09-12T12:00:00.000Z");
const DIA = 86_400_000;
const HORA = 3_600_000;

const h = (horas: number): string => new Date(AGORA - horas * HORA).toISOString();
const d = (dias: number): string => new Date(AGORA - dias * DIA).toISOString();

function pr(over: Partial<Pr> = {}): Pr {
  return {
    repo: "scudelerlucas/hub",
    numero: 1,
    titulo: "mudança de teste",
    estado: "aberto",
    rascunho: false,
    branch: "claude/x",
    url: "https://github.com/scudelerlucas/hub/pull/1",
    atualizado_em: h(2),
    fechado_em: null,
    mergeado_em: null,
    checks: null,
    ...over,
  };
}

function branch(over: Partial<BranchSemPr> = {}): BranchSemPr {
  return {
    repo: "scudelerlucas/hub",
    branch: "claude/x",
    ultimo_commit_em: h(3),
    ultimo_commit_msg: "chore: commit de teste",
    tem_pr: false,
    ...over,
  };
}

function sessao(over: Partial<Sessao> = {}): Sessao {
  return {
    sessao_id: "sess_1",
    conta: "lucasscudeler@gmail.com",
    titulo: "conversa de teste",
    estado: "working",
    estado_detalhe: null,
    precisa_de: null,
    branches: [],
    repos: [],
    url: "https://claude.ai/code/session_1",
    criado_em: d(1),
    atualizado_em: h(2),
    ...over,
  };
}

/** Sync sempre fresco nas quatro fontes, para o frescor não poluir os outros testes. */
const SYNC_FRESCO: Sync[] = [
  { fonte: "github", executado_em: h(1), ok: true },
  { fonte: "sessoes:lucasscudeler@gmail.com", executado_em: h(2), ok: true },
  { fonte: "sessoes:lsgpandora@gmail.com", executado_em: h(2), ok: true },
  { fonte: "sessoes:almapetra.ltda@gmail.com", executado_em: h(2), ok: true },
];

function col(quadro: QuadroAssuntos, id: ColunaId): Coluna {
  const achada = quadro.colunas.find((c) => c.id === id);
  if (!achada) throw new Error(`coluna ${id} não existe`);
  return achada;
}

/** Tudo o que está na coluna: dentro da janela + bloco "mais antigos". */
function inteira(quadro: QuadroAssuntos, id: ColunaId): Assunto[] {
  const c = col(quadro, id);
  return [...c.assuntos, ...c.antigos];
}

function todos(quadro: QuadroAssuntos): Assunto[] {
  return quadro.colunas.flatMap((c) => [...c.assuntos, ...c.antigos]);
}

describe("composeAssuntos — junção das fontes em um cartão por assunto", () => {
  it("junta conversa e mudança que compartilham a branch num único cartão", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/painel", checks: "verde" })],
      [],
      [sessao({ branches: ["claude/painel"], estado: "review_ready" })],
      SYNC_FRESCO,
      AGORA,
    );
    const cartoes = todos(quadro);
    expect(cartoes).toHaveLength(1);
    const cartao = cartoes[0]!;
    expect(cartao.titulo).toBe("Conversa de teste"); // título da conversa vence
    expect(cartao.links.map((l) => l.rotulo)).toEqual([
      "abrir conversa",
      "ver no GitHub",
    ]);
  });

  it("duas conversas na mesma branch viram UM cartão com dois links de conversa", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/painel", checks: "verde" })],
      [],
      [
        sessao({
          sessao_id: "nova",
          titulo: "a mais recente",
          estado: "review_ready",
          branches: ["claude/painel"],
          atualizado_em: h(1),
          url: "https://claude.ai/code/nova",
        }),
        sessao({
          sessao_id: "antiga",
          titulo: "a mais antiga",
          estado: "working",
          branches: ["claude/painel"],
          atualizado_em: h(6),
          url: "https://claude.ai/code/antiga",
        }),
      ],
      SYNC_FRESCO,
      AGORA,
    );
    const cartoes = todos(quadro);
    expect(cartoes).toHaveLength(1);
    expect(cartoes[0]!.titulo).toBe("A mais recente");
    expect(cartoes[0]!.links.map((l) => l.rotulo)).toEqual([
      "abrir conversa",
      "abrir conversa (2)",
      "ver no GitHub",
    ]);
  });

  it("mudança sem conversa mostra o repositório na etiqueta (nunca 'conta não identificada')", () => {
    const quadro = composeAssuntos([pr()], [], [], SYNC_FRESCO, AGORA);
    const cartao = todos(quadro)[0]!;
    expect(cartao.etiqueta).toBe("hub");
    expect(cartao.corConta).toBe("neutra");
    expect(cartao.contaFiltro).toBeNull();
    expect(cartao.links.map((l) => l.rotulo)).toEqual(["ver no GitHub"]);
  });

  it("trabalho commitado sem mudança e sem conversa vira cartão 'sem conversa ligada'", () => {
    const quadro = composeAssuntos([], [branch()], [], SYNC_FRESCO, AGORA);
    const cartao = todos(quadro)[0]!;
    expect(cartao.situacao).toContain("sem conversa ligada");
    expect(cartao.titulo).toBe("Commit de teste");
  });

  it("trabalho commitado que já tem mudança aberta NÃO duplica cartão", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/y" })],
      [branch({ branch: "claude/y", tem_pr: true })],
      [],
      SYNC_FRESCO,
      AGORA,
    );
    expect(todos(quadro)).toHaveLength(1);
  });

  it("não junta assuntos por branch genérica (main não cola tudo com tudo)", () => {
    const quadro = composeAssuntos(
      [
        pr({ numero: 1, repo: "a/um", branch: "main", checks: "pendente" }),
        pr({ numero: 2, repo: "a/dois", branch: "main", checks: "pendente" }),
      ],
      [],
      [sessao({ branches: ["main"], estado: "working" })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(todos(quadro)).toHaveLength(3);
  });

  it("conversa sem mudança e sem trabalho commitado vira cartão próprio", () => {
    const quadro = composeAssuntos(
      [],
      [],
      [sessao({ estado: "need_input", precisa_de: "você dizer quem executa" })],
      SYNC_FRESCO,
      AGORA,
    );
    const cartao = col(quadro, "esperando").assuntos[0]!;
    expect(cartao.situacao).toContain("você dizer quem executa");
    expect(cartao.repo).toBeNull();
  });
});

describe("composeAssuntos — o desfecho da mudança vence o estado da conversa", () => {
  it("mudança mergeada + conversa 'pronta para aprovar' = Fechado, sem frase contraditória", () => {
    const quadro = composeAssuntos(
      [
        pr({
          branch: "claude/m",
          estado: "mergeado",
          mergeado_em: d(2),
          atualizado_em: d(2),
          checks: "verde",
        }),
      ],
      [],
      [sessao({ branches: ["claude/m"], estado: "review_ready", atualizado_em: d(2) })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "esperando").assuntos).toHaveLength(0);
    const cartao = col(quadro, "fechado").assuntos[0]!;
    expect(cartao.situacao).toBe("entrou na versão oficial em 10/09");
    expect(cartao.situacao).not.toContain("pronto para o Lucas aprovar");
    expect(cartao.desfecho).toBe("entrou na versão oficial");
  });

  it("mudança descartada + conversa travada = Fechado", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/f", estado: "fechado", fechado_em: d(1), atualizado_em: d(1) })],
      [],
      [sessao({ branches: ["claude/f"], estado: "blocked", atualizado_em: d(1) })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "esperando").assuntos).toHaveLength(0);
    expect(col(quadro, "fechado").assuntos[0]!.desfecho).toBe("descartado");
  });

  it("'completed' e 'archived' valem o mesmo que 'done'", () => {
    expect([...ENCERRADAS].sort()).toEqual(["archived", "completed", "done"]);
    for (const estado of ENCERRADAS) {
      const quadro = composeAssuntos(
        [],
        [],
        [sessao({ estado, atualizado_em: d(2) })],
        SYNC_FRESCO,
        AGORA,
      );
      expect(col(quadro, "fechado").assuntos).toHaveLength(1);
      expect(col(quadro, "fechado").assuntos[0]!.desfecho).toBe("concluído");
      expect(col(quadro, "fechado").assuntos[0]!.situacao).toBe("concluído em 10/09");
    }
  });

  it("conversa encerrada com mudança AINDA aberta continua viva", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/v", checks: "verde" })],
      [],
      [sessao({ branches: ["claude/v"], estado: "completed" })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "fechado").assuntos).toHaveLength(0);
    expect(col(quadro, "esperando").assuntos).toHaveLength(1);
  });
});

describe("composeAssuntos — colunas, janelas e tetos", () => {
  it("põe em 'Esperando o Lucas' conversa pronta/travada/sem resposta e mudança com testes ok", () => {
    const quadro = composeAssuntos(
      [pr({ numero: 9, branch: "claude/so-pr", checks: "verde" })],
      [],
      [
        sessao({ sessao_id: "a", estado: "review_ready" }),
        sessao({ sessao_id: "b", estado: "blocked" }),
        sessao({ sessao_id: "c", estado: "need_input" }),
      ],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "esperando").assuntos).toHaveLength(4);
  });

  it("conversa em andamento mantém o assunto em 'Andando' mesmo com os testes ok", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/z", checks: "verde" })],
      [],
      [sessao({ branches: ["claude/z"], estado: "working" })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "esperando").assuntos).toHaveLength(0);
    expect(col(quadro, "andando").assuntos[0]!.situacao).toBe("testes ok · em andamento");
  });

  it("na coluna de espera, o que ele precisa fazer vem primeiro e não é cortado", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/p", checks: "verde" })],
      [],
      [
        sessao({
          branches: ["claude/p"],
          estado: "blocked",
          precisa_de: "você dizer se o documento vira canon",
        }),
      ],
      SYNC_FRESCO,
      AGORA,
    );
    const cartao = col(quadro, "esperando").assuntos[0]!;
    expect(cartao.situacao.startsWith("você dizer se o documento vira canon")).toBe(true);
    expect(cartao.situacao).toContain("testes ok");
  });

  it("põe em 'Parado' mudança sem novidade há mais de 14 dias, trabalho commitado há mais de 7 e conversa sem movimento", () => {
    const quadro = composeAssuntos(
      [pr({ numero: 5, branch: "velha", checks: null, atualizado_em: d(20) })],
      [branch({ branch: "antiga", ultimo_commit_em: d(9) })],
      [sessao({ estado: "idle", atualizado_em: d(11) })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(inteira(quadro, "parado")).toHaveLength(3);
  });

  it("as colunas vivas só mostram 21 dias; o resto vai para 'mais antigos'", () => {
    expect(JANELA_ATIVA_DIAS).toBe(21);
    const quadro = composeAssuntos(
      [
        pr({ numero: 1, branch: "b1", checks: "verde", atualizado_em: d(3) }),
        pr({ numero: 2, branch: "b2", checks: "verde", atualizado_em: d(40) }),
        pr({ numero: 3, branch: "b3", checks: null, atualizado_em: d(60) }),
      ],
      [],
      [],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "esperando").assuntos).toHaveLength(1);
    expect(col(quadro, "esperando").antigos).toHaveLength(1);
    expect(col(quadro, "parado").assuntos).toHaveLength(0);
    expect(col(quadro, "parado").antigos).toHaveLength(1);
  });

  it("a coluna que fechou mostra 7 dias, sem bloco de antigos; o histórico guarda tudo", () => {
    expect(JANELA_FECHADO_DIAS).toBe(7);
    const quadro = composeAssuntos(
      [
        pr({ numero: 1, branch: "a", estado: "mergeado", mergeado_em: d(3), atualizado_em: d(3) }),
        pr({ numero: 2, branch: "b", estado: "mergeado", mergeado_em: d(20), atualizado_em: d(20) }),
        pr({ numero: 3, branch: "c", estado: "fechado", fechado_em: d(90), atualizado_em: d(90) }),
      ],
      [],
      [],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "fechado").assuntos).toHaveLength(1);
    expect(col(quadro, "fechado").antigos).toHaveLength(0);
    expect(quadro.historico).toHaveLength(3);
  });

  it("ordena cada coluna pela atividade mais recente primeiro", () => {
    const quadro = composeAssuntos(
      [
        pr({ numero: 1, branch: "a", checks: "pendente", atualizado_em: d(2) }),
        pr({ numero: 2, branch: "b", checks: "pendente", atualizado_em: h(1) }),
        pr({ numero: 3, branch: "c", checks: "pendente", atualizado_em: d(1) }),
      ],
      [],
      [],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "andando").assuntos.map((c) => c.atividadeTexto)).toEqual([
      "há 1 h",
      "há 1 dia",
      "há 2 dias",
    ]);
  });
});

describe("composeAssuntos — contas, textos, datas e frescor", () => {
  it("traduz os três e-mails conhecidos e usa a parte antes do @ para os outros", () => {
    expect(rotuloDaConta("lucasscudeler@gmail.com")).toEqual({
      rotulo: "Lucas",
      cor: "lucas",
    });
    expect(rotuloDaConta("lsgpandora@gmail.com").rotulo).toBe("Pandora");
    expect(rotuloDaConta("almapetra.ltda@gmail.com").rotulo).toBe("Alma Petra");
    expect(rotuloDaConta("outra.conta@gmail.com")).toEqual({
      rotulo: "outra.conta",
      cor: "neutra",
    });
  });

  it("o filtro de conta só lista contas de verdade", () => {
    const quadro = composeAssuntos(
      [pr()],
      [],
      [
        sessao({ sessao_id: "1", conta: "lucasscudeler@gmail.com" }),
        sessao({ sessao_id: "2", conta: "lsgpandora@gmail.com" }),
      ],
      SYNC_FRESCO,
      AGORA,
    );
    expect(quadro.contas).toEqual(["Lucas", "Pandora"]);
    expect(quadro.contas).not.toContain("conta não identificada");
  });

  it("limpa prefixos de commit, encurta o repositório e usa o fuso de São Paulo", () => {
    expect(limparTitulo("docs(regras): check-in automático")).toBe("Check-in automático");
    expect(limparTitulo("feat!: quadro novo")).toBe("Quadro novo");
    expect(limparTitulo("chore: docs: dois prefixos")).toBe("Dois prefixos");
    expect(repoCurto("scudelerlucas/Lucas-Contexto-Geral")).toBe("Lucas-Contexto-Geral");
    // 00:30 UTC do dia 12 ainda é dia 11 em São Paulo.
    expect(dataCurta("2026-09-12T00:30:00.000Z")).toBe("11/09");
  });

  it("não avisa nada quando as leituras estão frescas", () => {
    const quadro = composeAssuntos([pr()], [], [], SYNC_FRESCO, AGORA);
    expect(quadro.frescor.avisos).toEqual([]);
    expect(quadro.frescor.atualizadoTexto).toBe("há 1 h");
    expect(quadro.frescor.temLeituraOk).toBe(true);
  });

  it("avisa em português, diz de qual conta é o atraso e não inventa festa sem leitura", () => {
    const quadro = composeAssuntos(
      [pr()],
      [],
      [],
      [
        { fonte: "github", executado_em: h(30), ok: true },
        { fonte: "sessoes:almapetra.ltda@gmail.com", executado_em: d(3), ok: true },
      ],
      AGORA,
    );
    const textos = quadro.frescor.avisos.map((a) => a.texto);
    expect(textos).toContain(
      "Os dados podem estar velhos: as mudanças no código não atualizam desde 11/09.",
    );
    expect(textos).toContain(
      "Os dados podem estar velhos: as conversas da conta Alma Petra não atualizam desde 09/09.",
    );
    // Conta que nunca apareceu em sync NÃO entra no bloco de "dado velho":
    // vira a linha cinza de contas que ainda não entram.
    expect(textos.every((t) => t.startsWith("Os dados podem estar velhos:"))).toBe(true);
    expect(quadro.frescor.contasSemLeitura).toEqual(["Lucas", "Pandora"]);
    for (const aviso of quadro.frescor.avisos) {
      expect(aviso.texto).not.toMatch(/\b(PR|branch|merge|draft|CI)\b/i);
    }

    const semLeitura = composeAssuntos([], [], [], [], AGORA);
    expect(semLeitura.frescor.temLeituraOk).toBe(false);
  });

  it("ignora leitura que falhou ao calcular o frescor", () => {
    const quadro = composeAssuntos(
      [pr()],
      [],
      [],
      [
        { fonte: "github", executado_em: h(1), ok: false, erro: "timeout" },
        { fonte: "github", executado_em: h(40), ok: true },
      ],
      AGORA,
    );
    expect(quadro.frescor.atualizadoTexto).toBe("há 2 dias");
    expect(
      quadro.frescor.avisos.filter((a) => a.conta === null).map((a) => a.texto),
    ).toEqual([
      "Os dados podem estar velhos: as mudanças no código não atualizam desde 10/09.",
    ]);
  });
});

describe("fixtureFrentes — dados de demonstração", () => {
  it("tem o volume prometido e monta as quatro colunas sem cartão perdido", () => {
    const dados = fixtureFrentes(AGORA);
    expect(dados.prs).toHaveLength(14);
    expect(dados.branches).toHaveLength(6);
    expect(dados.sessoes).toHaveLength(10);
    expect(dados.sync).toHaveLength(2);

    const quadro = composeAssuntos(
      dados.prs,
      dados.branches,
      dados.sessoes,
      dados.sync,
      AGORA,
    );
    for (const c of quadro.colunas) {
      expect(c.assuntos.length + c.antigos.length).toBeGreaterThan(0);
    }
    expect(quadro.contas).toEqual(["Lucas", "Pandora", "Alma Petra"]);
    // A conta Alma Petra está velha (bloco âmbar); Lucas e Pandora ainda não
    // têm linha em sync (linha cinza, fora do bloco).
    expect(quadro.frescor.avisos.map((a) => a.conta)).toEqual(["Alma Petra"]);
    expect(quadro.frescor.contasSemLeitura).toEqual(["Lucas", "Pandora"]);
    expect(quadro.historico.length).toBeGreaterThan(col(quadro, "fechado").assuntos.length);
    // A conversa dupla da mesma branch virou um cartão com dois links.
    const painel = todos(quadro).find((a) => a.titulo.startsWith("Painel de assuntos"));
    expect(painel?.links.map((l) => l.rotulo)).toEqual([
      "abrir conversa",
      "abrir conversa (2)",
      "ver no GitHub",
    ]);
  });

  it("nomeia as colunas e os estados vazios em português, sem palavra de bastidor", () => {
    const quadro = composeAssuntos([], [], [], [], AGORA);
    expect(quadro.colunas.map((c) => c.nome)).toEqual([
      "Esperando o Lucas",
      "Andando",
      "Parado",
      "Fechou esta semana",
    ]);
    expect(quadro.colunas[0]!.vazio).toBe("Nada esperando o Lucas 🎉");
    for (const c of quadro.colunas) {
      expect(c.nome).not.toMatch(/\b(PR|branch|merge|draft|CI)\b/i);
      expect(c.vazio).not.toMatch(/\b(PR|branch|merge|draft|CI)\b/i);
    }
  });
});

// ─── volume real ─────────────────────────────────────────────────────────────

/** Sorteio determinístico (LCG): o mesmo "aleatório" em toda máquina. */
function sorteio(semente: number): () => number {
  let estado = semente;
  return () => {
    estado = (estado * 1103515245 + 12345) % 2147483648;
    return estado / 2147483648;
  };
}

/**
 * Gera ~800 mudanças / 300 branches / 200 conversas com a MESMA forma dos dados
 * reais medidos em 12/09/2026 (825 / 324 / 215; conversas: review_ready 75,
 * blocked 73, completed 63, working 4).
 */
function volumeSintetico(): {
  prs: Pr[];
  branches: BranchSemPr[];
  sessoes: Sessao[];
  sync: Sync[];
} {
  const rand = sorteio(20260912);
  const repos = ["scudelerlucas/hub", "a/dois", "b/tres", "c/quatro"];
  const contas = [
    "lucasscudeler@gmail.com",
    "lsgpandora@gmail.com",
    "almapetra.ltda@gmail.com",
  ];

  const prs: Pr[] = [];
  for (let i = 0; i < 800; i += 1) {
    const idade = Math.floor(rand() * 88); // dentro da janela de leitura (90 dias)
    const sorte = rand();
    const estado: Pr["estado"] =
      sorte < 0.62 ? "mergeado" : sorte < 0.72 ? "fechado" : "aberto";
    const checks: Pr["checks"] =
      rand() < 0.55 ? "verde" : rand() < 0.5 ? "vermelho" : rand() < 0.5 ? "pendente" : null;
    prs.push(
      pr({
        repo: repos[i % repos.length]!,
        numero: i + 1,
        titulo: `feat(x): mudança ${i + 1}`,
        branch: `claude/tarefa-${i + 1}`,
        estado,
        rascunho: estado === "aberto" && rand() < 0.2,
        checks,
        atualizado_em: d(idade),
        mergeado_em: estado === "mergeado" ? d(idade) : null,
        fechado_em: estado === "fechado" ? d(idade) : null,
        url: `https://github.com/${repos[i % repos.length]!}/pull/${i + 1}`,
      }),
    );
  }

  const branches: BranchSemPr[] = [];
  for (let i = 0; i < 300; i += 1) {
    const temPr = i < 200; // 2/3 já viraram mudança
    branches.push(
      branch({
        repo: repos[i % repos.length]!,
        branch: temPr ? `claude/tarefa-${i + 1}` : `claude/solta-${i + 1}`,
        tem_pr: temPr,
        ultimo_commit_em: d(Math.floor(rand() * 100)),
        ultimo_commit_msg: `chore: trabalho ${i + 1}`,
      }),
    );
  }

  // Mesma proporção de estados dos dados reais.
  const mistura: string[] = [
    ...Array<string>(70).fill("review_ready"),
    ...Array<string>(68).fill("blocked"),
    ...Array<string>(58).fill("completed"),
    ...Array<string>(4).fill("working"),
  ];
  const sessoes: Sessao[] = mistura.map((estado, i) => {
    const ligada = i % 3 !== 0; // 2/3 apontam para uma branch que existe
    return sessao({
      sessao_id: `sess_${i + 1}`,
      conta: contas[i % contas.length]!,
      titulo: `Conversa ${i + 1}`,
      estado,
      precisa_de: estado === "blocked" ? "uma decisão sua" : null,
      branches: ligada ? [`claude/tarefa-${i + 1}`] : [],
      repos: [repos[i % repos.length]!],
      atualizado_em: d(Math.floor(rand() * 80)),
      url: `https://claude.ai/code/session_${i + 1}`,
    });
  });

  return {
    prs,
    branches,
    sessoes,
    sync: [
      { fonte: "github", executado_em: h(1), ok: true },
      { fonte: "sessoes:lucasscudeler@gmail.com", executado_em: h(2), ok: true },
    ],
  };
}

describe("composeAssuntos — com a forma real dos dados (800 / 300 / 200)", () => {
  const dados = volumeSintetico();
  const quadro = composeAssuntos(
    dados.prs,
    dados.branches,
    dados.sessoes,
    dados.sync,
    AGORA,
  );

  it("nada encerrado aparece nas colunas vivas", () => {
    for (const id of ["esperando", "andando", "parado"] as ColunaId[]) {
      for (const cartao of inteira(quadro, id)) {
        expect(cartao.desfecho).toBeNull();
        expect(cartao.situacao).not.toContain("entrou na versão oficial");
        expect(cartao.situacao).not.toContain("descartado");
      }
    }
    for (const cartao of col(quadro, "fechado").assuntos) {
      expect(cartao.desfecho).not.toBeNull();
    }
  });

  it("respeita as janelas: 21 dias nas colunas vivas, 7 dias na que fechou", () => {
    for (const id of ["esperando", "andando", "parado"] as ColunaId[]) {
      for (const c of col(quadro, id).assuntos) {
        expect(AGORA - Date.parse(c.atividadeEm!)).toBeLessThanOrEqual(21 * DIA);
      }
      for (const c of col(quadro, id).antigos) {
        expect(AGORA - Date.parse(c.atividadeEm!)).toBeGreaterThan(21 * DIA);
      }
    }
    for (const c of col(quadro, "fechado").assuntos) {
      expect(AGORA - Date.parse((c.fechadoEm ?? c.atividadeEm)!)).toBeLessThanOrEqual(
        7 * DIA,
      );
    }
  });

  it("nenhuma coluna despeja mais de 25 cartões de uma vez", () => {
    expect(TETO_VISIVEL).toBe(25);
    for (const c of quadro.colunas) {
      expect(Math.min(c.assuntos.length, TETO_VISIVEL)).toBeLessThanOrEqual(25);
    }
  });

  it("a primeira leitura da coluna de espera é curta, e o resto fica recolhido", () => {
    const c = col(quadro, "esperando");
    // O que a tela mostra de primeira: no máximo 25 cartões.
    expect(Math.min(c.assuntos.length, TETO_VISIVEL)).toBeLessThanOrEqual(25);
    // Nada do que está aqui já foi resolvido — era o erro de antes (148 de 158).
    expect(c.assuntos.every((a) => a.desfecho === null)).toBe(true);
    // Quem passou de 21 dias sai da coluna e vai para o bloco recolhido.
    expect(c.antigos.length).toBeGreaterThan(0);
    expect(c.assuntos.length).toBeLessThan(inteira(quadro, "esperando").length);
  });

  it("registra as contagens por coluna com o volume real (documento vivo do painel)", () => {
    const numeros = Object.fromEntries(
      quadro.colunas.map((c) => [
        c.id,
        { mostra: Math.min(c.assuntos.length, TETO_VISIVEL), janela: c.assuntos.length, antigos: c.antigos.length },
      ]),
    );
    // Se estes números mudarem, a tela mudou de comportamento — é para doer.
    expect(numeros).toMatchInlineSnapshot(`
      {
        "andando": {
          "antigos": 30,
          "janela": 25,
          "mostra": 25,
        },
        "esperando": {
          "antigos": 103,
          "janela": 60,
          "mostra": 25,
        },
        "fechado": {
          "antigos": 0,
          "janela": 50,
          "mostra": 25,
        },
        "parado": {
          "antigos": 121,
          "janela": 25,
          "mostra": 25,
        },
      }
    `);
    expect(quadro.totalAssuntos).toBe(967);
  });

  it("não perde nem duplica cartão: colunas + encerrados antigos = total", () => {
    const nasColunas = todos(quadro).length;
    const fechadosAntigos = quadro.historico.filter(
      (a) => AGORA - Date.parse((a.fechadoEm ?? a.atividadeEm)!) > 7 * DIA,
    ).length;
    expect(nasColunas + fechadosAntigos).toBe(quadro.totalAssuntos);
    const ids = new Set(todos(quadro).map((a) => a.id));
    expect(ids.size).toBe(nasColunas);
  });

  it("toda conversa e toda mudança encontraram um cartão", () => {
    const cartoes = [...todos(quadro), ...quadro.historico];
    const comConversa = new Set(
      cartoes.flatMap((c) => c.links.filter((l) => l.rotulo.startsWith("abrir")).map((l) => l.url)),
    );
    expect(comConversa.size).toBe(200);
    const comMudanca = new Set(
      cartoes.flatMap((c) => c.links.filter((l) => l.rotulo.startsWith("ver")).map((l) => l.url)),
    );
    expect(comMudanca.size).toBe(800);
  });
});

describe("leituras parciais — o que está aberto nunca cai fora do corte", () => {
  it("mudança aberta antiga sobrevive a 500 mudanças encerradas recentes", () => {
    // Espelha o banco real: 823 na janela, só 29 abertas. Um único `.limit(400)`
    // por data deixava 2 abertas de fora — este é o teste que impede a volta disso.
    const encerradas: Pr[] = Array.from({ length: 500 }, (_, i) =>
      pr({
        numero: 1000 + i,
        branch: `claude/encerrada-${i}`,
        estado: "mergeado",
        mergeado_em: d(1),
        atualizado_em: d(1),
      }),
    );
    const abertaAntiga = pr({
      numero: 7,
      branch: "claude/aberta-velha",
      estado: "aberto",
      checks: "verde",
      atualizado_em: d(200),
    });

    const unidas = unirPrs([abertaAntiga], encerradas);
    expect(unidas).toHaveLength(501);
    expect(unidas.some((p) => p.numero === 7)).toBe(true);

    // E ela aparece no quadro, no bloco "mais antigos" da coluna de espera.
    const quadro = composeAssuntos(unidas, [], [], SYNC_FRESCO, AGORA);
    const naEspera = inteira(quadro, "esperando").some((a) =>
      a.busca.includes("claude/aberta-velha"),
    );
    expect(naEspera).toBe(true);
  });

  it("não duplica quando a mesma linha vem nas duas consultas", () => {
    const linha = pr({ numero: 42, branch: "claude/x" });
    expect(unirPrs([linha], [linha])).toHaveLength(1);
    const b = branch({ branch: "claude/solta" });
    expect(unirBranches([b], [b])).toHaveLength(1);
  });

  it("trabalho commitado sem mudança entra sem janela e vem ordenado", () => {
    const antigo = branch({ branch: "claude/antiga", ultimo_commit_em: d(180) });
    const novo = branch({ branch: "claude/nova", ultimo_commit_em: d(1), tem_pr: true });
    const unidas = unirBranches([antigo], [novo]);
    expect(unidas.map((x) => x.branch)).toEqual(["claude/nova", "claude/antiga"]);
  });
});

describe("frescor sem linha de github em painel_frentes_sync", () => {
  it("usa o carimbo das próprias linhas de mudança (nunca diz 'nunca lidas' com dados na mesa)", () => {
    const quadro = composeAssuntos(
      [pr({ sincronizado_em: h(2) })],
      [branch({ sincronizado_em: h(3) })],
      [],
      // Só a linha de sessões existe — exatamente o estado do banco em 12/09.
      [{ fonte: "sessoes:lucasscudeler@gmail.com", executado_em: h(5), ok: true }],
      AGORA,
    );
    expect(quadro.frescor.temLeituraOk).toBe(true);
    expect(quadro.frescor.atualizadoTexto).toBe("há 2 h");
    // Nada sobre o GitHub; só as duas contas que não têm linha em sync.
    expect(quadro.frescor.avisos.filter((a) => a.conta === null)).toEqual([]);
  });

  it("avisa quando o carimbo das linhas está velho", () => {
    const quadro = composeAssuntos([pr({ sincronizado_em: h(40) })], [], [], [], AGORA);
    const doGithub = quadro.frescor.avisos.filter((a) => a.conta === null);
    expect(doGithub).toHaveLength(1);
    expect(doGithub[0]!.texto).toContain("não atualizam desde");
  });

  it("só diz 'nunca foram lidas' quando não há mudança nenhuma", () => {
    const vazio = composeAssuntos([], [], [], [], AGORA);
    expect(vazio.frescor.avisos[0]!.texto).toContain(
      "as mudanças no código ainda não foram lidas",
    );
    const comDados = composeAssuntos(
      [pr({ sincronizado_em: null })],
      [],
      [],
      [],
      AGORA,
    );
    expect(comDados.frescor.avisos.filter((a) => a.conta === null)).toEqual([]);
  });
});

describe("conversa encerrada não escreve 'concluído' em coluna viva", () => {
  it("mudança aberta com testes ok + conversa 'completed' fica em espera, sem contradição", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/vivo", checks: "verde" })],
      [],
      [sessao({ branches: ["claude/vivo"], estado: "completed" })],
      SYNC_FRESCO,
      AGORA,
    );
    const cartao = col(quadro, "esperando").assuntos[0]!;
    expect(cartao.situacao).not.toContain("concluído");
    // E diz o que fazer, mesmo sem `precisa_de` preenchido (item 4).
    expect(cartao.situacao).toBe("você olhar e aprovar · testes ok");
  });

  it("em 'Andando' também não vaza 'concluído'", () => {
    const quadro = composeAssuntos(
      [pr({ branch: "claude/meio", checks: "pendente" })],
      [],
      [sessao({ branches: ["claude/meio"], estado: "archived" })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "andando").assuntos[0]!.situacao).toBe("testes rodando");
  });
});

describe("mudança órfã em branch genérica", () => {
  it("cada mudança no main é um cartão (nunca um cartão só para o repositório)", () => {
    const quadro = composeAssuntos(
      [
        pr({ numero: 1, branch: "main", checks: "verde" }),
        pr({ numero: 2, branch: "main", checks: "verde" }),
        pr({ numero: 3, branch: "master", checks: "verde" }),
        pr({ numero: 4, branch: "", checks: "verde" }),
      ],
      [],
      [],
      SYNC_FRESCO,
      AGORA,
    );
    expect(todos(quadro)).toHaveLength(4);
    const ids = todos(quadro).map((a) => a.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toContain("mudanca:scudelerlucas/hub#1");
  });
});

describe("o primeiro paint é curto", () => {
  it("nasce com 6 cartões por coluna no desktop e 4 no celular", () => {
    expect(PRIMEIRO_PAINT_DESKTOP).toBe(6);
    expect(PRIMEIRO_PAINT_CELULAR).toBe(4);
    expect(PRIMEIRO_PAINT_DESKTOP).toBeLessThan(TETO_VISIVEL);
  });

  it("o filtro de conta é sempre o mesmo, com as três contas da casa", () => {
    expect(CONTAS_CONHECIDAS).toEqual(["Lucas", "Pandora", "Alma Petra"]);
  });
});

describe("rodada 4 — avisos por conta, janela do fecho e teto de links", () => {
  it("lista as contas que ainda não entram, sem chamar isso de dado velho", () => {
    const quadro = composeAssuntos(
      [pr({ sincronizado_em: h(1) })],
      [],
      [],
      [{ fonte: "sessoes:lucasscudeler@gmail.com", executado_em: h(2), ok: true }],
      AGORA,
    );
    expect(quadro.frescor.contasSemLeitura).toEqual(["Pandora", "Alma Petra"]);
    expect(quadro.frescor.avisos).toEqual([]);

    // Quando as três publicam, a linha desaparece sozinha.
    const completo = composeAssuntos(
      [pr({ sincronizado_em: h(1) })],
      [],
      [],
      SYNC_FRESCO,
      AGORA,
    );
    expect(completo.frescor.contasSemLeitura).toEqual([]);
  });

  it("'Fechou esta semana' olha a data do fecho, não a última mexida", () => {
    const quadro = composeAssuntos(
      [
        pr({
          branch: "claude/velha",
          estado: "mergeado",
          mergeado_em: d(20),
          atualizado_em: d(20),
        }),
      ],
      [],
      // A conversa foi tocada ontem, mas a mudança entrou na versão oficial há 20 dias.
      [sessao({ branches: ["claude/velha"], estado: "completed", atualizado_em: d(1) })],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "fechado").assuntos).toHaveLength(0);
    expect(quadro.historico).toHaveLength(1);
    expect(quadro.historico[0]!.fechadoEm).toBe(d(20));
  });

  it("a data do fecho é mergeado_em, mesmo com a mudança tocada ontem", () => {
    const quadro = composeAssuntos(
      [
        pr({
          branch: "claude/tocada",
          estado: "mergeado",
          mergeado_em: d(20),
          fechado_em: d(20),
          // Alguém comentou ontem: não ressuscita o assunto.
          atualizado_em: d(1),
        }),
      ],
      [],
      [],
      SYNC_FRESCO,
      AGORA,
    );
    expect(col(quadro, "fechado").assuntos).toHaveLength(0);
    expect(quadro.historico).toHaveLength(1);
    expect(quadro.historico[0]!.fechadoEm).toBe(d(20));
    expect(quadro.historico[0]!.situacao).toBe("entrou na versão oficial em 23/08");
  });

  it("um cartão com 49 mudanças mostra 3 links e resume o resto", () => {
    const muitas = Array.from({ length: 49 }, (_, i) =>
      pr({
        numero: 500 + i,
        branch: "claude/muitas",
        checks: "verde",
        atualizado_em: h(i + 1),
        url: `https://github.com/scudelerlucas/hub/pull/${500 + i}`,
      }),
    );
    const quadro = composeAssuntos(
      muitas,
      [],
      [sessao({ branches: ["claude/muitas"], estado: "review_ready" })],
      SYNC_FRESCO,
      AGORA,
    );
    const cartao = todos(quadro)[0]!;
    const rotulos = cartao.links.map((l) => l.rotulo);
    expect(rotulos).toEqual([
      "abrir conversa",
      "mudança 1",
      "mudança 2",
      "mudança 3",
      "e outras 46 mudanças no GitHub",
    ]);
    // Nenhum rótulo mostra o número cru da mudança.
    for (const r of rotulos) expect(r).not.toMatch(/#\d+/);
    expect(cartao.links.at(-1)!.url).toBe(
      "https://github.com/scudelerlucas/hub/pulls?q=is%3Apr%20head%3Aclaude%2Fmuitas",
    );
  });

  it("com uma só mudança o link continua sendo 'ver no GitHub'", () => {
    const quadro = composeAssuntos([pr({ checks: "verde" })], [], [], SYNC_FRESCO, AGORA);
    expect(todos(quadro)[0]!.links.map((l) => l.rotulo)).toEqual(["ver no GitHub"]);
  });

  it("no dedup das duas consultas, o estado mais avançado vence", () => {
    const aberta = pr({ numero: 9, estado: "aberto", atualizado_em: h(1) });
    const mergeada = pr({
      numero: 9,
      estado: "mergeado",
      mergeado_em: h(3),
      atualizado_em: h(3),
    });
    expect(unirPrs([aberta], [mergeada])[0]!.estado).toBe("mergeado");
    expect(unirPrs([aberta], [mergeada])).toHaveLength(1);
  });
});
