# Requisitos do sistema (para a página pública)

Medidos com o relatório do Medidor de FPS (Configurações → Medidor de FPS → Detalhado → disquete; arquivos em
`.perf/devices/`, fora do git). Atualizar esta página a cada aparelho novo medido e a cada otimização grande.
Última revisão: 2026-10-15.

## O que pesa

- **CPU, um núcleo.** O desenho e a simulação rodam numa thread só (JavaScript). O que manda é a força de UM núcleo,
  não a quantidade de núcleos.
- **Memória quase não conta.** O jogo usou 14–32 MB de JavaScript em todos os aparelhos medidos; 3 GB de RAM bastam.
- **GPU não foi o limite** nem no aparelho mais fraco (PowerVR GE8320) depois das otimizações de 2026-10-13/15.
- **O custo cresce com a vila** (unidades, prédios, área explorada): um aparelho que vai bem no começo pode ficar
  pesado lá pelo dia 70. Os requisitos abaixo valem para a vila grande (pior caso).

## Requisitos (versão para a página)

**Mínimo** — 30 quadros por segundo na qualidade Leve, com Processamento Reduzido, até uma vila média, velocidade 1×:
- Celular Android 9 ou mais novo, com núcleos **Cortex-A75 ou melhores** (ex.: MediaTek Helio G85/G88/G90,
  Snapdragon 675/678; aparelhos de ~2020 como Redmi Note 8 Pro/9, Moto G9 Plus);
- 3 GB de RAM;
- Google Chrome atualizado (o jogo pode ser instalado como app pelo Chrome).

**Recomendado** — 60 quadros por segundo na Equilibrada, vila grande, velocidade 3×:
- Núcleos **Cortex-A76/A77 ou melhores** (ex.: Snapdragon 720G/732G/778G, Helio G95/G99, Dimensity 700/810 ou
  superior);
- 4 GB de RAM.

**Computador:** processador dos últimos ~8 anos (Intel i3 / AMD Ryzen 3 ou melhor), vídeo integrado, Chrome ou Edge
atualizado. Notebook com Celeron N4000/N4020 fica no limite do mínimo.

**Abaixo do mínimo** (só núcleos Cortex-A53: Helio P22/P35, Snapdragon 450/460, Unisoc): roda no começo, fica pesado
conforme a vila cresce.

> Estimativa: tirada de 3 aparelhos medidos. Antes de publicar, medir um intermediário de 2020 (Helio G85 ou
> Snapdragon 665/675) para confirmar a linha do mínimo.

## Aparelhos medidos

| Aparelho | Chip / GPU | Força de 1 núcleo (≈) | Vila nova | Vila grande (dia 74–79) |
|---|---|---|---|---|
| LG K12 (LM-X420), Android 9 | Helio P22 (8× Cortex-A53 2,0 GHz) / PowerVR GE8320, 3 GB | 1× | ~40 qps, oscilando (Equilibrada) | 7–15 qps (Leve, antes do Processamento Reduzido) |
| Motorola Moto G100, Android 12 | Snapdragon 870 / Adreno 650, 8–12 GB | ~6× | 90 qps (tela de 90 Hz) | 55–90 qps (Alta) |
| PC do autor | 12 núcleos / RTX 4060 Ti, 16 GB | ~10× | sobra | 57–60 qps afastado, 60 de perto |

Conta usada: no K12, um quadro da vila grande custava ~55 ms de CPU (desenho ~40 + simulação ~11). Para 30 qps é
preciso um núcleo ~2× mais forte; para 60, ~3,5×. Força de um núcleo pela ordem de grandeza do Geekbench 5
single-core: Cortex-A53 2,0 GHz ≈ 150; A75 ≈ 350; A76 ≈ 550; A77/A78 ≈ 700–800; Snapdragon 870 ≈ 1.000.

## Opções que ajudam aparelho fraco (Configurações)

- **Qualidade Leve**: resolução 1×, menos partículas, clima leve, até 30 qps.
- **Processamento Reduzido**: a simulação calcula 30 vezes por segundo em vez de 60 (metade do trabalho).
- **Atrás de prédios = Esmaecer** em vez de Silhueta: a silhueta custou 4–7 ms por quadro no K12.

## Como atualizar

1. Pedir a quem tem o aparelho: Medidor de FPS → Detalhado, jogar ~30 s em cada situação (vila parada, câmera
   andando, zoom afastado) e tocar no disquete.
2. Ler os arquivos de `.perf/devices/` (modelo, GPU, configurações, FPS com p50/p95/p99, ms por etapa do desenho e por
   sistema da simulação).
3. Atualizar a tabela de aparelhos e, se mudar, as linhas de mínimo/recomendado.
