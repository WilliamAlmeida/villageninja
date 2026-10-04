import { pick } from '../core/rng';

const GIVEN = [
  'Kenta', 'Haruki', 'Aiko', 'Sora', 'Ren', 'Yui', 'Daichi', 'Hana', 'Riku', 'Mei', 'Takumi', 'Emi', 'Kaito', 'Nanami',
  'Shin', 'Rin', 'Haru', 'Yuki', 'Tetsu', 'Ayame', 'Jiro', 'Kaede', 'Isamu', 'Mio', 'Ryota', 'Saki', 'Goro', 'Natsu',
  'Hikaru', 'Asami', 'Kazuki', 'Chiyo', 'Raiden', 'Tomoe', 'Akira', 'Sayuri', 'Botan', 'Kenji', 'Momo', 'Hayato',
];
const CLANS = [
  'Hoshino', 'Takeda', 'Kurogane', 'Mizuki', 'Amano', 'Kazehaya', 'Ishida', 'Tsukimura', 'Raikō', 'Enjō',
  'Kiriyama', 'Shirase', 'Fujimori', 'Akagawa', 'Yamabuki', 'Kagenuma',
];
const ROGUE_TITLES = ['Renegado', 'Nukenin', 'Mercenário', 'Desertor'];

export const randomGiven = () => pick(GIVEN);
export const randomName = () => `${pick(CLANS)} ${pick(GIVEN)}`;
export const randomRogueName = () => `${pick(ROGUE_TITLES)} ${pick(GIVEN)}`;
/** Nome curto para exibir sobre a cabeça. */
export const shortName = (full: string) => full.split(' ').slice(-1)[0] ?? full;
