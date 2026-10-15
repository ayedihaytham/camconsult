import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { journalDto } from "../mappers.js";

export const journalRouter = Router();
journalRouter.use(requireAuth, requireAdmin);

journalRouter.get("/", async (_req, res) => {
  const { rows } = await query(
    "select * from journal order by at desc limit 500",
  );
  res.json(rows.map(journalDto));
});

// Pas de suppression : le journal est en ajout seul (voir aussi le déclencheur de schema.sql).
