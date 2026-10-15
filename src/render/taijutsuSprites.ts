import { art } from './art';
import { drawSpriteFx } from './jutsuSprites';
import { spriteFx } from '../data/jutsuFx';
import type { Unit } from '../game/types';
import { dollParts } from './doll';

const colored = new Map<string, { source: HTMLImageElement; pic: HTMLCanvasElement }>();

/** A roupa externa usa as mesmas cores da montagem do ninja. */
export function rollingCloth(u: Unit): string {
  const parts = dollParts({ style: 'short', rank: u.ninja?.rank,
    sannin: u.ninja?.sannin, anbu: u.ninja?.anbu, look: u.look });
  return parts?.filter(p => /^layer-(outfit|vest|coat|cloak)-/.test(p.name)).at(-1)?.color ?? u.look.cloth;
}

/** Recolore somente tecido neutro; mantém contorno, costuras e poeira bege. */
function rollingSheet(sheet: string, color: string): HTMLCanvasElement | null {
  const source = art(sheet);
  if (!source?.naturalWidth) return null;
  const key = sheet + '|' + color, cached = colored.get(key);
  if (cached?.source === source) return cached.pic;
  const pic = document.createElement('canvas');
  pic.width = source.naturalWidth; pic.height = source.naturalHeight;
  const ctx = pic.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, pic.width, pic.height), d = pixels.data;
  const rgb = [1,3,5].map(i => parseInt(color.slice(i,i+2),16));
  for (let i=0;i<d.length;i+=4) {
    if (!d[i+3]) continue;
    const hi=Math.max(d[i]!,d[i+1]!,d[i+2]!),lo=Math.min(d[i]!,d[i+1]!,d[i+2]!);
    if (hi-lo>16 || hi<=40) continue;
    const light=(d[i]!+d[i+1]!+d[i+2]!)/3/145;
    for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(rgb[k]!*light));
  }
  ctx.putImageData(pixels,0,0);
  if (colored.size >= 128) colored.delete(colored.keys().next().value!);
  colored.set(key,{source,pic});
  return pic;
}

/** Retorna true apenas quando a transformação substituiu o corpo com sucesso. */
export function drawRollingBody(ctx: CanvasRenderingContext2D, u: Unit, id: string | undefined, t: number): boolean {
  if (u.dead || u.stun>0 || (id!=='gatsuga' && id!=='nikudan')) return false;
  const s=spriteFx(id);
  if (!s || !art(s.sheet)?.naturalWidth) return false;
  const angle=u.facing;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath();ctx.ellipse(u.x,u.y+8,id==='nikudan'?24:21,7,0,0,Math.PI*2);ctx.fill();
  let drawn=false;
  if(id==='nikudan'){
    const pic=rollingSheet(s.sheet,rollingCloth(u));
    if(pic)drawn=drawSpriteFx(ctx,s,u.x,u.y+9,angle,t,u.id,undefined,undefined,pic);
  } else {
    // Cada participante vira uma broca na própria posição.
    drawn=drawSpriteFx(ctx,s,u.x,u.y-5,angle,t,u.id);
  }
  ctx.restore();
  return drawn;
}

export function drawLionFists(ctx: CanvasRenderingContext2D, u: Unit, t: number,
  primary: {x:number;y:number}, other: {x:number;y:number}, scale: number) {
  const s=spriteFx('soshiken');
  if(!s)return;
  const fade=Math.min(1,u.anim/.1);
  for(const [i,p]of [other,primary].entries())
    drawSpriteFx(ctx,{...s,size:s.size*scale,opacity:s.opacity*fade},p.x,p.y-3,u.facing,t,u.id+i*3);
}
