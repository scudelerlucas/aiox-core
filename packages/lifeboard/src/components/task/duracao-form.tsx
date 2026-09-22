"use client";

import { useRef, useState, type FormEvent } from "react";

import { AvisoNaoSalvo, AVISO_SEM_RASCUNHO } from "@/components/task/aviso-nao-salvo";
import { CampoErro } from "@/components/task/campo-erro";
import { CampoNumerico } from "@/components/task/campo-numerico";
import { MensagemSucesso } from "@/components/task/mensagem-sucesso";
import { usarPortaDeEscrita } from "@/components/task/porta-de-escrita";

export interface DuracaoFormProps {
  taskId: string;
  estimativaDias: number | null;
}

/**
 * A forma que o servidor GUARDA — `007` vira `7`, `1.50` vira `1.5`, `+3` vira
 * `3`. Mesma conversão de `estimativaSet` (`Number` sobre o texto aparado); o
 * que o `numeroDigitado` do servidor recusa não é convertido aqui, e a caixa
 * fica como está (a recusa em português é quem fala).
 */
export function duracaoCanonica(bruta: string): string {
  const t = bruta.trim();
  if (t.length === 0) return "";
  /*
   * [BAIXO #2, rodada 15] A VÍRGULA DO TECLADO pt-BR. `Number("1,5")` é `NaN`,
   * e a caixa ficaria mostrando `1,5` com o banco em 1.5 — a tela e o dado em
   * grafias diferentes, que é a família do BAIXO #11 da rodada 13. A régua é a
   * MESMA do servidor (`comDecimalCanonico` em `actions.ts`): uma vírgula
   * decimal vira ponto; vírgula misturada com ponto, ou mais de uma, não é
   * grafia decidida e segue para a recusa em português.
   */
  const semVirgula =
    t.indexOf(",") !== -1 &&
    t.indexOf(".") === -1 &&
    t.indexOf(",") === t.lastIndexOf(",")
      ? t.replace(",", ".")
      : t;
  const n = Number(semVirgula);
  return Number.isFinite(n) ? String(n) : bruta;
}

