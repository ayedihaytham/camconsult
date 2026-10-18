import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, FolderOpen, Search, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApurementSelect } from "./ApurementSelect";

type Source = { id: string; source: string; nom: string; chemin: string };
export function ExistingDocumentPicker({
  societeId,
  parentType,
  parentId,
  busy,
  onClose,
  onSelect,
}: {
  societeId: string;
  parentType: string;
  parentId: string;
  busy: boolean;
  onClose: () => void;
  onSelect: (source: Source) => Promise<boolean>;
}) {
  const [folder, setFolder] = useState<{ id: string; chemin: string } | null>(
    null,
  );
  const [sources, setSources] = useState<Source[]>([]);
  const [scope, setScope] = useState("dossier"),
    [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .post<{ id: string; chemin: string }>("/apurement/pieces/dossier", {
        societeId,
        parentType,
        parentId,
      })
      .then((result) => {
        if (active) setFolder(result);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [societeId, parentType, parentId, refresh]);
  useEffect(() => {
    if (!folder) return;
    let active = true;
    setLoading(true);
    setError("");
    setSelected("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ societeId, q: search });
      if (scope === "dossier") params.set("folderId", folder.id);
      api
        .get<Source[]>(`/apurement/pieces/sources?${params}`)
        .then((result) => {
          if (active) setSources(result);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [folder, societeId, scope, search, refresh]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="apurement-dialog flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="bg-primary px-6 py-5 pr-12 text-primary-foreground">
          <DialogTitle className="text-primary-foreground">
            Associer une pièce existante
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/80">
            Choisissez un document de cette société. Son original reste à sa
            place.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5 sm:p-6">
          {folder && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <FolderOpen className="size-4 shrink-0" />
                Dossier de destination · cabinet uniquement
              </div>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {folder.chemin}
              </p>
              <Link
                className="mt-2 inline-block font-medium text-primary underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
                to={`/structuration?societe=${societeId}&dossier=${folder.id}`}
              >
                Ouvrir ce dossier dans Structuration
              </Link>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              Emplacement
              <ApurementSelect
                aria-label="Emplacement des documents"
                value={scope}
                onValueChange={setScope}
                options={[
                  { value: "dossier", label: "Ce dossier Apurement" },
                  {
                    value: "societe",
                    label: "Tous les documents de la société",
                  },
                ]}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Nom du document
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  aria-label="Rechercher un document existant"
                  className="h-11 pl-9"
                  placeholder="Rechercher un fichier…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : loading ? (
            <p
              role="status"
              className="py-6 text-center text-sm text-muted-foreground"
            >
              Chargement des documents…
            </p>
          ) : !sources.length ? (
            <div
              role="status"
              className="rounded-md border border-dashed p-6 text-center"
            >
              <FolderOpen className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="font-medium">Aucun document compatible trouvé</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {scope === "dossier"
                  ? "Importez un PDF, PNG ou JPEG dans ce dossier via Structuration, puis actualisez. Vous pouvez aussi rechercher dans tous les documents de la société."
                  : "Ajoutez un PDF, PNG ou JPEG dans Structuration, Collecte ou directement dans les justificatifs."}
              </p>
            </div>
          ) : (
            <fieldset className="divide-y overflow-hidden rounded-md border">
              <legend className="sr-only">Documents disponibles</legend>
              {sources.map((s) => {
                const key = `${s.source}:${s.id}`;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-start gap-3 p-3 text-sm transition-colors hover:bg-muted/50 ${selected === key ? "bg-primary/5" : "bg-background"}`}
                  >
                    <input
                      type="radio"
                      name="existing-piece"
                      className="mt-1 accent-primary"
                      checked={selected === key}
                      onChange={() => setSelected(key)}
                    />
                    <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block break-words font-medium">
                        {s.nom}
                      </span>
                      <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                        {s.chemin}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
          {sources.length === 200 && (
            <p className="text-xs text-muted-foreground">
              200 résultats affichés. Précisez le nom pour affiner la recherche.
            </p>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-muted/20 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              setRefresh((n) => n + 1);
            }}
          >
            <RefreshCw className="mr-2 size-4" />
            Actualiser
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!selected || loading || busy}
            onClick={async () => {
              const source = sources.find(
                (s) => `${s.source}:${s.id}` === selected,
              );
              if (!source) return;
              try {
                if (await onSelect(source)) onClose();
                else
                  setError(
                    "Association impossible. Vérifiez que le document est toujours disponible, puis réessayez.",
                  );
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "Association impossible.",
                );
              }
            }}
          >
            {busy ? "Association…" : "Associer le document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
