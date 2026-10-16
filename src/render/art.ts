// Arte em pixel art (PNG pequenos em src/art, gerados por IA e preparados por scripts/prepare-art.py).
// O jogo é sempre em pixel art; o desenho procedural de sprites.ts só aparece enquanto a imagem carrega (ou fora do
// navegador, nos testes).
import { DOLL_FRAME_PAD, DOLL_GRID, type DollPart, type DollPose, hex, hsv, tintPixels } from './doll';
import dollPoses from '../data/doll-poses.json';
import { artLayout, layoutVersion, type ArtLayout } from '../data/layout';
import hokage from '../art/buildings/hokage.png';
import house from '../art/buildings/house.png';
import lumber from '../art/buildings/lumber.png';
import quarry from '../art/buildings/quarry.png';
import market from '../art/buildings/market.png';
import academy from '../art/buildings/academy.png';
import hospital from '../art/buildings/hospital.png';
import tower from '../art/buildings/tower.png';
import library from '../art/buildings/library.png';
import library2 from '../art/buildings/library-2.png';
import library3 from '../art/buildings/library-3.png';
import missions from '../art/buildings/missions.png';
import ironmine from '../art/buildings/ironmine.png';
import forge from '../art/buildings/forge.png';
import pharmacy from '../art/buildings/pharmacy.png';
import sealshop from '../art/buildings/sealshop.png';
import monument from '../art/buildings/monument.png';
import farm from '../art/buildings/farm.png';
import training from '../art/buildings/training.png';
import herbgarden from '../art/buildings/herbgarden.png';
import villager from '../art/characters/villager.png';
import rogue from '../art/characters/rogue.png';
import boar from '../art/animals/boar.png';
import wolf from '../art/animals/wolf.png';
import bear from '../art/animals/bear.png';
import tree0 from '../art/scenery/tree0.png';
import tree1 from '../art/scenery/tree1.png';
import rock from '../art/scenery/rock.png';
import ore from '../art/scenery/ore.png';
import herb from '../art/scenery/herb.png';
import chop from '../art/characters/villager-chop.png';
import mine from '../art/characters/villager-mine.png';
import hoe from '../art/characters/villager-farm.png';
import rockCracked from '../art/scenery/rock-cracked.png';
import stump0 from '../art/scenery/stump0.png';
import stump1 from '../art/scenery/stump1.png';
import rockPebbles from '../art/scenery/rock-pebbles.png';
import oreEmpty from '../art/scenery/ore-empty.png';
import house2 from '../art/buildings/house-2.png';
import house3 from '../art/buildings/house-3.png';
// variantes dos prédios repetidos (render/variants.ts): casa -b/-c, lenhador/pedreira/fazenda -b, por nível
import houseBArt from '../art/buildings/house-b.png';
import houseB2Art from '../art/buildings/house-b-2.png';
import houseB3Art from '../art/buildings/house-b-3.png';
import houseCArt from '../art/buildings/house-c.png';
import houseC2Art from '../art/buildings/house-c-2.png';
import houseC3Art from '../art/buildings/house-c-3.png';
import lumberBArt from '../art/buildings/lumber-b.png';
import lumberB2Art from '../art/buildings/lumber-b-2.png';
import lumberB3Art from '../art/buildings/lumber-b-3.png';
import quarryBArt from '../art/buildings/quarry-b.png';
import quarryB2Art from '../art/buildings/quarry-b-2.png';
import quarryB3Art from '../art/buildings/quarry-b-3.png';
import farmBArt from '../art/buildings/farm-b.png';
import farmB2Art from '../art/buildings/farm-b-2.png';
import farmB3Art from '../art/buildings/farm-b-3.png';
import lumber2 from '../art/buildings/lumber-2.png';
import lumber3 from '../art/buildings/lumber-3.png';
import quarry2 from '../art/buildings/quarry-2.png';
import quarry3 from '../art/buildings/quarry-3.png';
import market2 from '../art/buildings/market-2.png';
import market3 from '../art/buildings/market-3.png';
import towerTop from '../art/buildings/tower-top.png';
import hospital2 from '../art/buildings/hospital-2.png';
import hospital3 from '../art/buildings/hospital-3.png';
import farm2 from '../art/buildings/farm-2.png';
import farm3 from '../art/buildings/farm-3.png';
import training2 from '../art/buildings/training-2.png';
import training3 from '../art/buildings/training-3.png';
import academy2 from '../art/buildings/academy-2.png';
import academy3 from '../art/buildings/academy-3.png';
import hokage2 from '../art/buildings/hokage-2.png';
import hokage3 from '../art/buildings/hokage-3.png';
import hokage4 from '../art/buildings/hokage-4.png';
// ninja em camadas (scripts/prepare-layers.py): corpo-base com folga no quadro + peças em cor-chave
import ninjaBody from '../art/ninja/body/ninja-body.png';
import caveProps from '../art/props/cave-props.png';
import cropWheat from '../art/fields/crop-wheat.png';
import cropTurnip from '../art/fields/crop-turnip.png';
import cropCabbage from '../art/fields/crop-cabbage.png';
import cropRice from '../art/fields/crop-rice.png';
import cropPumpkin from '../art/fields/crop-pumpkin.png';
import cropHerbs from '../art/fields/crop-herbs.png';
import fieldSoil from '../art/fields/field-soil.png';
import fieldFence from '../art/fields/field-fence.png';
// bestas com cauda (Fera Colossal de cada cauda, data/bijuu.ts)
import bijuu1 from '../art/animals/bijuu-1.png';
import bijuu2 from '../art/animals/bijuu-2.png';
import bijuu3 from '../art/animals/bijuu-3.png';
import bijuu4 from '../art/animals/bijuu-4.png';
import bijuu5 from '../art/animals/bijuu-5.png';
import bijuu6 from '../art/animals/bijuu-6.png';
import bijuu7 from '../art/animals/bijuu-7.png';
import bijuu8 from '../art/animals/bijuu-8.png';
import bijuu9 from '../art/animals/bijuu-9.png';
// poses de golpe e selos do ninja em camadas (scripts/prepare-layers.py --pose)
import ninjaBodyStrike from '../art/ninja/body/ninja-body-strike.png';
import ninjaBodyCast from '../art/ninja/body/ninja-body-cast.png';
import ninjaBodyKick from '../art/ninja/body/ninja-body-kick.png';
import ninjaBodyAir from '../art/ninja/body/ninja-body-air.png';
import layerCloakKageAir from '../art/ninja/layers/layer-cloak-kage-air.png';
import layerCloakKageHurt from '../art/ninja/layers/layer-cloak-kage-hurt.png';
import layerOutfitGeninAir from '../art/ninja/layers/layer-outfit-genin-air.png';
import layerVestChuninAir from '../art/ninja/layers/layer-vest-chunin-air.png';
import layerVestJouninAir from '../art/ninja/layers/layer-vest-jounin-air.png';
import layerCoatSanninAir from '../art/ninja/layers/layer-coat-sannin-air.png';
import layerOutfitAnbuAir from '../art/ninja/layers/layer-outfit-anbu-air.png';
import ninjaBodyHurt from '../art/ninja/body/ninja-body-hurt.png';
import layerOutfitGeninHurt from '../art/ninja/layers/layer-outfit-genin-hurt.png';
import layerVestChuninHurt from '../art/ninja/layers/layer-vest-chunin-hurt.png';
import layerVestJouninHurt from '../art/ninja/layers/layer-vest-jounin-hurt.png';
import layerCoatSanninHurt from '../art/ninja/layers/layer-coat-sannin-hurt.png';
import layerOutfitAnbuHurt from '../art/ninja/layers/layer-outfit-anbu-hurt.png';
import layerOutfitGeninKick from '../art/ninja/layers/layer-outfit-genin-kick.png';
import layerVestChuninKick from '../art/ninja/layers/layer-vest-chunin-kick.png';
import layerVestJouninKick from '../art/ninja/layers/layer-vest-jounin-kick.png';
import layerCoatSanninKick from '../art/ninja/layers/layer-coat-sannin-kick.png';
import layerCloakKageKick from '../art/ninja/layers/layer-cloak-kage-kick.png';
import layerOutfitAnbuKick from '../art/ninja/layers/layer-outfit-anbu-kick.png';
import layerOutfitGeninStrike from '../art/ninja/layers/layer-outfit-genin-strike.png';
import layerVestChuninStrike from '../art/ninja/layers/layer-vest-chunin-strike.png';
import layerVestJouninStrike from '../art/ninja/layers/layer-vest-jounin-strike.png';
import layerCoatSanninStrike from '../art/ninja/layers/layer-coat-sannin-strike.png';
import layerCloakKageStrike from '../art/ninja/layers/layer-cloak-kage-strike.png';
import layerOutfitAnbuStrike from '../art/ninja/layers/layer-outfit-anbu-strike.png';
import layerOutfitGeninCast from '../art/ninja/layers/layer-outfit-genin-cast.png';
import layerVestChuninCast from '../art/ninja/layers/layer-vest-chunin-cast.png';
import layerVestJouninCast from '../art/ninja/layers/layer-vest-jounin-cast.png';
import layerCoatSanninCast from '../art/ninja/layers/layer-coat-sannin-cast.png';
import layerCloakKageCast from '../art/ninja/layers/layer-cloak-kage-cast.png';
import layerOutfitAnbuCast from '../art/ninja/layers/layer-outfit-anbu-cast.png';
import layerOutfitGenin from '../art/ninja/layers/layer-outfit-genin.png';
import layerHeadband from '../art/ninja/layers/layer-headband.png';
import layerVestJounin from '../art/ninja/layers/layer-vest-jounin.png';
import layerCoatSannin from '../art/ninja/layers/layer-coat-sannin.png';
import layerCloakKage from '../art/ninja/layers/layer-cloak-kage.png';
import layerHatKage from '../art/ninja/layers/layer-hat-kage.png';
import layerSwordZabuza from '../art/ninja/layers/layer-sword-zabuza.png';
import swordZabuza from '../art/weapons/sword-zabuza.png';
import swordSamehada from '../art/weapons/sword-samehada.png';
import swordKiba from '../art/weapons/sword-kiba.png';
import swordHiramekarei from '../art/weapons/sword-hiramekarei.png';
import swordNuibari from '../art/weapons/sword-nuibari.png';
import swordKabutowari from '../art/weapons/sword-kabutowari.png';
import swordShibuki from '../art/weapons/sword-shibuki.png';
import swordKusanagi from '../art/weapons/sword-kusanagi.png';
import swordSakumo from '../art/weapons/sword-sakumo.png';
import swordAsuma from '../art/weapons/sword-asuma.png';
import swordRaijin from '../art/weapons/sword-raijin.png';
import swordBee from '../art/weapons/sword-bee.png';

