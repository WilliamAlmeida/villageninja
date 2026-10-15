# Auditoria de contato dos projéteis

Disparos reais: oito direções × três distâncias (limitadas ao alcance de cada jutsu), passo de 1/60 s. O erro mede a separação fora do corpo na primeira colisão elegível; zero significa contato ou interseção. A última coluna conta os casos já intersectados no início do passo elegível (artes grandes perto do alvo ou mergulho do dragão). Não é aprovação visual.

| Jutsu | Casos | Com contato | Maior separação | Já intersectado |
|---|---:|---:|---:|---:|
| Katon: Housenka no Jutsu | 24 | 24 | 0.000000 | 0 |
| Katon: Goukakyuu no Jutsu | 24 | 24 | 0.000000 | 1 |
| Suiton: Mizurappa | 24 | 24 | 0.000000 | 1 |
| Suiton: Suiryuudan no Jutsu | 24 | 24 | 0.000000 | 13 |
| Fuuton: Shinkuu Ha | 24 | 24 | 0.000000 | 0 |
| Doton: Doryuudan | 24 | 24 | 0.000000 | 1 |
| Raiton: Raikyuu | 24 | 24 | 0.000000 | 1 |
| Yōton: Yōkai no Jutsu | 24 | 24 | 0.000000 | 0 |
| Hirudora | 24 | 24 | 0.000000 | 1 |
| Fuuton: Rasenshuriken | 24 | 24 | 0.000000 | 2 |

Reproduzir: powershell -File scripts/audit-projectile-contacts.ps1 e bun scripts/audit-jutsu-projectiles.ts. No laboratório, conferir com Diagnóstico de contato e Pausar no contato; ajustar o marcador Contato na peça Principal / projétil.
