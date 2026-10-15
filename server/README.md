# Servidor do Vila Ninja (contas, retratos e duelos)

Bun + Postgres, no molde do `battlecard-server`. O jogo continua local (save no navegador); o servidor guarda só o que
é entre jogadores: conta, retrato do campeão, duelos, ELO e o relatório das defesas (docs/gdd-escala-ilhas-pvp.md,
seção 6).

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
| `GET /me` · `POST /me/name` | Conta, placar, retrato publicado, on-line / nome mostrado |
| `PUT /snapshot` `{code}` | Publica o retrato `VN1.` (decodificado com o `sanitize` do jogo; `power` = atributos × (nível + 5)) |
| `GET /duel/opponent[?not=id]` · `GET /duel/opponent/:id` | Sorteia adversário de força parecida (±30%, visto em 30 dias) / retrato de um jogador (revanche) |
| `POST /duel/start` `{opponentId}` | Abre o duelo (copia o retrato) e devolve `duelId` + `code` |
| `POST /duel/finish` `{duelId, won, summary}` · `POST /duel/cancel` | Resultado (ELO K32 atacante / K16 defensor) / apaga um duelo que não começou |
| `GET /duel/ranking` · `GET /duel/history` | Top 50 e a minha posição / meus últimos duelos |
| `GET /duel/defenses` · `POST /duel/defenses/seen` | Quem desafiou o meu retrato (e revanche pendente) / marca como visto |
| `GET /admin/overview` (header `X-Dev-Key`) | Números gerais para o dono |

Duelo aberto e largado (fechou o jogo) conta como derrota ao abrir o próximo. O resultado é do cliente (não há replay
determinístico entre motores JS, ver o GDD seção 8 item 3): o servidor só **sinaliza** o que é suspeito em
`summary.flags` (`fast` < 4 s, `weak-win`, `no-snapshot`), limita 30 duelos por hora por jogador (`TOO_MANY_DUELS`) e
lista os suspeitos para o dono em `GET /admin/suspicious` (e `duels.flagged7d` na visão geral).
