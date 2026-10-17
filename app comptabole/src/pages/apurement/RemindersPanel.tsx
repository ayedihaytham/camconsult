import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Quarter } from "@/types/apurement";
import { usePermissions } from "@/hooks/usePermissions";
export function RemindersPanel({
  societeId,
  annee,
  trimestre,
}: {
  societeId: string;
  annee: number;
  trimestre: Quarter;
}) {
  const [due, setDue] = useState("");
  const [cadence, setCadence] = useState("3");
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { canManageCollaborateurs } = usePermissions();
  useEffect(() => {
    let live = true;
    api
      .get<{ echeance: string; cadenceJours: number; actif: boolean }[]>(
        `/apurement/rappels?societeId=${societeId}&annee=${annee}&trimestre=${trimestre}`,
      )
      .then((rows) => {
        if (!live) return;
        const r = rows[0];
        setDue(r?.echeance?.slice(0, 10) || "");
        setCadence(String(r?.cadenceJours || 3));
        setActive(r?.actif || false);
      })
      .catch((e) => {
        if (live) setMessage(e.message);
      });
    return () => {
      live = false;
    };
  }, [societeId, annee, trimestre]);
  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="font-semibold">Rappels internes</h2>
      <p className="text-sm text-muted-foreground">
        Échéance définie par le cabinet, sans présumer de délai légal.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Échéance
          <Input
            disabled={!canManageCollaborateurs}
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Cadence en jours
          <Input
            disabled={!canManageCollaborateurs}
            type="number"
            min={1}
            max={365}
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          />
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!canManageCollaborateurs}
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Actif
        </label>
        {canManageCollaborateurs && (
          <Button
            disabled={busy || !due}
            onClick={async () => {
              setBusy(true);
              try {
                await api.put("/apurement/rappels", {
                  societeId,
                  annee,
                  trimestre,
                  echeance: due,
                  cadenceJours: Number(cadence),
                  actif: active,
                });
                setMessage("Rappel enregistré.");
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Enregistrement impossible",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Enregistrer le rappel
          </Button>
        )}
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