import layerVestChunin from '../art/ninja/layers/layer-vest-chunin.png';
import layerHairSpiky from '../art/ninja/layers/layer-hair-spiky.png';
import layerHairPonytail from '../art/ninja/layers/layer-hair-ponytail.png';
import layerHairShort from '../art/ninja/layers/layer-hair-short.png';
import layerHairLong from '../art/ninja/layers/layer-hair-long.png';
import layerHairBuns from '../art/ninja/layers/layer-hair-buns.png';
import layerOutfitAnbu from '../art/ninja/layers/layer-outfit-anbu.png';
import layerSwordSamehada from '../art/ninja/layers/layer-sword-samehada.png';
import layerSwordKiba from '../art/ninja/layers/layer-sword-kiba.png';
import layerSwordHiramekarei from '../art/ninja/layers/layer-sword-hiramekarei.png';
import layerSwordNuibari from '../art/ninja/layers/layer-sword-nuibari.png';
import layerSwordKabutowari from '../art/ninja/layers/layer-sword-kabutowari.png';
import layerSwordShibuki from '../art/ninja/layers/layer-sword-shibuki.png';
import layerSwordKusanagi from '../art/ninja/layers/layer-sword-kusanagi.png';
import layerSwordSakumo from '../art/ninja/layers/layer-sword-sakumo.png';
import layerSwordAsuma from '../art/ninja/layers/layer-sword-asuma.png';
import layerSwordRaijin from '../art/ninja/layers/layer-sword-raijin.png';
import layerSwordBee from '../art/ninja/layers/layer-sword-bee.png';
import layerSwordTanto from '../art/ninja/layers/layer-sword-tanto.png';
import layerMaskFox from '../art/ninja/layers/layer-mask-fox.png';
import layerMaskTiger from '../art/ninja/layers/layer-mask-tiger.png';
import layerMaskCrow from '../art/ninja/layers/layer-mask-crow.png';
import layerMaskOwl from '../art/ninja/layers/layer-mask-owl.png';
import layerMaskBoar from '../art/ninja/layers/layer-mask-boar.png';
import layerMaskHawk from '../art/ninja/layers/layer-mask-hawk.png';
import layerMaskBear from '../art/ninja/layers/layer-mask-bear.png';
import layerMaskMonkey from '../art/ninja/layers/layer-mask-monkey.png';
// bustos pintados (retratos da interface), nas mesmas cores-chave das bases: recoloridos por ninja com tintedArt
import bustSpiky from '../art/ninja/busts/bust-spiky.png';
import bustPonytail from '../art/ninja/busts/bust-ponytail.png';
import bustShort from '../art/ninja/busts/bust-short.png';
import bustLong from '../art/ninja/busts/bust-long.png';
import bustBuns from '../art/ninja/busts/bust-buns.png';
import bustBald from '../art/ninja/busts/bust-bald.png';
// o mesmo busto com o chapéu e o manto de Kage (retrato do Kage atual)
import kageBustSpiky from '../art/ninja/busts/kage-bust-spiky.png';
import kageBustPonytail from '../art/ninja/busts/kage-bust-ponytail.png';
import kageBustShort from '../art/ninja/busts/kage-bust-short.png';
import kageBustLong from '../art/ninja/busts/kage-bust-long.png';
import kageBustBuns from '../art/ninja/busts/kage-bust-buns.png';
import kageBustBald from '../art/ninja/busts/kage-bust-bald.png';
import snake from '../art/animals/snake.png';
import crow from '../art/animals/crow.png';
import monkey from '../art/animals/monkey.png';
import spider from '../art/animals/spider.png';
import tiger from '../art/animals/tiger.png';
import rhino from '../art/animals/rhino.png';
import hydra from '../art/animals/hydra.png';
import golem from '../art/animals/golem.png';
import puppet from '../art/characters/puppet.png';
import ruin from '../art/scenery/ruin.png';
import chest from '../art/scenery/chest.png';
import chestOpen from '../art/scenery/chest-open.png';
import cave from '../art/scenery/cave.png';
import port from '../art/buildings/port.png';
import kennel from '../art/buildings/kennel.png';
// Pedra Memorial e Monte dos Kages com 1 a 6 rostos
import memorialArt from '../art/buildings/memorial.png';
import monumentF1Art from '../art/buildings/monument-f1.png';
import monumentF2Art from '../art/buildings/monument-f2.png';
import monumentF3Art from '../art/buildings/monument-f3.png';
import monumentF4Art from '../art/buildings/monument-f4.png';
import monumentF5Art from '../art/buildings/monument-f5.png';
import monumentF6Art from '../art/buildings/monument-f6.png';
// mapas temáticos (scripts/theme-art.py)
import houseFishingArt from '../art/buildings/house-fishing.png';
import houseDesertArt from '../art/buildings/house-desert.png';
import marketFishingArt from '../art/buildings/market-fishing.png';
import marketDesertArt from '../art/buildings/market-desert.png';
import towerFishingArt from '../art/buildings/tower-fishing.png';
import towerDesertArt from '../art/buildings/tower-desert.png';
import themePropsArt from '../art/props/theme-props.png';
// bustos por patente: colete (Chunin/Jounin) e sobretudo (Sannin) em magenta (scripts/bust-ranks.py)
import bustSpikyVestArt from '../art/ninja/busts/bust-spiky-vest.png';
import bustPonytailVestArt from '../art/ninja/busts/bust-ponytail-vest.png';
import bustShortVestArt from '../art/ninja/busts/bust-short-vest.png';
import bustLongVestArt from '../art/ninja/busts/bust-long-vest.png';
import bustBunsVestArt from '../art/ninja/busts/bust-buns-vest.png';
import bustBaldVestArt from '../art/ninja/busts/bust-bald-vest.png';
import bustSpikyCoatArt from '../art/ninja/busts/bust-spiky-coat.png';
import bustPonytailCoatArt from '../art/ninja/busts/bust-ponytail-coat.png';
import bustShortCoatArt from '../art/ninja/busts/bust-short-coat.png';
import bustLongCoatArt from '../art/ninja/busts/bust-long-coat.png';
import bustBunsCoatArt from '../art/ninja/busts/bust-buns-coat.png';
import bustBaldCoatArt from '../art/ninja/busts/bust-bald-coat.png';
// poses sentado e carregando, capa do sensei e pergaminho nas costas (ninja em camadas)
import ninjaBodySitArt from '../art/ninja/body/ninja-body-sit.png';
import ninjaBodyCarryArt from '../art/ninja/body/ninja-body-carry.png';
import layerOutfitGeninSitArt from '../art/ninja/layers/layer-outfit-genin-sit.png';
import layerVestChuninSitArt from '../art/ninja/layers/layer-vest-chunin-sit.png';
import layerVestJouninSitArt from '../art/ninja/layers/layer-vest-jounin-sit.png';
import layerCoatSanninSitArt from '../art/ninja/layers/layer-coat-sannin-sit.png';
import layerCloakKageSitArt from '../art/ninja/layers/layer-cloak-kage-sit.png';
import layerOutfitAnbuSitArt from '../art/ninja/layers/layer-outfit-anbu-sit.png';
import layerOutfitGeninCarryArt from '../art/ninja/layers/layer-outfit-genin-carry.png';
import layerVestChuninCarryArt from '../art/ninja/layers/layer-vest-chunin-carry.png';
import layerVestJouninCarryArt from '../art/ninja/layers/layer-vest-jounin-carry.png';
import layerCoatSanninCarryArt from '../art/ninja/layers/layer-coat-sannin-carry.png';
import layerCloakKageCarryArt from '../art/ninja/layers/layer-cloak-kage-carry.png';
import layerOutfitAnbuCarryArt from '../art/ninja/layers/layer-outfit-anbu-carry.png';
import layerCapeArt from '../art/ninja/layers/layer-cape.png';
import layerScrollBackArt from '../art/ninja/layers/layer-scroll-back.png';
// segunda versão da ruína e da entrada da mina (Codex); cada região do mapa sorteia uma (Renderer.siteArt)
import ruinAltArt from '../art/scenery/ruin-alt.png';
import caveAltArt from '../art/scenery/cave-alt.png';
// decorações (scripts/deco-grid.py)
import decoLantern from '../art/buildings/deco/lantern.png';
import decoBench from '../art/buildings/deco/bench.png';
import decoFlowers from '../art/buildings/deco/flowers.png';
import decoBanner from '../art/buildings/deco/banner.png';
import decoShrine from '../art/buildings/deco/shrine.png';
import decoStatue from '../art/buildings/deco/statue.png';
import decoCherry from '../art/buildings/deco/cherry.png';
import decoCherryGreen from '../art/buildings/deco/cherry-green.png';
import decoCherryBare from '../art/buildings/deco/cherry-bare.png';
import decoFountain from '../art/buildings/deco/fountain.png';
import decoPond from '../art/buildings/deco/pond.png';
import decoPagoda from '../art/buildings/deco/pagoda.png';
import arena from '../art/buildings/arena.png';
import orgGoen from '../art/characters/org-goen.png';
import soundIwao from '../art/characters/sound-iwao.png';
import soundKumomaru from '../art/characters/sound-kumomaru.png';
import soundKanade from '../art/characters/sound-kanade.png';
import soundSokon from '../art/characters/sound-sokon.png';
import soundHakkotsu from '../art/characters/sound-hakkotsu.png';
import orgTetsuo from '../art/characters/org-tetsuo.png';
import orgMizuchi from '../art/characters/org-mizuchi.png';
import orgRaiga from '../art/characters/org-raiga.png';
import orgKagero from '../art/characters/org-kagero.png';
import orgShiryo from '../art/characters/org-shiryo.png';
import orgTsuchigumo from '../art/characters/org-tsuchigumo.png';
import orgYomi from '../art/characters/org-yomi.png';
import forge2 from '../art/buildings/forge-2.png';
import forge3 from '../art/buildings/forge-3.png';
import pharmacy2 from '../art/buildings/pharmacy-2.png';
import pharmacy3 from '../art/buildings/pharmacy-3.png';
import sealshop2 from '../art/buildings/sealshop-2.png';
import sealshop3 from '../art/buildings/sealshop-3.png';
import intel from '../art/buildings/intel.png';
import puppetshop from '../art/buildings/puppetshop.png';
import dog from '../art/animals/dog.png';
import dogWhite from '../art/animals/dog-white.png';
import dogPug from '../art/animals/dog-pug.png';
import dogBull from '../art/animals/dog-bull.png';
import toad from '../art/animals/toad.png';
import slug from '../art/animals/slug.png';
import projectileHousenka from '../art/effects/projectile-housenka.png';
import projectileGoukakyuu from '../art/effects/projectile-goukakyuu.png';
import projectileMizurappa from '../art/effects/projectile-mizurappa.png';
import projectileHirudora from '../art/effects/projectile-hirudora.png';
import dragonHead from '../art/effects/effect-suiryuudan-head.png';
import dragonBody from '../art/effects/effect-suiryuudan-body.png';
import dragonOrigin from '../art/effects/effect-suiryuudan-origin.png';
import effectSuirou from '../art/effects/effect-suirou.png';
import rasenganSphere from '../art/effects/effect-rasengan-v1.png';
import rasenganImpact from '../art/effects/effect-rasengan-impact-v1.png';
import rasenganCrater from '../art/effects/effect-rasengan-crater-v1.png';
import rasenshuriken from '../art/effects/projectile-rasenshuriken-v1.png';
import rasenshurikenImpact from '../art/effects/effect-rasenshuriken-impact-v1.png';
import doryuuhekiWall from '../art/effects/effect-doryuuheki-v1.png';
import doryuuhekiProfile from '../art/effects/effect-doryuuheki-profile-v1.png';
import doryuuhekiOblique from '../art/effects/effect-doryuuheki-oblique-v1.png';
import doryuudanOrigin from '../art/effects/effect-doryuudan-origin-v1.png';
import doryuudanMud from '../art/effects/projectile-doryuudan-v1.png';
import sandShield from '../art/effects/effect-sunanotate-v1.png';
import sandCoffin from '../art/effects/effect-sabakukyu-v1.png';
import kirinStrike from '../art/effects/effect-kirin-v1.png';
import jukaiRoots from '../art/effects/effect-jukai-v1.png';
import raikyuuSphere from '../art/effects/projectile-raikyuu-v1.png';
import nagashiDischarge from '../art/effects/effect-chidorinagashi-v1.png';
import kaitenDome from '../art/effects/effect-kaiten-v1.png';
import chidoriHand from '../art/effects/effect-chidori-hand-v2.png';
import chidoriImpact from '../art/effects/effect-chidori-impact-v1.png';
import sensatsuNeedles from '../art/effects/effect-sensatsu-v1.png';
import reizaHalo from '../art/effects/effect-reiza-v1.png';
import kajosatsuSun from '../art/effects/effect-kajosatsu-v1.png';
import lionFists from '../art/effects/effect-soshiken-v1.png';
import fangDrill from '../art/effects/effect-gatsuga-v1.png';
import rollingBall from '../art/effects/effect-nikudan-v2.png';
import yokaiLava from '../art/effects/projectile-yokai-v1.png';
import yokaiSplash from '../art/effects/effect-yokai-impact-v1.png';
import daitoppaGust from '../art/effects/effect-daitoppa-v1.png';
import shinkuuBlade from '../art/effects/projectile-shinkuuha-v1.png';

