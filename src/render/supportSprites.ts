import { FX } from '../data/jutsuFx';
import type { Effect,Unit } from '../game/types';
import { project,projectAngle } from '../core/iso';
import { art } from './art';
import { drawSpriteFx } from './jutsuSprites';
const tinted=new Map<string,HTMLCanvasElement>();
export function drawSmokePoof(ctx:CanvasRenderingContext2D,e:Effect){
 if(e.fx!=='kagebunshin')return false;const s=FX.jutsus.kagebunshin?.sprite,img=s&&art(s.sheet);if(!s||!img)return false;
 const key=s.sheet+':'+e.color;let variant=tinted.get(key);
 if(!variant){variant=document.createElement('canvas');variant.width=img.naturalWidth;variant.height=img.naturalHeight;const c=variant.getContext('2d')!;c.drawImage(img,0,0);c.globalCompositeOperation='multiply';c.fillStyle=e.color;c.fillRect(0,0,variant.width,variant.height);c.globalCompositeOperation='destination-in';c.drawImage(img,0,0);if(tinted.size>=24)tinted.delete(tinted.keys().next().value!);tinted.set(key,variant);}
 return drawSpriteFx(ctx,{...s,size:s.size*(e.r??18)/18},e.x,e.y,0,0,0,undefined,Math.min(s.frames-1,Math.floor(e.t/e.life*s.frames)),variant);
}
export function drawHealingHand(ctx:CanvasRenderingContext2D,u:Unit,x:number,y:number){
 const h=u.healing,s=FX.jutsus.shousen?.sprite;if(!h||h.stage==='approach'||!s)return;
 const f=h.stage==='ending'?6+Math.min(1,Math.floor(h.t/.1)):h.t<.2?Math.min(2,Math.floor(h.t/.07)):2+Math.floor(h.t*s.fps)%4;
 drawSpriteFx(ctx,s,x,y,0,0,0,undefined,f);
}
/** Base recortada pelo chão; ninja real entre interior escuro e moldura/tampa. */
export function drawEdoCoffin(ctx:CanvasRenderingContext2D,u:Unit,t:number,draw:(copy:Unit)=>void){
 const f=u.edoIntro,s=FX.jutsus.edotensei?.sprite;if(!f||!s||!art(s.sheet))return false;
 const p=project(f.x,f.y),size=s.size,x=p.x+(s.dx??0),floor=p.y+9,base=p.y+s.dy;
 const rise=Math.min(1,f.elapsed/.55),y=base+(1-rise)*size*.85;
 const frame=f.elapsed<.55?0:Math.min(7,2+Math.floor((f.elapsed-.55)/.55*5));
 const step=Math.max(0,Math.min(1,(f.elapsed-1.1)/.4));
 const exit=project(f.exitX,f.exitY);
 const inside={x:x+size*(.61-s.anchorX),y:y+size*(.82-s.anchorY)-9};
 const copy={...u,hidden:false,edoIntro:undefined,x:inside.x+(exit.x-inside.x)*step,y:inside.y+(exit.y-inside.y)*step,facing:step>.4?projectAngle(u.facing):Math.PI/2,moving:step>0,anim:0,drawScale:1};
 ctx.save();ctx.beginPath();ctx.rect(x-size*2,floor-size*3,size*4,size*3);ctx.clip();
 // Abertura vazada: fundo pertence ao cenário composto e não está pintado na fonte.
 ctx.fillStyle='#30271f';ctx.fillRect(x+size*(.55-s.anchorX),y+size*(.12-s.anchorY),size*.19,size*.7);
 if(f.elapsed>.75&&step<.65)draw(copy);
 drawSpriteFx(ctx,{...s,dx:0,dy:0},x,y,0,0,0,undefined,frame);
 ctx.restore();if(step>=.65)draw(copy);return true;
}
export function drawEdoRemnant(ctx:CanvasRenderingContext2D,e:Effect){
 const s=FX.jutsus.edotensei?.sprite;if(!s)return false;const p=project(e.x,e.y);
 const fade=Math.min(1,(e.life-e.t)/.4),x=p.x+(s.dx??0),y=p.y+s.dy;
 ctx.save();ctx.globalAlpha*=s.opacity*fade;ctx.fillStyle='#30271f';ctx.fillRect(x+s.size*(.55-s.anchorX),y+s.size*(.12-s.anchorY),s.size*.19,s.size*.7);ctx.restore();
 return drawSpriteFx(ctx,{...s,opacity:s.opacity*fade},p.x,p.y,0,0,0,undefined,7);
}