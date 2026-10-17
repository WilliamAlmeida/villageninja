# Combate, técnicas e inimigos

> Detalhe movido do CLAUDE.md (o índice fica lá). Mantenha atualizado ao mexer no sistema.

- Inimigos especiais: animais ladrões (`thief` em `data/animals.ts`: corvo bica os canteiros maduros dos campos cercados, macaco rouba ryo/ervas e foge;
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
  cresceu e encostou noutro prédio. **Arena fechada no Exame/duelo** (`arenaFence`): o caminho de quem não participa
  (moradores e ninjas fora do combate) não entra no terreno dela e destino lá dentro falha (`setDestination` passa a cerca
  ao A*); `clearArena` (systems/exam.ts, a cada 0,5 s) tira quem está dentro e refaz a rota de quem cortava por ela.
  **Plateia na arquibancada**: quem não luta anda até o chão logo abaixo do seu lugar
  (`arenaSpots.seat(i)`/`below`, pontos `seat1…8` do Editor de cenário ou um arco no fundo) e salta para ele (`takeSeat`,
  `Unit.perch` = id da arena); o renderer o desenha logo depois da peça mais ao fundo (a arquibancada), sem deixá-la
  transparente. Chamado para lutar ou fim do exame: desce (`leaveSeat`). **Vagas** 4 ou 8 no drawer da arena
  (`flags.examSize`, `setExamSize`).
- **Duelo por retrato** (2026-10-15, docs/gdd-escala-ilhas-pvp.md 6.2; `game/snapshot.ts`, `game/duel.ts`): o retrato
  (`snapshotOf` → `encodeSnapshot`: texto `VN1.` + base64url do JSON com nome, visual, patente, natureza, nível,
  atributos com duas casas, jutsus, kekkei, equipamento/lâmina, contrato, profissão, Sannin, Bijuu, ANBU, arte do Kage,
  clã só para mostrar) é copiado no drawer da Arena ("Copiar retrato", área de transferência + textarea) e colado por
  outro jogador ("Desafiar retrato"). `decodeSnapshot`/`sanitize` desconfiam de tudo: ids conferidos nos dados, atributos
  presos a `RANKS[rank].statCap`, nível ≤ `SNAPSHOT_MAX_LEVEL` (60), nome só com letras/números, cores `#rrggbb`.
  `startDuel` cria o convidado (`unitFromSnapshot`, facção `guest`, nome "(convidado)") sentado na arquibancada e abre um
  Exame de um par com `Exam.duel`: a máquina de systems/exam.ts faz caminhada, "VS", luta, ring-out e tempo; `finishExam`
  desvia para `finishDuel` (XP 40/15, `stats.duelsWon/duelsLost`, `state.lastDuel`; sem promoção, sem `examNextDay`,
  sem `lastExam`). Campeão escolhido em `flags.duelistId` (`setDuelist`; padrão o mais forte livre, `duelist`). Exame e
  duelo se excluem na arena (`examStatus`/`duelBlock`). O convidado senta olhando para a frente da tela (`facing` π/4); o
  sensei e os colegas de equipe do campeão largam o que faziam (treino, estudo, casa...) e vão para `Exam.watchers`,
  assistindo da arquibancada (`arenaSide` 0, lugares depois dos dois duelistas) até `finishDuel` soltá-los; só fica de
  fora quem está lutando (`fight`/`flee`/`ko`) ou em missão/expedição, e esses não seguem o líder até a arena
  (`followLeader` ignora líder com `arenaSide`). A luta espera todos sentarem, plateia inclusive, até `DUEL_GATHER` (30 s). Fim da luta (nocaute, tempo ou ring-out): "Fim da luta!",
  fase `bow` — os dois voltam ao seu canto (`left`/`right`, até 7 s), viram-se um para o outro com "Vitória!"/"Derrota"
  sobre a cabeça e ficam 2,2 s no estado `bow` (pose `cast` quadro 1, mãos juntas, em sprites.ts) antes do `finishDuel`. Ao começar o duelo a janela
  fecha e a câmera vai para a arena (`watchDuel`); "Abrir Duelos" no drawer da Arena fecha o drawer. Save v47. Testes em tests/duel.test.ts.
  **Janela Duelos** (dock "Duelos", tecla D; `ui/panel.ts` `duelsWindow`, abas Duelo/Ranking/Defesas/Conta; o drawer da
  Arena só tem o botão "Abrir Duelos"): `ui/arenaClient.ts` fala com o servidor em `server/` (README lá) pela mesma
  origem (`/api/*`, proxy em `scripts/apiProxy.ts`): convidado automático (token no localStorage, nunca no save),
  "Publicar retrato", "Procurar adversário" (força parecida) → "Lutar" abre o duelo no servidor e chama `startDuel` com
  o retrato recebido (`arena.pending`, guardado no localStorage; se `startDuel` falhar, `cancel`); `arena.tick` (laço da
  interface) vê `state.lastDuel` mudar e manda `finish` (ELO K32/K16, `lastOnline`). Ranking (top 50 + posição),
  Defesas (quem desafiou o meu retrato; Revanche busca o retrato dele) e Conta (nome, apelido + senha, entrar em outro
  aparelho; formulários em `showAlert`, porque a janela remonta). Sem servidor: "Sem conexão" e o copiar/colar manual
  continua. Vitrine: `?demo&tela=duels`.
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
  `pickBijuu` prefere as maiores e pula as que a vila já tem; enquanto houver fera solta, `bijuuFree`, a Fera ganha
  `BIJUU_FREE_WEIGHT` = +0,4 no sorteio dos chefes: no nível 3 vira 1 chefe em 6, uma a cada ~30 dias, em vez de ~40); vencida vai para o jarro (`state.bijuu.jar`) e o Kage sela
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

