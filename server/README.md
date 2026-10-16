# Servidor do Vila Ninja (contas, duelos, site e equipe)

Bun + Postgres + Redis, no molde do `battlecard-server`. O jogo continua local (save no navegador); o servidor guarda só
o que é entre jogadores: conta, retrato do campeão, duelos, ELO e o relatório das defesas (docs/gdd-escala-ilhas-pvp.md,
seção 6). Também serve o **site público** e a API do **painel da equipe**.

## Endereços (mesma origem, pelo `scripts/live.ts` do jogo)

- `/play` é o jogo (build do `live.ts`); `/?demo`, `/?tela=…` antigos redirecionam para lá.
- `/`, `/ranking`, `/jogador/<id>`, `/novidades`, `/novidades/<slug>`, `/entrar`, `/privacidade`, `/termos` é o site em
  pt-BR; `/en`, `/en/ranking`, `/en/player/<id>`, `/en/news…`, `/en/sign-in`, `/en/privacy`, `/en/terms` em inglês (`src/site/`; nomes em inglês em `EN_SLUG`, `i18n.ts`). Nome público: **Ninja
  Cursed Fight (NCF RPG)**, sem "Naruto" (marca registrada). Contato das páginas legais: `CONTACT_EMAIL`. Arte do site em
  `site/img/`, gerada por `python scripts/site-art.py` a partir dos originais do Codex em `site/img/raw/` (fora do git). HTML pronto do
  servidor, guardado 60 s no cache; `site.js` (`site/`) faz a parte viva depois (quem está logado, on-line, botões
  de entrar e língua automática na primeira visita). Arquivos em `/site/…?v=<hash>` (cache de um ano); as ilustrações
  do jogo saem de `src/art/ui/art` em `/site/art/`.
- `/api/*` é a API abaixo.

Perfil público (`duels.publicProfile`): liga, pontos, posição, ataques/defesas, o campeão (patente, nível, natureza,
atributos; sem nomes de jutsus, que são do anime) e os duelos recentes; conta de teste ou banida dá 404. Novidades
(`services/news.ts`) são escritas no painel e saem com `renderBody` (parágrafos, `## `, `- `, `**negrito**`, links). A hora
de publicar é a do banco (`NOW()`): o relógio do Postgres no WSL anda um pouco atrás.

Origem (`services/source.ts`): o site e o jogo guardam no navegador o primeiro `?ref=` e o site anterior (`vn_ref`, 30
dias) e mandam ao criar o convidado ou a conta pelo Discord/Google (`users.ref`, `ref_host`, hosts agrupados: facebook,
youtube, tiktok…). O painel mostra em Público ("De onde vieram") e no detalhe do jogador.

## Cache (Redis)

`src/cache.ts`: `REDIS_URL` no `.env` (local: container `redis` do WSL, `redis://localhost:6379`; na VPS o Redis de lá).
Sem ele, ou se cair, tudo segue na memória do processo (tenta o Redis de novo a cada 30 s). Guarda páginas e números
prontos, limites de tentativas (`rl:*`), o estado do login (`oauth-state:*`, 10 min) e os bilhetes de vínculo
(`oauth-ticket:*`, 5 min). Prefixo `vn:` (testes: `vntest:`, apagado a cada rodada).

## Login com Discord e Google

`src/services/oauth.ts`, OAuth 2 com PKCE sem biblioteca. Cada provedor aparece só com `*_CLIENT_ID` e
`*_CLIENT_SECRET` no `.env`. Endereços de volta para cadastrar no app do provedor:
`<origem>/api/auth/discord/callback` e `<origem>/api/auth/google/callback` (uma por origem: `http://localhost:3010` e o
domínio público). O token volta no fragmento (`/play#vn_token=…`), lido pelo jogo (`ui/arenaClient.ts`) e pelo site.

- Convidado que entra liga o provedor à conta dele (bilhete de uso único, `POST /api/auth/link-ticket`) e vira conta
  cadastrada sem perder ranking nem retrato. Perfil já usado cai na conta dona dele; e-mail confirmado igual ao de uma
  conta existente liga nela; senão nasce uma conta nova.
- Apelido e senha continuam para quem já tem (o jogo só oferece criar quando nenhum provedor está ligado).

## Painel `/staff`

Casca estática (`src/site/index.ts`, `site/staff.js` + `staff.css`, `noindex`, sem cache) que entra com a conta do jogo
(token no localStorage, papel `mod`/`admin`; senão manda para `/entrar?next=/staff`). Telas por `#/`:
- **Visão geral:** cada quadro faz o seu pedido e mostra um esqueleto até chegar.
  - "Agora": on-line, ativos, contas, duelos, suspeitos.
  - "Por dia": barras de ativos, contas novas e duelos em 14/30/90 dias, com o retorno no dia seguinte e a tabela.
  - Público: países pela Cloudflare (`CF-IPCountry`; o IP não é guardado) e jeitos de entrar.
  - Suspeitos, Servidor (Redis/memória, banco, memória) e as últimas ações.
- **Jogadores** e o detalhe com ações.
- **Suspeitos**, **Avisos** e **Registro**.

Números por dia: `user_days` ganha uma linha por conta e dia ao usar o jogo (`accounts.fromToken`). O job
`startDailyJob` (`services/panel.ts`, só no `index.ts`) refaz hoje e ontem em `daily_stats` a cada 5 min, e os últimos 90
dias na subida. O painel só lê, então abre rápido com muitos jogadores.

