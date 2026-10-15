import { FX, formatFx, type SpriteFx } from '../src/data/jutsuFx';
const sprite=(sheet:string,size:number,anchorY=.5):SpriteFx=>({
  sheet,cols:4,rows:2,frames:8,fps:16,size,anchorX:.5,anchorY,dy:0,
  opacity:1,blend:'normal',rotate:false,flip:true
});
FX.jutsus.soshiken={...FX.jutsus.soshiken,sprite:sprite('effect-soshiken-v1',36)};
FX.jutsus.gatsuga={...FX.jutsus.gatsuga,sprite:{...sprite('effect-gatsuga-v1',76),anchorX:.65,rotate:true}};
FX.jutsus.nikudan={...FX.jutsus.nikudan,sprite:sprite('effect-nikudan-v2',84,.78)};
await Bun.write('src/data/jutsu-fx.json',formatFx(FX));
