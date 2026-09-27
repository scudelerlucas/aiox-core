/**
 * OS-LIFEBOARD · P4 rodada 16 — a COBERTURA EM PARES do produto dos gestos
 * (§22 de `guarda-no-navegador.mjs`), fora da guarda para poder ser testada
 * sem navegador (`tests/unit/cobertura-em-pares.test.ts`).
 *
 * O problema: o produto cartesiano dos eixos que o operador controla (7
 * camadas × 3 zooms × 3 painéis × 2 seleções × 2 filtros × 2 enquadramentos
 * × 2 pans = 1.008 estados por largura) não cabe no robô. A cobertura em
 * pares garante que TODO par de valores de quaisquer dois eixos aparece em
 * pelo menos uma combinação — o jeito conhecido de pegar defeito de
 * interação de dois fatores sem pagar o produto inteiro. Defeito que só
 * existe numa interação de TRÊS eixos fica fora, e a guarda diz isso.
 *
 * `credita(combo, i, j)` decide se o par (eixo i, eixo j) daquela combinação
 * conta como coberto: um par só vale onde é OBSERVÁVEL (ex.: "cartão
 * selecionado × zoom no teto" não cobre nada numa combinação em que o
 * destaque não tem como aparecer). O eixo 0 é o que decide a
 * observabilidade, então ele é sempre preenchido primeiro.
 */

/**
 * ── A COBERTURA EM PARES, GERADA — NUNCA ESCOLHIDA ────────────────────────
 *
 * Gulosa e determinística: pega o primeiro par ainda descoberto, fixa os dois
 * valores dele e completa os outros eixos, em ordem, com o valor que cobre
 * mais pares ainda descobertos (empate: o primeiro). O par-semente TEM de
 * sair creditado (senão o valor é descartado). O eixo 0 tem de ser o das
 * camadas: é ele que decide se o destaque é observável.
 */
export function gerarCoberturaEmPares(eixos, credita) {
  const n = eixos.length;
  const chaveDoPar = (i, a, j, b) => `${String(i)}:${String(a)}|${String(j)}:${String(b)}`;
  const falta = new Map();
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      for (let a = 0; a < eixos[i].valores.length; a += 1) {
        for (let b = 0; b < eixos[j].valores.length; b += 1) falta.set(chaveDoPar(i, a, j, b), [i, a, j, b]);
      }
    }
  }
  const total = falta.size;
  const creditados = (combo) => {
    const saida = [];
    for (let i = 0; i < n; i += 1) {
      if (combo[i] === null) continue;
      for (let j = i + 1; j < n; j += 1) {
        if (combo[j] === null) continue;
        if (credita(combo, i, j)) saida.push(chaveDoPar(i, combo[i], j, combo[j]));
      }
    }
    return saida;
  };
  const combos = [];
  while (falta.size > 0) {
    const [i0, a0, j0, b0] = falta.values().next().value;
    const semente = chaveDoPar(i0, a0, j0, b0);
    const combo = new Array(n).fill(null);
    combo[i0] = a0;
    combo[j0] = b0;
    for (let k = 0; k < n; k += 1) {
      if (combo[k] !== null) continue;
      let melhor = -1;
      let melhorGanho = -1;
      for (let v = 0; v < eixos[k].valores.length; v += 1) {
        combo[k] = v;
        const ganhos = creditados(combo).filter((c) => falta.has(c));
        const sementeViva = combo[0] === null || ganhos.includes(semente);
        if (sementeViva && ganhos.length > melhorGanho) {
          melhorGanho = ganhos.length;
          melhor = v;
        }
      }
      if (melhor === -1) throw new Error(`o par ${semente} não é observável em combinação nenhuma`);
      combo[k] = melhor;
    }
    const ganhos = creditados(combo).filter((c) => falta.has(c));
    if (!ganhos.includes(semente)) throw new Error(`o gerador não conseguiu creditar o par ${semente}`);
    for (const c of ganhos) falta.delete(c);
    combos.push([...combo]);
  }
  return { combos, total };
}

/** Recontagem INDEPENDENTE do gerador: devolve os pares que as combinações não cobrem. */
export function paresSemCobertura(eixos, combos, credita) {
  const cobertos = new Set();
  for (const combo of combos) {
    for (let i = 0; i < eixos.length; i += 1) {
      for (let j = i + 1; j < eixos.length; j += 1) {
        if (credita(combo, i, j)) cobertos.add(`${String(i)}:${String(combo[i])}|${String(j)}:${String(combo[j])}`);
      }
    }
  }
  const faltam = [];
  for (let i = 0; i < eixos.length; i += 1) {
    for (let j = i + 1; j < eixos.length; j += 1) {
      for (let a = 0; a < eixos[i].valores.length; a += 1) {
        for (let b = 0; b < eixos[j].valores.length; b += 1) {
          if (!cobertos.has(`${String(i)}:${String(a)}|${String(j)}:${String(b)}`)) {
            faltam.push(`${eixos[i].valores[a].nome} × ${eixos[j].valores[b].nome}`);
          }
        }
      }
    }
  }
  return faltam;
}
