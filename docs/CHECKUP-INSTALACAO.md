# Checkup da Instalação — Diziline

Guia de implantação de uma paróquia nova, com a distinção clara entre **o que é automático**
(rodado pelo sistema, pelas migrations ou pela página `/admin/checkup`) e **o que é manual**
(feito por você no Supabase, Cloudflare ou no painel do provedor de pagamento).

A página `/admin/checkup` (acesso restrito a **super admin**) executa os testes automáticos e
repete a lista de procedimentos manuais dentro do próprio sistema. Nenhum teste grava dados,
dispara e-mail/push real ou gera cobrança.

---

## 1. Visão geral da sequência

| # | Etapa | Tipo | Onde |
|---|-------|------|------|
| 1 | Criar projeto Supabase | Manual | app.supabase.com |
| 2 | Aplicar migrations | Semi-automático | `supabase db push` |
| 3 | Criar super admin | Manual + função SQL | Auth Users + SQL Editor |
| 4 | Configurar segredos | Manual | Supabase → Edge Functions → Secrets |
| 5 | Deploy das Edge Functions | Semi-automático | `supabase functions deploy` |
| 6 | Agendar cron jobs | Manual | SQL Editor (pg_cron) |
| 7 | Publicar front-end | Manual | Cloudflare Pages/Workers |
| 8 | Registrar webhook do gateway | Manual | Painel do provedor |
| 9 | Identidade visual | Manual (no app) | `/admin/configuracoes` |
| 10 | Client Local (totem) | Manual | PC do totem |
| 11 | Transação sandbox ponta a ponta | Manual | Totem + app |
| 12 | Validação final | **Automático** | `/admin/checkup` |

---

## 2. Procedimentos manuais — detalhado

### 1. Criar o projeto Supabase
Cada paróquia usa **um projeto Supabase próprio**. É isso que garante isolamento total de dados,
gateways independentes e conformidade com a LGPD. Anote: `Project URL`, `anon/publishable key`,
`service-role key` e o `project ref`.

### 2. Aplicar as migrations

**2.1 Instalar e autenticar a CLI (só na primeira vez, no SEU PC — não no Lovable)**
```bash
# macOS
brew install supabase/tap/supabase
# Windows / Linux
npm i -g supabase

supabase --version     # confirme que responde
supabase login         # abre o navegador para autorizar
```

**2.2 Ligar o repositório ao projeto novo**

Na raiz do repositório (a pasta que contém `supabase/`):
```bash
supabase link --project-ref <REF_DO_PROJETO>
```
- O `REF` está em **Supabase → Settings → General → Reference ID** (também aparece na URL do
  dashboard: `app.supabase.com/project/<REF>`).
- A CLI vai pedir a **senha do banco** (a que você definiu ao criar o projeto). Se esqueceu:
  **Settings → Database → Reset database password**.
- O link grava o ref em `supabase/.temp` — para trocar de paróquia, rode `supabase link` de novo
  com o outro ref.

**2.3 Rodar as migrations**
```bash
supabase db push            # aplica tudo que falta
supabase migration list     # confere local x remoto (todas devem aparecer nos dois lados)
```
As migrations em `supabase/migrations/` estão em ordem cronológica e criam **tudo**: tabelas,
enums, políticas de RLS, GRANTs, funções e triggers. Nada precisa ser executado à mão.
Se o push falhar no meio, corrija e rode de novo — as migrations são aplicadas em sequência e
o Supabase retoma da última bem-sucedida.

Problemas comuns:

| Mensagem | O que fazer |
|---|---|
| `failed SASL auth` / senha incorreta | Resete a senha do banco e refaça o `supabase link`. |
| `must be owner of relation` no trigger de `auth.users` | Esperado em alguns projetos; a migration captura o erro. Crie o trigger pelo SQL Editor depois, se o cadastro de usuário não criar o perfil. |
| `remote migration versions not found` | `supabase migration repair --status reverted <versão>` e repita o push. |

