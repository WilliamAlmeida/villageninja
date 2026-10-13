// Visual dos jutsus ajustável no Laboratório (http://localhost:3011/lab, painel "Ajuste"): sprites dos projéteis,
// partículas de rastro e explosão por estilo (`Vfx`) com exceção por jutsu, e os números do projétil (velocidade,
// tamanho, raio, quantidade, alcance, abertura do leque). Tudo vem de `jutsu-fx.json`; o laboratório grava esse arquivo
// pelo servidor do 3011 (`/api/fx`). Só desenho, menos `proj`/`vfx` dos jutsus, que entram no JutsuDef ao carregar
// (data/jutsus.ts) e valem para o jogo todo.
import FX_RAW from './jutsu-fx.json';
import type { Vfx } from './vfx';

/** Formato de cada partícula (desenho em render/particles.ts). */
export type Shape = 'flame' | 'drop' | 'mist' | 'spark' | 'dust' | 'chip' | 'streak' | 'mote' | 'smoke' | 'flash' | 'leaf'
  | 'shard' | 'ember' | 'note' | 'needle';
export const SHAPES: Shape[] = ['flame', 'ember', 'spark', 'flash', 'mote', 'smoke', 'mist', 'drop', 'dust', 'chip', 'shard', 'streak', 'leaf', 'needle', 'note'];

/**
 * Um emissor de partículas. No rastro, `n` é por segundo (projétil grande, tamanho > 6, solta o dobro); na explosão,
 * é a quantidade (+ `nR` por px de raio, até `max`). Faixas [mín, máx] são sorteadas a cada partícula.
 */
export interface Emitter {
  shape: Shape;
  /** Cores sorteadas; "$" = a cor do jutsu/efeito. */
  colors: string[];
  n: number;
  nR?: number;
  max?: number;
  life: [number, number];
  size: [number, number];
  /** Tamanho proporcional: × raio na explosão, × tamanho do projétil ÷ 5 no rastro. */
  scale?: boolean;
  /** Velocidade em direção sorteada (na explosão, para fora e × raio ÷ 20, achatada na vertical). */
  speed: [number, number];
  /** Somado à velocidade vertical (negativo sobe na tela). */
  rise?: [number, number];
  /** Rastro: fração da velocidade do projétil que a partícula leva (negativo = solta para trás). */
  follow?: number;
  /** Espalhamento do ponto onde nasce: × tamanho do projétil (rastro) ou × raio (explosão). */
  spread?: number;
  /** Rastro: nasce tantos px atrás do projétil. */
  back?: number;
  /** Explosão: nasce num anel de raio × k, em volta (igualmente espaçadas). */
  ring?: number;
  /** Pulo: velocidade para o alto (cai com gravidade e quica) e altura inicial. */
  jump?: [number, number];
  z?: number;
  /** Desloca na vertical (px; negativo = mais alto). */
  dy?: number;
  opacity?: number;
  /** Soma luz (brilho). Sem: pelo formato (chama, faísca, clarão, ponto, brasa, gelo). */
  glow?: boolean;
  /** Desenhado antes do projétil, discreto (resíduo atrás de uma sprite). */
  under?: boolean;
  /** Chance de nascer em cada sorteio (0–1); sem: sempre. */
  chance?: number;
  /** Desligado no painel: fica guardado com os valores, mas não solta nada. */
  off?: boolean;
}

export interface StyleFx {
  trail: Emitter[];
  burst: Emitter[];
}

/** Folha de sprite em grade (cols × rows, `frames` quadros em loop) desenhada sobre o projétil ou o alvo. */
export interface SpriteFx {
  /** Nome no registro de art.ts (PNG em src/art/effects). */
  sheet: string;
  cols: number;
  rows: number;
  frames: number;
  fps: number;
  /** Largura desenhada (px de cena); a altura segue a proporção da célula. */
  size: number;
  /** Ponto da célula que fica no projétil (0–1; 0,75 = núcleo perto da frente). */
  anchorX: number;
  anchorY: number;
  dy: number;
  opacity: number;
  blend: 'normal' | 'add';
  /** Gira com a direção do voo. */
  rotate: boolean;
  /** Indo para a esquerda, espelha na vertical (a arte não fica de cabeça para baixo). */
  flip: boolean;
  /** Nasce da mão: a parte da arte que ainda está atrás do ponto de lançamento não aparece (corpo longo que sai do
   *  punho, como o tigre do Hirudora). Precisa de `rotate`. */
  emerge?: boolean;
  /**
   * `dragon`: sequência única do lançador até o alvo (Suiryuudan): cada quadro é um trecho do bote, a âncora (anchorX,
   * anchorY) é a fonte no chão e `targetX` é onde o mergulho cai na largura da célula. Escala igual nos dois eixos,
   * entre `minSize` e `maxSize` (largura da célula); longe demais, o dragão desliza até o alvo em vez de esticar.
   */
  motion?: 'loop' | 'dragon';
  targetX?: number;
  minSize?: number;
  maxSize?: number;
  /** Dragão: quanto ele inclina em pé (cisalhamento, tangente máxima) antes de girar; 0 = só gira. */
  shear?: number;
  /** Dragão modular: cabeça na folha principal, corpo encaixado à curva e fonte fixa. */
  parts?: DragonParts;
}

