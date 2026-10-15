# Sōshiken, Gatsūga e Nikudan Sensha — propostas v1

Criadas em 2026-10-15 com ImageGen integrado e as referências enviadas pelo autor.
Estado: artes aprovadas pelo autor e integradas em 2026-10-15; parâmetros de gameplay preservados.

## Funcionamento e aplicação visual

- Sōshiken: chakra moldado em leões que envolvem os punhos e afetam a rede de chakra ao contato. A folha contém um leão, instanciado em cada mão; acompanhar a coreografia, sem lançar os leões como projéteis.
- Gatsūga: a folha contém uma broca dirigida à direita, desenhada por participante e orientada pela própria trajetória. Sozinho, o ninja vira uma broca; com ninken próximo e disponível, o pet também se transforma e ataca o mesmo alvo. O corpo fica oculto durante a investida.
- Nikudan Sensha: corpo recolhido em bola, avançando por rotação. Folha com corpo/roupa e poeira atrás. A versão comum não usa espinhos; a variante Nikudan Hari Sensha é distinta.
- Manter os parâmetros atuais do jogo até uma decisão explícita sobre mudanças de gameplay: Sōshiken melee + atordoamento0.6s; Gatsūga dash; Nikudan dash com raio34.
- Alinhar efeitos à direção, aos pontos das mãos e ao chão; expor ajustes no laboratório.

## Arquivos

Fontes ativas: soshiken-source.png, gatsuga-source.png, nikudan-source-v2.png. A fonte anterior nikudan-source.png foi preservada como original histórico.
Folhas preparadas: effect-soshiken-v1.png (384x192), effect-gatsuga-v1.png e effect-nikudan-v2.png (512x256).
Todas4x2/oito quadros; preparo: scripts/prepare-taijutsu.ps1, componente principal, escala comum, alpha mínimo32 e nearest-neighbor.
Prévia animada: preview.html. Prompts completos: prompts.json.

## Referências consultadas

- https://naruto.fandom.com/wiki/Gentle_Step_Twin_Lion_Fists
- https://naruto.fandom.com/wiki/Fang_Passing_Fang
- https://naruto.fandom.com/wiki/Human_Bullet_Tank
- https://naruto.fandom.com/wiki/Spiked_Human_Bullet_Tank

As páginas bloquearam leitura direta; descrições foram consultadas nos resultados de busca. Para Gatsūga, a forma visual segue principalmente a referência do autor.

## Nikudan v2 — cor personalizável

Revisão solicitada pelo autor: superfície de tecido de cor única, costuras finas e sombreado neutro; sem painéis de roupa multicoloridos. Fonte nikudan-source-v2.png; folha effect-nikudan-v2.png. A prévia tem seletor de cor, aplicado apenas aos pixels neutros do tecido, preservando a poeira bege. Na integração, a cor virá da roupa predominante do ninja.

## Integração

Runtime: src/render/taijutsuSprites.ts, src/render/sprites.ts e src/render/jutsuSprites.ts. Configuração reproduzível: bun scripts/configure-taijutsu.ts. Preparo: scripts/prepare-taijutsu.ps1.

Sōshiken usa o ponto da mão da pose e uma segunda mão estimada; separação mínima nas vistas frontal/traseira evita sobrepor os leões. Gatsūga desenha uma broca por unidade participante, orientada à própria trajetória. Gatsūga/Nikudan substituem o corpo durante a investida e a fase de rotação da recuperação. Rastro de corpos procedurais desativado nessas duas investidas.

Nikudan escolhe a cor da peça externa montada por dollParts (roupa/colete/casaco/manto), com fallback para look.cloth. Recoloração em cache de no máximo128 folhas; só pixels neutros são alterados, mantendo a poeira bege.

Todas as folhas usam SpriteFx e as três seções de ajuste do laboratório. Sem estado persistente novo, sem dano repetido por animação. Capturas em output/playwright/{soshiken,gatsuga,nikudan}-integrado.png.

## Gatsūga com ninken e avisos oculares — 2026-10-15

Uma broca por unidade. Ao usar Gatsūga, o ninken real do dono participa se estiver visível, vivo, sem atordoamento/outra técnica, na mesma facção e até120px de mundo do dono. Cada um sai da própria posição e mira o mesmo alvo, respeitando terreno e regras de facção/arena. O dono conserva o poder do jutsu; o cão aplica seu dano normal de ataque (com multiplicador da raça), uma vez no contato, com recarga de ataque. Não duplica o poder do jutsu do dono. A IA do cão aguarda sua investida; morte, ocultação, atordoamento, perda de vínculo ou alvo inválido cancelam a participação. Savev46 adiciona apenas campos opcionais.

Laboratório: opção Ninken na barra; links /lab?jutsu=gatsuga&at=0.1 e /lab?jutsu=gatsuga&at=0.08&ninken=1. O ninken de teste é uma unidade real ligada ao lançador.

Sharingan/Byakugan: fonte7px, deslocamento vertical−47px de cena, seguindo o lançador. Aviso identificado separadamente do texto de dano e reutilizado por unidade para não duplicar; nome do jutsu mantém tamanho e origem atuais. Capturas: output/playwright/gatsuga-solo.png, gatsuga-ninken.png, byakugan-texto.png e sharingan-texto.png.


Aprovação final em 2026-10-15: o autor confirmou que os três ficaram OK no jogo, incluindo Gatsūga com uma broca por participante e Nikudan recolorido pela roupa. Próximo lote: Chidori.