const URLS: Record<string, string> = { hokage, house, lumber, quarry, market, academy, hospital, tower, library, missions, ironmine, forge, pharmacy, sealshop, monument, farm, training, herbgarden, villager, rogue, boar, wolf, bear, tree0, tree1, rock, ore, herb,
  'projectile-housenka': projectileHousenka, 'projectile-goukakyuu': projectileGoukakyuu,
  'projectile-mizurappa': projectileMizurappa, 'projectile-hirudora': projectileHirudora, 'effect-suirou': effectSuirou,
  'effect-suiryuudan-head': dragonHead, 'effect-suiryuudan-body': dragonBody, 'effect-suiryuudan-origin': dragonOrigin,
  'effect-rasengan-v1': rasenganSphere, 'effect-rasengan-impact-v1': rasenganImpact, 'effect-rasengan-crater-v1': rasenganCrater,
  'projectile-rasenshuriken-v1': rasenshuriken, 'effect-rasenshuriken-impact-v1': rasenshurikenImpact,
  'effect-doryuuheki-v1': doryuuhekiWall, 'effect-doryuudan-origin-v1': doryuudanOrigin,
  'effect-doryuuheki-profile-v1': doryuuhekiProfile,
  'effect-doryuuheki-oblique-v1': doryuuhekiOblique,
  'projectile-doryuudan-v1': doryuudanMud, 'effect-sunanotate-v1': sandShield, 'effect-sabakukyu-v1': sandCoffin,
  'effect-kirin-v1': kirinStrike, 'effect-jukai-v1': jukaiRoots,
  'projectile-raikyuu-v1': raikyuuSphere, 'effect-chidorinagashi-v1': nagashiDischarge,
  'effect-kaiten-v1': kaitenDome,
  'effect-chidori-hand-v2': chidoriHand, 'effect-chidori-impact-v1': chidoriImpact,
  'effect-sensatsu-v1': sensatsuNeedles, 'effect-reiza-v1': reizaHalo, 'effect-kajosatsu-v1': kajosatsuSun,
  'effect-soshiken-v1': lionFists, 'effect-gatsuga-v1': fangDrill, 'effect-nikudan-v2': rollingBall,
  'projectile-yokai-v1': yokaiLava, 'effect-yokai-impact-v1': yokaiSplash, 'effect-daitoppa-v1': daitoppaGust, 'projectile-shinkuuha-v1': shinkuuBlade,
  'villager-chop': chop, 'villager-mine': mine, 'villager-farm': hoe, stump0, stump1, 'rock-cracked': rockCracked, 'rock-pebbles': rockPebbles, 'ore-empty': oreEmpty,
  // níveis de upgrade dos prédios e o guarda da torre
  'house-2': house2, 'house-3': house3, 'house-b': houseBArt, 'house-b-2': houseB2Art, 'house-b-3': houseB3Art, 'house-c': houseCArt, 'house-c-2': houseC2Art, 'house-c-3': houseC3Art, 'lumber-b': lumberBArt, 'lumber-b-2': lumberB2Art, 'lumber-b-3': lumberB3Art, 'quarry-b': quarryBArt, 'quarry-b-2': quarryB2Art, 'quarry-b-3': quarryB3Art, 'farm-b': farmBArt, 'farm-b-2': farmB2Art, 'farm-b-3': farmB3Art, 'lumber-2': lumber2, 'lumber-3': lumber3, 'quarry-2': quarry2, 'quarry-3': quarry3, 'market-2': market2, 'market-3': market3, 'tower-top': towerTop, 'hospital-2': hospital2, 'hospital-3': hospital3, 'farm-2': farm2, 'farm-3': farm3, 'training-2': training2, 'training-3': training3,
  'academy-2': academy2, 'academy-3': academy3, 'forge-2': forge2, 'forge-3': forge3, 'pharmacy-2': pharmacy2, 'pharmacy-3': pharmacy3, 'sealshop-2': sealshop2, 'sealshop-3': sealshop3, 'library-2': library2, 'library-3': library3, 'hokage-2': hokage2, 'hokage-3': hokage3, 'hokage-4': hokage4,
  'ninja-body': ninjaBody, 'cave-props': caveProps, 'crop-wheat': cropWheat, 'crop-turnip': cropTurnip, 'crop-cabbage': cropCabbage, 'crop-rice': cropRice, 'crop-pumpkin': cropPumpkin, 'crop-herbs': cropHerbs, 'field-soil': fieldSoil, 'field-fence': fieldFence, 'bijuu-1': bijuu1, 'bijuu-2': bijuu2, 'bijuu-3': bijuu3, 'bijuu-4': bijuu4, 'bijuu-5': bijuu5, 'bijuu-6': bijuu6, 'bijuu-7': bijuu7, 'bijuu-8': bijuu8, 'bijuu-9': bijuu9, 'ninja-body-strike': ninjaBodyStrike, 'ninja-body-cast': ninjaBodyCast, 'ninja-body-kick': ninjaBodyKick, 'ninja-body-air': ninjaBodyAir, 'layer-cloak-kage-air': layerCloakKageAir, 'layer-cloak-kage-hurt': layerCloakKageHurt, 'layer-outfit-genin-air': layerOutfitGeninAir, 'layer-vest-chunin-air': layerVestChuninAir, 'layer-vest-jounin-air': layerVestJouninAir, 'layer-coat-sannin-air': layerCoatSanninAir, 'layer-outfit-anbu-air': layerOutfitAnbuAir, 'ninja-body-hurt': ninjaBodyHurt, 'layer-outfit-genin-hurt': layerOutfitGeninHurt, 'layer-vest-chunin-hurt': layerVestChuninHurt, 'layer-vest-jounin-hurt': layerVestJouninHurt, 'layer-coat-sannin-hurt': layerCoatSanninHurt, 'layer-outfit-anbu-hurt': layerOutfitAnbuHurt, 'layer-outfit-genin-kick': layerOutfitGeninKick, 'layer-vest-chunin-kick': layerVestChuninKick, 'layer-vest-jounin-kick': layerVestJouninKick, 'layer-coat-sannin-kick': layerCoatSanninKick, 'layer-cloak-kage-kick': layerCloakKageKick, 'layer-outfit-anbu-kick': layerOutfitAnbuKick, 'layer-outfit-genin-strike': layerOutfitGeninStrike, 'layer-vest-chunin-strike': layerVestChuninStrike, 'layer-vest-jounin-strike': layerVestJouninStrike, 'layer-coat-sannin-strike': layerCoatSanninStrike, 'layer-cloak-kage-strike': layerCloakKageStrike, 'layer-outfit-anbu-strike': layerOutfitAnbuStrike, 'layer-outfit-genin-cast': layerOutfitGeninCast, 'layer-vest-chunin-cast': layerVestChuninCast, 'layer-vest-jounin-cast': layerVestJouninCast, 'layer-coat-sannin-cast': layerCoatSanninCast, 'layer-cloak-kage-cast': layerCloakKageCast, 'layer-outfit-anbu-cast': layerOutfitAnbuCast, 'layer-outfit-genin': layerOutfitGenin, 'layer-headband': layerHeadband, 'layer-vest-jounin': layerVestJounin, 'layer-coat-sannin': layerCoatSannin, 'layer-cloak-kage': layerCloakKage, 'layer-hat-kage': layerHatKage, 'layer-sword-zabuza': layerSwordZabuza, 'sword-zabuza': swordZabuza, 'sword-samehada': swordSamehada, 'sword-kiba': swordKiba, 'sword-hiramekarei': swordHiramekarei, 'sword-nuibari': swordNuibari, 'sword-kabutowari': swordKabutowari, 'sword-shibuki': swordShibuki, 'sword-kusanagi': swordKusanagi, 'sword-sakumo': swordSakumo, 'sword-asuma': swordAsuma, 'sword-raijin': swordRaijin, 'sword-bee': swordBee, 'layer-vest-chunin': layerVestChunin, 'layer-hair-spiky': layerHairSpiky, 'layer-hair-ponytail': layerHairPonytail, 'layer-hair-short': layerHairShort, 'layer-hair-long': layerHairLong, 'layer-hair-buns': layerHairBuns, 'layer-outfit-anbu': layerOutfitAnbu, 'layer-sword-samehada': layerSwordSamehada, 'layer-sword-kiba': layerSwordKiba, 'layer-sword-hiramekarei': layerSwordHiramekarei, 'layer-sword-nuibari': layerSwordNuibari, 'layer-sword-kabutowari': layerSwordKabutowari, 'layer-sword-shibuki': layerSwordShibuki, 'layer-sword-kusanagi': layerSwordKusanagi, 'layer-sword-sakumo': layerSwordSakumo, 'layer-sword-asuma': layerSwordAsuma, 'layer-sword-raijin': layerSwordRaijin, 'layer-sword-bee': layerSwordBee, 'layer-sword-tanto': layerSwordTanto, 'layer-mask-fox': layerMaskFox, 'layer-mask-tiger': layerMaskTiger, 'layer-mask-crow': layerMaskCrow, 'layer-mask-owl': layerMaskOwl, 'layer-mask-boar': layerMaskBoar, 'layer-mask-hawk': layerMaskHawk, 'layer-mask-bear': layerMaskBear, 'layer-mask-monkey': layerMaskMonkey, 'bust-spiky': bustSpiky, 'bust-ponytail': bustPonytail, 'bust-short': bustShort, 'bust-long': bustLong, 'bust-buns': bustBuns, 'bust-bald': bustBald, 'kage-bust-spiky': kageBustSpiky, 'kage-bust-ponytail': kageBustPonytail, 'kage-bust-short': kageBustShort, 'kage-bust-long': kageBustLong, 'kage-bust-buns': kageBustBuns, 'kage-bust-bald': kageBustBald, snake, crow, monkey, spider, tiger, rhino, hydra, golem, puppet, ruin, chest, 'chest-open': chestOpen, cave, port, kennel, 'ruin-alt': ruinAltArt, 'cave-alt': caveAltArt, 'ninja-body-sit': ninjaBodySitArt, 'ninja-body-carry': ninjaBodyCarryArt, 'layer-outfit-genin-sit': layerOutfitGeninSitArt, 'layer-vest-chunin-sit': layerVestChuninSitArt, 'layer-vest-jounin-sit': layerVestJouninSitArt, 'layer-coat-sannin-sit': layerCoatSanninSitArt, 'layer-cloak-kage-sit': layerCloakKageSitArt, 'layer-outfit-anbu-sit': layerOutfitAnbuSitArt, 'layer-outfit-genin-carry': layerOutfitGeninCarryArt, 'layer-vest-chunin-carry': layerVestChuninCarryArt, 'layer-vest-jounin-carry': layerVestJouninCarryArt, 'layer-coat-sannin-carry': layerCoatSanninCarryArt, 'layer-cloak-kage-carry': layerCloakKageCarryArt, 'layer-outfit-anbu-carry': layerOutfitAnbuCarryArt, 'layer-cape': layerCapeArt, 'layer-scroll-back': layerScrollBackArt, 'bust-spiky-vest': bustSpikyVestArt, 'bust-ponytail-vest': bustPonytailVestArt, 'bust-short-vest': bustShortVestArt, 'bust-long-vest': bustLongVestArt, 'bust-buns-vest': bustBunsVestArt, 'bust-bald-vest': bustBaldVestArt, 'bust-spiky-coat': bustSpikyCoatArt, 'bust-ponytail-coat': bustPonytailCoatArt, 'bust-short-coat': bustShortCoatArt, 'bust-long-coat': bustLongCoatArt, 'bust-buns-coat': bustBunsCoatArt, 'bust-bald-coat': bustBaldCoatArt, 'house-fishing': houseFishingArt, 'house-desert': houseDesertArt, 'market-fishing': marketFishingArt, 'market-desert': marketDesertArt, 'tower-fishing': towerFishingArt, 'tower-desert': towerDesertArt, 'theme-props': themePropsArt, 'memorial': memorialArt, 'monument-f1': monumentF1Art, 'monument-f2': monumentF2Art, 'monument-f3': monumentF3Art, 'monument-f4': monumentF4Art, 'monument-f5': monumentF5Art, 'monument-f6': monumentF6Art, 'lantern': decoLantern, 'bench': decoBench, 'flowers': decoFlowers, 'banner': decoBanner, 'shrine': decoShrine, 'statue': decoStatue, 'cherry': decoCherry, 'cherry-green': decoCherryGreen, 'cherry-bare': decoCherryBare, 'fountain': decoFountain, 'pond': decoPond, 'pagoda': decoPagoda, arena, intel, puppetshop, dog, 'dog-white': dogWhite, 'dog-pug': dogPug, 'dog-bull': dogBull, toad, slug,
  // Ordem do Eclipse
  'org-goen': orgGoen, 'org-tetsuo': orgTetsuo, 'org-mizuchi': orgMizuchi, 'org-raiga': orgRaiga, 'org-kagero': orgKagero, 'org-shiryo': orgShiryo, 'org-tsuchigumo': orgTsuchigumo, 'org-yomi': orgYomi, 'sound-iwao': soundIwao, 'sound-kumomaru': soundKumomaru, 'sound-kanade': soundKanade, 'sound-sokon': soundSokon, 'sound-hakkotsu': soundHakkotsu };

