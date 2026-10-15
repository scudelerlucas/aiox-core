#!/usr/bin/env bash
# ARQUIVO GERADO por scripts/sync-rules.mjs — NÃO editar.
# Fonte única: classificar_arquivos() em scripts/regente/fila.sh.
# Regere com: node scripts/sync-rules.mjs
# Lido por sed e avaliado pelo robô; não é para ser executado sozinho.
classificar_arquivos() { # lista de caminhos → define texto_medido
  local caminho fora=0
  texto_medido="nao"
  [ -n "${1:-}" ] || return
  while IFS= read -r caminho; do
    [ -z "$caminho" ] && continue
    case "$caminho" in
      # Os dois arquivos que o próprio Regente grava sob regente/eventos/** sempre entram,
      # antes de qualquer outro filtro — são json/jsonl, mas não "configuração" no sentido da
      # linha 123 do PLANO-MESTRE.md, são o registro operacional do próprio Regente.
      regente/eventos/*.jsonl|regente/eventos/agent_state.json) continue;;
    esac
    case "$caminho" in
      # Achado de 22/09 (PR #963, rodada 13): rodadas 12 e 13 nomearam `.agents/`, `.codex/`,
      # agora `.aios-core/` (388 arquivos `.md` — o maior de todos) foram achados um de cada vez,
      # sempre a mesma classe. Medido: `.agents` `.aios-core` `.aios` `.antigravity` `.codex`
      # `.cursor` `.gemini` são 6 pastas de configuração/instrução de ferramenta de IA na raiz,
      # todas com `.md` que passariam como "só texto". Em vez de continuar nomeando uma a uma,
      # **qualquer diretório oculto na raiz** (começa com `.`) é excluído por padrão — é a mesma
      # lógica da lista branca de formato: fechar a classe inteira, não o exemplo de hoje.
      .*/*|CLAUDE.md|README.md) fora=1; break;;
      scripts/*|supabase/*|vigia/*|agentes/*|AGENTS.md) fora=1; break;;
      # Achado de 22/09 (PR #963, rodada 8): docs/ferramentas/radar-produtos/** não é
      # documentação — é a aplicação FastAPI implantada que o docs/ops/PLANO-D-... já
      # registra (pyproject.toml, 20 módulos pytest, vercel.json próprio). Um .md ali
      # (ex. METODOLOGIA.md) é conferido por teste Python contra o catálogo de tags; a CI
      # de raiz ignora docs/**, então um .md quebrado ali não seria pego antes do merge
      # autônomo. Excluído por inteiro, antes do resto.
      docs/ferramentas/radar-produtos/*) fora=1; break;;
      # Achado de 22/09 (PR #963, rodada 11): nem todo `.md` é texto passivo. Os documentos que
      # governam o próprio comportamento autônomo do Regente (mudar um deles sem revisão é
      # mudar a regra que decide se revisão é preciso) e os `.md` que o `offerforge` carrega em
      # runtime (`offerforge/src/metodo/loader.ts`, conferido: `fs.readFileSync` + schema, não
      # é prosa lida por humano) ficam fora, mesmo sendo `.md`.
      regente/plantao.md|regente/PLANO-MESTRE.md|regente/CODICE-LS-v1.1.md|regente/REGENTE.md|regente/VIGILIA.md) fora=1; break;;
      # Portado do PR #963 em 09/10/2026 (religação do Regente, decisão B do operador). Acréscimos
      # do mesmo dia: o próprio arquivo de desligamento e a declaração de escopo da classe 2 de
      # cada OS (PLANO-MESTRE §5: mudar a "Pasta do produto" é "pergunta antes") também governam
      # o que o Regente e as sessões podem fazer sozinhos — nunca entram como "só texto".
      regente/DESLIGADO.md|regente/README.md|*/VERSOES-E-FOSSO-*.md) fora=1; break;;
      # Achado de 22/09 (rodada 14): offerforge/packs/*.md é a mesma classe de
      # offerforge/metodo/*.md — carregado e validado por schema em loadPack()
      # (offerforge/src/metodo/loader.ts:311-341), não prosa. ARQUITETURA.md, DEPLOY.md,
      # KIT-README.md etc. ficam de fora desta exclusão: conferido, nenhum é importado por
      # src/ — são planejamento para humano ler, não runtime.
      # Achado de 22/09 (rodada 18): a linha acima estava ERRADA sobre offerforge/CLAUDE.md e
      # offerforge/prompts/*.md — "não importado por src/" não é a régua certa para esta
      # classe, porque quem lê esses dois não é código, é o próprio agente que constrói o
      # produto. offerforge/CLAUDE.md diz de si mesmo "regras permanentes... prevalecem sobre
      # qualquer instrução conflitante em prompts de fase" — mesma natureza de `CLAUDE.md` na
      # raiz (já excluído) e de `regente/plantao.md` (rodada 11: lido por agente, não por JS,
      # e ainda assim é a regra). offerforge/prompts/*.md (01-setup.md a 07-ui.md, conferidos
      # os 7) são o prompt de cada fase de construção, colado direto numa sessão — "FASE 0X",
      # "Tarefa: 1. ... 2. ...", a mesma coisa que radar-superviral/schedule/*.md (rodada 17).
      offerforge/metodo/*.md|offerforge/packs/*.md|offerforge/CLAUDE.md|offerforge/prompts/*.md) fora=1; break;;
      # Achado de 22/09 (rodada 19): vsl-studio/BOOTSTRAP-PROMPT.md é "o prompt único para
      # colar no Claude Code local e montar tudo" (conferido: vsl-studio/README.md diz
      # exatamente isso) — mesma classe de offerforge/CLAUDE.md e radar-superviral/schedule/:
      # lido por agente, não por código, mas muda comportamento de verdade.
      vsl-studio/BOOTSTRAP-PROMPT.md) fora=1; break;;
      # Achado de 22/09 (rodada 22): docs/legado/PACOTE-MENTOR-LEGADO/60-projeto-claude/
      # PROJECT-INSTRUCTIONS-mentor-legado.md é colado inteiro nas "Instruções do Projeto" do
      # Claude que os mentores usam com membros de verdade (conferido: 02-INSTALACAO-CLAUDE.md,
      # Passo 3, manda copiar o conteúdo inteiro do arquivo para lá) — muda blindas de
      # diagnóstico, privacidade e escalonamento em produção, não é prosa passiva. Excluída a
      # pasta inteira `60-projeto-claude/` (o nome já diz o que ela é: conteúdo para colar num
      # Projeto do Claude), não só o arquivo de hoje — mesma lição de squads/ na rodada 17.
      docs/legado/PACOTE-MENTOR-LEGADO/60-projeto-claude/*) fora=1; break;;
      # Achado de 22/09 (rodada 16, ESTREITO DEMAIS — corrigido na rodada 17): nomear só
      # radar-superviral/AGENT.md e squads/*/agents/*.md vazou de novo na hora seguinte —
      # radar-superviral/schedule/prompt-diario.md e prompt-semanal.md são colados direto no
      # corpo do trigger agendado (conferido em schedule/cadence.md: "colando os prompts de
      # prompt-diario.md e prompt-semanal.md"), e squads/content-engine/tasks/write-script.md
      # é carregado pelo próprio agente (george-blackman.md, "*write-script → loads
      # tasks/write-script.md"). Conferido o padrão inteiro: todo agente de squad declara, na
      # própria definição, quais pastas ele carrega sob comando — "type=folder
      # (tasks|templates|checklists|data|workflows|etc...)" — varia de squad para squad e o
      # próprio texto diz "etc", não é uma lista fechada. Mesma lição da rodada 13 (pastas
      # ocultas): parar de nomear arquivo por arquivo e fechar a classe inteira.
      # radar-superviral/ (fora só o schedule/) e squads/ (framework de definição de agente,
      # mesma natureza de `.aios-core` e `offerforge/metodo/`) ficam fora por inteiro.
      # Achado de 22/09 (rodada 20): radar-superviral/playbook.md escapou da rodada 17 — é o
      # "protocolo executável na nuvem" (conferido, linha 1 do próprio arquivo) que os dois
      # prompts agendados mandam seguir ("Siga radar-superviral/playbook.md", conferido nos
      # dois). Medi a referência inteira desta vez: só `AGENT.md` e `playbook.md` são citados
      # como "leia/siga" pelos prompts — o resto de radar-superviral/ (README, relatórios,
      # blueprint/, docs/) não é referenciado como instrução em lugar nenhum, então continua
      # fora desta exclusão (é o mesmo cuidado que poupou `offerforge/prompts/` de excluir
      # `ARQUITETURA.md`/`DEPLOY.md` na rodada 18 — nominal, não a pasta inteira).
      radar-superviral/schedule/*|radar-superviral/AGENT.md|radar-superviral/playbook.md|squads/*) fora=1; break;;
      social-os/schedule/*|social-os/AGENT.md) fora=1; break;;
      # Achado de 22/09, 3 rodadas seguidas (23, 24, 25) — mesmo padrão das rodadas 13/17 (parar
      # de nomear um arquivo de cada vez e fechar a classe): rodada 23 achou
      # docs/ops/PROMPT-ROUTINE-publicar-sessoes-outras-contas-2026-09-12.md (bloco que falta colar
      # numa Routine, grava no Supabase), rodada 24 achou
      # docs/ops/PROMPT-CHROME-2026-09-22-codex-web-frentes.md (bloco agendado para a próxima
      # varredura), rodada 25 achou docs/editor-os/PROMPT-DC-F1-teste-de-fogo.md (Desktop Commander,
      # ainda pendente, instala dependência e publica). As três batem a mesma convenção de nome
      # desta casa: arquivo `PROMPT-*.md` é bloco para colar numa sessão/Routine/ferramenta e
      # executar, não prosa para humano ler — a regra `execucao-remota.md` é a fonte da convenção.
      # Medido: ~45 arquivos `PROMPT-*.md` no repo, a maioria em `docs/`; não dá para saber sem ler
      # cada um se já rodou (histórico) ou ainda está pendente (controle vivo), e o preço de excluir
      # um já executado por engano é só pedir revisão do operador numa vez a mais — muito menor que
      # o preço de deixar passar um pendente. Fechado por padrão: qualquer `PROMPT-*.md` (maiúsculo,
      # a convenção real desta casa; variantes minúsculas como `prompt-diario.md` já caem nas
      # exclusões de pasta acima) sai da classe "só texto".
      */PROMPT-*.md) fora=1; break;;
    esac
    # Achado de 22/09 (rodada 26): o padrão acima é sensível a maiúsculas e só pega prefixo — mas
    # `docs/frameworks/TGM-v4.1-prompt-rapido.md` (minúsculo, "prompt" no MEIO do nome) passava
    # como "sim", mesmo se descrevendo como "Plug-and-play para LLM ou operador humano" (linha 6 do
    # próprio arquivo) e citado como referência operacional em `REGISTRO-CANONICO.md`. Comparar
    # caso a caso não fecha a classe — mesma lição das rodadas 13/17/23-25: qualquer `.md` com
    # "prompt" no nome, sem olhar maiúscula/minúscula nem posição, sai da classe "só texto".
    case "$(printf '%s' "$caminho" | tr '[:upper:]' '[:lower:]')" in
      */*prompt*.md|prompt*.md) fora=1; break;;
    esac
    # Caminho: só qualifica sob docs/**, memoria/**, ou sendo *.md em qualquer lugar (condição 1
    # do PLANO-MESTRE.md §5, texto literal). Um `.md` fora dessas pastas já é seguro por
    # definição (é texto), pula a checagem de formato abaixo — mas só depois de passar pelas
    # exclusões nominais acima, que valem mesmo sendo `.md`.
    # Pauta semanal do SOCIAL OS (decisão D9-B do operador, 14/10/2026: "você aprova uma vez a
    # mudança no robô da casa e nunca mais mergeia semana nem PR de texto"). A pauta é texto de
    # post em JSON (`vsl-studio/schema/pauta.schema.json`), um arquivo por post, que ninguém executa: o
    # `pauta.py publicar` só a lê e tira o bloco `leitura` antes de qualquer coisa sair. Entra só
    # o nome exato, na pasta exata de uma semana ISO (`social-os/semanas/AAAA-Www/pauta-*.json`),
    # e o `*` do `case` casa `/`, então a forma aninhada sai antes. Esquema, `AGENT.md`,
    # `schedule/` e qualquer outro `.json` do `social-os/` continuam fora.
    case "$caminho" in
      social-os/semanas/*/*/*) fora=1; break;;
      social-os/semanas/[0-9][0-9][0-9][0-9]-W[0-9][0-9]/pauta-*.json) continue;;
    esac
    case "$caminho" in
      docs/*|memoria/*) ;;
      *.md) continue;;
      *) fora=1; break;;
    esac
    # Achado de 22/09 (PR #963, rodada 12, REVERTIDO na rodada 19): esta exceção nominal para
    # `docs/legado/PACOTE-MENTOR-LEGADO-v1.1-face-operador.zip` confiava no CAMINHO, não no
    # conteúdo — eu conferi o conteúdo uma vez (rodada 12) e a exceção passou a valer para
    # sempre, mesmo que uma versão futura do mesmo caminho trocasse o conteúdo por código,
    # config ou instrução alterada (nada aqui inspeciona `.zip`, e a CI de doc não roda sobre
    # ele). `classificar_arquivos` só recebe o caminho, nunca o conteúdo — não há como fixar
    # num hash verificado sem reestruturar a função. Revertido: `.zip` volta a não estar na
    # lista branca de formato (não passa mais como "só texto"); este arquivo específico segue
    # existindo e é editável, só não entra mais na classe que mergeia sozinha.
    # Formato: achado de 22/09, 5 rodadas (6→11) — toda tentativa de EXCLUIR o que é perigoso
    # (extensão de código, depois +config/lockfile) deixou passar algo novo (`.html`, `.sql`,
    # `.css` sob docs/**, rodada 10; `.stl`/`.3mf` faltando na lista branca, rodada 11). Lista
    # negra nunca fecha. Lista **branca** de formato de documento conhecido — só isto entra;
    # qualquer extensão não listada aqui fica de fora por padrão, inclusive as que ninguém
    # pensou em nomear ainda.
    case "$caminho" in
      *.md|*.docx|*.pdf|*.csv|*.tsv|*.xlsx|*.pptx|*.txt|*.png|*.jpg|*.jpeg|*.gif|*.svg|*.webp|*.stl|*.3mf) ;;
      *) fora=1; break;;
    esac
  done <<< "$1"
  [ "$fora" -eq 0 ] && texto_medido="sim"
}