### 3. Criar o super admin
1. **Authentication → Users → Add user** (com senha, e-mail confirmado).
2. No **SQL Editor**:
```sql
select public.setup_nova_paroquia(
  'email@paroquia.org.br',
  'Paróquia Nossa Senhora ...',
  '00.000.000/0001-00',
  'https://site-da-paroquia.org.br'
);
```
A função promove o usuário a `super_admin` e semeia: configuração da paróquia, configuração de
gateway (desativada), configuração de TEF (desativada), comunidade "Matriz", categorias de
contribuição e mensagens padrão do totem. É idempotente — rodar duas vezes não duplica nada.

> Sem super admin ninguém acessa Configurações, Totens, Diagnóstico, Auditoria e Checkup.

### 4. Configurar os segredos
Em **Settings → Edge Functions → Secrets**:

| Segredo | Para quê |
|---|---|
| `CARTEIRINHA_HMAC_SECRET` | Assina o QR Code da carteirinha. **Gere um valor novo por paróquia** — reaproveitar permitiria que um QR de outra instalação fosse aceito aqui. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Notificações push (iOS e Android). |
| Segredo de webhook do gateway | Validação HMAC das notificações de pagamento. |
| Credenciais do provedor | Client ID/secret ou API key do Rede/Sicredi/Pagar.me. |

Nenhum desses valores vai para o repositório nem chega ao navegador — são lidos apenas dentro
das Edge Functions.

**4.1 Gerar o segredo da carteirinha**
```bash
openssl rand -hex 32
```

**4.2 Gerar as chaves VAPID (push)**
```bash
npx web-push generate-vapid-keys
```
Saída:
```
Public Key:  BB1x... (87 caracteres, base64url)
Private Key: k3Jd... (43 caracteres, base64url)
```
- `VAPID_PUBLIC_KEY` = Public Key
- `VAPID_PRIVATE_KEY` = Private Key
- `VAPID_SUBJECT` = `mailto:contato@paroquia.org.br` (precisa do prefixo `mailto:`)

O par é **fixo para a instalação**: se você trocar as chaves depois, todas as inscrições push
existentes deixam de funcionar e cada fiel precisa reativar a notificação no app.

**4.3 Salvar os segredos**

Pelo painel: **Settings → Edge Functions → Secrets → Add new secret** (um por vez, sem aspas
e sem espaços em volta do valor).

Ou pelo terminal:
```bash
supabase secrets set \
  CARTEIRINHA_HMAC_SECRET=<valor-do-openssl> \
  VAPID_PUBLIC_KEY=<public> \
  VAPID_PRIVATE_KEY=<private> \
  VAPID_SUBJECT=mailto:contato@paroquia.org.br

supabase secrets list   # confere os nomes (valores nunca são exibidos)
```

> Se você alterar um segredo depois do deploy, rode `supabase functions deploy` de novo para as
> funções relerem os novos valores.

### 5. Deploy das Edge Functions
```bash
supabase functions deploy              # todas de uma vez
supabase functions deploy totem-config # ou uma específica
```
Verificações rápidas:
```bash
supabase functions list                # todas devem aparecer como ACTIVE
curl -s -X POST https://<REF>.supabase.co/functions/v1/totem-config \
  -H "Content-Type: application/json" -d '{}'
```
Depois volte ao `/admin/checkup` — o bloco **Edge Functions** confirma que cada função responde,
e o bloco **PWA e notificações** confirma que as VAPID pegaram. Em `/admin/configuracoes` use o
botão de **push de teste** para validar no seu próprio celular (iOS exige o app na Tela de Início).

