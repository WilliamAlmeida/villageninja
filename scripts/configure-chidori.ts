import { FX, formatFx, type SpriteFx } from '../src/data/jutsuFx';
const sprite:SpriteFx={sheet:'effect-chidori-hand-v2',cols:4,rows:2,frames:8,fps:18,size:24,anchorX:.5,anchorY:.54,dy:0,opacity:1,blend:'normal',rotate:false,flip:false};
FX.jutsus.chidori={...FX.jutsus.chidori,sprite,burst:FX.jutsus.chidori?.burst ?? [],impact:{...sprite,sheet:'effect-chidori-impact-v1',size:46,anchorY:.57,dy:-13,rotate:true,flip:true}};
await Bun.write('src/data/jutsu-fx.json',formatFx(FX));