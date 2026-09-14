import "dotenv/config";
import { pool } from "./db.js";
import { ensureSchema } from "./ensureSchema.js";

ensureSchema()
  .then(() => {
    console.log("[migrate] schéma prêt");
    return pool.end();
  })
  .catch((err) => {
    console.error("[migrate] échec:", err.message);
    process.exit(1);
  });
