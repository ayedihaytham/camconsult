import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://cabinet:cabinet@localhost:5439/cabinet",
});

pool.on("error", (err) => {
  console.error("[db] pool error", err);
});

/** Raccourci : pool.query avec log en cas d'erreur. */
export async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error("[db] query failed:", text.split("\n")[0].trim(), err.message);
    throw err;
  }
}

/** Exécute une fonction dans une transaction. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
