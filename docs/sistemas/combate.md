# Combate, técnicas e inimigos

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- Inimigos especiais: animais ladrões (`thief` em `data/animals.ts`: corvo bica a fazenda, macaco rouba ryo/ervas e foge;
  o saque fica em `Unit.loot` e volta ao abater) e renegados com função (`Unit.role`, `data/enemies.ts`: bombardeiro
  derruba prédios pela metade, médico cura os aliados), que entram nas invasões por `raidRoles` (spawner.ts). Animais com golpe (`ability`): aranha (teia que prende,
  projétil com stun), tigre das sombras (`night`: só à noite, bote) e rinoceronte (investida que atropela e danifica prédio).
  Folha cuja silhueta engana a detecção de direção do prepare-art vai em `TRUST_FACING`.
  Renegados da 2ª leva: espião (`cloak`: `canHit` o ignora até torre/ninja com Inteligência alta o revelar; sabota e foge),
  marionetista (cria `role: 'puppet'` que desmontam se ele cair) e invocador (lobos com `ownerId` e `life`, sem recompensa).
  Chefes novos: Hidra (`heads`: ao zerar a vida perde uma e volta inteira) e Golem de Barro (`tier`: ao cair se divide em 2,
  até 7 pedaços; conta como chefe derrotado uma vez só), ambos em `killUnit` (combat.ts).
  Missões de caça das feras novas ficam no FIM de `MISSION_TEMPLATES` (o save guarda o índice); feras de missão usam o golpe
  especial em `guardHome`.
- **Arena do Exame redonda** (6×6, coliseu com portão na frente-esquerda; muro, portão e peças no layout.json; `game/arena.ts`): os dois do duelo ficam no círculo (`arenaRing`): Shunshin e Kawarimi
  só pousam dentro (`keepInRing`), a distância de luta cabe nele (`ringDesired`) e andar não tira ninguém; empurrado para
  fora por um golpe (`Unit.knockT`, setado em `push`) perde (ring-out, `systems/exam.ts`). Migração 23 desloca a arena que
  cresceu e encostou noutro prédio. **Plateia na arquibancada**: quem não luta anda até o chão logo abaixo do seu lugar
  (`arenaSpots.seat(i)`/`below`, pontos `seat1…8` do Editor de cenário ou um arco no fundo) e salta para ele (`takeSeat`,
  `Unit.perch` = id da arena); o renderer o desenha logo depois da peça mais ao fundo (a arquibancada), sem deixá-la
  transparente. Chamado para lutar ou fim do exame: desce (`leaveSeat`). **Vagas** 4 ou 8 no drawer da arena
  (`flags.examSize`, `setExamSize`).
- **Estratégia de luta** (`game/tactics.ts`): papel automático pelo atributo (`roleOf`: tanque, atacante, atirador,
  suporte = quem tem cura), com etiqueta no drawer e marca pequena na cabeça durante a luta; **duelos**: `pickFoe` escolhe o
  mais perto penalizando quem já está sendo enfrentado (o bolo vira lutas lado a lado) e o inimigo prefere o tanque
  (provocação); **tática da equipe** (`Team.tactic`, painel da equipe): livre, focar o mais forte, segurar posição
  (`anchor`), flanquear (`engageAdjust` no `engage`); formação pelo papel ao mover (`roleOffset`); afastamento leve entre
  aliados colados (`spreadSystem`, menu "Afastar aliados na luta", `flags.spread`). Legibilidade: anel vermelho em inimigo
  lutando, barra só de quem está ferido, dano somado no mesmo alvo (`fxDamage`, fonte menor). **Câmera de batalha**
  (`ui/battle.ts`): luta com 6+ mostra "Ver luta" (segue o duelo principal sem abrir drawer) e, com a câmera seguindo e
  nada selecionado, enquadra sozinha uma vez. **Momento especial** (`fxMoment`, efeito `moment`): técnica de Kage, Sannin,
  Ordem/Som ou jutsu proibido dá câmera lenta curta (main.ts), fundo escuro e o nome no centro (no máximo a cada 8 s).
- **Técnicas ninja** (`game/techniques.ts`, `systems/techniques.ts`, tudo automático): **Shunshin** (some num redemoinho e
  aparece adiante: chegar na luta, recuar quem luta de longe, fugir ferido; visual pela natureza em `flickerStyle`:
  água, areia (Terra), brasas (Fogo), raios em zigue-zague (Raio), riscos de vento (Vento); sem natureza, folhas (vila) / névoa (renegados); deixa um vulto `afterimage`), **Kawarimi** (golpe forte/fatal vira tronco, chance por
  Velocidade+Inteligência). **Ritmo do combate** (`state.pace`, menu): rápido = jutsu na hora; tático = selos antes
  (`Unit.cast`, `sealTime`), golpe ≥ `SEAL_BREAK` da vida ou atordoamento interrompe (taijutsu e cura sem selos).
  Investidas (Chidori) correm até o alvo (`Unit.dash`, `dashTick`). **Artes do Kage** (`data/kageArts.ts`,
  `ninja.kageArt`): por enquanto só o Hiraishin (kunai marca o alvo → `Unit.mark`; aparece no clarão e golpeia; ferido
  volta para a Residência); a lista foi feita para crescer.
