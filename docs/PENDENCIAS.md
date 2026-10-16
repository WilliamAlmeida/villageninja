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
- [x] Torre níveis 2 e 3: usam a mesma torre do nível 1 (base + topo com o vigia; pedido do autor, os bônus seguem por nível)
- [ ] Torres dos mapas temáticos (pescadores, deserto) em camadas
- [x] Residência do Kage nos 4 níveis (3×3, 3×3, 4×4, 5×5; scripts/building-art.py kage)
- [x] Lote 1: Academia, Hospital, Biblioteca (agora com arte nos 3 níveis) e Mercado; nível 3 com terreno maior (save v38)
- [x] Lote 2: Forja, Farmácia e Selos (as duas redesenhadas), Lenhador e Pedreira
- [ ] Lote 3: Mercado, Casa e Torre dos mapas temáticos (pescadores, deserto)
- [ ] Lote 4: Missões, Mina de Ferro, Horta, Porto, Inteligência, Marionetes, Canil; depois as decorações
- [ ] Refazer o resto das construções e decorações no padrão (gabarito v2, grade do boneco, paleta), em lotes com aprovação (`scripts/building-art.py`)
- [ ] Tirar o sistema de peça "por cima do vigia" (`LayoutPiece.over`) quando nenhuma torre usar mais (as em camadas não usam)

## 5. Sprites dos jutsus (levantamento de 2026-10-13)

Inventário dos 56 jutsus, artes existentes e prioridades: [jutsus-sprites.md](jutsus-sprites.md).
As caixas abaixo acompanham o trabalho; itens concluídos registram aprovação visual e commit.

- [x] Rasengan e Ōdama Rasengan — esfera compartilhada na mão, formação por escala, impacto animado e cratera temporária no chão (12/18 s). Ōdama usa as mesmas três imagens em 2×. Aprovado visualmente pelo autor em 2026-10-13 (73c11ca); prévia em `docs/arte/jutsus/rasengan/preview-impacto.html`.
- [x] Rasenshuriken — formação na mão, projétil com quatro lâminas giratórias, domo expansivo de 0,8 s (baixado +8 px no eixo Y) e cratera compartilhada ampliada (20 s). Aprovado visualmente pelo autor em 2026-10-13; prévia em `docs/arte/jutsus/rasenshuriken/preview.html`.
- [x] Chidori — formação baixa, corrida com a mão baixa, perfuração e dissipação; sem empurrão e sem partículas de água no impacto. Aprovado pelo autor em 2026-10-15 após revisão das referências.
- [x] Doryuuheki — muralha frontal, diagonal e perfil aprovados; registros de perfil e diagonal restaurados após regressão na configuração; três vistas deslocadas +7 px em Y. Aprovação do autor em 2026-10-15; integração original 3a50dcf.
- [x] Doryuudan — cabeça e lama aprovadas; afastamento visual da cabeça aumentado 12 px na direção do disparo. Aprovação do autor em 2026-10-15; integração original 3a50dcf.
- [x] Suna no Tate — barreira de areia aprovada. Aprovação do autor em 2026-10-15; integração original 3a50dcf.
- [x] Sabaku Kyū — casulo e fases de prisão aprovados. Aprovação do autor em 2026-10-15; integração original 3a50dcf.
- [x] Kirin — integrado em 2026-10-15: formação, cabeça descendente e descarga no chão em 0,8 s; mantém redução de força sem tempestade. Aprovado visualmente pelo autor (3de1e8b).
- [ ] Amaterasu e Susano'o — adiados por solicitação do autor em 2026-10-14.
- [x] Jukai Kōtan — integrado: raízes crescem, envolvem, permanecem e recuam pelo tempo da prisão. Aprovado visualmente pelo autor (3de1e8b).
- [x] Raikyuu — esfera elétrica em voo integrada e aprovada visualmente pelo autor (3de1e8b).
- [x] Chidori Nagashi — alinhamento Y entre os oito quadros corrigido em 2026-10-15: fundo da abertura central em referência fixa, dy final +9 px no laboratório; restaurado e sincronizado com o configurador/prévia em 2026-10-15. Prévia atualizada e montagem em `docs/arte/jutsus/raiton-mokuton/nagashi-alinhamento.png`; Aprovado pelo autor em 2026-10-15.
- [x] Yōkai — lava própria e impacto de 0,8 s integrados em 2026-10-15; Aprovado pelo autor em 2026-10-15. Prévia em `docs/arte/jutsus/lava-vento/preview.html`.
- [x] Daitoppa e Shinkuu Ha — rajada e lâmina integradas; artes aprovadas pelo autor em 2026-10-15.
- [x] Sekizō — substituído o leque/coluna por cinco socos sucessivos, canhões longos de ar comprimido e deslocamentos ao redor do alvo. Corrigido a partir da referência do autor em 2026-10-15; captura em `output/playwright/sekizo-canhoes.png`; Aprovado pelo autor em 2026-10-15.
- [x] Ajustes de contato e posicionamento aprovados pelo autor em 2026-10-15: frente física das sprites, impacto do Yōkai no chão, origem ajustável do Daitoppa e controles de todas as peças no laboratório. Auditoria em `docs/auditoria-projeteis.md`.
- [x] Kaiten — folha própria aprovada em 2026-10-15 e integrada: formação, seis quadros de rotação e dissipação, acompanhando o tempo do escudo; posição editável no laboratório.
- [x] Sōshiken, Gatsūga e Nikudan Sensha — implementação e resultado no jogo aprovados pelo autor em 2026-10-15: leões ligados aos punhos, uma broca no ninja e outra no ninken próximo durante a investida e bola de tecido neutro recolorida pela roupa externa do ninja; ajustes disponíveis no laboratório.
- [ ] Sensatsu, Reiza e Kajōsatsu — agulhas de gelo, feixes e esferas de calor.
- [ ] Kage Bunshin, Edo Tensei e Shousen — aparição, invocação e cura.
- [ ] Avaliar efeitos compartilhados de impacto, poeira, cortes e chakra para os golpes físicos restantes.

## Campos cercados (2026-10-16)
- [x] Fazenda em etapas: canteiros de formato livre, cultura por cercado, teto de canteiros, Horta vira cultura (save v49)
- [ ] Arte do Codex: folha 32×32 por cultura e etapa (semente, broto, crescendo, quase, maduro), chão do canteiro (cru,
      arado, úmido) e peças de cerca no losango (dois lados, cantos, portão); hoje é desenho provisório em `render/fields.ts`
- [ ] Espantalho (decoração que protege os canteiros dos corvos num raio) e poço/irrigação

## Fora da lista (só quando o autor pedir)
- "Preparar defesa" com prazo (adiado pelo autor).
- Testar `CODEX_MODEL=gpt-6-luna` nas imagens.
- ~~Ajuste de balanceamento~~ feito em 2026-10-11 (economia, XP, golpe comum, jutsus, lâminas, modos, ameaças); ver CLAUDE.md → Balanceamento.
