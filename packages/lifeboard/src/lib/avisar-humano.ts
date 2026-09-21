import "server-only";
/**
 * OS-LIFEBOARD · P6 — [Checagem 8 da régua (B11), rodada 11] A FALHA TEM DESTINO.
 *
 * A página da tarefa tratava uma falha de leitura com `console.error` + uma
 * frase na tela. As duas coisas são certas e nenhuma das duas AVISA ninguém:
 * o `console.error` de um Server Component morre no log do servidor, que não
 * tem leitor humano, e a frase na tela só existe se o operador estiver na
 * frente dela naquele segundo. B11 pede o contrário: **falha chega a gente.**
 *
 * Este módulo é esse destino, e é o único lugar do `src/` que decide para
 * onde a falha vai:
 *
 *  1. o registro estruturado continua (é o que um humano lê depois, no log);
 *  2. quando `LIFEBOARD_ALERTA_WEBHOOK` está configurado, o aviso é POSTado
 *     lá — é o canal que chega a uma pessoa (Slack, e-mail, o que estiver do
 *     outro lado da URL);
 *  3. quando não está, a função DIZ isso no registro, em vez de fingir que
 *     avisou. Um destino que não existe precisa aparecer, não sumir.
 *
 * Nunca lança: avisar sobre uma falha não pode virar a segunda falha. E nunca
 * interpola variável no 1º argumento de `console.*` (CodeQL
 * `js/tainted-format-string`).
 */

export interface AvisoDeFalha {
  /** A tela ou rota onde a falha aconteceu (`/tarefa/[id]`). */
  onde: string;
  /** O que estava sendo lido/gravado (o id da tarefa, por exemplo). */
  alvo: string;
  /** O erro cru — nunca vai para a tela, só para o destino humano. */
  causa: unknown;
}

export interface DestinoDaFalha {
  /** Para onde vai o aviso. `null` = não há canal humano configurado. */
  url: string | null;
  enviar: (corpo: string) => Promise<unknown>;
  registrar: (rotulo: string, dados: Record<string, unknown>) => void;
}

function mensagemDe(causa: unknown): string {
  if (causa instanceof Error) return causa.message;
  if (typeof causa === "string") return causa;
  return "erro sem mensagem";
}

export function destinoPadrao(): DestinoDaFalha {
  const url = process.env.LIFEBOARD_ALERTA_WEBHOOK ?? "";
  return {
    url: url.length > 0 ? url : null,
    enviar: (corpo: string) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: corpo,
      }),
    registrar: (rotulo: string, dados: Record<string, unknown>) => {
      // 1º argumento literal, sempre — o resto vai como dados.
      console.error("[lifeboard] aviso de falha", rotulo, dados);
    },
  };
}

/**
 * Manda a falha para onde um humano a lê. Devolve `true` quando o canal
 * humano de fato recebeu — é o que o teste-sentinela mede.
 */
export async function avisarHumano(
  aviso: AvisoDeFalha,
  destino: DestinoDaFalha = destinoPadrao(),
): Promise<boolean> {
  const dados = {
    onde: aviso.onde,
    alvo: aviso.alvo,
    mensagem: mensagemDe(aviso.causa),
    quando: new Date().toISOString(),
  };
  if (destino.url === null) {
    destino.registrar("sem canal humano configurado (LIFEBOARD_ALERTA_WEBHOOK)", dados);
    return false;
  }
  try {
    await destino.enviar(JSON.stringify(dados));
    destino.registrar("enviado ao canal humano", dados);
    return true;
  } catch (erroDoAviso) {
    destino.registrar("o canal humano recusou o aviso", {
      ...dados,
      falhaDoAviso: mensagemDe(erroDoAviso),
    });
    return false;
  }
}