Avisos (`services/notices.ts`): o jogo pergunta ao abrir e a cada minuto (só quem já tem conta na arena). Cada aviso
aparece uma vez, numa janela com o botão do link. Manutenção (`blockFrom` até `endsAt`) faz `POST /duel/start` responder
423 `MAINTENANCE`.

## Equipe (papéis)

`users.role`: `player`, `mod` ou `admin`. O painel (`/api/admin/*`) aceita uma conta `mod`/`admin` pelo token normal;
o `X-Dev-Key` (DEV_PASSWORD) fica como chave de emergência. Toda ação da equipe vai para `staff_actions`
(`services/staff.ts`, `GET /api/admin/log`). Primeiro admin: `ADMIN_EMAILS` no `.env` (e-mail confirmado no
Discord/Google vira admin ao entrar) ou `bun scripts/role.ts <apelido|e-mail|id> admin`.

## Subir

```bash
cd server && bun install && cp .env.example .env   # preencher DATABASE_URL (e TEST_DATABASE_URL para os testes)
bun run dev                                         # http://localhost:3012/api/health
```

- Banco: Postgres com os bancos `villageninja` e `villageninja_test` (no autor: container `postgres_16` do WSL, host
  5433). As tabelas são criadas no boot (`src/db.ts`, tudo `IF NOT EXISTS`; esquema novo = SQL idempotente lá).
- PM2 (raiz do jogo): `pm2 start ecosystem.local.config.cjs --only villageninja-server`. O `scripts/live.ts` e o
  `scripts/dev.ts` fazem proxy de `/api/*` para `ARENA_PORT` (3012): o jogo e a API saem pela mesma origem, inclusive
  pelo túnel Cloudflare.
- Testes: `bun test` (na raiz do jogo roda também `server/tests`; sem `TEST_DATABASE_URL` eles são pulados com aviso).

## API (`/api/...`, JSON; erros `{ error: CODIGO }`; sessão por `Authorization: Bearer <token>`)

| Rota | O que faz |
|---|---|
| `POST /auth/guest` | Conta de convidado + token (30 por hora por IP) |
| `POST /auth/register` `{username, password, email?}` | Convidado vira conta (argon2id) |
| `POST /auth/login` `{login, password}` · `POST /auth/logout` | Sessão nova da conta / apaga a sessão |
| `GET /auth/providers` | Provedores ligados (`[{id, name}]`) |
| `POST /auth/link-ticket` · `GET /auth/<discord\|google>/start?return=&ticket=` · `…/callback` | Login social (ver acima) |
| `POST /me/unlink` `{provider}` | Desliga um provedor (se sobrar outro jeito de entrar) |
| `GET /me` · `POST /me/name` | Conta, placar, retrato publicado, on-line / nome mostrado |
| `PUT /snapshot` `{code}` | Publica o retrato `VN1.` (decodificado com o `sanitize` do jogo; `power` = atributos × (nível + 5)) |
| `GET /duel/opponent[?not=id]` · `GET /duel/opponent/:id` | Sorteia adversário de força parecida (±30%, visto em 30 dias) / retrato de um jogador (revanche) |
| `POST /duel/start` `{opponentId}` | Abre o duelo (copia o retrato) e devolve `duelId` + `code` |
| `POST /duel/finish` `{duelId, won, summary}` · `POST /duel/cancel` | Resultado (ELO K32 atacante / K16 defensor) / apaga um duelo que não começou |
| `GET /duel/ranking` · `GET /duel/history` | Top 50 e a minha posição / meus últimos duelos |
| `GET /duel/defenses` · `POST /duel/defenses/seen` | Quem desafiou o meu retrato (e revanche pendente) / marca como visto |
| `GET /admin/whoami` · `GET /admin/overview` · `GET /admin/suspicious` · `GET /admin/log` | Equipe: quem sou, números gerais, duelos suspeitos, registro de ações |
| `POST /admin/role` `{userId, role}` | Só admin: troca o papel (registrado) |
| `GET /admin/kpis` · `/admin/daily?days=` · `/admin/audience` · `/admin/health` | Quadros da visão geral, um pedido por quadro (cache 30 s a 5 min; `daily` lê `daily_stats`) |
| `GET /admin/players?q=&filter=&sort=&page=` · `GET /admin/players/:id` | Lista (30 por página) e detalhe (identidades, placar, retrato, duelos, ações nela) |
| `POST /admin/players/:id/<rename\|note\|ban\|unban\|kick\|reset-rating\|test\|delete>` | Ações (todas registradas; moderador não age em conta da equipe; apagar só admin, com o nome para confirmar) |
| `GET/POST /admin/notices` · `PUT/DELETE /admin/notices/:id` | Avisos: tipo, tom, público, período, link e manutenção (`blockFrom`) |
| `GET/POST /admin/news` · `PUT/DELETE /admin/news/:id` | Novidades do site (rascunho ou publicada) |
| `GET /notices` · `POST /notices/:id/<read\|click>` | Jogo: avisos valendo para a conta (marca entregue) e a manutenção marcada |

Duelo aberto e largado (fechou o jogo) conta como derrota ao abrir o próximo. O resultado é do cliente (não há replay
determinístico entre motores JS, ver o GDD seção 8 item 3): o servidor só **sinaliza** o que é suspeito em
`summary.flags` (`fast` < 4 s, `weak-win`, `no-snapshot`), limita 30 duelos por hora por jogador (`TOO_MANY_DUELS`) e
lista os suspeitos para o dono em `GET /admin/suspicious` (e `duels.flagged7d` na visão geral).
