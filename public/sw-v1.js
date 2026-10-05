// Service worker mínimo do PWA. Não guarda cache: tudo continua vindo da rede,
// então atualizações do jogo aparecem na hora.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
