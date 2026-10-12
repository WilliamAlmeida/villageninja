# Pendências (lista viva)

Tudo o que foi combinado com o autor e ainda falta. Marcar `[x]` ao terminar (com o commit) e não apagar a linha.
Origem: ideias dos mockups (`docs/arte/mockups`, análise de 2026-10-11) e a lista de jutsus aprovada.

## 1. Jutsus que faltam (aprovados)
- [x] Kage Mane (sombra que prende; Nara) (9ae9b56)
- [x] Shintenshin (troca de mente: o alvo luta pelo lado de quem usou por uns segundos; Yamanaka) (9ae9b56)
- [x] Chidori Nagashi (raio em volta do corpo, área curta que paralisa) (9ae9b56)
- [x] Kirin (raio do céu em área grande; precisa de tempestade/nuvem ou carrega muito) (9ae9b56)
- [x] Ōdama Rasengan (Rasengan gigante, área ao chegar) (9ae9b56)
- [x] Areia do Gaara: escudo de areia automático + Sabaku Kyū (caixão de areia que prende e esmaga) (9ae9b56)
- [x] Edo Tensei (proibido: traz de volta por um tempo um ninja caído da vila para lutar) (9ae9b56)

## 2. Cenário
- [x] Decorações (categoria nova na construção: pagode, santuários, lanternas, cerejeiras que florescem na
      primavera; felicidade em volta) (e36300d)
- [x] Ruas calçadas pintadas pelo jogador (ninjas e moradores andam mais rápido) (e36300d)
- [x] Monte dos Kages com um rosto por Kage que já passou (refeito como paredão de montanha a pedido do autor) (6178536)
- [x] Pedra Memorial com os nomes dos ninjas caídos (6178536)
- [x] Mapa jogável temático da Vila dos Pescadores (palafitas, cais, barcos, redes) + enfeites no Porto (d3ae338)
- [x] Mapa jogável temático da Cidade dos Mercadores (deserto, tendas, muralha, poço) (d3ae338)
- [x] Arte nova da ruína e da entrada da mina: as duas versões ficam no jogo (a editada pelo autor e a `-alt` do Codex);
      cada região do mapa sorteia uma
- [x] Penhascos e escadas (primeiro nos mapas jogáveis, ex.: prova do Monte dos Sapos) (33d2ef4)

## 3. Telas (dos mockups)
- [x] Ninjas: cartões em grade (retrato, patente, nível, vida, 2 jutsus) com a faixa da equipe/missão (d3ae338)
- [x] Ficha do ninja: barra de atributo com a cor de cada um; jutsus em cartões com selo de kanji; contrato em cartão (d3ae338)
- [x] Equipes: formação em cartões com retrato e vida; rotina/tática/ordens em botões (já estava no jogo)
- [x] Clãs: estandarte ilustrado com o emblema de cada clã (33d2ef4)
- [x] Missões: ilustração do alvo em cada contrato e recompensas em caixinhas (33d2ef4)
- [x] Kit 2 sem uso: linha de missão (`row`), rótulo com ponta de pergaminho, separador (`divider`) (33d2ef4)
- [x] Ícones de interface em pixel art: o autor decidiu manter os glifos como estão (2026-10-11)
- [x] Sharingan/Byakugan pintados nos retratos (bustos) (12fa127)
- [x] Bustos que reflitam a patente/roupa em camadas (12fa127)
- [x] Pose sentado/descansando (arquibancada do Exame, descanso, Hospital) (57f41d5)
- [x] Pose carregando (volta de expedição com espólio, raptado do Som) (57f41d5)
- [x] Peças novas: capa (do sensei, na cor da equipe) e pergaminho nas costas (quem está estudando) (57f41d5)

## 4. Padrão novo da arte isométrica (docs/design-arte-iso.md; piloto instalado em 2026-10-12 para o autor ver no jogo)
- [x] Autor conferir o piloto no jogo e nos editores (aprovado: "agora sim gostei")
- [ ] Autor limpar as rebarbas brancas que sobrarem
- [x] Mapa da vila 112×112 (era 72×48; save v36 centraliza a vila no mapa novo; missões seguem 72×48) e chão em blocos
- [ ] Autor conferir o mapa novo no save dele (costura do terreno nas bordas antigas, invasões vindo de mais longe)
- [ ] Marcar as preferidas em /paleta → `python scripts/palette-from-favorites.py` → aprovar a paleta → reaplicar no piloto
- [ ] Torre níveis 2 e 3 em camadas (base + topo) no mesmo padrão; torres dos mapas temáticos (pescadores, deserto)
- [ ] Refazer o resto das construções e decorações no padrão (gabarito v2, grade do boneco, paleta), em lotes com aprovação
- [ ] Tirar o sistema de peça "por cima do vigia" (`LayoutPiece.over`) quando nenhuma torre usar mais (as em camadas não usam)

## Fora da lista (só quando o autor pedir)
- "Preparar defesa" com prazo (adiado pelo autor).
- Testar `CODEX_MODEL=gpt-6-luna` nas imagens.
- ~~Ajuste de balanceamento~~ feito em 2026-10-11 (economia, XP, golpe comum, jutsus, lâminas, modos, ameaças); ver CLAUDE.md → Balanceamento.
