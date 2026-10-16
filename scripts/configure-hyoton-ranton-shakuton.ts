import { FX,formatFx,type SpriteFx } from '../src/data/jutsuFx';
const base:SpriteFx={sheet:'',cols:4,rows:2,frames:8,fps:16,size:40,anchorX:.5,anchorY:.5,dy:0,opacity:1,blend:'normal',rotate:true,flip:false};
// Valores já regulados no painel prevalecem sobre estes padrões.
for(const id of ['sensatsu','reiza','kajosatsu']){
 const old=FX.jutsus[id]??{};
 const sprite={...base,sheet:`effect-${id}-v1`,size:id==='sensatsu'?37:id==='reiza'?9:42,
  anchorX:id==='kajosatsu'?.62:.5,rotate:id!=='reiza',hitX:id==='sensatsu'?.86:id==='kajosatsu'?.82:.5,hitY:.5,hitRadius:1,...old.sprite};
 FX.jutsus[id]={...old,sprite,trail:old.trail??[],burst:old.burst??[],impact:{...sprite,size:id==='kajosatsu'?44:id==='sensatsu'?28:14,hitX:undefined,rotate:false,...old.impact}};
}
FX.jutsus.reiza.origin={...base,sheet:'effect-reiza-v1',size:48,rotate:false,forward:14,dy:-10,mouthX:.5,mouthY:.5,life:1,...FX.jutsus.reiza.origin};
FX.jutsus.kajosatsu.burst=FX.jutsus.kajosatsu.burst?.length?FX.jutsus.kajosatsu.burst:[{shape:'mist',colors:['#fff5e8','#eadbd0'],n:7,life:[.3,.6],size:[2,4],speed:[2,8],rise:[-16,-8],dy:-10,opacity:.6,glow:false}];
await Bun.write('src/data/jutsu-fx.json',formatFx(FX));