/**
 * Folhas de sprite no padrão de scripts/sprite-template.py: 4 quadros (ciclo de caminhada) × 3 linhas
 * (0 = de lado olhando para a direita, 1 = de frente, 2 = de costas). O quadro parado é a coluna 1.
 */
export const SHEET_ROWS = { side: 0, front: 1, back: 2 } as const;
const SHEET = { frames: 4, rows: 3, idle: 1 };
/** Bases de ninja (uma por penteado) desenhadas em cores-chave: cabelo verde e roupa azul, recoloridas por ninja. */
export const NINJA_HAIRSTYLES = ['spiky', 'ponytail', 'short', 'long', 'buns', 'bald'] as const;
const SHEETS = new Set(['ninja-body', 'villager', 'rogue', 'boar', 'wolf', 'bear', 'snake', 'crow', 'monkey', 'spider', 'tiger', 'rhino', 'hydra', 'golem', 'puppet', 'dog', 'dog-white', 'dog-pug', 'dog-bull', 'toad', 'slug', 'villager-chop', 'villager-mine', 'villager-farm', 'org-goen', 'org-tetsuo', 'org-mizuchi', 'org-raiga', 'org-kagero', 'org-shiryo', 'org-tsuchigumo', 'org-yomi', 'sound-iwao', 'sound-kumomaru', 'sound-kanade', 'sound-sokon', 'sound-hakkotsu', ...Array.from({ length: 9 }, (_, i) => `bijuu-${i + 1}`)]);

