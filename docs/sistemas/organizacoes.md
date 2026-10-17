# Organizações, títulos e lâminas lendárias

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- **Ordem das organizações (história)**: Som (Vila Oculta) → Espadachins (depois da 1ª invasão do Som, `swordsmenAwake`) →
  Eclipse (depois da 1ª dos Espadachins, `swordsmen.raids`); uma organização por vez no mapa; todas voltam sempre.
- **Lâminas lendárias** (`data/blades.ts`, `game/blades.ts`): itens de arma únicos (`blade-<id>`, `ItemDef.blade`), cada um
  com o efeito do anime em combate (`bladeHit`/`bladeMult`/`bladeDefense` em `applyDamage`, alcance/ritmo em `meleeStats`,
  Raijin em `bladeTick`). `state.blades` = as que a vila já conseguiu (`grantBlade`); quem cai com uma, ela volta ao
  estoque (`recoverBlades`, sistema `legends`). Origem: as 7 da Névoa (Espadachins), Kusanagi (Sannin das Serpentes), Sete
  espadas (explorar a Ilha Vulcânica), Sabre de Chakra/Lâminas do Asuma/Raijin (Forja nível 3, `minBuildingLevel`,
  `craftBlock`; Raijin `kageOnly`). Sem "Manter" nem lote.
- **Espadachins da Névoa** (`data/swordsmen.ts`, `game/swordsmen.ts`, `state.swordsmen`): da Vila Oculta em diante invadem
  em dupla com escolta (`swordsmenTick`), caçam ninjas em vez de roubar (`swordsmanPrey`). Só UMA espada por invasão: o
  primeiro derrubado cai e deixa a lâmina (`swordsmanFall` em `killUnit`); os outros, derrubados, caem de vez (ryo) ou, com
  `fleeChance` (30%), somem na névoa (cloak + fuga) e voltam. Espadachim cuja espada já é da vila vem sem ela e, com
  `henchChance` (50%), a invasão traz `hench` (2–4) capangas a mais. Tomadas as sete, continuam vindo atrás delas (o primeiro derrubado cai e dá ryo). Sprite montado como ninja com a lâmina (`swordsmanPortrait`). Ordem do Eclipse, Espadachins e
  Quinteto do Som ficam na aba **Bingo Book** da janela Vila (`View 'bingo'`); a aba Kage tem o Kage, a ANBU e os Sannin
  No Bingo Book todos aparecem pelo sprite (`artPortrait(org-<id>, true)` / `swordsmanPortrait`), num padrão só (os bustos
  pintados da Ordem saíram; o atlas dos selos é `badge-ranks.png`); `.bingo` deixa todos os cartões com a mesma altura).
- **Quinteto do Som** (`data/sound.ts`, `game/sound.ts`, `state.sound`, arte `sound-<membro>` via `scripts/sound-sprites.sh`):
  da Vila Oculta em diante, 4 membros invadem para RAPTAR um ninja (`soundTarget`: nunca Kage nem Sannin; em geral o mais
  talentoso — kekkei genkai, nível, atributos —, mas `SOUND.pickTop` 30% um dos 5 mais talentosos e `pickAny` 30% um
  qualquer, senão no fim de jogo nunca davam conta). `soundBrain` (hostiles): vão atrás dele (até dentro de casa), um carrega
  (`Unit.carrying`/`captiveOf`; o raptado não é alvo, `canHit`) e foge devagar levando o dobro de dano, os outros cobrem e
  os ninjas da vila por perto recebem ordem de atacar quem carrega. Matam no máximo `SOUND.maxKills` (4) por invasão; dali em
  diante o golpe deles NOCAUTEIA (`soundKnockout`, `raid.kills`). Impedido: recompensa e honra. Levado: fica `away = WITH_SOUND`, o nó `som` (Esconderijo do Som) aparece na
  Região com prazo (`SOUND.rescueDays`); ação `rescue` abre `createSoundScene` (líder Hakkotsu + 2). Passou o prazo: selo
  amaldiçoado (`cursed`, vira inimigo mais forte e vem nas invasões; derrotado, volta para a vila, `cursedDefeated`).
  Voltam sempre (não acabam). Seção no Bingo Book com o placar.
- **Ordem do Eclipse** (`data/org.ts`, `game/org.ts`, `systems/org.ts`, arte `org-<membro>`): 8 membros com técnica
  própria (`useArt`: Inferno, Corpo de Ferro –50% dano, Prisão d'Água, Trovão Veloz, Miragem, Mortos-vivos, Ninho,
  Repulsão). Da Vila Oculta em diante as 3 duplas atacam a cada 4–6 dias e caçam o ninja mais forte (`orgBrain`; caça
  em `Unit.life`, depois recuam). Quem cai entra em `state.org.down`; caídas as duplas, o covil aparece na
  Região (nó `covil`, ação `assault`) e a Ordem recruta membros novos (`regroup`, `org.cycle`: +30% de vida por volta até `ORG.cycleMax` = 5, `cycleHpMult`; sem teto, no dia 599 a 20ª volta tinha
  vida ×7 e a dupla não caía);
  covil destruído (`org.wins`), ela some `ORG.restDays` e se reergue do zero. Vida cresce com a quantidade de Jounins da vila. Seção na aba Kage.
- **ANBU** (`game/anbu.ts`, seção na aba Kage): o Kage nomeia Chunins/Jounins (Torre de Inteligência; vagas pelo nível da vila, `ANBU.slots` 3/3/5/8: no nível
  máximo uma por máscara); saem das
  equipes comuns e só formam equipe entre si (`teamKind`/`teamFit` em teams.ts: o Kage não tem equipe, ANBU só com ANBU,
  Sannin só com Sannin; `enforceTeamRules` roda na automação e no "Montar" e conserta saves antigos);
  a máscara é escolhida ao nomear (`NinjaInfo.mask`, qualquer animal) e dá +1 no atributo que ela representa (`maskKey`). Invisíveis (`cloak`) só com inimigo à vista (`ANBU.alert`) e até atacar — emboscada (`anbuAmbush`) —, ficam na
  rua à noite patrulhando, revelam espiões como o espião da vila e acodem o Kage com Shunshin (`anbuTick`). Missão secreta
  na Região: ação `covert` (`startCovert`, expedição com `teamId -1`): metade do saque sem infâmia se não forem descobertos.
- **Os Três Sannin** (`data/sannin.ts`, `game/sannin.ts`, seção na aba Kage): título para até 3 Jounins nv 20+ (um por
  caminho: sapo/serpente/lesma) com contrato do animal (invoca mais), teto de atributo 10 (`statCapOf`) e técnica
  lendária: Modo Sábio (`Unit.sage`, +40% dano/+30% velocidade; visual: contorno de energia laranja seguindo a silhueta do sprite, `solidArt` em
  `sageGlow`, e chamas subindo pelas bordas, `sageWisps`), Troca de Pele (`sanninSurvive`), Selo da Força de Cem.
  **Caminho do Jounin**: ANBU **ou** Sannin (um bloqueia o outro em `anbuBlock`/`sanninBlock`) e depois Kage, que deixa
  os dois (`crownKage` → `leaveSannin`: sai o título e a técnica, a vaga do caminho abre; o contrato do animal fica).
  Save v51 conserta: Kage que era Sannin perde o título; ANBU e Sannin juntos fica só Sannin. Selo do cartão
  (`rankKey`/`rankName`): Kage > Sannin > ANBU > patente. Clone (Kage Bunshin, marionete) leva a ficha do dono mas não
  conta como Sannin, ANBU nem Jinchuuriki (`kind === 'ninja'` nas listas).
