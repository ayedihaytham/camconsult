import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ledger/StatusDot";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/utils";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { computeManques } from "@/lib/collecte/manques";
import { useCollectes } from "@/store/collectes";
import type { CollecteFull } from "@/types";

interface Props {
  collecte: CollecteFull;
  isAdmin: boolean;
  isClient: boolean;
  onNavigate: (onglet: string) => void;
}

export function RecapTab({ collecte, isAdmin, isClient, onNavigate }: Props) {
  const sendRecap = useCollectes((s) => s.sendRecap);
  const closeRecap = useCollectes((s) => s.closeRecap);
  const addNote = useCollectes((s) => s.addNote);

  const recap = collecte.recapStatut;
  const notesLibres = collecte.notes.filter(
    (n) => n.kind === "note" && n.onglet === "",
  );
  const [newNote, setNewNote] = useState("");

  const live = useMemo(() => computeManques(collecte), [collecte]);
  const label = (k: string) => TAB_BY_KEY[k]?.label ?? (k || "Général");

  const groups = useMemo(() => {
    const byTab = new Map<string, typeof live>();
    for (const m of live) byTab.set(m.onglet, [...(byTab.get(m.onglet) ?? []), m]);
    return [...byTab.entries()];
  }, [live]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          État du récap :
        </span>
        <StatusDot
          tone={
            recap === "repondu"
              ? "success"
              : recap === "envoye"
                ? "warning"
                : "muted"
          }
          label={
            recap === "envoye"
              ? "Envoyé au client — en attente"
              : recap === "repondu"
                ? "Complété par le client"
                : "Non envoyé"
          }
        />

        {isAdmin && recap === "none" && (
          <Button
            size="sm"
            variant="ledger"
            className="ml-auto"
            onClick={async () => {
              if (!live.length) return toast.error("Aucune case importante vide.");
              await sendRecap(collecte.id, live.length);
              toast.success(
                `Récap envoyé — ${live.length} case(s) à compléter par le client`,
              );
            }}
            disabled={!live.length}
          >
            <Send className="h-4 w-4" />
            Envoyer au client pour complétion ({live.length})
          </Button>
        )}
        {isAdmin && recap !== "none" && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={async () => {
              await closeRecap(collecte.id);
              toast.success("Récap clôturé");
            }}
          >
            Clore le récap
          </Button>
        )}
      </div>

      {isClient && recap === "envoye" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cliquez un point ci-dessous pour ouvrir l'onglet, remplissez les cases{" "}
          <span className="font-semibold">?</span>, enregistrez, puis
          «&nbsp;Transmettre au cabinet&nbsp;» (bouton en haut à droite).
        </p>
      )}
      {isClient && recap === "repondu" && (
        <p className="text-sm text-muted-foreground">
          Récap renvoyé au cabinet. En attente de traitement.
        </p>
      )}
      {isClient && recap === "none" && (
        <p className="text-sm text-muted-foreground">
          Aucune demande du cabinet pour le moment.
        </p>
      )}

      {(isAdmin || recap !== "none") && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {live.length === 0
              ? "Toutes les cases importantes sont remplies ✓"
              : `Cases à compléter (${live.length})`}
          </h3>
          <div className="space-y-4">
            {groups.map(([tab, items]) => (
              <div key={tab}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label(tab)} · {items.length}
                </p>
                <div className="space-y-1.5">
                  {items.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => onNavigate(m.onglet)}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:border-accent/50 hover:bg-secondary/40"
                    >
                      <span className="text-foreground">{m.ref}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                        Ouvrir l'onglet
                        <ChevronRight className="h-3.5 w-3.5 text-accent" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes générales */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Notes générales
        </h3>
        <div className="space-y-2">
          {notesLibres.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune note.</p>
          )}
          {notesLibres.map((n) => (
            <div key={n.id} className="rounded-md border border-border px-3 py-2">
              <p className="text-sm text-foreground">{n.texte}</p>
              <p className="text-[11px] text-muted-foreground">
                {n.auteur === "admin" ? "Cabinet" : "Client"} ·{" "}
                {formatRelative(n.creeLe)}
              </p>
            </div>
          ))}
          {(isAdmin || isClient) && (
            <div className="flex gap-2">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ajouter une note…"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!newNote.trim()) return;
                  await addNote(collecte.id, "", newNote.trim());
                  setNewNote("");
                }}
              >
                <MessageSquarePlus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          )}
        </div>
      </div>

      {isAdmin && recap === "repondu" && (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Le client a renvoyé. Complétez ce qui reste puis validez la collecte.
        </p>
      )}
    </div>
  );
}
