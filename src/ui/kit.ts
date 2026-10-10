// Kit de interface em pixel art (scripts/prepare-kit2.py → src/art/ui/kit2): cada peça vira a variável CSS
// --k2-<nome>, usada por border-image no styles.css (bloco "kit 2"). Variações de cor saem do script, não daqui.

import kDialog from '../art/ui/kit2/dialog.png';
import kTitle from '../art/ui/kit2/title.png';
import kPanel from '../art/ui/kit2/panel.png';
import kCrest from '../art/ui/kit2/crest.png';
import kRound from '../art/ui/kit2/round.png';
import kButtonDark from '../art/ui/kit2/button-dark.png';
import kButtonOrange from '../art/ui/kit2/button-orange.png';
import kButtonRed from '../art/ui/kit2/button-red.png';
import kButtonGreen from '../art/ui/kit2/button-green.png';
import kButtonBlue from '../art/ui/kit2/button-blue.png';
import kBarTrack from '../art/ui/kit2/bar-track.png';
import kBarGreen from '../art/ui/kit2/bar-green.png';
import kBarRed from '../art/ui/kit2/bar-red.png';
import kBarOrange from '../art/ui/kit2/bar-orange.png';
import kBarBlue from '../art/ui/kit2/bar-blue.png';
import kBarAmber from '../art/ui/kit2/bar-amber.png';
import kPillGreen from '../art/ui/kit2/pill-green.png';
import kPillRed from '../art/ui/kit2/pill-red.png';
import kPillAmber from '../art/ui/kit2/pill-amber.png';
import kPillOrange from '../art/ui/kit2/pill-orange.png';
import kPillBlue from '../art/ui/kit2/pill-blue.png';
import kPillPurple from '../art/ui/kit2/pill-purple.png';
import kPillGray from '../art/ui/kit2/pill-gray.png';
import kTooltip from '../art/ui/kit2/tooltip.png';
import kTooltipArrow from '../art/ui/kit2/tooltip-arrow.png';

const KIT: Record<string, string> = {
  'dialog': kDialog,
  'title': kTitle,
  'panel': kPanel,
  'crest': kCrest,
  'round': kRound,
  'button-dark': kButtonDark,
  'button-orange': kButtonOrange,
  'button-red': kButtonRed,
  'button-green': kButtonGreen,
  'button-blue': kButtonBlue,
  'bar-track': kBarTrack,
  'bar-green': kBarGreen,
  'bar-red': kBarRed,
  'bar-orange': kBarOrange,
  'bar-blue': kBarBlue,
  'bar-amber': kBarAmber,
  'pill-green': kPillGreen,
  'pill-red': kPillRed,
  'pill-amber': kPillAmber,
  'pill-orange': kPillOrange,
  'pill-blue': kPillBlue,
  'pill-purple': kPillPurple,
  'pill-gray': kPillGray,
  'tooltip': kTooltip,
  'tooltip-arrow': kTooltipArrow,
};

export function applyKit() {
  const st = document.documentElement.style;
  for (const [k, url] of Object.entries(KIT)) st.setProperty(`--k2-${k}`, `url(${url})`);
}
