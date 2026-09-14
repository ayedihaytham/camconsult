import { Router } from "express";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { notifKey } from "../notifications.js";
import { notificationDto } from "../mappers.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  const { rows } = await query(
    "select * from notifications where user_key = $1 order by cree_le desc limit 50",
    [notifKey(req.session)],
  );
  res.json(rows.map(notificationDto));
});

notificationsRouter.post("/mark-read", async (req, res) => {
  const key = notifKey(req.session);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (ids && ids.length > 0) {
    await query(
      "update notifications set lu = true where user_key = $1 and id = any($2::uuid[])",
      [key, ids],
    );
  } else {
    await query(
      "update notifications set lu = true where user_key = $1 and lu = false",
      [key],
    );
  }
  res.json({ ok: true });
});