## Impacto visual do Rasengan e Ōdama

No contato da investida, `dashTick` chama `rasenganHitFx` (`game/rasenganFx.ts`): descarga animada de 0,5 s e
efeito `crater` no chão, com duração de 12/18 s. Investida cancelada, sem alvo ou bloqueada não cria marca.
Rasengan mantém dano em um alvo; Ōdama mantém o dano em área configurado no catálogo. A cratera é cosmética,
não muda tiles nem colisão; não aparece na água ou fora do mapa. Limite de 24 marcas, removendo a mais antiga.
São efeitos transitórios eliminados ao salvar, sem novos campos persistidos e sem migração do save v44.

Rasenshuriken também usa `rasenganHitFx`, chamado por `projectileSystem.explode`: o `burst` dura o ciclo inteiro
de 0,8 s, seguido visualmente pela cratera de 20 s. Mantém a resolução imediata de dano em área (raio 70),
velocidade 200 e colisões existentes; não aplica dano a cada quadro do domo. Muralha continua bloqueando o golpe
com o impacto de terra existente, sem domo nem cratera de Rasenshuriken. A formação na mão é somente desenho.

## Integração visual de Doton e areia

Doryuuheki mantém `raiseWall`/`wallHit`/`wallCovers`; apenas o desenho passou à folha com fases. Doryuudan mantém
um único projétil, dano, raio e velocidade: `releaseJutsu` cria adicionalmente `jutsuOrigin` fixo por 0,65 s
na mesma posição de lançamento, usando `JutsuFx.origin`. A cabeça não segue o ninja nem causa dano adicional.
Suna no Tate continua usando `Unit.shield`/`shieldVfx`; Sabaku Kyū continua usando `Unit.stun`/`stunVfx` com o
dano existente. Os dois mostram a folha de areia no lugar da explosão inicial de partículas. Fases em
`render/earthSandMotion.ts`, sem timers adicionais. Fonte é efeito transitório eliminado do save; não há novos
campos persistentes, mantendo save v44.

## Integração de Raiton e Mokuton

`releaseJutsu`: jutsu de área com `.impact` usa duração `frames/fps` e dispensa anel/partículas duplicadas.
Kirin mantém o efeito `thunder` com `fx: kirin`, força reduzida a 60% sob céu limpo e o dano em área original.
Nagashi mantém um único dano em área no momento do uso; o `burst` de 0,8 s leva `uid`, acompanha o corpo pelo
`effectSystem` e termina se o lançador morrer, sumir ou ficar oculto. Seguir visualmente não aplica dano novamente.
Jukai mantém dano e 2,5 s de prisão com estilo `wood`, substituindo a explosão inicial pelas fases de raízes.
Raikyuu mantém o projétil e o atordoamento existentes. Nenhum campo persistente novo; save continua v44.

## Sekizō: sequência de canhões de ar (2026-10-15)

A implementação anterior soltava cinco projéteis em leque com um impacto de coluna vertical. Corrigido
conforme o ataque da referência: cinco socos sucessivos, cada vez mais rápidos, produzindo canhões de
pressão na direção do alvo. `game/sekizo.ts` mantém `Unit.barrage` (alvo, tempo, próximo soco e poder),
atualizado pelo sistema de técnicas; a IA aguarda a sequência. Cada soco tem um projétil de dano,
poder/consumo/recarga da definição atual; aceleração e deslocamentos são a adaptação para o jogo 2D.
Os deslocamentos ao redor do alvo só pousam em terreno andável e ficam dentro do limite do Exame.
Morte, ocultação, atordoamento, alvo inválido ou fuga interrompem os socos restantes. Save v45:
sequência e `Projectile.cannon` são campos opcionais; saves v44 continuam sem sequência ativa.
Referências: episódio420 de Naruto Shippūden e [Evening Elephant](https://naruto.fandom.com/wiki/Evening_Elephant).

## Gatsūga com ninken e avisos oculares — 2026-10-15

Uma broca por unidade. Ao usar Gatsūga, o ninken real do dono participa se estiver visível, vivo, sem atordoamento/outra técnica, na mesma facção e até120px de mundo do dono. Cada um sai da própria posição e mira o mesmo alvo, respeitando terreno e regras de facção/arena. O dono conserva o poder do jutsu; o cão aplica seu dano normal de ataque (com multiplicador da raça), uma vez no contato, com recarga de ataque. Não duplica o poder do jutsu do dono. A IA do cão aguarda sua investida; morte, ocultação, atordoamento, perda de vínculo ou alvo inválido cancelam a participação. Savev46 adiciona apenas campos opcionais.

Laboratório: opção Ninken na barra; links /lab?jutsu=gatsuga&at=0.1 e /lab?jutsu=gatsuga&at=0.08&ninken=1. O ninken de teste é uma unidade real ligada ao lançador.

Sharingan/Byakugan: fonte7px, deslocamento vertical−47px de cena, seguindo o lançador. Aviso identificado separadamente do texto de dano e reutilizado por unidade para não duplicar; nome do jutsu mantém tamanho e origem atuais. Capturas: output/playwright/gatsuga-solo.png, gatsuga-ninken.png, byakugan-texto.png e sharingan-texto.png.
