// Gerado por scripts/prepare-ui.py: assets de interface em pixel art (atlas de ícones e dos selos de rank, ilustrações).

import atlas_icons from '../art/ui/icons.png';
import atlas_badge_ranks from '../art/ui/badge-ranks.png';
import ar_beast_slug from '../art/ui/art/beast-slug.png';
import ar_beast_snake from '../art/ui/art/beast-snake.png';
import ar_beast_toad from '../art/ui/art/beast-toad.png';
import ar_kage_bg from '../art/ui/art/kage-bg.png';
import ar_kunai_card from '../art/ui/art/kunai-card.png';
import ar_perk_buildings from '../art/ui/art/perk-buildings.png';
import ar_perk_clans from '../art/ui/art/perk-clans.png';
import ar_perk_kage from '../art/ui/art/perk-kage.png';
import ar_perk_taxes from '../art/ui/art/perk-taxes.png';
import ar_perk_territory from '../art/ui/art/perk-territory.png';
import ar_perk_threat from '../art/ui/art/perk-threat.png';
import ar_scene_autumn from '../art/ui/art/scene-autumn.png';
import ar_scene_festival from '../art/ui/art/scene-festival.png';
import ar_scene_spring from '../art/ui/art/scene-spring.png';
import ar_scene_summer from '../art/ui/art/scene-summer.png';
import ar_scene_village from '../art/ui/art/scene-village.png';
import ar_scene_winter from '../art/ui/art/scene-winter.png';

/** Um atlas: imagem, colunas × linhas e a casa (coluna, linha) de cada item. */
export interface Atlas { url: string; cols: number; rows: number; pos: Record<string, [number, number]> }
export const ICONS: Atlas = { url: atlas_icons, cols: 10, rows: 4, pos: { 'anvil': [0, 0], 'arena': [1, 0], 'beast': [2, 0], 'blade-dark': [3, 0], 'bomb': [4, 0], 'candle': [5, 0], 'castle': [6, 0], 'chakra-crystal': [7, 0], 'crystal': [8, 0], 'darksteel': [9, 0], 'drop': [0, 1], 'eclipse': [1, 1], 'food': [2, 1], 'gold': [3, 1], 'hammer': [4, 1], 'herbs': [5, 1], 'iron': [6, 1], 'kunai': [7, 1], 'map': [8, 1], 'ninja': [9, 1], 'paper': [0, 2], 'path-slug': [1, 2], 'path-snake': [2, 2], 'path-toad': [3, 2], 'pickaxe': [4, 2], 'pill': [5, 2], 'ryo': [6, 2], 'scroll': [7, 2], 'select': [8, 2], 'shield': [9, 2], 'stone': [0, 3], 'swords': [1, 3], 'vest-crystal': [2, 3], 'vest': [3, 3], 'wood': [4, 3] } };
export const BADGE_RANKS: Atlas = { url: atlas_badge_ranks, cols: 5, rows: 1, pos: { 'seal-A': [0, 0], 'seal-B': [1, 0], 'seal-C': [2, 0], 'seal-D': [3, 0], 'seal-S': [4, 0] } };
export const ART: Record<string, string> = { 'beast-slug': ar_beast_slug, 'beast-snake': ar_beast_snake, 'beast-toad': ar_beast_toad, 'kage-bg': ar_kage_bg, 'kunai-card': ar_kunai_card, 'perk-buildings': ar_perk_buildings, 'perk-clans': ar_perk_clans, 'perk-kage': ar_perk_kage, 'perk-taxes': ar_perk_taxes, 'perk-territory': ar_perk_territory, 'perk-threat': ar_perk_threat, 'scene-autumn': ar_scene_autumn, 'scene-festival': ar_scene_festival, 'scene-spring': ar_scene_spring, 'scene-summer': ar_scene_summer, 'scene-village': ar_scene_village, 'scene-winter': ar_scene_winter };
