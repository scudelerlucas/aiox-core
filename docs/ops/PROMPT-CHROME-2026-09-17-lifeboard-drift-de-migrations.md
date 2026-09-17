# Missão — recuperar as 3 migrações que existem no banco e não no repositório

> **Para:** o Lucas, à mão (ou Claude on Chrome) · **Tempo:** ~4 minutos
> **Classe:** só leitura. Nenhum `insert`, `update`, `delete`, `alter` ou `drop`. Pode rodar em produção.
> **Volta para:** eu escrevo os arquivos de migração que faltam, a partir do que você colar de volta.

## O problema, em duas frases

Três migrações foram aplicadas direto no banco de produção e nunca viraram arquivo no repositório:
`fila_dia_e_dono_motivo_puro`, `fila_fechar_ultimo_dono` e `fila_motivo_literal_text`. Quem
reconstruir o banco a partir do repositório vai receber um banco **incompleto** — e o diagnóstico
`PASSO-0` vai dizer 20/20 verde assim mesmo, porque ele confere o que o repositório conhece e não
tem como sentir falta do que nunca foi escrito.

## NÃO FAÇA

- **Não edite, não salve, não apague nada.** A consulta é de leitura; nenhum botão de escrita.
- **Não rode nada fora do que está aqui.** Nem "Run" em aba antiga com outra consulta aberta.
- **Não cole valor de chave, segredo ou senha na resposta.** Esta missão não precisa de nenhum.
- Se aparecer erro dizendo que `supabase_migrations.schema_migrations` não existe: **pare e me
  conte** — quer dizer que este banco nunca teve histórico, e a conclusão muda.

## Passo a passo

1. **Abra o editor de SQL do projeto de produção:**
   `https://supabase.com/dashboard/project/hciiilopyivjaekaxfqp/sql/new`
   Confira no alto da tela que o nome do projeto é **`quiz-diagnosys`** — é esse mesmo, apesar do
   nome não citar o LifeBoard.

2. **Gere a consulta.** No repositório, rode:
   ```
   cd packages/lifeboard
   node scripts/gerar-conferencia-drift.mjs > supabase/aplicar/PASSO-0c-drift.sql
   ```
   Abra o arquivo `supabase/aplicar/PASSO-0c-drift.sql` e copie o conteúdo inteiro.
   *(O arquivo não é versionado de propósito: cópia velha da lista de migrações produziria alarme
   falso. Quem é versionado é o gerador.)*

3. **Cole no editor e clique em `Run`.** O resultado sai em até 5 linhas, com uma coluna `bloco`.

4. **Copie o resultado inteiro de volta para mim.** É o que eu preciso, e só isso:

   | Bloco | O que fazer com ele |
   |---|---|
   | `1. SO NO BANCO` | **É o achado.** Se a última coluna trouxer o SQL entre colchetes, é ele que vira arquivo de migração — me mande na íntegra, sem cortar. |
   | `2. SO NO REPOSITORIO` | Uma linha de resumo. Me mande também: ela diz quantas migrações não constam no histórico. |
   | `3. DUPLICADA NO HISTORICO` | Nome registrado duas vezes. Me mande. |

5. **Se o bloco 1 disser `banco nao guarda o SQL`**, me avise: significa que este banco usa uma
   versão antiga do histórico e o conteúdo terá de ser reconstruído por outro caminho (leitura do
   objeto no banco, não do histórico). Não tente adivinhar o SQL — eu também não vou.

## Critério de pronto

Você colou de volta as linhas dos três blocos, sem cortar a coluna do SQL, e sem nenhum segredo junto.
