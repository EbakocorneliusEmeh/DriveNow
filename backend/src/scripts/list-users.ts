import "dotenv/config";
import { listUsers } from "../admin/admin.service.js";
import { pool } from "../db/index.js";

async function main() {
  const users = await listUsers();

  if (users.length === 0) {
    console.log("No users found.");
  } else {
    console.table(users);
  }

  await pool.end();
}

main().catch((error) => {
  console.error("Error listing users:", error);
  process.exitCode = 1;
  pool.end();
});