/**
 * Peças do dragão. Pontos em fração da célula (0–1): `neck` é onde o corpo encaixa na cabeça (a âncora da cabeça é a
 * ponta, que segue a trajetória); `origin` é a base da fonte no chão; `band` é a faixa da folha do corpo que vira o
 * corpo (topo e altura).
 */
export interface DragonParts {
  bodySheet: string;
  originSheet: string;
  bodyWidth: number;
  originSize: number;
  spacing: number;
  neckX?: number;
  neckY?: number;
  originX?: number;
  originY?: number;
  bandTop?: number;
  bandHeight?: number;
}
export const PARTS_DEFAULT = { neckX: 0.25, neckY: 0.5, originX: 0.5, originY: 0.78, bandTop: 0.3125, bandHeight: 0.375 };

/** Números do projétil que o laboratório pode mudar (entram no JutsuDef). */
export interface ProjFx {
  projSpeed?: number;
  projSize?: number;
  radius?: number;
  count?: number;
  range?: number;
  spread?: number;
}
export const PROJ_KEYS: (keyof ProjFx)[] = ['projSpeed', 'projSize', 'radius', 'count', 'range', 'spread'];

export interface JutsuFx {
  sprite?: SpriteFx;
  /** Troca o estilo visual (rastro, impacto, estado) do jutsu. */
  vfx?: Vfx;
  proj?: ProjFx;
  /** Exceção: partículas próprias no lugar das do estilo. */
  trail?: Emitter[];
  burst?: Emitter[];
  /**
   * Bote em arco (game/dragonFlight.ts): o projétil sai da fonte atrás do lançador, sobe `lift` px e mergulha no alvo,
   * chegando sempre de frente. `bend`: desvio lateral no meio do caminho (px; 0 = reto no chão, o arco é só a altura).
   */
  flight?: FlightFx;
}

export interface FlightFx {
  lift: number;
  bend: number;
  /** Onde ficam os controles da curva no chão (fração do caminho): pequeno = sobe quase reto da fonte / desce quase
   *  reto no alvo. Sem: 1/3. */
  out?: number;
  in?: number;
  /** Altura (px) em que o corpo sai da fonte. Sem: 18. */
  sourceZ?: number;
}

export interface FxData {
  /** Por estilo; "none" = sem estilo (usa a cor do efeito). */
  styles: Record<string, StyleFx>;
  jutsus: Record<string, JutsuFx>;
  /** Sprites de estado (água: a Prisão d'Água em volta do preso). */
  status: Record<string, SpriteFx>;
}

/** Os dados vivos: o laboratório muda este objeto e o desenho segue na hora. */
export const FX = FX_RAW as unknown as FxData;

/** Partículas de um estilo ou de um jutsu com exceção. */
export function trailFx(jutsu: string | undefined, style: string): Emitter[] | undefined {
  return (jutsu ? FX.jutsus[jutsu]?.trail : undefined) ?? FX.styles[style]?.trail;
}
export function burstFx(jutsu: string | undefined, style: string): Emitter[] | undefined {
  return (jutsu ? FX.jutsus[jutsu]?.burst : undefined) ?? FX.styles[style]?.burst;
}
export function spriteFx(jutsu: string | undefined): SpriteFx | undefined {
  return jutsu ? FX.jutsus[jutsu]?.sprite : undefined;
}

/** JSON legível: um emissor por linha, o resto indentado (o arquivo vai para o git e é revisado à mão). */
export function formatFx(data: FxData): string {
  const line = (v: unknown) => JSON.stringify(v);
  const list = (a: Emitter[] | undefined, pad: string) => `[\n${(a ?? []).map((e) => `${pad}  ${line(e)}`).join(',\n')}\n${pad}]`;
  const out: string[] = [];
  out.push('{\n "styles": {');
  out.push(
    Object.entries(data.styles)
      .map(([k, s]) => `  ${line(k)}: {\n   "trail": ${list(s.trail, '   ')},\n   "burst": ${list(s.burst, '   ')}\n  }`)
      .join(',\n'),
  );
  out.push(' },\n "jutsus": {');
  out.push(
    Object.entries(data.jutsus)
      .map(([k, j]) => {
        const parts: string[] = [];
        if (j.sprite) parts.push(`   "sprite": ${line(j.sprite)}`);
        if (j.vfx) parts.push(`   "vfx": ${line(j.vfx)}`);
        if (j.proj && Object.keys(j.proj).length) parts.push(`   "proj": ${line(j.proj)}`);
        if (j.flight) parts.push(`   "flight": ${line(j.flight)}`);
        if (j.trail) parts.push(`   "trail": ${list(j.trail, '   ')}`);
        if (j.burst) parts.push(`   "burst": ${list(j.burst, '   ')}`);
        return `  ${line(k)}: {\n${parts.join(',\n')}\n  }`;
      })
      .join(',\n'),
  );
  out.push(' },\n "status": {');
  out.push(Object.entries(data.status).map(([k, s]) => `  ${line(k)}: ${line(s)}`).join(',\n'));
  out.push(' }\n}\n');
  return out.join('\n');
}
