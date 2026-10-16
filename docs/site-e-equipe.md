# Site público, login e painel da equipe

Decisões do autor (2026-10-16) e ordem de trabalho. Detalhe técnico em `server/README.md`.

## Decisões

- O jogo fica em **`/play`**; a raiz é o site. `ninja.wmst.com.br` é endereço temporário.
- Site em **pt-BR (raiz) e inglês (`/en`)**, HTML pronto do servidor (rápido e indexável), com cache no Redis; o que
  muda por pessoa chega depois pelo `site.js`.
- Login com **Discord e Google**. O convidado continua existindo e vincula sem perder nada. Apelido e senha ficam só
  para quem já tem.
- **Painel da equipe** em `/staff`, com papéis (`mod`, `admin`) e o registro de toda ação. Nada de uma senha
  compartilhada: o `X-Dev-Key` vira só a chave de emergência.
- O painel não pode demorar para abrir. A casca abre na hora e cada quadro busca o seu dado ao mesmo tempo. Os números
  pesados ficam prontos em tabela, guardados no Redis.
- Para jogar é preciso passar por `/entrar` e escolher convidado (temporário), Discord ou Google. Ranking só para quem
  tem conta. O jogo não abre janela nenhuma ao entrar (o tutorial, quando existir, é que guia).
- Arte do site com referência do próprio jogo (prints do autor em `server/site/img/screenshots`, bustos e sprites):
  vila e arena são prints reais; emblema, defesa e duelo são do Codex no estilo dos sprites. Referências ao anime podem
  ficar na página por enquanto.
- Os "eventos leves" do jogo (marcos de progresso enviados ao servidor) ficam para depois.
- Do painel do battlecard vale copiar:
  - painel carregado sob demanda;
  - `is_test` fora dos números;
  - país pelo IP com base local, sem guardar IP, e "provável VPN" pelo fuso;
  - origem (`?ref=` e referrer);
  - avisos com público e janela de tempo, bloqueio de manutenção e entregue/lido/clicado;
  - limpeza com prévia.
- Do battlecard não copiar:
  - senha única;
  - visão geral que conta tudo a cada abertura;
  - limite de tentativas na memória.

## Ordem

1. [x] **Fundação**:
   - jogo em `/play`;
   - Redis com volta para a memória;
   - limites de tentativas no Redis;
   - papéis;
   - `user_identities`;
   - `staff_actions`;
   - login Discord/Google com vínculo ao convidado;
   - aba Conta do jogo;
   - esqueleto do site: início, ranking e entrar, em pt/en.
2. [x] **Apps OAuth**: "NCF RPG" no Discord e no Google (projeto `ncf-rpg`), IDs e segredos no `server/.env`. O app do
   Google está **em produção** desde 2026-10-16 (Branding com página inicial, `/privacidade`, `/termos` e o domínio
   `wmst.com.br`; só escopos básicos, então não precisa de verificação). Logo na tela de consentimento exige verificação:
   não foi enviado. Trocar o domínio temporário = atualizar Branding e os endereços de volta nos dois apps.
3. [x] **Site**:
   - [x] nome público "Ninja Cursed Fight (NCF RPG)" (sem "Naruto": marca registrada; arte também sem personagens do
     anime);
   - [x] arte do Codex (banner, emblema, botão de jogar, vila organizada, luta, arena) e o mapa da região de um print;
   - [x] privacidade e termos em pt/en;
   - [x] perfil público do jogador (`/jogador/<id>`, ligado do ranking);
   - [x] novidades escritas no painel (`/novidades`, três mais novas no início);
   - [x] origem `?ref=` e site anterior, gravados na conta e mostrados no painel.
4. [x] **Painel `/staff`** (detalhe no `server/README.md`):
   - visão geral por quadros, com `daily_stats` feita por um job;
   - jogadores: busca, detalhe e ações (banir, renomear, derrubar sessões, zerar ELO, anotar, papel);
   - duelos suspeitos;
   - avisos com manutenção;
   - registro de ações;
   - país pela Cloudflare (`CF-IPCountry`), sem base de IP nem IP guardado.
5. [ ] Depois:
   - save na nuvem para quem tem login;
   - temporadas de ranking;
   - eventos de progresso.
