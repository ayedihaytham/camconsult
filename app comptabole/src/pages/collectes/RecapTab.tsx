import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ledger/StatusDot";
import { Input } from "@/components/ui/input";
import { formatRelative } from "@/lib/utils";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { computeManques } from "@/lib/collecte/manques";
import { sectionRecapStatut } from "@/lib/collecte/recap";
import { useCollectes } from "@/store/collectes";
import type { CollecteFull } from "@/types";

interface Props {
  collecte: CollecteFull;
  isAdmin: boolean;
  isClient: boolean;
  onNavigate: (onglet: string) => void;
}

export function RecapTab({ collecte, isAdmin, isClient, onNavigate }: Props) {
  const sendRecapSection = useCollectes((s) => s.sendRecapSection);
  const closeRecapSection = useCollectes((s) => s.closeRecapSection);
  const addNote = useCollectes((s) => s.addNote);

  const notesLibres = collecte.notes.filter(
    (n) => n.kind === "note" && n.onglet === "",
  );
  const [newNote, setNewNote] = useState("");
  const [sending, setSending] = useState<string | null>(null);

  const live = useMemo(() => computeManques(collecte), [collecte]);
  const label = (k: string) => TAB_BY_KEY[k]?.label ?? (k || "Général");

  // Une ligne par tableau demandé — chaque tableau s'envoie indépendamment
  // des autres, jamais un envoi global pour toute la collecte.
  const rows = useMemo(
    () =>
      collecte.onglets.map((onglet) => ({
        onglet,
        count: live.filter((m) => m.onglet === onglet).length,
        statut: sectionRecapStatut(collecte, onglet),
      })),
    [collecte, live],
  );
  // Le client ne voit que les tableaux que le cabinet lui a effectivement
  // envoyés — jamais la liste complète des tableaux de la collecte, qui
  // laisserait croire qu'on lui demande des choses non encore transmises.
  // L'admin voit tout (pour choisir quoi envoyer ensuite).
  const visibleRows = isClient ? rows.filter((r) => r.statut !== "none") : rows;
  const totalCount = visibleRows.reduce((s, r) => s + r.count, 0);
  const anyPending = rows.some((r) => r.statut === "envoye");
  const anyRepondu = rows.some((r) => r.statut === "repondu");

  // Client sans aucun tableau encore envoyé : rien à montrer dans le
  // tableau (voir visibleRows) — un message suffit, jamais une pastille
  // trompeuse "tout est rempli" ni un tableau vide.
  if (isClient && visibleRows.length === 0) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Aucune demande du cabinet pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {totalCount === 0
            ? "Toutes les cases importantes sont remplies ✓"
            : `${totalCount} case(s) importante(s) à compléter, réparties sur ${visibleRows.filter((r) => r.count > 0).length} tableau(x)`}
        </span>
      </div>

      {isClient && anyPending && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Cliquez « Ouvrir l'onglet » sur un tableau envoyé, remplissez les cases{" "}
          <span className="font-semibold">?</span>, enregistrez, puis
          «&nbsp;Transmettre au cabinet&nbsp;» (bouton en haut à droite).
        </p>
      )}
      {isClient && !anyPending && anyRepondu && (
        <p className="text-sm text-muted-foreground">
          Récap renvoyé au cabinet. En attente de traitement.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-primary text-xs uppercase tracking-wide text-primary-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">Tableau</th>
              <th className="px-3 py-2.5 text-right font-medium">
                Cases à compléter
              </th>
              <th className="px-3 py-2.5 text-left font-medium">Statut</th>
              <th className="px-3 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((r) => (
              <tr key={r.onglet} className="hover:bg-muted/20">
                <td className="px-3 py-2 text-foreground">{label(r.onglet)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {r.count}
                </td>
                <td className="px-3 py-2">
                  <StatusDot
                    tone={
                      r.statut === "repondu"
                        ? "success"
                        : r.statut === "envoye"
                          ? "warning"
                          : "muted"
                    }
                    label={
                      r.statut === "envoye"
                        ? "Envoyé — en attente"
                        : r.statut === "repondu"
                          ? "Complété par le client"
                          : r.count === 0
                            ? "Complet"
                            : "Non envoyé"
                    }
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && r.statut === "none" && r.count > 0 && (
                    <Button
                      size="sm"
                      variant="ledger"
                      disabled={sending === r.onglet}
                      onClick={async () => {
                        setSending(r.onglet);
                        try {
                          await sendRecapSection(collecte.id, r.onglet, r.count);
                          toast.success(
                            `« ${label(r.onglet)} » envoyé — ${r.count} case(s) à compléter`,
                          );
                        } finally {
                          setSending(null);
                        }
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Envoyer
                    </Button>
                  )}
                  {isAdmin && r.statut !== "none" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sending === r.onglet}
                      onClick={async () => {
                        setSending(r.onglet);
                        try {
                          await closeRecapSection(collecte.id, r.onglet);
                          toast.success(`« ${label(r.onglet)} » clôturé`);
                        } finally {
                          setSending(null);
                        }
                      }}
                    >
                      Clore
                    </Button>
                  )}
                  {!isAdmin && r.statut === "envoye" && (
                    <button
                      onClick={() => onNavigate(r.onglet)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-accent"
                    >
                      Ouvrir l'onglet
                      <ChevronRight className="h-3.5 w-3.5 text-accent" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

      {isAdmin && anyRepondu && (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Le client a renvoyé. Complétez ce qui reste puis validez la collecte.
        </p>
      )}
    </div>
  );
}
