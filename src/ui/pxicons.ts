// Gerado por scripts/prepare-ui.py: assets de interface em pixel art (atlas de ícones e de cartões, ilustrações).

import iconsAtlas from '../art/ui/icons.png';
import cardsAtlas from '../art/ui/cards.png';
import ar_beast_slug from '../art/ui/art/beast-slug.png';
import ar_beast_snake from '../art/ui/art/beast-snake.png';
import ar_beast_toad from '../art/ui/art/beast-toad.png';
import ar_kage_bg from '../art/ui/art/kage-bg.png';
import ar_kunai_hiraishin from '../art/ui/art/kunai-hiraishin.png';
import ar_scene_autumn from '../art/ui/art/scene-autumn.png';
import ar_scene_festival from '../art/ui/art/scene-festival.png';
import ar_scene_spring from '../art/ui/art/scene-spring.png';
import ar_scene_summer from '../art/ui/art/scene-summer.png';
import ar_scene_village from '../art/ui/art/scene-village.png';
import ar_scene_winter from '../art/ui/art/scene-winter.png';

/** Um atlas: imagem, colunas × linhas e a casa (coluna, linha) de cada item. */
export interface Atlas { url: string; cols: number; rows: number; pos: Record<string, [number, number]> }
export const ICONS: Atlas = { url: iconsAtlas, cols: 10, rows: 10, pos: { 'alert': [0, 0], 'anvil': [1, 0], 'arena': [2, 0], 'axe': [3, 0], 'baby': [4, 0], 'back': [5, 0], 'beast': [6, 0], 'bell': [7, 0], 'bomb': [8, 0], 'books': [9, 0], 'candle': [0, 1], 'cart': [1, 1], 'castle': [2, 1], 'check': [3, 1], 'clipboard': [4, 1], 'crown': [5, 1], 'crystal': [6, 1], 'darksteel': [7, 1], 'dna': [8, 1], 'drop': [9, 1], 'dummy': [0, 2], 'eclipse': [1, 2], 'eye': [2, 2], 'fail': [3, 2], 'flag': [4, 2], 'flask': [5, 2], 'food': [6, 2], 'frown': [7, 2], 'fullscreen': [8, 2], 'gear': [9, 2], 'gold': [0, 3], 'hammer': [1, 3], 'herbs': [2, 3], 'hourglass': [3, 3], 'house': [4, 3], 'houses': [5, 3], 'hut': [6, 3], 'info': [7, 3], 'iron': [8, 3], 'kunai': [9, 3], 'lantern': [0, 4], 'leaf': [1, 4], 'lock': [2, 4], 'luggage': [3, 4], 'map': [4, 4], 'medal': [5, 4], 'medic': [6, 4], 'megaphone': [7, 4], 'menu': [8, 4], 'minus': [9, 4], 'monument': [0, 5], 'moon': [1, 5], 'ninja': [2, 5], 'paper': [3, 5], 'party': [4, 5], 'path-slug': [5, 5], 'path-snake': [6, 5], 'path-toad': [7, 5], 'pause': [8, 5], 'paw': [9, 5], 'phone': [0, 6], 'pickaxe': [1, 6], 'pill': [2, 6], 'pin': [3, 6], 'play': [4, 6], 'plus': [5, 6], 'rain': [6, 6], 'refresh': [7, 6], 'run': [8, 6], 'ryo': [9, 6], 'save': [0, 7], 'scroll': [1, 7], 'select': [2, 7], 'shield': [3, 7], 'ship': [4, 7], 'skull': [5, 7], 'smile': [6, 7], 'snow': [7, 7], 'star': [8, 7], 'stone': [9, 7], 'storm': [0, 8], 'sun': [1, 8], 'swords': [2, 8], 'target': [3, 8], 'text': [4, 8], 'todo': [5, 8], 'tower': [6, 8], 'trash': [7, 8], 'trophy': [8, 8], 'up': [9, 8], 'users': [0, 9], 'vest': [1, 9], 'wheat': [2, 9], 'wood': [3, 9], 'x': [4, 9] } };
export const CARDS: Atlas = { url: cardsAtlas, cols: 10, rows: 2, pos: { 'seal-A': [0, 0], 'seal-B': [1, 0], 'seal-C': [2, 0], 'seal-D': [3, 0], 'seal-S': [4, 0], 'org-goen': [5, 0], 'org-kagero': [6, 0], 'org-mizuchi': [7, 0], 'org-raiga': [8, 0], 'org-shiryo': [9, 0], 'org-tetsuo': [0, 1], 'org-tsuchigumo': [1, 1], 'org-yomi': [2, 1] } };
export const ART: Record<string, string> = { 'beast-slug': ar_beast_slug, 'beast-snake': ar_beast_snake, 'beast-toad': ar_beast_toad, 'kage-bg': ar_kage_bg, 'kunai-hiraishin': ar_kunai_hiraishin, 'scene-autumn': ar_scene_autumn, 'scene-festival': ar_scene_festival, 'scene-spring': ar_scene_spring, 'scene-summer': ar_scene_summer, 'scene-village': ar_scene_village, 'scene-winter': ar_scene_winter };
