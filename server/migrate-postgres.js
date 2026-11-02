import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(new URL("../migrations/postgres/0001_auth.sql", import.meta.url), "utf8");
await sql.transaction(migration.split(";").map(s => s.trim()).filter(Boolean).map(s => sql.query(s)));
console.log("PostgreSQL schema is ready.");