const images = new Map<string, HTMLImageElement>();

/** URL do PNG (para usar no DOM, ex.: fundo dos cards de construção). */
/**
 * Escala extra de alguns sprites de prédio em relação à largura da base. Usado quando os níveis de upgrade
 * ganham alas laterais: sem isso o corpo do prédio encolhe para caber na mesma largura e parece que diminuiu.
 */
export const ART_SCALE: Record<string, number> = {
  // torres dos mapas temáticos: terreno 2×2 desde a v33; a arte 1×1 de antes fica 20% maior até chegar a nova
  'tower-fishing': 0.6, 'tower-desert': 0.6,
  missions: 1.25,
  // decorações: a largura do desenho em relação ao losango do terreno (lanterna fina, cerejeira passa do tile)
  lantern: 0.45, bench: 0.85, flowers: 0.8, banner: 0.55, shrine: 0.85, statue: 0.6, cherry: 1.3, 'cherry-green': 1.3, 'cherry-bare': 1.3,
  fountain: 0.95, pond: 1, pagoda: 0.9, memorial: 0.62,
};

export const artUrl = (name: string): string | null => URLS[name] ?? null;

/** Imagem pronta para desenhar, ou null (arte desligada, nome sem imagem, ainda carregando). */
/**
 * Carrega todas as imagens antes do jogo começar a desenhar (senão, enquanto um PNG não chega, aparece o
 * desenho antigo no lugar). `onProgress` recebe 0..1. Imagem que falhar não trava: o jogo usa o desenho antigo nela.
 */
