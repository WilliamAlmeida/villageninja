# Taijutsu do anime × poses do ninja em camadas

Objetivo: o máximo de golpes com o mínimo de folhas. Cada folha de pose tem 4 quadros × 3 vistas (lado, frente,
costas) e vale para todo ninja (roupas regeradas uma vez por pose; cabelo, bandana, máscara, chapéu e espadas seguem a
cabeça sozinhos). Um golpe novo é só uma **coreografia** em `JutsuDef.moves` (`[pose, quadro, segundos]`) mais o efeito
visual (vfx) que já existe — sem sprite nova.

## Folhas que já temos

| Folha | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| `walk` (caminhada) | contato | passagem (parado) | contato | passagem |
| `strike` (soco) | prepara, punho atrás | avança | **impacto**, braço todo esticado | recupera |
| `kick` (chute) | joelho erguido | **chute alto** | **rasteira** agachado | guarda |
| `cast` (selos) | selo no peito | selo no queixo | selo dedos cruzados | **solta**, palma aberta à frente |
| `air` (no ar) | agacha para pular | encolhido no ar | **chute voador** | aterrissa com a mão no chão |
| `hurt` (atingido) | recua | arremessado | **caído** no chão | levantando |

Truques de código que multiplicam os quadros (só desenho, `drawUnitArt`): alternar dois quadros rápido (rajada),
espelhar o lado a cada passo (giro), deslocar o sprite para cima (salto/no ar), avanço curto (lunge), investida
(`dash` com rastro), vulto/afterimage (Shunshin), clarão branco (impacto), "esmaga e estica", aura (Modo Sábio).

## Golpes do anime e como montar

| Golpe (quem) | O que faz no anime | Coreografia com o que temos |
|---|---|---|
| **Konoha Senpuu** (Lee) | chute giratório alto + rasteiro | kick 0 → 1 → 2 → 3 ✅ feito |
| Konoha Reppuu (Lee) | rasteira que derruba | kick 0 → 2 → 3 + alvo atordoado curto |
| Konoha Daisenpuu (Lee/Gai) | vários chutes girando | kick 1 ↔ 2 alternando, espelhando o lado a cada passo |
| Konoha Shōfū (Lee) | chute de baixo para cima que lança o alvo | kick 2 → 1 (subindo) + alvo empurrado para cima |
| Dynamic Entry (Gai) | chute voador de entrada | investida (`dash`) em kick 1 + "esmaga" ao chegar |
| Tsūtenkyaku (Tsunade) | calcanhar do alto rachando o chão | kick 1 (perna no alto) → strike 3 + cratera/onda (`wave`) |
| Ōkashō (Sakura/Tsunade) | soco no chão que racha tudo | strike 0 → 2 + `burst` de terra + `wave` |
| Shishi Rendan (Sasuke) | chute que lança, combo no ar, calcanhar | kick 2 → 1 → strike 2 → kick 1, deslocado para cima |
| Omote Renge (Lee) | chute para o alto, agarra, gira e crava | kick 2 → 1 → (sobe) → strike 2 caindo + poeira |
| Ura Renge (Lee) | rajada de golpes em alta velocidade | strike 1 ↔ 2 muito rápido + vultos (Shunshin) |
| Asa Kujaku (Gai) | centenas de socos em chamas | strike 1 ↔ 2 rápido + `hit` de fogo em leque |
| Hirudora (Gai) | soco que solta um tigre de ar | cast 0 → strike 2 + `wave`/`gust` grande |
| Sekizō (Gai) | 5 socos que viram colunas de ar | strike 0 → 2 → 0 → 2 → 2 + 5 projéteis de ar |
| Hakke Kūshō (Neji/Hinata) | palma de ar à distância | cast 3 (palma) + `wave` (projétil de ar) |
| Hakke 64 Shō (Neji) | 64 golpes de palma nos pontos de chakra | cast 3 ↔ strike 1 rápido, números somando |
| Hakkeshō Kaiten (Neji) | gira e forma um domo de chakra | cast 1 espelhando o lado a cada 0,05 s + `drawDome` azul |
| Jūho Sōshiken (Hinata) | punhos de leão de chakra | strike 0 → 2 + aura azul em volta das mãos |
| Gatsūga (Kiba) | gira como broca e atravessa | investida com o sprite girando (rotação) + rastro |
| Nikudan Sensha (Chōji) | vira bola e rola por cima | investida com o sprite redondo girando (escala + rotação) |
| Lariat do Raikage (A) | corrida com o braço esticado e raios | investida em strike 2 + `bolt` (já é o fim do Chidori) |
| Kawazu Kumite (Naruto Sábio) | golpes com energia natural ao redor | strike/kick normais + `sageGlow` (já existe) |
| Hachimon (Lee/Gai) | abre os portões: aura e força | estado (buff) com aura verde/vermelha; usa as outras |

## Feito

Todos os golpes da tabela entraram como jutsu (`data/jutsus.ts`, fim da lista), menos Kawazu Kumite (já é o Modo
Sábio) e Hachimon (fica para um estado de "portões"); mais Rasengan (investida com a esfera na mão, `handOrb`) e
Rasenshuriken (projétil `spinner`). Altura do salto: 4º campo do passo (`moves`), o corpo sobe e a sombra fica no
chão. Os golpes Hyuga (Kūshō, 64 Palmas, Kaiten, Sōshiken) exigem o Byakugan (`kekkei: 'byakugan'`). Efeito: 5º campo, `spin` (giro espelhando) ou `roll` (bola girando). Investida com área ao chegar: `dashRadius`.
Alvo lançado ao alto: `launch`. Reação ao dano: `MOVE_SEQS` (`hurt-light`, `hurt-down`, `hurt-launch`), por
`playHurt` em combat.ts; o duelo do Exame em nocaute fica caído.

## Antes (o que faltava)

Com soco, chute e selos dá para ~80% da lista. Uma folha a mais destravaria o resto:

- **`air` (no ar)**: 0 agacha para pular · 1 subindo com o joelho dobrado · 2 chute voador esticado · 3 aterrissa
  agachado. Cobre Dynamic Entry, Shishi Rendan, Omote Renge, Kage Buyō, Tsūtenkyaku, saltos de fuga e o pouso do
  Shunshin.
- (opcional) **`hurt`**: atingido · caído · levantando — reaproveitado por todo mundo ao levar golpe forte, nocaute do
  Som, Kawarimi e resgate do Hospital.

Regra: folha nova só quando um quadro serve a muitos golpes; golpe novo é coreografia + vfx.
