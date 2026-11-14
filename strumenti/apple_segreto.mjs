// Segreto per l'accesso con Apple su Supabase (campo «Secret Key (for OAuth)» del provider Apple).
// È un JWT firmato ES256 con la chiave .p8 scaricata da Apple Developer; vale al massimo 6 mesi, poi va rifatto.
// Si esegue sul proprio Mac: la chiave non esce dal computer e il segreto compare solo nel terminale.
//
// Uso:
//   node strumenti/apple_segreto.mjs --team ABCDE12345 --chiave XYZ123ABCD --servizio site.flockets.web --p8 ~/Downloads/AuthKey_XYZ123ABCD.p8
//
//   --team      Team ID (Apple Developer → Membership)
//   --chiave    Key ID della chiave «Sign in with Apple»
//   --servizio  identificativo del Services ID (è anche il Client ID su Supabase)
//   --p8        percorso del file .p8
//   --giorni    durata in giorni (facoltativo, massimo 180)
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const arg = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, v) => (x.startsWith('--') ? [...a, [x.slice(2), v[i + 1]]] : a), []));
const manca = ['team', 'chiave', 'servizio', 'p8'].filter(k => !arg[k]);
if (manca.length) {
  console.error('Mancano: ' + manca.map(k => '--' + k).join(', ') + '\nUso: node strumenti/apple_segreto.mjs --team … --chiave … --servizio … --p8 …/AuthKey_….p8');
  process.exit(1);
}
const giorni = Math.min(180, Math.max(1, Number(arg.giorni) || 180));
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const ora = Math.floor(Date.now() / 1000);
const testa = { alg: 'ES256', kid: arg.chiave, typ: 'JWT' };
const corpo = { iss: arg.team, iat: ora, exp: ora + giorni * 86400, aud: 'https://appleid.apple.com', sub: arg.servizio };
const dati = b64u(JSON.stringify(testa)) + '.' + b64u(JSON.stringify(corpo));
const chiave = createPrivateKey(readFileSync(arg.p8.replace(/^~(?=\/)/, homedir()), 'utf8'));
const firma = sign('sha256', Buffer.from(dati), { key: chiave, dsaEncoding: 'ieee-p1363' });
console.log(dati + '.' + b64u(firma));
console.error(`\nValido fino al ${new Date((ora + giorni * 86400) * 1000).toLocaleDateString('it-IT')}: incollalo su Supabase → Authentication → Sign In / Providers → Apple → Secret Key.`);
