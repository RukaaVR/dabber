// Usage: npm run reset-password -- <username> <new password>
import { getDb } from "../lib/server/db";
import { hashPassword } from "../lib/server/auth";

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 6) {
    console.error("Usage: npm run reset-password -- <username> <new password (6+ chars)>");
    process.exit(1);
  }
  const db = getDb();
  const row = db.prepare("SELECT id FROM users WHERE username = ?").get(username.toLowerCase()) as { id: string } | undefined;
  if (!row) {
    console.error(`No user called “${username}”.`);
    process.exit(1);
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(password), row.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id);
  console.log(`Password for ${username} updated. They've been logged out everywhere.`);
}

void main();
