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
import kHudBar from '../art/ui/kit2/hud-bar.png';
import kHudSlot from '../art/ui/kit2/hud-slot.png';
import kDock from '../art/ui/kit2/dock.png';
import kDockSlot from '../art/ui/kit2/dock-slot.png';
import kDockSlotOn from '../art/ui/kit2/dock-slot-on.png';
import kPortrait from '../art/ui/kit2/portrait.png';
import kCard from '../art/ui/kit2/card.png';
import kCardGenin from '../art/ui/kit2/card-genin.png';
import kCardChunin from '../art/ui/kit2/card-chunin.png';
import kCardJounin from '../art/ui/kit2/card-jounin.png';
import kCardSannin from '../art/ui/kit2/card-sannin.png';
import kCardKage from '../art/ui/kit2/card-kage.png';
import kRow from '../art/ui/kit2/row.png';
import kRowPlain from '../art/ui/kit2/row-plain.png';
import kLabel from '../art/ui/kit2/label.png';
import kDivider from '../art/ui/kit2/divider.png';

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
  'hud-bar': kHudBar,
  'hud-slot': kHudSlot,
  'dock': kDock,
  'dock-slot': kDockSlot,
  'dock-slot-on': kDockSlotOn,
  'portrait': kPortrait,
  'card': kCard,
  'card-genin': kCardGenin,
  'card-chunin': kCardChunin,
  'card-jounin': kCardJounin,
  'card-sannin': kCardSannin,
  'card-kage': kCardKage,
  'row': kRow,
  'row-plain': kRowPlain,
  'label': kLabel,
  'divider': kDivider,
};

export function applyKit() {
  const st = document.documentElement.style;
  for (const [k, url] of Object.entries(KIT)) st.setProperty(`--k2-${k}`, `url(${url})`);
}
