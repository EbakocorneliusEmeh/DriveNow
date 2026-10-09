import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import { users } from "../db/schema.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: pnpm --filter backend admin:promote your-email@example.com");
  process.exitCode = 1;
} else {
  const [user] = await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.email, email))
    .returning({ fullName: users.fullName, email: users.email });

  if (!user) {
    console.error("No account was found with that email address.");
    process.exitCode = 1;
  } else {
    console.log(`${user.fullName} (${user.email}) is now an admin.`);
  }
}

await pool.end();
