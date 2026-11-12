#!/usr/bin/env python3
"""Valida um STORYBOARD POR SEGUNDO (vsl-studio/schema/storyboard-segundo.schema.json).

Uso: python3 scripts/storyboard-segundo-validar.py <arquivo.json> [--teto N]

Além do schema (quando `jsonschema` está instalado), confere o que o schema não alcança:
- as faixas cobrem 0..duracao_s sem buraco e sem sobreposição;
- a soma dos créditos das faixas bate com totais.creditos;
- totais.creditos ≤ teto fixo do formato, salvo autorização no gate (ou --teto);
- toda faixa `seedance-2.5` é `essencial` e traz `porque`;
- storyboard aprovado com `seedance-2.5` tem aprovação do Lucas;
- acabamento (opcional, emenda de 09/11/2026): só sobre faixa falada com fonte heygen-avatar-v; motor
  só Seedance; o crédito do acabamento entra no total; qualquer acabamento exige gate.teto_autorizado
  (total ≤ esse teto) e, se aprovado, aprovação do Lucas; gate_pos reprovado manda o trecho de volta ao HeyGen;
- o prompt de cada faixa gerada começa pela etiqueta [<id> s<de>-<ate>] — é o que o hook
  .claude/hooks/higgsfield-storyboard-gate.sh procura antes de deixar o disparo passar.
Sai 0 quando passa; 1 com a lista do que falhou. Sem rede, sem crédito.
"""
import json
import re
import sys
from pathlib import Path

