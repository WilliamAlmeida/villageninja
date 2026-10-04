// Gera arte de teste pela API REST da Runware (sem SDK nem MCP; só Node 18+).
//
// Uso:
//   node scripts/runware.mjs <saida.png> "<prompt>" [--sem-fundo] [--size 1024x1024]
//   --sem-fundo  remove o fundo depois (BiRefNet, ~US$ 0,0006) e salva PNG transparente
//   node scripts/runware.mjs <saida.png> --so-fundo <entrada.png>   só remove o fundo de uma imagem que já existe
// Modelo: RUNWARE_MODEL (padrão FLUX.1 [dev], ~US$ 0,004 por imagem 1024² — barato para explorar).
// Chave: arquivo apontado por RUNWARE_KEY_FILE (padrão: a chave local do projeto sprite_generator).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KEY_FILE = process.env.RUNWARE_KEY_FILE ?? 'C:/wamp/www/claude/projects/sprite_generator/.runware.key';
const MODEL = process.env.RUNWARE_MODEL ?? 'runware:101@1';
const BG_MODEL = process.env.RUNWARE_BG_MODEL ?? 'runware:112@5';
const KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args.splice(i, 2)[1];
};
const size = (flag('--size') ?? '1024x1024').split('x').map((n) => Math.round(Number(n) / 16) * 16); // múltiplos de 16
const onlyBg = flag('--so-fundo');
const removeBg = args.includes('--sem-fundo') || !!onlyBg;
const [out, prompt] = args.filter((a) => !a.startsWith('--'));
if (!out || (!prompt && !onlyBg)) {
  console.error('uso: node scripts/runware.mjs <saida.png> "<prompt>" [--sem-fundo] [--size 1024x1024]');
  process.exit(1);
}

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

const img = onlyBg
  ? { imageURL: `data:image/png;base64,${fs.readFileSync(onlyBg).toString('base64')}`, cost: 0 }
  : await runTask({ taskType: 'imageInference', model: MODEL, positivePrompt: prompt, width: size[0], height: size[1], numberResults: 1 });
let url = img.imageURL;
let cost = img.cost ?? 0;
if (removeBg) {
  // usa a URL (o UUID às vezes ainda não está disponível logo após gerar) e tenta de novo se falhar
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
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
console.log(`ok ${out}  US$ ${cost.toFixed(4)}  (${MODEL})`);
