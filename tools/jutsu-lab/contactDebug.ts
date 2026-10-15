import { project } from '../../src/core/iso';
import { drawProjectile } from '../../src/render/sprites';
import type { Camera } from '../../src/core/camera';
import type { Game } from '../../src/game/game';
import { PROJECTILE_DEBUG, projectileContact, targetBody, TARGET_BODY } from '../../src/game/projectileCollision';
export function drawContactDebug(canvas:HTMLCanvasElement,camera:Camera,g:Game,enabled:boolean,time=0) {
 if(!enabled)return;
 const ctx=canvas.getContext('2d')!,ratio=canvas.width/camera.viewW;
 const screen=(p:{x:number;y:number})=>camera.sceneToScreen(p.x,p.y);
 ctx.save();ctx.setTransform(ratio,0,0,ratio,0,0);ctx.lineWidth=1.5;
 for(const u of g.state.units){if(u.dead||u.hidden)continue;const p=screen(targetBody(u));ctx.strokeStyle='#5fd3ff';ctx.beginPath();ctx.ellipse(p.x,p.y,TARGET_BODY.x*camera.zoom,TARGET_BODY.y*camera.zoom,0,0,Math.PI*2);ctx.stroke();}
 for(const p of g.state.projectiles){if(p.dead)continue;const c=projectileContact(p),pt=screen(c);ctx.strokeStyle='#ffdd55';ctx.beginPath();ctx.arc(pt.x,pt.y,Math.max(2,c.radius*camera.zoom),0,Math.PI*2);ctx.stroke();}
 const hit=PROJECTILE_DEBUG.hits.at(-1);
 if(hit?.projectile && !hit.projectile.dragon && !hit.projectile.cannon){const p=hit.projectile,xy=project(p.x,p.y),v=project(p.vx,p.vy),at=screen({x:xy.x,y:xy.y-8});ctx.save();ctx.translate(at.x,at.y);ctx.scale(camera.zoom,camera.zoom);ctx.globalAlpha=.55;drawProjectile(ctx,{...p,x:0,y:0,vx:v.x,vy:v.y},time);ctx.restore();}
 if(hit){const a=screen(hit.from),b=screen(hit.to),p=screen(hit.point),t=screen(hit.target);
 ctx.strokeStyle='#ff7a42';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 ctx.strokeStyle='#ffdd55';ctx.beginPath();ctx.moveTo(p.x-6,p.y);ctx.lineTo(p.x+6,p.y);ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x,p.y+6);ctx.stroke();
 ctx.strokeStyle='#5fd3ff';ctx.beginPath();ctx.ellipse(t.x,t.y,(TARGET_BODY.x+hit.radius)*camera.zoom,(TARGET_BODY.y+hit.radius)*camera.zoom,0,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
