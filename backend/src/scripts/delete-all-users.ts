import "dotenv/config";
import { db, pool } from "../db/index.js";
import { users } from "../db/schema.js";

async function main() {
  console.log("Deleting all users...");
  const deletedUsers = await db.delete(users).returning({ id: users.id });
  console.log(`Successfully deleted ${deletedUsers.length} users.`);
  await pool.end();
}

main().catch((error) => {
  console.error("Error deleting users:", error);
  process.exitCode = 1;
  pool.end();
});