TETOS = {"anuncio": 60, "reels": 20, "short": 20, "vsl": 250, "boas-vindas": 20, "aula": 10, "teaser": 60, "stories": 12, "follow-up": 0, "outro": 60}
MOTORES_ACABAMENTO = {"seedance-2.0-standard", "seedance-2.0-fast", "seedance-2.0-mini", "seedance-2.5"}
GERADAS = {"seedance-2.5", "seedance-2.0-standard", "seedance-2.0-fast", "seedance-2.0-mini", "imagem-animada"}
VOZES = {"elevenlabs-v4", "gravada-pelo-lucas"}
ROSTOS = {"gravado-pelo-lucas", "heygen-avatar-v", "sem-rosto"}


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    caminho = Path(sys.argv[1])
    teto_arg = None
    if "--teto" in sys.argv:
        teto_arg = float(sys.argv[sys.argv.index("--teto") + 1])
    sb = json.loads(caminho.read_text(encoding="utf-8"))
    erros: list[str] = []

    schema_path = Path(__file__).resolve().parent.parent / "vsl-studio" / "schema" / "storyboard-segundo.schema.json"
    try:
        import jsonschema  # type: ignore

        for e in sorted(jsonschema.Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8"))).iter_errors(sb), key=str):
            erros.append(f"schema: {'/'.join(str(p) for p in e.path) or '<raiz>'}: {e.message}")
    except ImportError:
        print("aviso: `jsonschema` não instalado — o schema completo não foi conferido; as conferências obrigatórias próprias rodaram (pip install jsonschema)")

    pilha = sb.get("pilha", {})
    if pilha.get("voz") not in VOZES:
        erros.append(f"pilha.voz inválida: {pilha.get('voz')!r}")
    if pilha.get("rosto") not in ROSTOS:
        erros.append(f"pilha.rosto inválido: {pilha.get('rosto')!r}")
    if pilha.get("rosto") == "heygen-avatar-v" and "lipsync_fonte" not in pilha:
        erros.append("pilha.lipsync_fonte é obrigatório quando pilha.rosto é heygen-avatar-v")

    dur = int(sb.get("duracao_s", 0))
    faixas = sorted(sb.get("segundos", []), key=lambda f: (f.get("de", 0), f.get("ate", 0)))
    cursor = 0
    for f in faixas:
        de, ate = int(f.get("de", 0)), int(f.get("ate", 0))
        if ate <= de:
            erros.append(f"faixa {de}-{ate}: `ate` tem de ser maior que `de`")
        if de < cursor:
            erros.append(f"faixa {de}-{ate}: sobrepõe a anterior (que terminava em {cursor})")
        elif de > cursor:
            erros.append(f"buraco: nenhum storyboard entre o segundo {cursor} e o {de}")
        cursor = max(cursor, ate)
        if f.get("fonte") == "seedance-2.5" and not f.get("essencial"):
            erros.append(f"faixa {de}-{ate}: Seedance 2.5 só em segundo essencial")
        porque = f.get("porque")
        if not isinstance(porque, str) or len(porque) < 8:
            erros.append(f"faixa {de}-{ate}: `porque` precisa ter ao menos 8 caracteres")
        if f.get("camada") == "prova" and f.get("fonte") not in {"real", "gravado"}:
            erros.append(f"faixa {de}-{ate}: camada `prova` só aceita fonte `real` ou `gravado`")
        if f.get("fonte") in GERADAS:
            etiqueta = f"[{sb.get('id')} s{de}-{ate}]"
            if not str(f.get("prompt", "")).startswith(etiqueta):
                erros.append(f"faixa {de}-{ate}: o prompt tem de começar por {etiqueta}")
            for campo in ("prompt", "unidade", "creditos"):
                if campo not in f:
                    erros.append(f"faixa {de}-{ate}: `{campo}` é obrigatório para fonte gerada")
        ac = f.get("acabamento")
        if ac is not None:
            ref = f"faixa {de}-{ate}: acabamento"
            if f.get("fonte") != "heygen-avatar-v":
                erros.append(f"{ref} só vale sobre a saída do HeyGen (fonte `heygen-avatar-v`); aqui a fonte é {f.get('fonte')!r}")
            if f.get("ouve") not in {"voz", "voz+musica"}:
                erros.append(f"{ref} só vale em cena falada (`ouve` = voz ou voz+musica)")
            if ac.get("motor") not in MOTORES_ACABAMENTO:
                erros.append(f"{ref}: motor {ac.get('motor')!r} não é Seedance (use um de {sorted(MOTORES_ACABAMENTO)})")
            if not isinstance(ac.get("creditos"), (int, float)) or ac.get("creditos") < 0:
                erros.append(f"{ref}: `creditos` é obrigatório e não pode ser negativo")
            if not isinstance(ac.get("porque"), str) or len(ac["porque"]) < 8:
                erros.append(f"{ref}: `porque` precisa ter ao menos 8 caracteres")
            etiqueta = f"[{sb.get('id')} s{de}-{ate}]"
            if not str(ac.get("prompt", "")).startswith(etiqueta):
                erros.append(f"{ref}: o prompt tem de começar por {etiqueta}")
            gp = ac.get("gate_pos")
            if gp is not None and (gp.get("boca_no_tempo") is False or gp.get("rosto_igual") is False):
                erros.append(f"{ref}: a medida depois do acabamento reprovou (boca fora do tempo ou rosto mudou) — este trecho volta para a saída do HeyGen, sem acabamento")
    if cursor != dur:
        erros.append(f"as faixas terminam em {cursor}, mas duracao_s é {dur}")

    gate = sb.get("gate", {})
    if gate.get("aprovado") is True and any(f.get("fonte") == "seedance-2.5" for f in faixas):
        if gate.get("aprovado_por") != "lucas":
            erros.append("storyboard aprovado com Seedance 2.5 exige gate.aprovado_por = lucas")

    soma = sum(float(f.get("creditos", 0) or 0) + float((f.get("acabamento") or {}).get("creditos", 0) or 0) for f in faixas)
    tem_acabamento = any(f.get("acabamento") is not None for f in faixas)
    tot = sb.get("totais", {})
    if abs(soma - float(tot.get("creditos", -1))) > 0.01:
        erros.append(f"totais.creditos = {tot.get('creditos')} ≠ soma das faixas = {soma:g}")
    teto_ordinario = float(TETOS.get(sb.get("formato", "outro"), 60))
    teto_declarado = float(tot.get("teto_do_formato", teto_ordinario))
    autorizacao = sb.get("gate", {}).get("teto_autorizado")
    teto_autorizado = autorizacao.get("teto") if isinstance(autorizacao, dict) else None
    teto_autorizado_numerico = isinstance(teto_autorizado, (int, float)) and not isinstance(teto_autorizado, bool)
    teto = teto_arg if teto_arg is not None else teto_ordinario
    if teto_arg is None and teto_declarado > teto_ordinario:
        if not autorizacao:
            erros.append(
                f"totais.teto_do_formato = {teto_declarado:g} supera o teto ordinário "
                f"de {sb.get('formato')} ({teto_ordinario:g}) sem gate.teto_autorizado"
            )
        else:
            if not teto_autorizado_numerico:
                erros.append("gate.teto_autorizado.teto deve ser numérico quando autoriza teto acima do formato")
            else:
                teto = float(teto_autorizado)
            if teto_autorizado_numerico and teto != teto_declarado:
                erros.append(
                    f"gate.teto_autorizado.teto = {teto:g} ≠ "
                    f"totais.teto_do_formato = {teto_declarado:g}"
                )
    if tem_acabamento:
        if not isinstance(autorizacao, dict) or not autorizacao:
            erros.append("peça com acabamento precisa de gate.teto_autorizado (o teto que o Lucas autorizou para esta peça, com `por`, `em` e `teto`); sem ele não dispara")
        else:
            if autorizacao.get("por") != "lucas":
                erros.append("peça com acabamento exige gate.teto_autorizado.por = lucas")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}", str(autorizacao.get("em", ""))):
                erros.append("peça com acabamento exige gate.teto_autorizado.em no formato AAAA-MM-DD HH:MM")
            if not teto_autorizado_numerico:
                erros.append("peça com acabamento exige gate.teto_autorizado.teto numérico")
            elif teto_arg is None:
                teto = float(teto_autorizado)
        if gate.get("aprovado") is True and gate.get("aprovado_por") != "lucas":
            erros.append("peça com acabamento exige gate.aprovado_por = lucas (o sim é dele, peça a peça)")
    if soma > teto:
        if tem_acabamento and autorizacao and teto_arg is None:
            erros.append(f"{soma:g} créditos passam do teto que o Lucas autorizou para esta peça ({teto:g}) — reduzir ou pedir a ele um teto novo")
        else:
            erros.append(f"{soma:g} créditos passam do teto do formato ({teto:g}) — reduzir ou pedir o sim do Lucas")
    ess = sum(int(f.get("ate", 0)) - int(f.get("de", 0)) for f in faixas if f.get("essencial"))
    if int(tot.get("segundos_essenciais", -1)) != ess:
        erros.append(f"totais.segundos_essenciais = {tot.get('segundos_essenciais')} ≠ medido = {ess}")
    if not re.fullmatch(r"ss-\d{4}-\d{2}-\d{2}-\d{3}", str(sb.get("id", ""))):
        erros.append("id fora do padrão ss-AAAA-MM-DD-NNN")

    gate = sb.get("gate", {})
    if gate.get("aprovado") is True:
        for campo in ("aprovado_por", "aprovado_em", "chat"):
            if campo not in gate:
                erros.append(f"gate.{campo} é obrigatório quando gate.aprovado é true")

    if erros:
        print(f"✗ {caminho}: {len(erros)} problema(s)")
        for e in erros:
            print(" -", e)
        return 1
    print(f"✓ {caminho}: {len(faixas)} faixas · {dur} s · {soma:g} créditos (teto {teto:g}) · {ess} s essenciais")
    return 0


if __name__ == "__main__":
    sys.exit(main())
