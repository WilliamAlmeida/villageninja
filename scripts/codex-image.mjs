// Gera arte pelo Codex CLI (incluso no plano do ChatGPT — caminho PADRÃO deste projeto).
// A Runware (scripts/runware.mjs, scripts/sprite.mjs) fica só como alternativa quando o Codex não estiver disponível.
//
// Uso:
//   node scripts/codex-image.mjs <saida.png> "<descrição>" [--ref a.png,b.png] [--size 1024x1024]
//   node scripts/codex-image.mjs <saida.png> "<descrição do personagem>" --sheet biped|quadruped [--ref visual.png]
//     --sheet  folha de sprite no padrão do jogo: manda o gabarito de poses (docs/arte/gabarito-*.png) como
//              1ª referência e usa o prompt fixo (grade 4×3, de lado para a direita / frente / costas).
// Depois tira o fundo branco localmente (scripts/remove-bg.py). Para folhas, rode scripts/prepare-art.py (valida).
// Modelo do agente: CODEX_MODEL (padrão gpt-5.5; o padrão do config.toml não é aceito no login do ChatGPT).
// ~1–2 min por imagem; pode rodar várias em paralelo. O que o Codex respondeu fica em <saida>.codex.txt.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MODEL = process.env.CODEX_MODEL ?? 'gpt-5.5';
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args.splice(i, 2)[1];
};
const sheet = flag('--sheet');
const refs = (flag('--ref') ?? '').split(',').filter(Boolean);
const size = flag('--size') ?? (sheet ? '1536x1024' : '1024x1024');
const [out, desc] = args;
if (!out || !desc || (sheet && !['biped', 'quadruped', 'action'].includes(sheet))) {
  console.error('uso: node scripts/codex-image.mjs <saida.png> "<descrição>" [--ref a.png,b.png] [--size LxA] [--sheet biped|quadruped|action]');
  process.exit(1);
}

const dir = path.resolve(path.dirname(out));
const file = path.basename(out);
fs.mkdirSync(dir, { recursive: true });
if (sheet) refs.unshift(`docs/arte/gabarito-${sheet}.png`);
const refList = refs.map((r) => path.resolve(r));

const STYLE = 'Flat 16-bit pixel art, chibi with a big head, few flat colors, dark pixel outline, no gradients, no anti-aliasing.';
const views = {
  quadruped: 'Row 1: side view walking on four legs, head on the RIGHT side. Row 2: front view walking toward the viewer. Row 3: back view walking away.',
  biped: 'Row 1: side view walking, facing RIGHT. Row 2: front view walking toward the viewer. Row 3: back view walking away (only the back of the head visible).',
  action: 'Row 1: side view facing RIGHT, striking to the right. Row 2: front view facing the viewer, striking down in front. Row 3: back view, striking down away from the viewer.',
}[sheet ?? 'biped'];
const cycle = sheet === 'action'
  ? 'Columns are one tool swing in order, following the brown handle and gray tool head of the guide: 1 wind-up (tool raised high behind the head), 2 swing (tool coming forward), 3 impact (tool head hitting the ground/target in front), 4 recover. Feet stay planted.'
  : 'Columns are the walk cycle in order: 1 contact (legs apart), 2 passing (legs together), 3 contact with the other leg forward, 4 passing.';
const body = sheet
  ? [
      'Pixel art game sprite sheet.',
      'Image 1 is a STRICT layout and pose guide: 4 columns by 3 rows of equal cells, one gray mannequin per cell.',
      `Redraw EVERY mannequin as: ${desc}.`,
      refs.length > 1 ? 'Image 2 shows the exact character design: copy its colors, clothes, hair and proportions.' : '',
      "Keep each cell's position, size, pose, facing direction and leg positions, with the feet on the red baseline.",
      views,
      cycle,
      'All 12 frames show the SAME character with the same size, proportions and colors. One character per cell.',
      STYLE,
      'Remove the grid lines, red baselines and mannequins. Pure white background, no shadows, no text.',
    ]
  : [desc, refs.length ? 'Use the attached image(s) as reference.' : '', 'Pure white background, no shadows, no text.'];

const prompt = [
  `Use your image generation tool to create ONE image, ${size}, and save it in the current folder as ${file}.`,
  'Do not write code and do not create or change any other file.',
  ...body,
].filter(Boolean).join('\n');

const cmd = ['exec', '--skip-git-repo-check', '-m', MODEL, '-s', 'workspace-write', '-C', dir];
if (refList.length) cmd.push('-i', refList.join(','));
cmd.push('-'); // prompt pela entrada padrão (o -i aceita várias imagens e engoliria o prompt)
const t0 = Date.now();
const r = spawnSync('codex', cmd, { input: prompt, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 32 << 20 });
fs.writeFileSync(`${out}.codex.txt`, `# prompt\n${prompt}\n\n# saída\n${r.stdout ?? ''}\n${r.stderr ?? ''}`);
if (!fs.existsSync(out)) {
  const err = `${r.stdout ?? ''}${r.stderr ?? ''}`.match(/ERROR: .*/)?.[0] ?? 'o Codex não salvou a imagem';
  console.error(`FALHOU ${out}: ${err} (veja ${out}.codex.txt)`);
  process.exit(1);
}
const bg = spawnSync('python', ['scripts/remove-bg.py', out], { encoding: 'utf8' });
if (bg.status !== 0) console.error(`remoção de fundo falhou: ${bg.stderr}`);
console.log(`ok ${out}  (${Math.round((Date.now() - t0) / 1000)} s, Codex ${MODEL})`);
