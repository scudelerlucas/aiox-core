import type { ConsumoConta } from "@/core/prompts/tipos";
import {
  ROTULO_CONTA,
  bancoRecusaria,
  estadoDaMedicao,
  faixaConsumo,
  formatarUsd,
  headroomUsd,
  tetoAtingido,
  textoDaMedicao,
  textoEspacoLivre,
  textoEstimativa,
  textoPrevisaoComFila,
  textoTetoVsRealidade,
} from "@/core/prompts/tipos";
import { formatRelativeTime } from "@/lib/format-relative-time";

/**
 * OS-LIFEBOARD · P7 — cartão de conta: gasto do dia vs teto (barra) + o que
 * espera na fila + o que o roteador faria a seguir.
 *
 * Cor NUNCA é o único sinal: a faixa (ok/warn/crit) reusa os tokens de estado
 * já verificados a 4,5:1/3:1 (`scripts/checar-contraste.mjs`), e o texto ao
 * lado sempre diz o número e o rótulo por extenso. O TRILHO da barra é
 * `bg-navy-600` (4,01:1 sobre o cartão), já registrado no script.
 *
 * D9 (rodada 3): conta no teto NÃO sugere modelo. Sugerir "próximo modelo:
 * Fable" numa conta que não vai rodar nada hoje é convidar o operador a uma
 * ação que o banco recusa — o cartão diz o que é verdade: "teto atingido —
 * próximo espaço amanhã".
 *
 * MÉDIO 2 (rodada 8): o TETO APARECE EM TEXTO SEMPRE. O ramo "sem medição"
 * trocava a linha inteira do dinheiro por uma frase — e o valor do teto, que é
 * o trabalho deste cartão, sobrava só dentro do `aria-label`: invisível em 2
 * dos 3 estados reais. E a frase da medição saía DUAS vezes seguidas (uma no
 * lugar da linha do dinheiro, outra na linha de baixo). Agora: a linha do
 * dinheiro existe nos três estados e termina em "de US$ X" (dizendo "nada
 * medido ainda" quando é o caso, nunca "US$ 0,00", que fingiria medição), e a
 * frase da medição aparece UMA vez.
 *
 * D36 (rodada 8): conta que o banco RECUSARIA agora (medição velha com
 * `exigir_medicao_recente`) ganha o selo "sem autorização agora" — ele exclui
 * "escolhida agora", porque um cartão não pode dizer que foi escolhido para um
 * disparo que o banco vai recusar.
 *
 * MÉDIO 2 (rodada 9): os selos deixaram de ser um `else if`. Dois estados
 * verdadeiros ao mesmo tempo (teto atingido E sem autorização) agora aparecem
 * os dois, e o rodapé para de prometer "próximo espaço amanhã" quando amanhã
 * não resolve o que trava a conta.
 *
 * D13/D20 (rodada 4): o cartão NUNCA mostra número negativo (o crítico mediu
 * "US$ -20,00 livres" nesta linha) — passou do teto vira "sem espaço livre
 * agora". E quando parte do consumo é ESTIMATIVA da casa (item que morreu sem
 * fechar), o cartão diz isso: um número inflado pode congelar a conta o dia
 * inteiro, e o operador precisa saber que dá para corrigir na linha da fila.
 */
const FAIXA_CLASSES: Record<"ok" | "warn" | "crit", { barra: string; texto: string }> = {
  ok: { barra: "bg-state-done", texto: "text-state-done" },
  warn: { barra: "bg-state-progress", texto: "text-state-progress" },
  crit: { barra: "bg-state-blocked", texto: "text-state-blocked" },
};

export interface ContaCardProps {
  consumo: ConsumoConta;
  /** Próximo modelo que o roteador sugeriria, na complexidade selecionada. Ignorado quando a conta está no teto. */
  proximoModelo?: string;
  /** Esta conta seria a escolhida pelo roteamento automático agora? */
  seriaEscolhida?: boolean;
  /**
   * D3: esta conta não tem espaço HOJE para a complexidade atual. NÃO é
   * recusa — o item entra na fila e roda quando houver espaço.
   */
  semEspacoHoje?: boolean;
  agora?: number;
}

