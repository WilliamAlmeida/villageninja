// Privacidade e termos (pt/en): textos curtos e verdadeiros sobre o que o servidor guarda de fato (src/db.ts).
// O Google pede as duas páginas para publicar o login; mudou o que é guardado, mude aqui também.
import { config } from '../config';
import type { Lang } from './i18n';
import { esc, page } from './layout';

const UPDATED = '2026-10-16';

const PRIVACY = {
  pt: {
    title: 'Política de privacidade',
    body: (mail: string) => `
<p>Esta página explica o que o Ninja Cursed Fight (NCF RPG) guarda sobre você e por quê. Atualizada em ${UPDATED}.</p>
<h2>O que fica no seu aparelho</h2>
<p>O jogo (a vila, os ninjas, o progresso) é salvo no próprio navegador, no armazenamento local. Também fica lá o código
da sua sessão nos duelos. Não usamos cookies de rastreamento nem anúncios.</p>
<h2>O que fica no servidor</h2>
<ul>
<li><b>Conta:</b> um identificador, o nome que você mostra na arena, a data de criação e de último acesso.</li>
<li><b>Entrar com Discord ou Google:</b> o identificador da sua conta nesse serviço, o nome, o e-mail (se confirmado) e a foto
de perfil. Não recebemos a sua senha nem acesso a mensagens, contatos ou arquivos.</li>
<li><b>Apelido e senha</b> (contas antigas): a senha é guardada só como resumo criptográfico (argon2id).</li>
<li><b>Duelos:</b> o retrato do campeão que você publica (atributos, jutsus e equipamento do ninja), os resultados, a
pontuação e o histórico das lutas.</li>
<li><b>Segurança:</b> o endereço IP é usado na hora para limitar tentativas e não é guardado com a sua conta.</li>
</ul>
<h2>Para que usamos</h2>
<p>Só para o jogo funcionar: entrar na mesma conta em outro aparelho, sortear adversários, montar o ranking e evitar
trapaça. Não vendemos nem compartilhamos os seus dados.</p>
<h2>Quem vê</h2>
<p>Outros jogadores veem o seu nome na arena, o retrato do campeão e a sua pontuação. A equipe do jogo vê os dados da
conta para moderação, e toda ação dela fica registrada.</p>
<h2>Apagar os dados</h2>
<p>Peça a exclusão da conta pelo e-mail <a href="mailto:${mail}">${mail}</a>. Você também pode desligar o Discord ou o
Google na aba Conta do jogo, ou remover o acesso direto nas configurações do Discord ou do Google.</p>`,
  },
  en: {
    title: 'Privacy policy',
    body: (mail: string) => `
<p>This page explains what Ninja Cursed Fight (NCF RPG) stores about you and why. Last updated ${UPDATED}.</p>
<h2>What stays on your device</h2>
<p>The game itself (your village, ninjas and progress) is saved in your browser's local storage, together with your
duel session code. We use no tracking cookies and no ads.</p>
<h2>What we store on the server</h2>
<ul>
<li><b>Account:</b> an identifier, the name you show in the arena, and the creation and last-seen dates.</li>
<li><b>Sign in with Discord or Google:</b> your account identifier on that service, name, e-mail (if verified) and profile
picture. We never receive your password or access to messages, contacts or files.</li>
<li><b>Username and password</b> (older accounts): the password is stored only as a cryptographic hash (argon2id).</li>
<li><b>Duels:</b> the champion snapshot you publish (your ninja's stats, jutsu and gear), results, rating and fight
history.</li>
<li><b>Security:</b> your IP address is used on the spot to rate-limit attempts and is not stored with your account.</li>
</ul>
<h2>How we use it</h2>
<p>Only to run the game: sign in on another device, match opponents, build the leaderboard and prevent cheating. We do
not sell or share your data.</p>
<h2>Who can see it</h2>
<p>Other players see your arena name, your champion snapshot and your rating. The game staff can see account data for
moderation, and every staff action is logged.</p>
<h2>Deleting your data</h2>
<p>Ask for account deletion at <a href="mailto:${mail}">${mail}</a>. You can also unlink Discord or Google in the
game's Account tab, or revoke access directly in your Discord or Google settings.</p>`,
  },
};

const TERMS = {
  pt: {
    title: 'Termos de uso',
    body: (mail: string) => `
<p>Ao jogar o Ninja Cursed Fight (NCF RPG) você concorda com estes termos. Atualizados em ${UPDATED}.</p>
<h2>O jogo</h2>
<p>É um projeto independente e gratuito, em desenvolvimento, sem vínculo com nenhuma outra franquia ou empresa. Partes
podem mudar, ser rebalanceadas ou sair do ar sem aviso, inclusive o ranking (temporadas podem zerar os pontos).</p>
<h2>Sua conta</h2>
<ul>
<li>Use um nome que não ofenda ninguém e que não se passe por outra pessoa.</li>
<li>Não use programas, alterações no jogo ou falhas para ganhar duelos ou mexer no ranking.</li>
<li>Não tente derrubar, sobrecarregar ou invadir o servidor.</li>
</ul>
<p>A equipe pode renomear, suspender ou apagar contas que descumprirem essas regras.</p>
<h2>Seu progresso</h2>
<p>A vila fica salva no seu navegador: limpar os dados do navegador apaga o jogo. O que fica no servidor (conta, duelos,
ranking) está descrito na <a href="/privacidade">política de privacidade</a>.</p>
<h2>Garantia</h2>
<p>O jogo é oferecido como está, sem garantia de funcionamento contínuo.</p>
<h2>Contato</h2>
<p><a href="mailto:${mail}">${mail}</a></p>`,
  },
  en: {
    title: 'Terms of use',
    body: (mail: string) => `
<p>By playing Ninja Cursed Fight (NCF RPG) you agree to these terms. Last updated ${UPDATED}.</p>
<h2>The game</h2>
<p>It is a free independent project in development, not affiliated with any other franchise or company. Features may
change, be rebalanced or go offline without notice, including the leaderboard (seasons may reset ratings).</p>
<h2>Your account</h2>
<ul>
<li>Use a name that does not offend anyone or impersonate someone else.</li>
<li>Do not use tools, game modifications or exploits to win duels or manipulate the leaderboard.</li>
<li>Do not try to take down, overload or break into the server.</li>
</ul>
<p>The staff may rename, suspend or delete accounts that break these rules.</p>
<h2>Your progress</h2>
<p>Your village is saved in your browser: clearing browser data deletes the game. What is stored on the server
(account, duels, leaderboard) is described in the <a href="/en/privacy">privacy policy</a>.</p>
<h2>Warranty</h2>
<p>The game is provided as is, with no guarantee of continuous availability.</p>
<h2>Contact</h2>
<p><a href="mailto:${mail}">${mail}</a></p>`,
  },
};

function legal(lang: Lang, origin: string, path: string, doc: { title: string; body: (mail: string) => string }) {
  return page({ lang, path, title: doc.title, origin, body: `<section class="sec page-h legal"><h1>${esc(doc.title)}</h1>${doc.body(esc(config.contactEmail))}</section>` });
}

export const privacyPage = (lang: Lang, origin: string) => legal(lang, origin, '/privacidade', PRIVACY[lang]);
export const termsPage = (lang: Lang, origin: string) => legal(lang, origin, '/termos', TERMS[lang]);
