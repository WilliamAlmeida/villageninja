# Kage Bunshin, Edo Tensei e Shousen — elaboração

Iniciado em 2026-10-16. Estado: fontes, integração e resultado visual no jogo aprovados pelo autor em 2026-10-16. ImageGen integrado; fontes originais preservadas e prompts em `prompts.json`.

## Decisões do autor

- Manter a transparência atual dos clones, como indicação visual de que são cópias.
- Clones continuam sem usar jutsus.
- Fumaça deve servir também a outros eventos de tamanho de arte semelhante.
- Edo: preservar o reanimado atual; acrescentar caixão saindo do chão, abrindo e revelando o ninja.
- Shousen: aproximação real, tratamento próximo com chakra verde nas mãos e cura ao longo do atendimento. Sem feixe longo entre personagens.

## Fumaça compartilhada

Auditoria em `src/game/combat.ts`, `systems/hostiles.ts`, `techniques.ts`, `ninken.ts`, `missions.ts`, `exam.ts` e `modes.ts` em 2026-10-16. Há vários eventos pontuais `smoke` com raios 12–20 e durações 0.45–0.9s.

Uma folha neutra, sem ninja, tronco ou símbolo, permite compartilhar a animação de expansão/dissipação. A seleção precisa ser explícita por finalidade para preservar as outras identidades visuais.

| Situação | Aplicação proposta | Momento de mostrar/ocultar a unidade |
|---|---|---|
| Kage Bunshin, criação | Poof em cada ponto de criação; escala de personagem | Clone aparece no pico e permanece com transparência atual. |
| Clone derrotado ou expirado | Mesma folha, início mais rápido | Corpo some quando a fumaça encobre; efeito termina sozinho. |
| Kawarimi, saída e chegada | Mesma folha com escala/tempo próprios | Tronco e deslocamento mantêm suas próprias regras. |
| Invocação/retirada de ninken e animais de porte próximo | Escala menor, ancorada nos pés | Revelar/ocultar a unidade no pico. |
| Entrada/retirada pontual de ninja em cena, missão ou exame | Uso opcional da mesma folha | Vincular à transição real, evitando efeito duplicado. |
| Transformações pontuais com poof | Uso opcional quando o efeito pede nuvem neutra | Troca de aparência sincronizada com o pico. |

Fumaça de incêndio contínuo, poeira de obras e desintegração do Edo possuem comportamentos próprios e continuam exigindo seleção específica. A animação compartilhada será um recurso para eventos pontuais de aparição/desaparição, sem trocar globalmente todo evento `smoke`.

### Parâmetros sugeridos

- Folha 4×2, oito quadros: semente → expansão → pico opaco → abertura central → lobos → fiapos → resíduos.
- Largura inicial 44–52 pixels de cena para ninjas; animais menores perto de 30–38. Ajustar conforme as artes reais.
- Duração normal 0.6–0.8s; passagem pelo pico mais rápida na dissipação do clone.
- Cor neutra branca/cinza, com tintura opcional preservando luminância/alpha.
- Ancoragem comum na base. Sem recentralizar cada quadro, para não deslocar a nuvem durante a expansão.
- Camadas: ninja atrás da fumaça; resíduos podem terminar depois de o clone aparecer/desaparecer.
- Separar momento do evento de dano/vida: só uma criação ou remoção por unidade.

## Edo Tensei

Proposta: 0.5s de subida pelo recorte do chão → 0.4s de abertura → breve revelação → saída do ninja. Tempo de combate de 22s começa ao liberar o reanimado. Até a liberação ele não anda, ataca ou recebe seleção de combate.

Caixão e ninja precisam permanecer independentes. A abertura deve permitir compor o ninja real, com roupa/aparência do registro de caído. Estrutura traseira, interior, moldura frontal e tampa precisam de ordem de desenho definida; a arte não deve trazer um ninja fixo.

Fonte inicial: folha do caixão fechado/abertura, com interior vazado nos quadros abertos. Subida por recorte na linha do chão; não deformar o objeto para simular subida. Caso a folha não ofereça recorte limpo para compor o ninja, separar estrutura e tampa antes da integração.

Escolher ponto caminhável com espaço para a saída. Reservar o caído durante a apresentação; cancelamento libera essa reserva. Usar o ninja real na prévia integrada. A saída definitiva segue com pó e fragmentos, conforme o efeito atual aprovado.

## Shousen

Sequência proposta:

1. Selecionar aliado ferido e posição caminhável próxima.
2. Médico se aproxima; o alcance de busca atual não será alcance do feixe.
3. Ao chegar, iniciar tratamento e consumir chakra/recarga.
4. Mãos orientadas ao paciente, com aura de chakra verde; cura distribuída por cerca de um segundo, mantendo o total atual.
5. Encerrar brilho e liberar ambos.