export function ContaCard({
  consumo,
  proximoModelo,
  seriaEscolhida,
  semEspacoHoje,
  agora = Date.now(),
}: ContaCardProps): JSX.Element {
  /*
    CRÍTICO 1 (rodada 13) · A TERCEIRA PAREDE, e a única que fica DENTRO da
    tela. As duas primeiras estão no banco (o estorno que não tira de hoje mais
    do que hoje tem, migration 0027 §6; o piso do número que governa o teto,
    0028 §1), e é lá que o defeito nasce e morre. Esta existe porque a promessa
    do DEPLOY.md D13 — "a tela nunca mostra número negativo" — era guardada só
    na SAÍDA (`textoEspacoLivre` clampa) e nunca na ENTRADA: com
    `consumoHojeUsd = -358,50` o cartão imprimia "US$ -358,50 de US$ 500,00 ·
    US$ 858,50 livres", a barra saía com `style="width:-72%"` (CSS inválido: o
    navegador cai no `w-full` da classe e desenha 100% CHEIA, em verde) e o
    `aria-valuenow="-72"` ficava fora da faixa declarada `0..100`.
    Nenhum número que chegue aqui, de qualquer banco e de qualquer versão,
    consegue mais desenhar uma barra inválida.
  */
  const gastoHoje = Math.max(0, consumo.consumoHojeUsd);
  const emUso = gastoHoje + consumo.reservadoUsd;
  // Uma clampagem só, e ela é a de cima: com `gastoHoje` no piso zero e
  // `reservadoUsd` nunca negativo, `emUso` não tem como ser negativo. Um
  // segundo `Math.max` aqui seria linha que nenhum teste consegue deixar
  // vermelha — guarda que não se prova é guarda que se acredita.
  const razao = consumo.tetoUsd > 0 ? Math.min(1, emUso / consumo.tetoUsd) : 1;
  const faixa = faixaConsumo(gastoHoje, consumo.reservadoUsd, consumo.tetoUsd);
  const atingiu = tetoAtingido(gastoHoje, consumo.reservadoUsd, consumo.tetoUsd);
  const headroom = headroomUsd(consumo);
  const cores = FAIXA_CLASSES[faixa];
  const previsao = textoPrevisaoComFila(consumo);
  const estimativa = textoEstimativa(consumo);
  const esperaHoje = semEspacoHoje === true && !atingiu;
  // D32a (rodada 7): três estados diferentes, três frases diferentes.
  const medicao = estadoDaMedicao(consumo, agora);
  const fraseDaMedicao = textoDaMedicao(consumo, agora);
  const semMedicao = medicao === "sem-medicao";
  /*
    MÉDIO 2 (rodada 12): "sem medição" e "sem gasto nenhum" NÃO são a mesma
    coisa, e o card tratava as duas como uma. Medido pelo crítico a 1280 px:
    `consumoHojeUsd = 98,50`, reservado 15, teto 500 — a linha do dinheiro
    imprimia "nada medido ainda + US$ 15,00 em execução de US$ 500,00", o
    `aria-label` repetia isso e a barra desenhava `aria-valuenow=23`. O texto
    explicava 3% enquanto a barra mostrava 23%, e duas linhas abaixo o próprio
    card dizia "US$ 50,00 do consumo são estimativa de 1 item que morreu sem
    fechar". O número que governa o teto estava escondido pela própria tela.

    Quem esconde o número passa a ser só o estado em que NÃO HÁ número: nada
    medido E nada consumido. É esse o caso que D32a (rodada 7) veio proteger —
    "US$ 0,00 de US$ 500,00 · US$ 500,00 livres" sobre um dia que ninguém
    mediu. Com consumo lançado, o número aparece, e a proveniência (sem medição
    nenhuma · a parcela estimada) continua dita na linha de baixo.
  */
  const semNumero = semMedicao && gastoHoje === 0;
  const realidade = textoTetoVsRealidade(consumo);
  // D36: o banco recusaria QUALQUER disparo desta conta agora.
  const travada = bancoRecusaria(consumo, agora);

  // MÉDIO 2 (rodada 9): a lista de selos. `escolhida agora` é o único que
  // convida, e ele só aparece quando NENHUM bloqueio aparece — nenhuma
  // superfície convida para o que o banco vai recusar (D9 estendido por D36).
  const selos: { texto: string; tom: "bloqueio" | "convite" }[] = [];
  if (atingiu) selos.push({ texto: "teto atingido", tom: "bloqueio" });
  if (travada) selos.push({ texto: "sem autorização agora", tom: "bloqueio" });
  if (esperaHoje) selos.push({ texto: "não cabe hoje", tom: "bloqueio" });
  if (selos.length === 0 && seriaEscolhida === true) {
    selos.push({ texto: "escolhida agora", tom: "convite" });
  }

  /*
    MÉDIO 2 (rodada 9) · O RODAPÉ PARAVA DE SER VERDADE QUANDO OS DOIS ESTADOS
    SE ENCONTRAVAM. Ele dizia "teto atingido — próximo espaço amanhã" DUAS
    LINHAS ABAIXO de "nenhum disparo é autorizado agora". Amanhã o teto zera e
    o banco continua recusando: a promessa era falsa, e era a única frase de
    prazo do cartão. Agora, quando os dois valem, a frase diz os dois — e diz
    qual deles amanhã NÃO resolve.
  */
  const rodape =
    atingiu && travada
      ? "teto atingido e sem autorização — amanhã o teto zera, mas o disparo só volta quando a medição desta conta for atualizada"
      : atingiu
        ? "teto atingido — próximo espaço amanhã"
        : travada
          ? "sem autorização agora — volta a rodar quando a medição desta conta for atualizada"
          : null;

  return (
    <section
      className={`rounded-lg border bg-navy-850 p-4 ${
        atingiu || esperaHoje || travada
          ? "border-state-blocked/70"
          : seriaEscolhida
            ? "border-gold-500 shadow-heroi"
            : "border-navy-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-bone-50">{ROTULO_CONTA[consumo.conta]}</h2>
        {/*
          MÉDIO 2 (rodada 9) · DOIS ESTADOS VERDADEIROS NÃO SE ESCONDEM.
          Era um `atingiu ? … : travada ? …` — um `else if`. O crítico mediu a
          consequência na conta real: Alma Petra mostrava só "teto atingido"
          enquanto o card, logo abaixo, dizia "nenhum disparo é autorizado
          agora". E, como a única conta com a trava ligada no fixture também
          estava no teto, "sem autorização agora" NÃO RENDERIZAVA NENHUMA VEZ —
          o estado que a rodada 8 diz ter adicionado nunca era exercido.
          Agora os selos são uma LISTA: cada estado verdadeiro ganha o seu.
        */}
        <div className="flex flex-wrap justify-end gap-1">
          {selos.map((selo) => (
            <span
              key={selo.texto}
              className={`rounded-full border bg-navy-800 px-2 py-0.5 text-[11px] font-medium ${
                selo.tom === "bloqueio"
                  ? "border-state-blocked/70 text-state-blocked"
                  : "border-gold-500/70 text-gold-300"
              }`}
            >
              {selo.texto}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-[11px] text-bone-400">{consumo.conta}</p>

      <div className="mt-3">
        <div
          role="progressbar"
          aria-valuenow={Math.round(razao * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            semNumero
              ? `Nada medido ainda nesta conta; ${formatarUsd(consumo.reservadoUsd)} em execução, de ${formatarUsd(consumo.tetoUsd)}`
              : semMedicao
                ? `Gasto de hoje: ${formatarUsd(gastoHoje)} lançado sem medição de sessão (${fraseDaMedicao}) mais ${formatarUsd(consumo.reservadoUsd)} em execução, de ${formatarUsd(consumo.tetoUsd)}`
                : `Gasto de hoje: ${formatarUsd(gastoHoje)} medido (${fraseDaMedicao}) mais ${formatarUsd(consumo.reservadoUsd)} em execução, de ${formatarUsd(consumo.tetoUsd)}`
          }
          className="h-2.5 w-full overflow-hidden rounded-full bg-navy-600"
        >
          <div
            className={`h-full rounded-full ${cores.barra}`}
            style={{ width: `${Math.round(razao * 100)}%` }}
          />
        </div>
        {/*
          D32a (rodada 7): SEM MEDIÇÃO NENHUMA não vira "US$ 0,00 de US$ 500,00 ·
          US$ 500,00 livres". O crítico mediu esse card sobre duas contas que
          nunca tiveram sessão: a tela dizia, com todas as letras, que o dia
          inteiro estava livre — sobre um número que ninguém nunca mediu. Zero
          não medido não é zero gasto, e o card diz qual dos dois é.

          MÉDIO 2 (rodada 8): mas o TETO continua na linha, nos três estados.
          Ele é o trabalho deste cartão ("gasto do dia vs teto") e estava
          visível só quando havia medição — nos outros dois casos sobrava
          dentro do `aria-label`, onde ninguém que enxerga o lê.
        */}
        <p
          className={`mt-1.5 text-xs font-medium ${semNumero ? "text-state-blocked" : cores.texto}`}
        >
          {semNumero ? "nada medido ainda" : formatarUsd(gastoHoje)}
          {consumo.reservadoUsd > 0 ? ` + ${formatarUsd(consumo.reservadoUsd)} em execução` : ""}
          {" de "}
          {formatarUsd(consumo.tetoUsd)}
        </p>
        <p
          className={`mt-0.5 text-[11px] ${
            medicao === "recente" ? "text-bone-400" : "text-state-progress"
          }`}
        >
          {/*
            MÉDIO 2: a frase da medição aparece UMA vez. Antes, no estado "sem
            medição", ela saía aqui E na linha de cima — duas linhas seguidas
            dizendo exatamente a mesma coisa.
            O proxy só atualiza na cadência da Routine diária de cada conta.
          */}
          {medicao === "recente"
            ? `medido até ${formatRelativeTime(consumo.medidoAteEm as string, agora)}`
            : semMedicao
              ? "sem medição nenhuma — nenhuma sessão desta conta foi medida ainda"
              : fraseDaMedicao}
          {semNumero ? null : (
            <>
              {" · "}
              {/* D13: clamp em 0 — "US$ -20,00 livres" não é informação, é erro. */}
              {textoEspacoLivre(consumo)}
              {headroom < 0 ? ` (${formatarUsd(Math.abs(headroom))} acima do teto)` : ""}
              {previsao ? ` · ${previsao}` : ""}
              {consumo.emEspera > 0
                ? ` · ${consumo.emEspera === 1 ? "1 item espera" : `${consumo.emEspera} itens esperam`} nova tentativa`
                : ""}
            </>
          )}
        </p>
        {/*
          D32d (rodada 7): o teto ao lado da realidade medida. O valor do teto é
          decisão do OPERADOR e nada aqui o muda — o que faltava era ele poder
          ver contra o quê está decidindo (medido: 9 de 9 dias acima do teto,
          mediana ~2,6×, máximo 16,8×).
        */}
        {realidade ? <p className="mt-0.5 text-[11px] text-bone-400">{realidade}</p> : null}
        {consumo.exigeMedicaoRecente === true ? (
          <p
            className={`mt-0.5 text-[11px] ${travada ? "text-state-blocked" : "text-state-progress"}`}
          >
            {travada
              ? "nenhum disparo é autorizado agora: esta conta exige medição de menos de 12 h."
              : "esta conta só autoriza gasto novo com medição de menos de 12 h."}
          </p>
        ) : null}
        {estimativa ? (
          <p className="mt-0.5 text-[11px] text-state-progress">{estimativa} — dá para ajustar na linha da fila.</p>
        ) : null}
      </div>

      {rodape ? (
        /* D9 estendido (D36): conta bloqueada não sugere modelo — sugerir
           "próximo modelo: Fable" aqui seria convidar para o disparo recusado. */
        <p className="mt-3 text-xs text-state-blocked">{rodape}</p>
      ) : proximoModelo ? (
        <p className="mt-3 text-xs text-bone-300">
          próximo modelo sugerido: <span className="font-semibold text-bone-100">{proximoModelo}</span>
        </p>
      ) : null}
    </section>
  );
}