### 6. Agendar os cron jobs
Os agendamentos **não** estão nas migrations (dependem de `pg_cron` habilitado e da URL/keys do
projeto). No SQL Editor, habilite as extensões e crie os jobs (horários em UTC — 3h da manhã em
Brasília = `0 6 * * *`):

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'enviar-push-notificacoes', '0 11 * * *',
  $$ select net.http_post(
       url     := 'https://<REF>.supabase.co/functions/v1/enviar-push-notificacoes',
       headers := '{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
       body    := '{}'::jsonb
     ); $$
);
```
Repita trocando o nome/rota para `enviar-email-aniversario` e `enviar-lembrete-pagamento`.

Conferência:
```sql
select jobid, jobname, schedule, active from cron.job;
select * from cron.job_run_details order by start_time desc limit 20;
```
Para corrigir um job existente, rode `select cron.unschedule('<nome>');` e agende de novo.

Sem esse passo, o app funciona normalmente, mas **nada é disparado automaticamente**.


### 7. Publicar o front-end
No Cloudflare, configure como variáveis de build:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
O domínio final precisa estar em **HTTPS** — é requisito de PWA e de push.

### 8. Registrar o webhook no provedor
Aponte o webhook do provedor para a função `webhook-pagamento` e cadastre **o mesmo segredo**
salvo no passo 4. A função recusa qualquer notificação sem assinatura HMAC válida, então os dois
lados precisam ter valores idênticos.

### 9. Identidade visual
Em `/admin/configuracoes`: logo do app, logo térmico (impressora), logo da carteirinha, cores,
slogan, CNPJ, endereço, telefone e o layout do comprovante (campos visíveis e corte da guilhotina).

### 10. Client Local (totem com impressora e PINPad)
1. Gere um token em `/admin/diagnostico` → **Tokens do Client Local**.
2. Copie a pasta `client-local` para o PC, `npm install`.
3. Coloque o token no `.env` como `API_TOKEN=...` e ajuste `CORS_ORIGIN` para o domínio publicado.
4. Rode o wizard do client no navegador para detectar impressora e PINPad.
5. Valide em `/admin/diagnostico`: impressão de teste e handshake do PINPad.

### 11. Transação de ponta a ponta em sandbox
Com o gateway em **sandbox**, faça um PIX e um cartão e confirme:
pagamento marcado como pago → mês verde no calendário do dizimista → comprovante impresso →
registro no histórico e na auditoria. Só depois troque o ambiente para produção.

---

## 3. Testes automáticos — o que cada um valida

Acesse **`/admin/checkup`** e clique em **Rodar todos os testes** (ou teste item a item).
Clique no nome de cada teste para ver a explicação dentro do próprio app.

### Banco de dados
- **Conexão com o Supabase** — URL e chave publicável corretas no build.
- **Configuração da paróquia criada** — existe linha em `configuracoes_paroquia` com nome.
- **Existe ao menos um super admin** — há registro `super_admin` em `user_roles`.
- **Dados iniciais** — comunidades e categorias de pagamento semeadas.
- **Configuração de gateway e TEF** — linhas existem e mostram provedor/estado.

### Funções SQL (RPC)
- `get_paroquia_publica`, `get_tema_paroquia`, `get_loja_config`, `get_dashboard_resumo`,
  `get_gateway_metrics`. Falha aqui = migration não aplicada ou `GRANT EXECUTE` ausente.

### Storage
- Buckets `logos-termicos`, `banners-campanhas`, `produtos`, `avisos-totem` e
  `avatares-paroquianos` presentes — e o de fotos precisa continuar **privado**.

### Edge Functions
- `totem-config` — a mais simples; se falhar, provavelmente nenhuma função foi deployada.
- `rede-gateway (test-connection)` — só handshake de credenciais, **não cria cobrança**.
- `tef-gateway` — ponte com a maquininha; aviso é esperado se o TEF estiver desativado.
- `carteirinha-verificar` — envia token inválido de propósito; a recusa prova que está no ar.
- `push-subscribe` — depende dos segredos VAPID.

### Realtime
- Inscrição no canal de `pagamentos` — é o que faz o calendário do dizimista e o painel admin
  atualizarem sozinhos. Exige a tabela publicada em `supabase_realtime`.

### PWA e notificações
- **Service Worker registrado** — obrigatório para instalar o app e receber push (exige HTTPS).
- **Permissão de notificação** — estado no dispositivo atual. No iOS só funciona depois de
  adicionar o app à Tela de Início. O teste apenas informa, não pede permissão.

---

## 4. Leitura dos resultados

| Estado | Significado |
|---|---|
| **OK** | Item pronto para produção. |
| **Atenção** | Funciona, mas depende de configuração pendente (ex.: gateway ainda inativo, push não autorizado no aparelho). |
| **Falhou** | Bloqueia a operação — resolva antes de abrir para os dizimistas. |
| **Não testado** | Ainda não executado nesta sessão. |

Regra prática para liberar produção: **zero "Falhou"**, e cada "Atenção" com justificativa
conhecida (módulo desativado de propósito, por exemplo).