- **Cuidado com os ninjas** (`game/care.ts`): XP do abate dividido (`noteHit`/`shareXp`: quem derrubou 100%, quem
  acertou 50%, equipe perto 25%); **Proteger novatos** (`flags.shelterRookies`, botão na lista de Ninjas): Genin se abriga
  de inimigo `CARE.danger`× mais forte (`fightPower`, sem usar nível) se houver Chunin+ em casa; **resgate** (`tryRescue`):
  com Hospital, quem zera a vida pode ir ferido para o Hospital em vez de morrer (chance por nível + médico perto);
  **recuperação de atraso** (`catchingUp`): 3+ níveis abaixo da média treina com XP em dobro. Invasões (`raidStrength`)
  seguem a força militar da vila (`villageMight`) mais que os dias.
- **Bestas com cauda (Bijuu)** (`data/bijuu.ts`, `game/bijuu.ts`, seção na aba Kage; arte `bijuu-1..9`, folhas de bicho do
  Codex): a Fera Colossal (chefe `titan`) é uma das nove, até o limite de caudas do nível da vila (`BIJUU_MAX_TAILS`,
  `pickBijuu` prefere as maiores e pula as que a vila já tem); vencida vai para o jarro (`state.bijuu.jar`) e o Kage sela
  num ninja de nível 12+ (`sealBijuu`): o Jinchuuriki (`NinjaInfo.bijuu`) veste o manto da fera quando a luta aperta.
  Jinchuuriki que cai solta a fera (`hostFell`). **Modos de combate** (`game/modes.ts`, `Unit.mode`, um por vez): manto
  da fera (mais dano por cauda, segura golpes, regenera; 4+ caudas soltam ondas de chakra; descontrolado, pegam aliados),
  Oito Portões (jutsu `hachimon`: muito dano e velocidade, a vida escorre) e manto de Raiton (jutsu `raitonyoroi`:
  rápido e esquiva). Bônus em `modeDamage/modeGuard/modeDodge/modeSpeed`; desenho: caudas de chakra (`bijuuTails`),
  aura pela silhueta (`sageGlow` com cores), vapor e raios. Laboratório: grupo "Bestas com cauda (manto)".
- **Dōjutsu** (`game/dojutsu.ts`; kekkei genkai de clã com `eye` em `data/kekkei.ts`, que agora pede condições
  `need`: natureza OU atributo ≥ `KEKKEI_STAT` num ninja do clã): **Sharingan** (fogo + Genjutsu alto) esquiva mais, copia o
  jutsu de rank baixo (até C, `DOJUTSU.copyMaxRank`) que um inimigo solta por perto (`sawJutsu` em `releaseJutsu` → `Unit.mirror`, devolvido uma vez por `mirrorCast` no
  `engage`; guarda UMA cópia por ninja em `NinjaInfo.seen`, a nova troca a anterior, e a aprende sem pergaminho nem natureza, `jutsuOptions`), Kanashibari,
  Amaterasu (efeito `ignite`: `Unit.burn`, chamas negras que queimam até apagar, `burnTick` no status) e Susano'o (modo
  `susanoo`: guerreiro de chakra roxo desenhado pela silhueta ampliada); **Byakugan** (Taijutsu + Inteligência altos) revela
  invisíveis por perto (`byakuganNear` em `spyRevealed`) e o Punho Gentil tira chakra a cada golpe (`gentleFist`); os golpes
  Hyuga (Kūshō, 64 Palmas, Kaiten, Sōshiken) exigem o Byakugan. Olhos acesos em combate (`Unit.eyeOn`, `eyeTick` no
  `modeTick`; brilho no rosto por `eyeGlints`). Vitrine: os dois primeiros clãs têm Sharingan e Byakugan. Laboratório: grupo "Dōjutsu".
- **Jutsus de clã do anime sem kekkei** (`game/mindJutsu.ts`): Kage Mane (efeito `shadow`: prende e o lançador fica
  parado segurando, `Unit.channel`; a sombra no chão é o efeito `tether` de `uid` até `tid`, desenhado no chão por
  `Renderer.drawTethers`), Shintenshin (`possess`: renegado comum passa para o lado do lançador, `Unit.charm`, e volta;
  chefe/organização resistem), Edo Tensei (proibido, `reanimate`: o caído mais forte de `state.fallen` volta por um tempo
  com pele cinza, `Unit.edo`/`lookId`, e se desfaz sem contar como perda). `state.fallen` (game/memorial.ts,
  `recordFallen` em killUnit/expedições/mapas) também alimenta a Pedra Memorial. Chidori Nagashi (`aoe` com `self`), Kirin
  (`sky`: efeito `thunder`, 60% da força sem chuva sobre o alvo), Ōdama Rasengan (`orbSize`), Suna no Tate e Sabaku Kyū
  (vfx `sand`).
- **Defesa proporcional** (`findThreat` em systems/ninjas.ts): um inimigo atrai no máximo `DEFEND_CAP` (4; chefe/organização 6)
  ninjas da vila; quem está colado nele (90 px) ou é o alvo dele sempre reage. Quem escolhe alvo conta na hora
  (`Game.noteEngaged`; a contagem é por passo). O Som chama só os `SOUND.chasers` (6) mais perto para perseguir quem carrega.
  Com o save do autor, ninjas atrás do Som: 78 → 14.
- Ninjas descansando (`rest`) ficam dentro do prédio (escondidos) e só saem para lutar com 60% de vida.
