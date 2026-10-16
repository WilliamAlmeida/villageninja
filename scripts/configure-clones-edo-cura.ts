import { FX,formatFx,type SpriteFx } from '../src/data/jutsuFx';
const base:SpriteFx={sheet:'',cols:4,rows:2,frames:8,fps:14,size:48,anchorX:.5,anchorY:.5,dy:0,opacity:1,blend:'normal',rotate:false,flip:false};
for(const [id,s] of Object.entries({kagebunshin:{...base,sheet:'effect-smoke-poof-v1',anchorY:.94,size:48,dy:9},edotensei:{...base,sheet:'effect-edo-coffin-v1',size:62,anchorX:.65,anchorY:.88,dy:9},shousen:{...base,sheet:'effect-shousen-palm-v1',size:22}}))FX.jutsus[id]={...FX.jutsus[id],sprite:{...s,...FX.jutsus[id]?.sprite}};
await Bun.write('src/data/jutsu-fx.json',formatFx(FX));