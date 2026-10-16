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
   Google está em "Testando": para abrir a todos, preencher o Branding (página inicial, `/privacidade`, `/termos`) e
   publicar.
3. [ ] **Site**:
   - [x] nome público "Ninja Cursed Fight (NCF RPG)" (sem "Naruto": marca registrada; arte também sem personagens do
     anime);
   - [x] arte do Codex (banner, emblema, botão de jogar, vila organizada, luta, arena) e o mapa da região de um print;
   - [x] privacidade e termos em pt/en;
   - perfil público do jogador;
   - notícias e novidades;
   - origem `?ref=`.
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
