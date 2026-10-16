// Troca o papel de uma conta pelo terminal (para dar o primeiro admin sem passar pelo painel):
//   cd server && bun scripts/role.ts <apelido|e-mail|id> <player|mod|admin>
// O normal é ADMIN_EMAILS no .env (vira admin ao entrar pelo Discord/Google) e, depois, o painel.
import { closeDb, sql } from '../src/db';
import { ROLES, type Role } from '../src/services/accounts';
import { staffLog } from '../src/services/staff';

const [who, role] = process.argv.slice(2) as [string | undefined, Role | undefined];
if (!who || !role || !ROLES.includes(role)) {
  console.error('uso: bun scripts/role.ts <apelido|e-mail|id> <player|mod|admin>');
  process.exit(1);
}
const rows = await sql<Array<{ id: string; name: string; role: string }>>`
  SELECT id, display_name as name, role FROM users
  WHERE lower(username) = lower(${who}) OR lower(email) = lower(${who}) OR id::text = ${who} LIMIT 2
`;
if (rows.length !== 1) {
  console.error(rows.length ? 'mais de uma conta bate com isso; use o id' : 'conta não encontrada');
  process.exit(1);
}
const u = rows[0]!;
await sql`UPDATE users SET role = ${role} WHERE id = ${u.id}`;
await staffLog(null, 'role', u.id, { from: u.role, to: role, via: 'terminal' });
console.log(`${u.name}: ${u.role} → ${role}`);
await closeDb();