Paciente faz pausa voluntária e interrompível durante o atendimento. Ordens do jogador, morte, stun, deslocamento/afastamento cancelam a parcela restante; não bloquear uma fuga do paciente. Evitar dois médicos reservarem o mesmo paciente sem necessidade. Aproximação deve ter tempo limite e abandonar alvo inalcançável; prioridade de combate/ordens segue explícita.

Autocura: atender no próprio lugar com as mãos perto do corpo. A sprite de chakra não inclui mão desenhada: usa os pontos das mãos do ninja e um brilho menor no ponto tratado. Para mãos atingirem o paciente nas diferentes direções, ajustar pose e distância de atendimento; uma aura sozinha não resolve posicionamento.

## Entregáveis

- `smoke-poof-source-v1.png`: original da fumaça compartilhada.
- `edo-coffin-source-v1.png`: original do caixão, sem ninja fixo.
- `shousen-palm-source-v1.png`: original do chakra verde, sem mão fixa.
- Folhas derivadas `effect-*-v1.png`, preparadas por `scripts/prepare-clones-edo-cura.ps1`.
- `preview.html`: estudo animado, controles de tempo/escala e comparação de tamanhos da fumaça. Manequins apenas ilustram composição; não representam novas sprites do personagem.

## Critérios de integração futura

Preservar transparência e restrições dos clones. Fumaça explicitamente associada a cada evento compatível. Fonte e derivados preservados. Expor ajustes de tamanho, aparência, pontos e grade no laboratório. Conferir base do caixão, encaixe do ninja e mão de cura nas diferentes direções. Aprovação visual das fontes precede a integração das folhas.
## Integração — 2026-10-16 (`c01fe7c`)

- Configuração: `bun scripts/configure-clones-edo-cura.ts`. Preserva valores já regulados no painel. Fontes em docs preservadas; PNGs finais registrados em `src/render/art.ts`.
- Fumaça: `src/render/supportSprites.ts` desenha a folha uma vez, com escala proporcional ao raio, progressão pela duração e tintura em cache. Eventos selecionados recebem `fx: kagebunshin`; a fumaça procedural e as partículas genéricas são suprimidas somente nesses eventos. Compartilhada entre clones (criação/derrota/expiração), Kawarimi, retirada do ninken, entradas/retiradas do exame e algumas transições de missão. Ajustes compartilhados pelo cartão Kage Bunshin do laboratório.
- Clones: revelação após 0.18s; transparência e restrição de jutsus originais preservadas. Doze segundos continuam contando a partir da liberação da apresentação.
- Edo: estado opcional `edoIntro` mantém o reanimado oculto ao combate durante 1.5s. Renderiza o ninja real por dentro da abertura da fonte; subida por recorte na linha do chão, abertura e saída interpolada. Escolhe saída caminhável com ponto intermediário livre; sem saída, libera no próprio ponto. Cancela se o dono cair. Os 22s de vida só começam quando a apresentação termina; o caixão aberto permanece por 0.65s com fade, depois desaparece. Campos opcionais sobrevivem ao save; não exigem migração.
- Shousen: `src/game/healing.ts`. Reserva paciente, aproxima por percurso real (limite de 5s), começa entre 18–22 unidades com trajeto livre, consome chakra/recarga no início do tratamento e distribui a cura por 1s. Finalização visual de 0.2s. Paciente pausa apenas durante o tratamento e retoma suas ações; comando novo, dano, stun, morte, ocultação e afastamento interrompem. Caminho de uma ordem nova é preservado. Retentativa após 1.5s para evitar repetição de buscas sem saída.
- Autocura usa a pose de mãos próximas ao corpo; atendimento usa o ponto de mão da pose de lançamento. Aura acompanha a mão real. A quantidade de cura continua derivada do poder/atributos existentes; não há feixe de luz nem cura instantânea.
- Médicos não abandonam ordens explícitas ou plataformas e não iniciam atendimento durante outra técnica. Pacientes em retirada, movimento comandado, duelo, plataforma ou técnica ativa não são escolhidos. No laboratório, reiniciar/trocar técnica limpa os estados de atendimento.
- Três seções de ajuste de sprite disponíveis para as três folhas: pontos, tamanho/aparência e grade. Ajuste de altura e escala do caixão não desloca a simulação; é desenho em pixels de cena.
- Capturas: `output/playwright/kagebunshin-sprite-integrado.png`, `edo-caixao-integrado.png`, `edo-saida-integrado.png`, `shousen-atendimento-integrado.png`.
- Typecheck e build do jogo/laboratório concluídos. Testes automatizados não executados nesta entrega.

Prévia real: [clones](http://localhost:3011/lab?jutsu=kagebunshin&at=0.28), [caixão](http://localhost:3011/lab?jutsu=edotensei&at=1.0), [saída](http://localhost:3011/lab?jutsu=edotensei&at=1.65), [cura](http://localhost:3011/lab?jutsu=shousen&at=1.0). Clique em Continuar para observar as etapas.