export function preloadArt(onProgress: (k: number) => void = () => {}): Promise<void> {
  const names = Object.keys(URLS);
  let done = 0;
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !names.length) return resolve();
    for (const name of names) {
      art(name); // cria o <img> e começa a baixar
      const img = images.get(name)!;
      const finish = () => {
        done++;
        onProgress(done / names.length);
        if (done === names.length) resolve();
      };
      if (img.complete) finish();
      else {
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
      }
    }
  });
}

/** Folhas de efeito registradas (projectile-*, effect-*): o painel "Ajuste" do Laboratório escolhe entre elas. */
export const EFFECT_SHEETS = Object.keys(URLS).filter((k) => /^(projectile|effect)-/.test(k));

export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined' || !(name in URLS)) return null;
  let img = images.get(name);
  if (!img) {
    img = new Image();
    img.src = URLS[name]!;
    img.dataset.name = name;
    images.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

type Pic = HTMLImageElement | HTMLCanvasElement;
const size = (img: Pic) => (img instanceof HTMLImageElement ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.width, h: img.height });

const SINGLE = { frames: 1, rows: 1, idle: 0 };
export const artFrames = (img: Pic) => (SHEETS.has(img.dataset.name ?? '') ? SHEET : SINGLE);
/** Folhas com folga em cima do quadro (cabelo alto, chapéu): a altura pedida vale para o corpo, o quadro é maior. */
const FRAME_PAD: Record<string, number> = { 'ninja-body': DOLL_FRAME_PAD };

/** Cópias reduzidas de cada arte (½, ¼, ⅛ do tamanho), feitas uma vez: o "mipmap" próprio. */
const MIP_LEVELS = 3;
type Mip = HTMLCanvasElement | ImageBitmap;
interface MipEntry {
  iw: number;
  ih: number;
  levels: Mip[];
  /** Até que nível já foi pedido (a cadeia assíncrona vai até ele). */
  wanted: number;
  building: boolean;
}
const mips = new WeakMap<Pic, MipEntry>();
const canBitmap = typeof createImageBitmap === 'function';

/**
 * Cópia `level` (1 = metade) da arte, feita uma vez a partir da anterior. As artes e os canvas guardados (boneco,
 * estação, peças) não mudam depois de prontos; se o tamanho mudar, refaz. Feita FORA da thread do jogo
 * (`createImageBitmap` com redução de qualidade): fazer na hora, no quadro em que a arte aparecia, custava 20-40 ms por
 * arte grande no celular fraco (o primeiro quadro passava de 1 s). Enquanto não está pronta, devolve a melhor que já
 * existe (ou null = a arte original, com suavização simples por um instante). Sem `createImageBitmap` (testes,
 * navegador antigo), faz na hora como antes.
 */
function mipLevel(img: Pic, level: number): Mip | null {
  const { w, h } = size(img);
  if (!w || !h) return null;
  let e = mips.get(img);
  if (!e || e.iw !== w || e.ih !== h) {
    e = { iw: w, ih: h, levels: [], wanted: 0, building: false };
    mips.set(img, e);
  }
  if (e.levels.length >= level) return e.levels[level - 1]!;
  if (canBitmap) {
    if (e.wanted < level) e.wanted = level;
    if (!e.building) void buildMips(img, e);
    return e.levels[e.levels.length - 1] ?? null;
  }
  for (let l = e.levels.length + 1; l <= level; l++) e.levels.push(shrinkToCanvas(l === 1 ? img : e.levels[l - 2]!, w, h, l));
  return e.levels[level - 1] ?? null;
}

function shrinkToCanvas(prev: Pic | Mip, w: number, h: number, level: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w / 2 ** level));
  c.height = Math.max(1, Math.round(h / 2 ** level));
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(prev, 0, 0, c.width, c.height);
  return c;
}

