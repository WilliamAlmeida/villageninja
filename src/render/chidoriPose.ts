// Animação por recortes das peças já montadas: mantém cabelo, roupa e cores do ninja.
// As poses baixas têm uma palma própria; só o quadro de contato usa o braço estendido.
type Pic = HTMLImageElement | HTMLCanvasElement;
const cache = new WeakMap<Pic,WeakMap<Pic,HTMLCanvasElement>>();
export function chidoriHandPoint(row:number,frame:number):[number,number] {
  if(frame===3)return row===0?[57,49]:row===1?[41,57]:[52,48];
  const shoulder = row===0 ? (frame===0?[35,53]:[38,51]) : row===1?[37,53]:[40,51];
  const angle = frame===0?70:row===0?105:80;
  return [shoulder[0]!+25*Math.cos(angle*Math.PI/180),shoulder[1]!+25*Math.sin(angle*Math.PI/180)];
}
export function chidoriArt(walk:Pic|null,strike:Pic):Pic {
  if(!walk || walk.dataset.name!=='ninja-body' || strike.dataset.pose!=='strike')return strike;
  let byStrike=cache.get(walk);if(!byStrike)cache.set(walk,byStrike=new WeakMap());
  const ready=byStrike.get(strike);if(ready)return ready;
  const w=walk.width/4,h=walk.height/3;
  if(w!==63||h!==80)return strike;
  const out=document.createElement('canvas');out.width=walk.width;out.height=walk.height;
  out.dataset.name='ninja-body';out.dataset.pose='strike';out.dataset.chidori='1';
  const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  for(let row=0;row<3;row++)for(let phase=0;phase<4;phase++){
    ctx.save();ctx.translate(phase*w,row*h);ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    if(phase===3){ctx.drawImage(strike,2*w,row*h,w,h,0,0,w,h);ctx.restore();continue;}
    const charge=phase===0,lean=row===0?(charge?4:7):0,down=charge?5:2;
    const legSource=charge?strike:walk,legCol=charge?0:phase===1?0:2;
    ctx.drawImage(legSource,legCol*w,row*h+62,w,18,0,62,w,18);
    // Corpo inclinado: cada linha se desloca em relação ao quadril fixo.
    const left=row===0?26:25,right=row===0?38:39;
    for(let y=46;y<64;y++){
      const shift=Math.round(lean*(64-y)/18);
      ctx.drawImage(walk,w+left,row*h+y,right-left,1,left+shift,y+down,right-left,1);
    }
    // Cabeça e acessórios acompanham o tronco, sem alterar o penteado.
    ctx.drawImage(walk,w,row*h,w,46,lean,down,w,46);
    const shoulder=row===0?(charge?[35,53]:[38,51]):row===1?[37,53]:[40,51];
    function arm(x:number,y:number,angle:number,length=1){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle*Math.PI/180);ctx.scale(length,1);
      // Manga/antebraço/palma da própria roupa montada, extraídos do braço horizontal.
      ctx.drawImage(strike,2*w+32,46,28,8,0,-3,28,8);ctx.restore();
    }
    if(charge)arm(row===0?27:25,58,30,.65); // segunda mão junto ao antebraço baixo
    else arm(row===0?33:25,52,-30,.65);
    arm(shoulder[0]!,shoulder[1]!,charge?70:row===0?105:80);
    ctx.restore();
  }
  byStrike.set(strike,out);return out;
}