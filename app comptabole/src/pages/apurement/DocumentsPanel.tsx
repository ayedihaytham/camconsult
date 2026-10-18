import { ApurementSelect } from "./ApurementSelect";
import { useCallback, useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/hooks/usePermissions";
type Source = { id: string; source: string; nom: string };
type Piece = {
  id: string;
  nom: string;
  preuveHash: string;
  source: string;
  sourceDisponible: boolean;
};
type Missing = {
  id: string;
  libelle: string;
  statut: string;
  version: number;
  collecteDemandeId?: string;
};
export async function downloadApurement(path: string, name: string) {
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  const response = await fetch(`${base}/api/apurement${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error("Téléchargement refusé ou indisponible.");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DocumentsPanel({
  societeId,
  parentType,
  parentId,
  onPiecesChanged,
}: {
  societeId: string;
  parentType: string;
  parentId: string;
  onPiecesChanged?: (pieces: Piece[]) => void;
}) {
  const [pieces, setPieces] = useState<Piece[]>([]),
    [sources, setSources] = useState<Source[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [missing, setMissing] = useState("");
  const [missingList, setMissingList] = useState<Missing[]>([]);
  const [collectes, setCollectes] = useState<{ id: string; periode: string }[]>(
    [],
  );
  const [collecteId, setCollecteId] = useState("");
  const { canManageCollaborateurs } = usePermissions();
  const loadMissing = useCallback(
    () =>
      api
        .get<Missing[]>(
          `/apurement/pieces-manquantes?societeId=${societeId}&parentId=${parentId}`,
        )
        .then(setMissingList),
    [societeId, parentId],
  );
  const load = useCallback(
    () =>
      api
        .get<Piece[]>(
          `/apurement/pieces?societeId=${societeId}&parentType=${parentType}&parentId=${parentId}`,
        )
        .then((rows) => {
          setPieces(rows);
          return rows;
        }),
    [societeId, parentType, parentId],
  );
  useEffect(() => {
    load().catch((e) => setError(e.message));
    loadMissing().catch((e) => setError(e.message));
  }, [load, loadMissing]);
  async function missingAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await loadMissing();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opération impossible");
    } finally {
      setBusy(false);
    }
  }
  async function associate(data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api.post("/apurement/pieces", {
        societeId,
        parentType,
        parentId,
        ...data,
      });
      const rows = await load();
      onPiecesChanged?.(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Association impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t pt-4 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:h-auto [&_button]:min-h-10">
      <h3 className="font-semibold">Justificatifs</h3>
      <p className="text-xs text-muted-foreground">
        Copie conservée avec empreinte. PDF, PNG ou JPEG, 8 Mo maximum.
      </p>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center justify-between border-b py-2 text-sm"
        >
          <span>
            {p.nom} · {p.source}
            {!p.sourceDisponible && (
              <span className="block text-xs text-muted-foreground">
                Original supprimé ; copie conservée
              </span>
            )}
          </span>
          <Button
            type="button"
            variant="link"
            onClick={() =>
              downloadApurement(`/pieces/${p.id}/telecharger`, p.nom).catch(
                (e) => setError(e.message),
              )
            }
          >
            Télécharger
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        type="button"
        disabled={busy}
        onClick={() =>
          api
            .get<Source[]>(`/apurement/pieces/sources?societeId=${societeId}`)
            .then(setSources)
            .catch((e) => setError(e.message))
        }
      >
        Associer une pièce existante
      </Button>
      {sources.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm" htmlFor={`source-${parentId}`}>
            Pièce de cette société
          </label>
          <ApurementSelect
            id={`source-${parentId}`}
            value={sourceId}
            onValueChange={(value) => setSourceId(value)}
            options={[
              { value: "", label: <>Choisir…</> },
              ...sources.map((s) => ({
                value: s.id,
                label: (
                  <>
                    {s.nom} ({s.source})
                  </>
                ),
              })),
            ]}
          />
          <Button
            type="button"
            disabled={!sourceId || busy}
            onClick={() => {
              const s = sources.find((x) => x.id === sourceId);
              if (s) void associate({ source: s.source, sourceId: s.id });
            }}
          >
            Confirmer l’association
          </Button>
        </div>
      )}
      <label className="block text-sm">
        Ajouter un justificatif
        <Input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 8388608) {
              setError("Pièce limitée à 8 Mo.");
              return;
            }
            const reader = new FileReader();
            reader.onerror = () => setError("Lecture impossible.");
            reader.onload = () =>
              void associate({
                source: "apurement_upload",
                nom: file.name,
                dataUrl: reader.result,
              });
            reader.readAsDataURL(file);
            e.target.value = "";
          }}
        />
      </label>
      <Input
        aria-label="Justificatif manquant"
        placeholder="Justificatif manquant à suivre en interne"
        value={missing}
        onChange={(e) => setMissing(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={!missing.trim() || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.post("/apurement/pieces-manquantes", {
              societeId,
              parentType,
              parentId,
              libelle: missing,
            });
            setMissing("");
            await loadMissing();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Demande impossible");
          } finally {
            setBusy(false);
          }
        }}
      >
        Signaler la pièce manquante
      </Button>
      {missingList.map((m) => (
        <div key={m.id} className="space-y-2 border-b py-2 text-sm">
          <p>
            {m.libelle} · {m.statut}
          </p>
          <div className="flex flex-wrap gap-2">
            {m.statut !== "validee" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  missingAction(() =>
                    api.patch(`/apurement/pieces-manquantes/${m.id}`, {
                      expectedVersion: m.version,
                      statut: canManageCollaborateurs ? "validee" : "fournie",
                    }),
                  )
                }
              >
                {canManageCollaborateurs
                  ? "Confirmer la pièce vérifiée"
                  : "Marquer fournie"}
              </Button>
            )}
            {!m.collecteDemandeId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  api
                    .get<{ id: string; periode: string }[]>(
                      `/collectes?societeId=${societeId}`,
                    )
                    .then(setCollectes)
                    .catch((e) => setError(e.message))
                }
              >
                Choisir une collecte pour demander au client
              </Button>
            )}
          </div>
          {collectes.length > 0 && !m.collecteDemandeId && (
            <div className="space-y-2">
              <ApurementSelect
                aria-label="Collecte de cette société"
                value={collecteId}
                onValueChange={(value) => setCollecteId(value)}
                groupLabel="Collecte de cette société"
                options={[
                  { value: "", label: <>Choisir une collecte</> },
                  ...collectes.map((c) => ({
                    value: c.id,
                    label: <>{c.periode}</>,
                  })),
                ]}
              />
              <p className="text-xs text-muted-foreground">
                Le client recevra une demande de justificatif neutre dans
                Collecte, sans montant ni mention d’Apurement.
              </p>
              <Button
                type="button"
                disabled={busy || !collecteId}
                onClick={() =>
                  missingAction(() =>
                    api.post(
                      `/apurement/pieces-manquantes/${m.id}/demander-collecte`,
                      { collecteId, confirmer: true },
                    ),
                  )
                }
              >
                Confirmer la demande via Collecte
              </Button>
            </div>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