/** Cadeia assíncrona das cópias de uma arte, até o nível pedido (pode crescer enquanto roda). */
async function buildMips(img: Pic, e: MipEntry) {
  e.building = true;
  try {
    while (e.levels.length < e.wanted) {
      const l = e.levels.length + 1;
      const prev = l === 1 ? img : e.levels[l - 2]!;
      const tw = Math.max(1, Math.round(e.iw / 2 ** l));
      const th = Math.max(1, Math.round(e.ih / 2 ** l));
      let m: Mip;
      try {
        m = await createImageBitmap(prev, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' });
        // navegador que ignora o tamanho pedido (Safari antigo): reduz na hora a partir do bitmap
        if (m.width !== tw || m.height !== th) {
          const c = shrinkToCanvas(m, e.iw, e.ih, l);
          m.close();
          m = c;
        }
      } catch {
        m = shrinkToCanvas(prev, e.iw, e.ih, l);
      }
      // a arte mudou de tamanho enquanto isso (entrada trocada): descarta
      if (mips.get(img) !== e) {
        if (m instanceof ImageBitmap) m.close();
        return;
      }
      e.levels.push(m);
    }
  } finally {
    e.building = false;
  }
}

/** Pede as cópias reduzidas (até ¼) das artes do cenário em pé, que aparecem aos montes no primeiro quadro. */
export function warmMips() {
  for (const name of Object.keys(URLS)) if (/^(tree|stump|rock|ore|herb)/.test(name)) {
    const img = art(name);
    if (img && img.naturalWidth) mipLevel(img, 2);
  }
}

/** Nível de cópia reduzida para uma escala na tela (px de tela por px da arte): a cópia que fica entre ½ e 1. */
export function mipFor(scale: number): number {
  if (!(scale > 0) || scale >= 0.5) return 0;
  return Math.min(MIP_LEVELS, Math.floor(Math.log2(1 / scale)));
}

/**
 * Desenha o recorte (sx, sy, sw, sh) da arte no retângulo (dx, dy, dw, dh). Ampliando: sem suavização (pixel art
 * nítida). Reduzindo (zoom baixo; prédios e cenário são guardados em 2×): a cópia reduzida mais próxima, com suavização
 * simples. Antes era suavização "high" na arte inteira, que a GPU refaz a cada desenho: com o mapa todo à vista eram
 * ~2 mil desenhos assim por quadro e o FPS caía para ~24 mesmo pausado. Deixa a suavização ligada/desligada como ficou.
 */
export function drawShrunk(ctx: CanvasRenderingContext2D, img: Pic, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
  const t = ctx.getTransform();
  const scale = Math.abs(dw * Math.hypot(t.a, t.b)) / sw;
  const shrink = scale < 0.98;
  ctx.imageSmoothingEnabled = shrink;
  if (shrink) ctx.imageSmoothingQuality = 'low';
  const level = shrink ? mipFor(scale) : 0;
  const m = level ? mipLevel(img, level) : null;
  if (m) {
    const k = m.width / size(img).w;
    ctx.drawImage(m, sx * k, sy * k, sw * k, sh * k, dx, dy, dw, dh);
  } else ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** `drawShrunk` da arte inteira. */
export function drawWhole(ctx: CanvasRenderingContext2D, img: Pic, dx: number, dy: number, dw: number, dh: number) {
  const { w, h } = size(img);
  drawShrunk(ctx, img, 0, 0, w, h, dx, dy, dw, dh);
}

/**
 * Geometria do quadro: px de tela por px do quadro (`k`, a altura pedida vale o CORPO: `body` do layout.json, ou o
 * quadro inteiro) e o ponto de origem no quadro (`feet` do quadro, senão `foot`: os pés; sem, o meio da base).
 */
function frameFit(img: Pic, height: number, frame = 0, row = 0) {
  const g = geoOf(img);
  const [fx, fy] = g.lay?.feet?.[row * g.sheet.frames + frame] ?? g.lay?.foot ?? [g.fw / 2, g.fh];
  return { sheet: g.sheet, fw: g.fw, fh: g.fh, k: height / g.body, fx, fy };
}

/** O que não muda de um desenho para outro na mesma imagem (folha, quadro, layout, altura do corpo). */
interface Geo {
  v: number;
  iw: number;
  ih: number;
  sheet: typeof SHEET;
  fw: number;
  fh: number;
  body: number;
  lay: ArtLayout | undefined;
}
/**
 * Guardado por imagem (refeito quando o layout é editado ou a imagem muda de tamanho): com o mapa inteiro à vista são
 * ~2 mil desenhos por quadro, e ler `dataset` + layout em cada um pesava mais que o próprio `drawImage`.
 */
const geos = new WeakMap<Pic, Geo>();
function geoOf(img: Pic): Geo {
  const { w: iw, h: ih } = size(img);
  const hit = geos.get(img);
  if (hit && hit.v === layoutVersion && hit.iw === iw && hit.ih === ih) return hit;
  const name = img.dataset.name ?? '';
  const sheet = SHEETS.has(name) ? SHEET : SINGLE;
  const fw = iw / sheet.frames;
  const fh = ih / sheet.rows;
  const lay = artLayout(name);
  const g = { v: layoutVersion, iw, ih, sheet, fw, fh, body: lay?.body ?? fh / (FRAME_PAD[name] ?? 1), lay };
  if (iw) geos.set(img, g); // imagem ainda carregando (0×0): não guarda
  return g;
}

/**
 * Desenha a imagem (ou o quadro `frame` da linha `row` de uma folha) com a origem (os pés) em (x, baseY), na altura
 * pedida. `flip` espelha na horizontal (em volta da origem). Ampliando, sem suavização; reduzindo, pela cópia reduzida (`drawShrunk`).
 */
export function drawArt(ctx: CanvasRenderingContext2D, img: Pic, x: number, baseY: number, height: number, flip = false, frame = 0, row = 0) {
  const { fw, fh, k, fx, fy } = frameFit(img, height, frame, row);
  if (flip) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    drawShrunk(ctx, img, fw * frame, fh * row, fw, fh, -fx * k, baseY - fy * k, fw * k, fh * k);
    ctx.restore();
    return;
  }
  // sem espelhar: sem save/restore (caro em ~2 mil desenhos por quadro); só a suavização volta como estava
  const on = ctx.imageSmoothingEnabled;
  const q = ctx.imageSmoothingQuality;
  drawShrunk(ctx, img, fw * frame, fh * row, fw, fh, x - fx * k, baseY - fy * k, fw * k, fh * k);
  ctx.imageSmoothingEnabled = on;
  ctx.imageSmoothingQuality = q;
}

/** Retângulo em que `drawArt` desenha um quadro (as mesmas contas, sem espelhar), para prender coisas a pontos da arte. */
export function artRect(img: Pic, x: number, baseY: number, height: number, frame = 0, row = 0) {
  const { sheet, fw, fh, k, fx, fy } = frameFit(img, height, frame, row);
  return { left: x - fx * k, top: baseY - fy * k, w: fw * k, h: fh * k, fw, fh, frames: sheet.frames };
}

const feet = new WeakMap<object, { cx: number; by: number; hw: number }>();
/**
 * Onde a arte toca o chão, em fração da imagem: centro (`cx`) e meia largura (`hw`) do corpo principal (as colunas
 * com bastante pixel, ignorando moedas e pedrinhas soltas) e a linha de baixo dele (`by`). O anel de seleção, o brilho
 * de "ainda não investigado" e a sombra se centram aí, e não no meio do quadrado da imagem.
 */
export function artFoot(pic: Pic) {
  const hit = feet.get(pic);
  if (hit) return hit;
  const { w, h } = size(pic);
  if (!w || !h) return { cx: 0.5, by: 1, hw: 0.4 };
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(pic, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  const cols = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]! > 128) cols[x]!++;
  const max = Math.max(...cols);
  let x0 = cols.findIndex((n) => n >= max * 0.35);
  let x1 = w - 1 - [...cols].reverse().findIndex((n) => n >= max * 0.35);
  if (x0 < 0) [x0, x1] = [0, w - 1];
  let by = h - 1;
  outer: for (; by > 0; by--) for (let x = x0; x <= x1; x++) if (d[(by * w + x) * 4 + 3]! > 128) break outer;
  const foot = { cx: (x0 + x1 + 1) / 2 / w, by: (by + 1) / h, hw: (x1 - x0 + 1) / 2 / w };
  feet.set(pic, foot);
  return foot;
}

