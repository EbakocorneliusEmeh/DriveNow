import "dotenv/config";
import { requestPasswordReset } from "../auth/auth.service.js";
import { pool } from "../db/index.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: pnpm --filter backend admin:reset-password <email>");
  process.exit(1);
}

async function main() {
  const token = await requestPasswordReset(email);

  if (token) {
    console.log(`Password reset token for ${email}: ${token}`);
  } else {
    console.log("If a matching account was found, a password reset token has been generated.");
  }

  await pool.end();
}

main().catch((error) => {
  console.error("Error generating password reset token:", error);
  process.exitCode = 1;
  pool.end();
});