/** Duração p80 em dias — sem ela a tarefa fica fora do caminho crítico, com aviso. */
export function DuracaoForm({ taskId, estimativaDias }: DuracaoFormProps): JSX.Element {
  const [valor, setValor] = useState<string>(estimativaDias != null ? String(estimativaDias) : "");
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  /**
   * [MÉDIO #3, rodada 6] o último valor que o SERVIDOR aceitou — apertar
   * "Salvar duração" duas vezes com o mesmo número mandava dois POSTs
   * idênticos. Aqui o botão continua respondendo (a região viva diz "nada
   * mudou"), só não gasta rede.
   */
  const confirmadoRef = useRef<string>(estimativaDias != null ? String(estimativaDias) : "");
  /** O que foi submetido — lido no `aoSucesso`, que roda depois do `await`. */
  const valorEnviadoRef = useRef<string>(confirmadoRef.current);
  /** O que está NA CAIXA agora — `aoSucesso` roda depois do `await`, e a
   * variável de `useState` lá seria a do render em que a closure nasceu. */
  const naCaixaRef = useRef<string>(valor);
  naCaixaRef.current = valor;

  /**
   * [MÉDIO #1, rodada 14] ESTE CAMPO **NÃO** GANHA RASCUNHO, e é por isso.
   *
   * Os outros seis campos de texto da página começam VAZIOS: são formulários de
   * criação, e guardar o que foi digitado só pode ajudar. Esta caixa começa com
   * o número que o SERVIDOR guarda. Um rascunho aqui faria a tela mostrar `9`
   * com o banco em `3`, sem dizer que aquilo não está salvo — a página mentindo
   * sobre o que está gravado, que é exatamente o defeito de onde vêm os
   * CRÍTICOs das rodadas 10, 11 e 13. Perder uma edição não salva é ruim;
   * afirmar em silêncio que ela foi salva é pior.
   *
   * A régua é derivada, não uma exceção escrita à mão: `camposDeTextoLivre`
   * (em `tests/unit/tarefa-varredura-derivada.ts`) marca como "nasce do
   * servidor" todo campo cujo `useState` não começa num literal, e só esses
   * ficam de fora da cobrança do rascunho.
   */

  const porta = usarPortaDeEscrita({
    op: "duracao",
    alvo: () => botaoRef.current,
    // [BAIXO, rodada 11] esvaziar o campo REMOVE a duração, e a tela dizia
    // "Duração salva." mesmo assim — a mesma frase dos dois desfechos
    // opostos. (`MaeForm` já distinguia: "Tarefa mãe removida.".)
    texto: () =>
      valorEnviadoRef.current.trim() === "" ? "Duração removida." : "Duração salva.",
    aoSucesso: () => {
      /**
       * [BAIXO #11, rodada 13] A CAIXA PASSA A MOSTRAR O QUE FICOU GRAVADO.
       *
       * `007` ia ao servidor, virava 7 no banco, e a caixa seguia exibindo
       * `007` até alguém dar F5 — a tela mostrando uma grafia que o dado não
       * tem. Pior: o próximo "Salvar duração" comparava `007` com `007` e
       * respondia "nada mudou" sobre um valor que é 7. Aqui a caixa e o
       * `confirmadoRef` passam os dois a falar a forma que o servidor guardou.
       *
       * [ALTO #4, rodada 13] e só quando a caixa ainda tem o que foi enviado:
       * se o operador digitou outra coisa durante a gravação, o que ele está
       * escrevendo é dele.
       */
      const canonico = duracaoCanonica(valorEnviadoRef.current);
      confirmadoRef.current = canonico;
      if (naCaixaRef.current === valorEnviadoRef.current) setValor(canonico);
    },
  });

  function aoEnviar(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    // [CRÍTICO #1, rodada 13] O REF DO QUE FOI ENVIADO SÓ SE ESCREVE DEPOIS DO
    // VEREDITO — a mesma lei que `status-form`, `mae-form` e `meta-form` já
    // seguiam desde a rodada 10, e que estes dois gêmeos não receberam.
    //
    // Escrito ANTES, uma recusa passava por cima do valor EM VOO: digitar `5`,
    // salvar, e 120 ms depois esvaziar a caixa e clicar de novo (recusado com
    // "Aguarde…") fazia a gravação a caminho — que gravou 5 — anunciar
    // "Duração removida." e guardar `""` em `confirmadoRef`. A partir daí a
    // caixa vazia era "igual ao confirmado": o clique seguinte respondia "já
    // está salva assim — nada mudou" e NÃO mandava nada. Banco 5, tela vazia,
    // e a página travada nesse desacordo até um F5. O espelho era pior:
    // esvaziar, salvar, digitar `5` em voo e ser recusado anunciava "Duração
    // salva." com a caixa em 5 e o banco em `null`.
    const decisao = porta.escrever(
      { task_id: taskId, estimativa_dias: valor },
      { mudou: valor.trim() !== confirmadoRef.current.trim() },
    );
    if (decisao === "gravar") valorEnviadoRef.current = valor;
  }

  return (
    // [ALTO #4, crítico 13/09] `min`/`step` no <input> disparavam a validação
    // NATIVA do Chrome (inglês, fora do CampoErro) antes da action rodar —
    // `noValidate` desativa isso; a régua de verdade é a Server Action.
    <form onSubmit={aoEnviar} noValidate className="flex flex-wrap items-end gap-2">
      {/* [CRÍTICO, rodada 11] campo de TEXTO: um `type="number"` em estado
          `badInput` (`2e`) mostrava `2e` na caixa e entregava `""` ao
          programa — e o servidor apagava a duração salva dizendo "Duração
          salva.". Ver `campo-numerico.tsx`. */}
      <CampoNumerico
        rotulo="Duração (dias, p80 — o prazo que acerta em 8 de 10 vezes)"
        descricaoId="duracao-tarefa-nao-salvo"
        valor={valor}
        // [ALTO #2, rodada 9] mexer no campo descarta o erro velho do
        // servidor — era ele que sobrevivia à correção e contradizia a
        // recusa nova na mesma tela.
        aoMudar={(texto) => {
          setValor(texto);
          porta.aoMudarCampo();
        }}
        placeholder="ex.: 2"
        classeDoCampo="min-h-[44px] w-28 rounded-lg border border-navy-700 bg-navy-900 px-2.5 py-2 text-sm text-bone-100 outline-none focus:border-gold-500"
      />
      <button
        ref={botaoRef}
        type="submit"
        aria-busy={porta.pendente ? true : undefined}
        aria-disabled={porta.pendente ? true : undefined}
        className={`inline-flex min-h-[44px] items-center rounded-lg border border-navy-700 bg-navy-850 px-3 text-sm font-semibold text-bone-100 transition hover:border-gold-600 ${
          porta.pendente ? "opacity-50" : ""
        }`}
      >
        Salvar duração
      </button>
      <CampoErro mensagem={porta.erroDoCampo} />
      <MensagemSucesso mensagem={porta.mensagem} />
      {/* [MÉDIO #1, rodada 15] A DISPENSA DE RASCUNHO PASSA A SER DITA.
          Este campo nasce com o número que o servidor guarda e não ganha
          rascunho (ver o bloco acima e a medida G da guarda de navegador).
          Antes, a diferença entre ele e a "Duração (dias)" da subtarefa — mesmo
          desenho, mesmo teclado, comportamento oposto — não estava em lugar
          nenhum da tela. */}
      <AvisoNaoSalvo
        id="duracao-tarefa-nao-salvo"
        mostrar={valor.trim() !== confirmadoRef.current.trim()}
        texto={AVISO_SEM_RASCUNHO}
      />
    </form>
  );
}
