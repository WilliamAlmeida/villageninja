# Onde cada arte do jogo mora dentro de src/art (uma regra só, pelo nome da arte). Os scripts que gravam arte usam
# `art_file(nome)`; o nome continua sendo a chave em todo lugar (render/art.ts, layout.json do Editor de cenário).
#
#   ninja/body    corpo-base do ninja em camadas por pose (ninja-body, ninja-body-<pose>)
#   ninja/layers  peças do ninja (roupas, coletes, cabelos, máscaras, espadas nas costas, capa, pergaminho): layer-*
#   ninja/busts   retratos (bust-*, kage-bust-*)
#   characters    folhas de personagens que não são o ninja em camadas: moradores, guarda da torre, renegado, Ordem, Som
#   animals       bichos, feras, invocações e as Bestas com cauda
#   weapons       lâminas lendárias soltas (sword-*)
#   buildings     prédios (com nível e tema: <tipo>-2, <tipo>-fishing…), Monte dos Kages, Pedra Memorial
#   buildings/deco decorações (lanterna, banco, cerejeira…)
#   scenery       árvores, tocos, rochas, veios, erva, baú, ruína, entrada de mina
#   props         atlas de enfeites desenhados por código (caverna, mapas temáticos)
#   region        fundo do mapa da região e o atlas dos lugares
#   ui/…          interface (já organizada: art, frame, kit1, kit2, atlas na raiz de ui)
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'src' / 'art'
EDITS = ART / 'art-edits.json'

CHARACTERS = {'villager', 'villager-chop', 'villager-farm', 'villager-mine', 'rogue', 'puppet'}
ANIMALS = {'bear', 'boar', 'crow', 'golem', 'hydra', 'monkey', 'rhino', 'slug', 'snake', 'spider', 'tiger', 'toad', 'wolf'}
DECO = {'lantern', 'bench', 'flowers', 'banner', 'shrine', 'statue', 'cherry', 'cherry-green', 'cherry-bare', 'fountain', 'pond', 'pagoda'}
SCENERY = {'tree0', 'tree1', 'stump0', 'stump1', 'rock', 'rock-cracked', 'rock-pebbles', 'ore', 'ore-empty', 'herb',
           'chest', 'chest-open', 'ruin', 'ruin-alt', 'cave', 'cave-alt'}
PROPS = {'cave-props', 'theme-props'}
REGION = {'region', 'region-places'}


def art_folder(name: str) -> str:
    """Pasta (relativa a src/art) da arte `name` (sem extensão)."""
    if name.startswith('ninja-body'):
        return 'ninja/body'
    if name.startswith('layer-'):
        return 'ninja/layers'
    if name.startswith('bust-') or name.startswith('kage-bust-'):
        return 'ninja/busts'
    if name.startswith('sword-'):
        return 'weapons'
    if name.startswith(('projectile-', 'effect-')):
        return 'effects'
    if name in CHARACTERS or name.startswith('org-') or name.startswith('sound-'):
        return 'characters'
    if name in ANIMALS or name.startswith('dog') or name.startswith('bijuu-'):
        return 'animals'
    if name in DECO:
        return 'buildings/deco'
    if name in SCENERY:
        return 'scenery'
    if name in PROPS:
        return 'props'
    if name in REGION:
        return 'region'
    if name == 'ui-scroll':
        return 'ui/art'
    return 'buildings'


def art_rel(name: str, ext: str = '.png') -> str:
    """Caminho relativo a src/art, com barra normal (é a chave do art-edits.json): 'buildings/academy.png'."""
    return f'{art_folder(name)}/{name}{ext}'


def art_file(name: str, ext: str = '.png') -> Path:
    """Arquivo da arte em src/art (cria a pasta)."""
    p = ART / art_rel(name, ext)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def edited() -> set:
    """Artes editadas à mão no editor de sprites (caminhos relativos a src/art): os scripts não as refazem sem --force."""
    import json
    return set(json.loads(EDITS.read_text(encoding='utf8'))) if EDITS.exists() else set()


def is_edited(name: str, edits: set | None = None, ext: str = '.png') -> bool:
    return art_rel(name, ext) in (edited() if edits is None else edits)


