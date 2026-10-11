import { Fragment, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot, type StatusTone } from "@/components/ledger/StatusDot";
import { Input } from "@/components/ui/input";
import { cn, formatRelative } from "@/lib/utils";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { computeManques, ecartsDeRepartition, type Manque } from "@/lib/collecte/manques";
import { sectionRecapStatut } from "@/lib/collecte/recap";
import { sectionStatut } from "@/lib/collecte/sections";
import { useCollectes } from "@/store/collectes";
import type { CollecteFull } from "@/types";

interface Props {
  collecte: CollecteFull;
  /** L'administrateur gère les demandes au client. */
  canManageRecap: boolean;
  isClient?: boolean;
  onNavigate: (onglet: string, target?: { ordre: number | null; col: string | null }) => void;
}

function DetailManques({ manques, titre, onOuvrir }: {
  manques: Manque[];
  titre: string;
  onOuvrir: (target?: { ordre: number | null; col: string | null }) => void;
}) {
  const vide = manques.some((manque) => manque.ordre === null);
  const parLigne = new Map<number, Manque[]>();
  for (const manque of manques) {
    if (manque.ordre === null) continue;
    parLigne.set(manque.ordre, [...(parLigne.get(manque.ordre) ?? []), manque]);
  }
  return (
    <div role="region" aria-label={`Détail de « ${titre} »`} className="space-y-2 border-t border-border bg-muted/20 px-3 py-3">
      <p className="text-xs font-semibold text-foreground">Ce que le client devra compléter</p>
      {vide ? (
        <p className="text-sm text-muted-foreground">Aucune ligne saisie : le client devra remplir ce tableau.</p>
      ) : (
        <ul className="max-h-60 divide-y divide-border/70 overflow-auto text-sm">
          {[...parLigne.entries()].map(([ordre, cases]) => (
            <li key={ordre} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5">
              <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-foreground">Ligne {ordre + 1}</span>
              <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                {cases.map((manque) => (
                  <button
                    key={manque.col}
                    type="button"
                    className="min-h-11 rounded-sm text-left text-xs text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
                    aria-label={`Ouvrir la ligne ${ordre + 1}, ${manque.ref.split(" · ")[1] ?? manque.col}, dans ${titre}`}
                    onClick={() => onOuvrir({ ordre, col: manque.col })}
                  >
                    {manque.ref.split(" · ")[1] ?? manque.col}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => onOuvrir()}>
        Ouvrir le tableau<ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}

function EcartsRepartition({ ecarts }: { ecarts: string[] }) {
  if (ecarts.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {ecarts.map((ecart) => (
        <li key={ecart} className="flex items-baseline gap-1.5 text-xs font-normal text-foreground">
          <span className="size-1.5 shrink-0 rounded-sm bg-warning" aria-hidden="true" />{ecart}
        </li>
      ))}
    </ul>
  );
}

export function RecapTab({ collecte, canManageRecap, isClient = false, onNavigate }: Props) {
  const sendRecapSection = useCollectes((s) => s.sendRecapSection);
  const closeRecapSection = useCollectes((s) => s.closeRecapSection);
  const addNote = useCollectes((s) => s.addNote);
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState<{ onglet: string; action: "send" | "close" | "note" } | null>(null);
  const busyRef = useRef(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const canMutate = canManageRecap && !isClient && collecte.statut !== "archive";
  const live = useMemo(() => computeManques(collecte), [collecte]);
  const label = (key: string) => TAB_BY_KEY[key]?.label ?? key;
  const notesLibres = collecte.notes.filter((note) => note.kind === "note" && note.onglet === "");

  // Chaque tableau garde sa demande indépendante ; aucun envoi global implicite.
  const rows = useMemo(() => collecte.onglets
    .filter((onglet) => !TAB_BY_KEY[onglet]?.cabinetSeul)
    .map((onglet) => ({
      onglet,
      count: live.filter((manque) => manque.onglet === onglet).length,
      statut: sectionRecapStatut(collecte, onglet),
      archive: collecte.statut === "archive" || sectionStatut(collecte, onglet) === "archive",
      vide: !collecte.lignes.some((ligne) => ligne.onglet === onglet),
      ecarts: ecartsDeRepartition(collecte, onglet, collecte.devise),
    })), [collecte, live]);
  type RecapRow = (typeof rows)[number];
  const aCompleter = (row: RecapRow) => row.count > 0 || row.ecarts.length > 0;
  const aTransmettre = rows.filter((row) => !row.archive && row.statut === "none" && aCompleter(row)).length;
  const enAttente = rows.filter((row) => !row.archive && row.statut === "envoye").length;
  const reponses = rows.filter((row) => !row.archive && row.statut === "repondu").length;

  async function agir(action: "send" | "close" | "note", row?: RecapRow) {
    if (!canMutate || busyRef.current || row?.archive) return;
    if (action === "send" && (!row || row.statut !== "none" || !aCompleter(row))) return;
    if (action === "close" && (!row || row.statut === "none")) return;
    if (action === "note" && !newNote.trim()) return;
    busyRef.current = true;
    setBusy({ onglet: row?.onglet ?? "", action });
    try {
      if (action === "send" && row) {
        await sendRecapSection(collecte.id, row.onglet, row.count);
        toast.success(`« ${label(row.onglet)} » transmis au client`);
      } else if (action === "close" && row) {
        await closeRecapSection(collecte.id, row.onglet);
        toast.success(`Demande « ${label(row.onglet)} » clôturée`);
      } else if (action === "note") {
        await addNote(collecte.id, "", newNote.trim());
        setNewNote("");
      }
    } catch {
      // Le store affiche l'erreur ; conserver le détail et la saisie permet de réessayer.
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  const status = (row: RecapRow): { tone: StatusTone; label: string } => {
    if (row.archive) return { tone: "muted", label: "Archivé" };
    if (row.statut === "envoye") return { tone: "warning", label: "En attente du client" };
    if (row.statut === "repondu") return { tone: "success", label: "Réponse reçue" };
    return { tone: aCompleter(row) ? "primary" : "muted", label: aCompleter(row) ? "À transmettre" : "Aucune demande" };
  };
  const contenu = (row: RecapRow) => row.vide
    ? "Tableau à remplir"
    : row.count > 0 ? `${row.count} case${row.count === 1 ? "" : "s"}` : row.ecarts.length > 0 ? "Montant à vérifier" : "Aucune case manquante";
  const detail = (row: RecapRow) => (
    <DetailManques manques={live.filter((manque) => manque.onglet === row.onglet)} titre={label(row.onglet)} onOuvrir={(target) => onNavigate(row.onglet, target)} />
  );
  const actions = (row: RecapRow, mobile = false) => (
    <div className={cn("flex flex-wrap items-center gap-1.5", !mobile && "justify-end")}>
      {canMutate && !row.archive && row.statut === "none" && aCompleter(row) && (
        <Button size="sm" className={cn("gap-1.5", mobile && "min-h-11")} disabled={busy !== null}
          aria-label={`Transmettre au client : ${label(row.onglet)}`} onClick={() => void agir("send", row)}>
          {busy?.onglet === row.onglet && busy.action === "send" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          {busy?.onglet === row.onglet && busy.action === "send" ? "Transmission…" : "Transmettre au client"}
        </Button>
      )}
      {canMutate && !row.archive && row.statut !== "none" && (
        <Button size="sm" variant="outline" className={cn("gap-1.5", mobile && "min-h-11")} disabled={busy !== null}
          aria-label={`Clôturer la demande : ${label(row.onglet)}`} onClick={() => void agir("close", row)}>
          {busy?.onglet === row.onglet && busy.action === "close" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          {busy?.onglet === row.onglet && busy.action === "close" ? "Clôture…" : "Clôturer"}
        </Button>
      )}
      {row.count > 0 && (
        <Button size="sm" variant="ghost" className={cn("gap-1 px-2", mobile && "min-h-11")}
          aria-expanded={ouvert === row.onglet} aria-label={`${ouvert === row.onglet ? "Masquer" : "Voir"} le détail de ${label(row.onglet)}`}
          onClick={() => setOuvert(ouvert === row.onglet ? null : row.onglet)}>
          <ChevronRight className={cn("transition-transform motion-reduce:transition-none", ouvert === row.onglet && "rotate-90")} aria-hidden="true" />Détail
        </Button>
      )}
    </div>
  );
  const titre = (row: RecapRow) => (
    <button type="button" className="inline-flex min-h-11 min-w-0 items-center gap-1 text-left font-semibold text-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
      aria-label={`Ouvrir le tableau ${label(row.onglet)}`} onClick={() => onNavigate(row.onglet)}>
      <span className="min-w-0 break-words">{label(row.onglet)}</span><ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );

  if (isClient || !canManageRecap) return null;

  return (
    <div className="min-w-0 space-y-4" data-tour="collecte-recap">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-3 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Récap</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{canMutate ? "Transmettez les tableaux à compléter, puis clôturez les demandes traitées." : "Consultez les tableaux et les demandes de cette collecte archivée."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground" aria-label="Résumé des demandes">
          <span><strong className="font-semibold text-primary">{aTransmettre}</strong> à transmettre</span>
          <span><strong className="font-semibold text-foreground">{enAttente}</strong> en attente</span>
          <span><strong className="font-semibold text-foreground">{reponses}</strong> réponse{reponses === 1 ? "" : "s"} reçue{reponses === 1 ? "" : "s"}</span>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 text-sm text-muted-foreground">Aucun tableau destiné au client dans cette collecte.</p>
      ) : (
        <>
          <div className="hidden border-y border-border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/65 text-xs text-primary">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Tableau</th>
                  <th className="px-3 py-2 text-left font-medium">À compléter</th>
                  <th className="px-3 py-2 text-left font-medium">Demande</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <Fragment key={row.onglet}>
                    <tr className="hover:bg-muted/20">
                      <td className="px-3 py-2">{titre(row)}<EcartsRepartition ecarts={row.ecarts} /></td>
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{contenu(row)}</td>
                      <td className="px-3 py-2"><StatusDot className="text-xs" {...status(row)} /></td>
                      <td className="px-3 py-2">{actions(row)}</td>
                    </tr>
                    {ouvert === row.onglet && row.count > 0 && <tr><td colSpan={4} className="p-0">{detail(row)}</td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border border-y border-border lg:hidden">
            {rows.map((row) => (
              <div key={row.onglet}>
                <article className="min-w-0 space-y-2 px-3 py-3">
                  <div className="min-w-0">
                    <h3 className="text-sm">{titre(row)}</h3>
                    <EcartsRepartition ecarts={row.ecarts} />
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="tabular-nums text-muted-foreground">{contenu(row)}</span>
                      <StatusDot className="text-xs" {...status(row)} />
                    </div>
                  </div>
                  {actions(row, true)}
                </article>
                {ouvert === row.onglet && row.count > 0 && detail(row)}
              </div>
            ))}
          </div>
        </>
      )}
      <section className="px-3" aria-labelledby="recap-notes-title">
        <h3 id="recap-notes-title" className="mb-2 text-sm font-semibold text-foreground">Notes générales</h3>
        <div className="space-y-2">
          {notesLibres.length === 0 && <p className="text-xs text-muted-foreground">Aucune note.</p>}
          {notesLibres.map((note) => (
            <div key={note.id} className="border-b border-border py-2">
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.texte}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{note.auteur === "admin" ? "Cabinet" : "Client"} · {formatRelative(note.creeLe)}</p>
            </div>
          ))}
          {canMutate && (
            <form className="flex min-w-0 gap-2" aria-label="Ajouter une note générale" onSubmit={(event) => { event.preventDefault(); void agir("note"); }}>
              <Input value={newNote} disabled={busy !== null} className="h-11 min-w-0 sm:h-9" onChange={(event) => setNewNote(event.target.value)} placeholder="Ajouter une note générale…" aria-label="Nouvelle note générale" />
              <Button type="submit" size="sm" variant="outline" className="h-11 shrink-0 sm:h-9" disabled={busy !== null || !newNote.trim()}>
                {busy?.action === "note" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MessageSquarePlus aria-hidden="true" />}Ajouter
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
