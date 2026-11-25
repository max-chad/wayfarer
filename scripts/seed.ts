// Seeds (or re-seeds) the SQLite database from data/source + data/generated.
// Usage: npm run db:seed            (seeds only if the DB is empty / outdated)
//        npm run db:reset           (wipes and re-seeds everything)
import { openDatabase, dbPath } from "../lib/db";
import { seedDatabase } from "../lib/seed";

const force = process.argv.includes("--reset");
const conn = openDatabase();
console.log(`Database: ${dbPath()}`);
seedDatabase(conn, { log: console.log, force });
conn.close();
