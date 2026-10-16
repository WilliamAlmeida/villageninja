import { sekizoTick } from '../sekizo';
import { healingTick } from '../healing';
import { fx } from '../fx';
import { dissolveEdo } from '../mindJutsu';
import { castTick, dashTick } from '../combat';
import type { Game } from '../game';

/** Selos em andamento (ritmo tático) e investidas (Chidori): seguem sozinhos, fora da IA de cada um. */
export function techniqueSystem(g: Game, dt: number) {
  for (const u of g.state.units) {
    if(u.healRetry)u.healRetry=Math.max(0,u.healRetry-dt);

    if(u.cloneIntro!=null){u.cloneIntro-=dt;if(u.cloneIntro<=0){u.cloneIntro=undefined;u.hidden=false;}}
    if(u.edoIntro){
      const owner=g.unit(u.ownerId);
      if(u.dead||!owner||owner.dead){u.dead=true;u.hidden=false;u.edoIntro=undefined;continue;}
      u.edoIntro.elapsed+=dt;
      if(u.edoIntro.elapsed>=1.5){fx(g,'jutsuOrigin',u.edoIntro.x,u.edoIntro.y,{fx:'edotensei',life:.65,color:'#8a6844'});u.x=u.edoIntro.exitX;u.y=u.edoIntro.exitY;u.edoIntro=undefined;u.hidden=false;}
      continue;
    }
    if(u.edo&&!u.dead){const owner=g.unit(u.ownerId);if((u.life=(u.life??0)-dt)<=0||!owner||owner.dead){dissolveEdo(g,u);continue;}}
    if(u.kind==='clone'&&!u.dead&&u.cloneIntro==null){if((u.life=(u.life??0)-dt)<=0){u.dead=true;fx(g,'smoke',u.x,u.y,{r:16,life:.6,color:'#e8e8e8',fx:'kagebunshin'});continue;}}
    if(u.healing)healingTick(g,u,dt);
    if (u.barrage) { sekizoTick(g, u, dt); continue; }
    if (u.dead) { u.dash = undefined; continue; }
    if (u.dash) dashTick(g, u, dt);
    else if (u.cast) castTick(g, u, dt);
  }
}
