// Canhão longo de pressão, com bordas claras e interior transparente.
import { project } from '../core/iso';
import { FX } from '../data/jutsuFx';
import type { Projectile } from '../game/types';
export function drawPressureTube(ctx: CanvasRenderingContext2D, x:number,y:number,tx:number,ty:number,index=0,fade=1) {
 const s=FX.jutsus.sekizo?.cannon, angle=Math.atan2(ty-y,tx-x);
 const length=Math.hypot(tx-x,ty-y),ahead=s?.forward??14,width=(s?.width??28)*(1+index*.08);
 if(length<=ahead)return;
 ctx.save();ctx.translate(x,y+(s?.dy??-4));ctx.rotate(angle);
 const alpha=(s?.opacity??.62)*fade;
 ctx.globalAlpha=alpha;
 const body=ctx.createLinearGradient(0,-width*.5,0,width*.5);
 body.addColorStop(0,'#f4fbffcc');body.addColorStop(.15,'#d9edf055');
 body.addColorStop(.5,'#f4ffff88');body.addColorStop(.85,'#d9edf055');body.addColorStop(1,'#f4fbffcc');
 ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(ahead,-width*.42);ctx.lineTo(length,-width*.5);
 ctx.ellipse(length,0,width*.18,width*.5,0,-Math.PI/2,Math.PI/2);
 ctx.lineTo(ahead,width*.42);ctx.ellipse(ahead,0,width*.12,width*.42,0,Math.PI/2,Math.PI*1.5);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#edf9ff';ctx.lineWidth=1.25;
 for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(ahead,side*width*.42);ctx.lineTo(length,side*width*.5);ctx.stroke();}
 ctx.globalAlpha=alpha*.22;ctx.lineWidth=.8;
 ctx.beginPath();ctx.ellipse(length,0,width*.18,width*.5,0,-Math.PI/2,Math.PI/2);ctx.stroke();
 ctx.globalAlpha=alpha*.24;
 for(const k of [-.22,0,.22]){ctx.beginPath();ctx.moveTo(ahead+3,width*k);ctx.lineTo(length-2,width*k*1.15);ctx.stroke();}
 ctx.restore();
}
export function drawPressureProjectile(ctx:CanvasRenderingContext2D,p:Projectile) {
 if(!p.cannon)return false;
 const from=project(p.cannon.sx,p.cannon.sy);
 drawPressureTube(ctx,from.x,from.y-8,p.x,p.y,p.cannon.index);return true;
}
