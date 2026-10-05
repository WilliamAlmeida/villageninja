// PM2 local (Windows) — serve o jogo na porta 3010, acessado de fora por https://ninja.wmst.com.br (túnel Cloudflare).
//   pm2 start ecosystem.local.config.cjs   |   pm2 logs villageninja   |   pm2 restart villageninja   |   pm2 delete villageninja
// Roda o BUILD de produção (scripts/live.ts), que se refaz sozinho quando o código muda. Não use o servidor de
// desenvolvimento aqui: a Cloudflare guarda em cache o CSS/JS dele e o celular recebe versão velha.
// Para HMR enquanto programa no PC, rode `bun run dev` em outra porta (ex.: PORT=3011).
const path = require('path');
const os = require('os');

const bun = process.platform === 'win32' ? path.join(os.homedir(), '.bun', 'bin', 'bun.exe') : 'bun';

module.exports = {
  apps: [
    {
      name: 'villageninja',
      cwd: __dirname,
      script: 'scripts/live.ts',
      interpreter: bun,
      env: { PORT: '3010' },
      // No Windows cada reinício abre uma janela de terminal; espera crescente evita a enxurrada.
      exp_backoff_restart_delay: 500,
      windowsHide: true,
    },
  ],
};
