// Gera uma FOLHA DE SPRITE no padrão do jogo (ver scripts/sprite-template.py) pela Runware.
// O gabarito de poses vai como 1ª imagem de referência, então todo personagem/monstro sai na mesma
// grade, ordem de quadros, direção e linha de base. Depois rode scripts/prepare-art.py, que valida.
//
// Uso:
//   node scripts/sprite.mjs <nome> <biped|quadruped> "<descrição>" [imagem-do-personagem.png]
//   ex.: node scripts/sprite.mjs ninja biped "young ninja, dark blue outfit, headband, spiky brown hair" docs/arte/testes/genin-andando.png
// Saída: docs/arte/sprites/<nome>.png (1536×1024, fundo removido). ~US$ 0,02 por folha.
// Modelo: RUNWARE_MODEL (padrão gpt-image, que segue o gabarito bem melhor que o FLUX).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KEY_FILE = process.env.RUNWARE_KEY_FILE ?? 'C:/wamp/www/claude/projects/sprite_generator/.runware.key';
const MODEL = process.env.RUNWARE_MODEL ?? 'openai:gpt-image@2';
const BG_MODEL = process.env.RUNWARE_BG_MODEL ?? 'runware:112@5';
const KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();

const [name, kind, desc, ref] = process.argv.slice(2);
if (!name || !['biped', 'quadruped'].includes(kind) || !desc) {
  console.error('uso: node scripts/sprite.mjs <nome> <biped|quadruped> "<descrição>" [referência.png]');
  process.exit(1);
}

const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const refs = [dataUri(`docs/arte/gabarito-${kind}.png`)];
if (ref) refs.push(dataUri(ref));

const views = kind === 'biped'
  ? 'Row 1: side view, walking, facing RIGHT. Row 2: front view, walking toward the viewer. Row 3: back view, walking away from the viewer (only the back of the head visible).'
  : 'Row 1: side view, walking on four legs, head on the RIGHT side. Row 2: front view, walking toward the viewer. Row 3: back view, walking away from the viewer.';

const prompt = [
  'Pixel art game sprite sheet.',
  'Image 1 is a STRICT layout and pose guide: a grid of 4 columns by 3 rows of equal cells, one gray mannequin per cell.',
  `Redraw EVERY mannequin as: ${desc}.`,
  ref ? 'Image 2 shows the exact character design: copy its colors, clothes, hair and proportions.' : '',
  'For each cell keep exactly the same cell, position, size, pose, facing direction and leg positions as the mannequin, with the feet on the red baseline.',
  views,
  'Columns are the walk cycle in order: 1 contact (legs apart), 2 passing (legs together), 3 contact with the other leg forward, 4 passing.',
  'All 12 frames show the SAME character with the same size, proportions and colors. One character per cell, nothing crossing into other cells.',
  'Style: flat 16-bit pixel art, chibi with a big head, few flat colors, dark pixel outline, no gradients, no anti-aliasing.',
  'Remove the grid lines, red baselines and mannequins. Pure white background, no shadows, no text.',
].filter(Boolean).join(' ');

async function runTask(task) {
  const res = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ taskUUID: crypto.randomUUID(), includeCost: true, outputType: 'URL', outputFormat: 'PNG', ...task }]),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data[0];
}

const img = await runTask({ taskType: 'imageInference', model: MODEL, positivePrompt: prompt, width: 1536, height: 1024, numberResults: 1, inputs: { referenceImages: refs } });
let cost = img.cost ?? 0;
let url = img.imageURL;
for (let tries = 3; tries > 0; tries--) {
  try {
    const bg = await runTask({ taskType: 'imageBackgroundRemoval', model: BG_MODEL, inputImage: img.imageURL });
    url = bg.imageURL;
    cost += bg.cost ?? 0;
    break;
  } catch (e) {
    if (tries === 1) throw new Error(`remoção de fundo: ${e.message}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
const out = `docs/arte/sprites/${name}.png`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
// guarda também o original com fundo (útil para revisar a grade)
fs.writeFileSync(out.replace('.png', '.raw.png'), Buffer.from(await (await fetch(img.imageURL)).arrayBuffer()));
console.log(`ok ${out}  US$ ${cost.toFixed(4)}  (${MODEL})`);
