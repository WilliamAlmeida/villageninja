// Início das ferramentas: só põe os ícones (glifos do jogo) nos cartões.
import { ico } from '../shared/ui';

for (const u of document.querySelectorAll<SVGUseElement>('use[href^="#g-"]')) {
  const name = u.getAttribute('href')!.slice(3);
  const svg = u.closest('svg')!;
  svg.outerHTML = ico(name);
}
