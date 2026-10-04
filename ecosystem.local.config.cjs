// PM2 local (Windows) — sobe o servidor de desenvolvimento (HMR) na porta 3010 (a 3000 é do battlecard).
//   pm2 start ecosystem.local.config.cjs   |   pm2 logs villageninja   |   pm2 restart villageninja   |   pm2 delete villageninja
// Com HMR, mudanças no código aparecem sem reiniciar o processo. No celular: http://IP-DO-PC:3010
const path = require('path');
const os = require('os');

const bun = process.platform === 'win32' ? path.join(os.homedir(), '.bun', 'bin', 'bun.exe') : 'bun';

module.exports = {
  apps: [
    {
      name: 'villageninja',
      cwd: __dirname,
      script: 'scripts/dev.ts',
      interpreter: bun,
      env: { PORT: '3010' },
      // No Windows cada reinício abre uma janela de terminal; espera crescente evita a enxurrada.
      exp_backoff_restart_delay: 500,
      windowsHide: true,
    },
  ],
};
