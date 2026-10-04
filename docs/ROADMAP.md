# Roadmap — Vila Ninja

Decisões de design (definidas com o autor):

| Tema | Decisão |
| --- | --- |
| Combate | **Automático + ordens**: ninjas lutam sozinhos; o jogador pode mandar atacar um alvo, ir a um ponto ou recuar |
| Arte | **Pixel art com spritesheets**. Agora: sistema de animação com sprites provisórios; arte final depois |
| Objetivo | **Sandbox com marcos**: Exame Chunin, eleger o Kage, níveis da vila, ameaças chefes |
| Missões | Acontecem **no próprio mapa da vila** (escolta, caça, acampamentos) |
| Prioridades | Equipes + sensei → missões → economia → clãs/kekkei genkai |

---

## Fase 1 — Equipes, sensei e ordens ✅
- `Team { id, nome, senseiId, membros[3], ordem }` no estado; tela **Equipes** (formar/desfazer, escolher sensei Chunin+).
- Comportamento: membros seguem o sensei em patrulha/treino; em combate focam o mesmo alvo.
- Bônus: treino com sensei rende +50% e puxa para os atributos fortes dele; +10% de dano com aliados próximos.
- **Ordens** (ninja ou equipe selecionada): tocar no chão = mover/defender ponto; tocar inimigo = atacar; botão **Recuar**.
  Implementação: campo `command` na unidade que sobrepõe a IA até concluir ou expirar.
- Testes: formação de equipe, ordem de ataque, bônus aplicados.
- **Feito**: `game/teams.ts`, `systems/teams.ts`, IA em `systems/ninjas.ts`, UI (painel do ninja, aba Equipes, modo de ordem), migração de save v1→v2.

## Fase 2 — Pipeline de sprites (placeholder)
- `SpriteSheet` + atlas JSON; `Animator` com estados `idle/walk/attack/cast/hurt/die` × 4 direções.
- Sprites provisórios gerados em runtime num atlas (mesmo caminho de código da arte final).
- Especificação de arte em `docs/ART.md`: tile 16 px (escala ×2), personagem 16×24, nº de frames por animação, paleta.
- `render/sprites.ts` passa a desenhar via atlas; desenhos procedurais ficam como fallback.

## Fase 3 — Níveis da vila (marco) ✅
- **Aldeia → Vila → Vila Oculta → Grande Vila Oculta** (`data/villageLevels.ts`), com requisitos
  (população, ninjas, ninjas por rank, prédios, invasões repelidas) e custo para evoluir.
- Território: só se constrói dentro de um raio da Residência do Hokage (12 → 17 → 23 → mapa todo).
- Desbloqueios: Hospital (Vila), Biblioteca de Jutsus (Vila Oculta, +50% de velocidade de estudo),
  Kage só a partir de Vila Oculta; impostos 2 → 3 → 3 → 4 ryo por morador.
- Ameaças escalam com o nível: invasões maiores e mais fortes, mais animais e feras grandes.
- **Feito**: `game/village.ts`, `systems/village.ts` (aviso de evolução), painel da vila na Residência do Hokage,
  botão 🏯 Vila, cadeados no menu de construção, território no mapa, save v3.
- Decisão: o mapa continua 72×48; o território é que cresce. Aumentar o mapa fica para quando houver missões fora da vila.

## Fase 4 — Missões no mapa ✅
- Prédio **Mesa de Missões**; quadro com 3 missões que renova a cada dia, ranks D → S conforme o nível da vila.
- Tipos: coleta de ervas (com lobos), caça (javali, urso, cobra), escolta de mercador (com emboscada),
  acampamento de bandidos e ninja procurado (chefe ★). 13 modelos em `data/missions.ts`.
- A equipe designada recebe ordens automáticas (ir, atacar alvos, colher, escoltar); alvos de missão guardam o local.
- Resultado: ryo/recursos, XP para a equipe, reputação; falha por tempo, equipe derrotada ou mercador morto.
- Missões cumpridas viram requisito de Vila Oculta (2) e Grande Vila Oculta (6). Missões simultâneas = nível da vila + 1.
- **Feito**: `game/missions.ts`, `systems/missions.ts`, `game/missionView.ts`, painel do quadro, botão 📋,
  marcadores (◆ alvo, ★ chefe, $ mercador), acampamentos no mapa, setas na borda da tela, save v4.

## Fase 5 — Economia mais profunda
- Recursos: **ferro**, **ervas**, **papel de selo**.
- Prédios: mina de ferro, horta de ervas, **ferreiro** (kunais/armas), farmácia (pílulas de chakra), oficina de selos (papel-bomba, armadilhas).
- Equipamento por ninja: arma, colete, consumível.

## Fase 6 — Exame Chunin (marco)
- Evento periódico quando há genins em equipes: arena no mapa, chaveamento, lutas 1×1 assistíveis.
- Desempenho (não só vitória) define promoções; convidados trazem ryo/reputação.

## Fase 7 — Clãs e kekkei genkai
- Famílias: moradores formam casais, filhos herdam aparência, natureza e talentos.
- Clãs fundados por ninjas notáveis; kekkei genkai como natureza combinada
  (ex.: Gelo = Vento+Água, Madeira = Terra+Água, Lava = Fogo+Terra) e técnicas exclusivas.

## Fase 8 — Kage e ameaças chefes (marcos)
- **Eleger o Kage**: ninja nível alto + Vila Oculta → cerimônia, Monte dos Kages, bônus globais.
- Ameaças raras escalando com o nível da vila: fera gigante, organização criminosa, invasão de outra vila.

---

## Transversal
- Testes headless para cada sistema novo; simulação de balanceamento por N dias (`tests/`).
- Performance: grade espacial quando houver >150 unidades.
- Se o jogo for publicado, trocar nomes de técnicas/termos do anime por nomes originais.