const whites = new WeakMap<object, HTMLCanvasElement>();
/** A arte toda branca (mesmo alfa), para o clarão de quem levou dano. */
export const whiteArt = (pic: Pic) => solidArt(pic, '#fff');

const solids = new Map<string, WeakMap<object, HTMLCanvasElement>>([['#fff', whites]]);
/** A arte toda numa cor só (mesmo alfa): clarão de dano (branco), silhueta da aura do Modo Sábio (laranja). */
export function solidArt(pic: Pic, color: string): HTMLCanvasElement {
  let cache = solids.get(color);
  if (!cache) solids.set(color, (cache = new WeakMap()));
  const hit = cache.get(pic);
  if (hit) return hit;
  const { w, h } = size(pic);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.dataset.name = pic.dataset.name ?? '';
  const ctx = c.getContext('2d')!;
  ctx.drawImage(pic, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  cache.set(pic, c);
  return c;
}

// ------------------------------------------------------------------ recoloração ("paper doll")
const tinted = new Map<string, HTMLCanvasElement>();

/**
 * Folha recolorida: troca as cores-chave da base (cabelo verde, roupa azul) e o tom de pele pelas cores pedidas,
 * mantendo o sombreado (a luminosidade relativa de cada pixel). Fica em cache por combinação.
 */
export function tintedArt(name: string, colors: { hair: string; cloth: string; skin: string; vest?: string }): HTMLCanvasElement | null {
  const key = `${name}|${colors.hair}|${colors.cloth}|${colors.skin}|${colors.vest ?? ''}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const img = art(name);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.dataset.name = name;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  // [cor nova, brilho (v) do tom médio da cor-chave na base]
  const hair: [number[], number] = [hex(colors.hair), 0.8];
  const cloth: [number[], number] = [hex(colors.cloth), 1];
  const skin: [number[], number] = [hex(colors.skin), 0.96];
  // colete/sobretudo dos bustos por patente: a cor-chave magenta (scripts/bust-ranks.py)
  const vest: [number[], number] | null = colors.vest ? [hex(colors.vest), 1] : null;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 10) continue;
    const { h, s, v } = hsv(px[i]!, px[i + 1]!, px[i + 2]!);
    const to =
      vest && s > 0.45 && h >= 280 && h <= 335 ? vest
      : s > 0.35 && h >= 85 && h <= 165 ? hair : s > 0.35 && h >= 200 && h <= 255 ? cloth : h >= 10 && h <= 45 && s > 0.12 && s < 0.6 && v > 0.6 ? skin : null;
    if (!to) continue;
    const k = v / to[1];
    for (let j = 0; j < 3; j++) {
      const base = to[0][j]! * k;
      // acima do tom médio clareia em direção ao branco (brilhos), abaixo escurece
      px[i + j] = k <= 1 ? base : to[0][j]! + (255 - to[0][j]!) * Math.min(1, k - 1);
    }
  }
  ctx.putImageData(data, 0, 0);
  tinted.set(key, c);
  return c;
}

// ------------------------------------------------------------------ ninja em camadas
const dolls = new Map<string, HTMLCanvasElement>();

/**
 * Monta o ninja desenhando as peças uma por cima da outra, cada uma recolorida (`tintPixels`, doll.ts). Fica em cache
 * por combinação. Sem o corpo carregado, null (o jogo usa a folha antiga).
 */
export function dollArt(parts: DollPart[], skin: string, pose?: DollPose): HTMLCanvasElement | null {
  const key = `${parts.map((p) => `${p.name}:${p.color ?? ''}:${p.color2 ?? ''}`).join('+')}|${skin}|${pose ?? ''}`;
  const hit = dolls.get(key);
  if (hit) return hit;
  // pose (golpe, selos): corpo da pose; peça com arte da pose usa a dela, as outras (cabelo, bandana, máscara, chapéu,
  // espadas) o quadro parado da caminhada deslocado junto com a cabeça (src/data/doll-poses.json)
  const sfx = pose ? `-${pose}` : '';
  const body = art(pose ? `ninja-body${sfx}` : parts[0]!.name);
  // peça que muda com o braço e ainda não tem a arte desta pose: o boneco fica na caminhada (melhor que a peça
  // parada desenhada por cima de um corpo deitado ou no ar)
  if (pose && parts.some((p) => (dollPoses.pieces as string[]).includes(p.name.replace(/^layer-/, '')) && !(`${p.name}${sfx}` in URLS))) return null;
  const layers = parts.map((p, i) => (i === 0 ? body : (pose && art(`${p.name}${sfx}`)) || art(p.name)));
  if (!body || layers.some((l) => !l)) {
    if (pose) for (const p of parts) art(`${p.name}${sfx}`); // começa a carregar; até lá o jogo usa a caminhada
    return null;
  }
  const c = document.createElement('canvas');
  c.width = body.naturalWidth;
  c.height = body.naturalHeight;
  c.dataset.name = 'ninja-body';
  if (pose) c.dataset.pose = pose;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const tmp = document.createElement('canvas');
  tmp.width = c.width;
  tmp.height = c.height;
  const tx = tmp.getContext('2d', { willReadFrequently: true })!;
  const fw = c.width / DOLL_GRID.cols;
  const fh = c.height / DOLL_GRID.rows;
  const offs = pose ? (dollPoses.offsets as Record<string, number[][]>)[pose] : undefined;
  for (const [i, p] of parts.entries()) {
    const img = layers[i]!;
    tx.clearRect(0, 0, tmp.width, tmp.height);
    const own = !pose || i === 0 || img.dataset.name === `${p.name}${sfx}`;
    if (own) tx.drawImage(img, 0, 0);
    else {
      // quadro parado da caminhada, centrado na célula da pose (pode ser mais larga) e deslocado com a cabeça
      const sw = img.naturalWidth / DOLL_GRID.cols;
      for (let r = 0; r < DOLL_GRID.rows; r++)
        for (let col = 0; col < DOLL_GRID.cols; col++) {
          const i = r * DOLL_GRID.cols + col;
          // cabeça inclinada ou deitada (atingido): gira as peças em volta do meio da cabeça
          const tilt = pose ? (dollPoses.tilt as Record<string, (number[] | null)[]>)[pose]?.[i] : null;
          if (tilt) {
            const [ang, px, py, wx, wy] = tilt as [number, number, number, number, number];
            tx.save();
            tx.beginPath();
            tx.rect(col * fw, r * fh, fw, fh);
            tx.clip();
            tx.translate(col * fw + px, r * fh + py);
            tx.rotate((ang * Math.PI) / 180);
            tx.drawImage(img, DOLL_GRID.idle * sw, r * fh, sw, fh, -wx, -wy, sw, fh);
            tx.restore();
            continue;
          }
          const [dx, dy] = offs?.[i] ?? [0, 0];
          tx.drawImage(img, DOLL_GRID.idle * sw, r * fh, sw, fh, col * fw + (fw - sw) / 2 + dx!, r * fh + dy!, sw, fh);
        }
    }
    const data = tx.getImageData(0, 0, tmp.width, tmp.height);
    tintPixels(data.data, p, i === 0, skin);
    tx.putImageData(data, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  }
  dolls.set(key, c);
  return c;
}
