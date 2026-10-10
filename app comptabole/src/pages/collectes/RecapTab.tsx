import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ledger/StatusDot";
import { Input } from "@/components/ui/input";
import { cn, formatRelative } from "@/lib/utils";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { computeManques, ecartsDeRepartition, type Manque } from "@/lib/collecte/manques";
import { sectionRecapStatut } from "@/lib/collecte/recap";
import { useCollectes } from "@/store/collectes";
import type { CollecteFull } from "@/types";

interface Props {
  collecte: CollecteFull;
  /** Cabinet (admin ou collaborateur du périmètre) — peut envoyer/clore un
   * récap par tableau, pas seulement l'admin. */
  canManageRecap: boolean;
  isClient: boolean;
  onNavigate: (onglet: string, target?: { ordre: number | null; col: string | null }) => void;
}

/** Détail des cases à compléter d'un tableau, ligne par ligne, tel que le client le recevra ; l'envoi se fait d'ici, après lecture. */
function DetailManques({
  manques,
  titre,
  peutEnvoyer,
  envoi,
  onEnvoyer,
  onOuvrir,
}: {
  manques: Manque[];
  titre: string;
  peutEnvoyer: boolean;
  envoi: boolean;
  onEnvoyer: () => void;
  onOuvrir: () => void;
}) {
  const vide = manques.find((m) => m.ordre === null);
  const parLigne = new Map<number, string[]>();
  for (const m of manques) {
    if (m.ordre === null) continue;
    parLigne.set(m.ordre, [...(parLigne.get(m.ordre) ?? []), m.ref.split(" · ")[1] ?? m.col ?? ""]);
  }
  return (
    <div role="region" aria-label={`Détail de « ${titre} »`} className="space-y-2 bg-muted/20 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ce que le client devra compléter dans « {titre} » ({manques.length} case{manques.length > 1 ? "s" : ""})
      </p>
      {vide ? (
        <p className="text-sm text-foreground">Aucune ligne n'est saisie dans ce tableau : le client devra le remplir en entier.</p>
      ) : (
        <ul className="max-h-60 divide-y divide-border/70 overflow-auto rounded-md border border-border bg-card text-sm">
          {[...parLigne.entries()].map(([ordre, colonnes]) => (
            <li key={ordre} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-1.5">
              <span className="w-16 shrink-0 font-semibold tabular-nums text-foreground">Ligne {ordre + 1}</span>
              <span className="flex min-w-0 flex-wrap gap-1.5">
                {colonnes.map((c) => (
                  <span key={c} className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                    {c}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {peutEnvoyer && (
          <Button size="sm" variant="ledger" disabled={envoi} onClick={onEnvoyer}>
            <Send className="h-3.5 w-3.5" />
            {envoi ? "Envoi…" : `Envoyer ces ${manques.length} case${manques.length > 1 ? "s" : ""} au client`}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onOuvrir}>
          Ouvrir le tableau
        </Button>
      </div>
    </div>
  );
}

/** Bordereaux dont le montant n'est pas atteint ou est dépassé : le cabinet le voit ici (il le demande au client par le Récap) au lieu d'être interrompu pendant sa saisie. */
function EcartsRepartition({ ecarts }: { ecarts: string[] }) {
  if (ecarts.length === 0) return null;
  return (
    <ul className="mt-0.5 space-y-0.5">
      {ecarts.map((e) => (
        <li key={e} className="text-xs font-normal text-warning">
          {e}
        </li>
      ))}
    </ul>
  );
}

export function RecapTab({ collecte, canManageRecap, isClient, onNavigate }: Props) {
  const sendRecapSection = useCollectes((s) => s.sendRecapSection);
  const closeRecapSection = useCollectes((s) => s.closeRecapSection);
  const addNote = useCollectes((s) => s.addNote);

  const notesLibres = collecte.notes.filter(
    (n) => n.kind === "note" && n.onglet === "",
  );
  const [newNote, setNewNote] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [afficherVides, setAfficherVides] = useState(false);

  const live = useMemo(() => computeManques(collecte), [collecte]);
  const label = (k: string) => TAB_BY_KEY[k]?.label ?? (k || "Général");
  const fieldActions = (onglet: string) => live.filter((manque) => manque.onglet === onglet).map((manque) => {
    const description = manque.ordre === null
      ? "Remplir ce tableau"
      : `Ligne ${manque.ordre + 1} · ${manque.ref.split(" · ")[1] ?? manque.col ?? "Champ à compléter"}`;
    return (
      <Button
        key={`${onglet}:${manque.ordre}:${manque.col}`}
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 px-2 text-[11px]"
        aria-label={`Aller à ${description} dans ${label(onglet)}`}
        onClick={() => onNavigate(onglet, { ordre: manque.ordre, col: manque.col })}
      >
        {description}<ChevronRight className="size-3" aria-hidden="true" />
      </Button>
    );
  });

  // Une ligne par tableau demandé — chaque tableau s'envoie indépendamment
  // des autres, jamais un envoi global pour toute la collecte.
  const rows = useMemo(
    () =>
      collecte.onglets.filter((onglet) => !TAB_BY_KEY[onglet]?.cabinetSeul).map((onglet) => ({
        onglet,
        count: live.filter((m) => m.onglet === onglet).length,
        statut: sectionRecapStatut(collecte, onglet),
        /** Aucune ligne saisie : tableau entièrement vide. */
        vide: !collecte.lignes.some((l) => l.onglet === onglet),
        /** Bordereaux dont le montant n'est pas atteint ou est dépassé : à signaler au client avec le reste. */
        ecarts: ecartsDeRepartition(collecte, onglet, collecte.devise),
      })),
    [collecte, live],
  );
  async function envoyer(onglet: string, count: number) {
    setSending(onglet);
    try {
      await sendRecapSection(collecte.id, onglet, count);
      toast.success(`« ${label(onglet)} » envoyé — ${count} case${count === 1 ? "" : "s"} à compléter`);
      setOuvert(null);
    } finally {
      setSending(null);
    }
  }
  const detail = (r: { onglet: string; count: number; statut: string }) => (
    <DetailManques
      manques={live.filter((m) => m.onglet === r.onglet)}
      titre={label(r.onglet)}
      peutEnvoyer={canManageRecap && r.statut === "none" && r.count > 0}
      envoi={sending === r.onglet}
      onEnvoyer={() => void envoyer(r.onglet, r.count)}
      onOuvrir={() => onNavigate(r.onglet)}
    />
  );
  const boutonDetail = (r: { onglet: string }, mobile = false) => (
    <Button
      size="sm"
      variant="outline"
      className={mobile ? "min-h-10 gap-1.5 px-2.5" : undefined}
      aria-expanded={ouvert === r.onglet}
      aria-label={`${ouvert === r.onglet ? "Masquer" : "Voir"} le détail de ${label(r.onglet)}`}
      onClick={() => setOuvert(ouvert === r.onglet ? null : r.onglet)}
    >
      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ouvert === r.onglet && "rotate-90")} />
      Détail
    </Button>
  );
  // Le client ne voit que les tableaux que le cabinet lui a effectivement
  // envoyés — jamais la liste complète des tableaux de la collecte, qui
  // laisserait croire qu'on lui demande des choses non encore transmises.
  // L'admin voit tout (pour choisir quoi envoyer ensuite).
  // Pour le cabinet, un tableau vide n'est pas listé (rien de précis à demander : le client le remplira de toute façon) tant qu'aucune demande n'y a
  // été envoyée ; ainsi il n'envoie que le nécessaire. Une demande déjà envoyée reste visible pour pouvoir être close.
  const visibleRows = isClient ? rows.filter((r) => r.statut !== "none") : rows.filter((r) => afficherVides || !(r.vide && r.statut === "none"));
  const nbVides = rows.filter((r) => r.vide && r.statut === "none").length;
  const totalCount = visibleRows.reduce((s, r) => s + r.count, 0);
  const tableauCount = visibleRows.filter((r) => r.count > 0).length;
  const anyPending = rows.some((r) => r.statut === "envoye");
  const anyRepondu = rows.some((r) => r.statut === "repondu");

  // Client sans aucun tableau encore envoyé : rien à montrer dans le
  // tableau (voir visibleRows) — un message suffit, jamais une pastille
  // trompeuse "tout est rempli" ni un tableau vide.
  if (isClient && visibleRows.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Aucune demande du cabinet pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          {totalCount === 0
            ? "Toutes les cases importantes sont remplies ✓"
            : `${totalCount} case${totalCount === 1 ? "" : "s"} importante${totalCount === 1 ? "" : "s"} à compléter, répartie${totalCount === 1 ? "" : "s"} sur ${tableauCount} tableau${tableauCount === 1 ? "" : "x"}`}
        </span>
      </div>

      {isClient && anyPending && (
        <p className="border-b border-warning/20 bg-warning/5 px-3 py-2 text-sm text-foreground">
          Choisissez une case demandée ci-dessous pour y accéder directement, complétez-la, puis transmettez vos réponses.
        </p>
      )}
      {isClient && !anyPending && anyRepondu && (
        <p className="text-sm text-muted-foreground">
          Récap renvoyé au cabinet. En attente de traitement.
        </p>
      )}

      {!isClient && nbVides > 0 && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-xs text-muted-foreground">
          <span>
            {afficherVides
              ? `${nbVides} tableau${nbVides > 1 ? "x" : ""} vide${nbVides > 1 ? "s" : ""} affiché${nbVides > 1 ? "s" : ""} : envoyez-les pour que le client les remplisse.`
              : `${nbVides} tableau${nbVides > 1 ? "x" : ""} vide${nbVides > 1 ? "s" : ""} non listé${nbVides > 1 ? "s" : ""} : il${nbVides > 1 ? "s" : ""} n'a${nbVides > 1 ? "nt" : ""} aucune ligne saisie.`}
          </span>
          <button type="button" onClick={() => setAfficherVides((v) => !v)} className="font-semibold text-primary underline underline-offset-2">
            {afficherVides ? "Masquer les tableaux vides" : "Afficher pour les envoyer"}
          </button>
        </p>
      )}
      {!isClient && visibleRows.length === 0 && (
        <p className="px-3 text-sm text-muted-foreground">Aucun tableau à envoyer pour le moment.</p>
      )}

      <div className="hidden overflow-x-auto border-y border-border lg:block">
        <table className="w-full text-sm">
          <thead className="bg-secondary/65 text-xs uppercase tracking-wide text-primary">
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
              <Fragment key={r.onglet}>
              <tr className="hover:bg-muted/20">
                <td className="px-3 py-2 font-medium text-foreground">
                  {label(r.onglet)}
                  {!isClient && <EcartsRepartition ecarts={r.ecarts} />}
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                  {r.count}
                </td>
                <td className="px-3 py-2">
                  <StatusDot
                    className="text-xs"
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
                  {canManageRecap && r.count > 0 && (
                    <span className="inline-flex">{boutonDetail(r)}</span>
                  )}
                  {canManageRecap && r.statut !== "none" && (
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
                  {isClient && r.statut === "envoye" && (
                    r.count > 0
                      ? <span className="inline-flex max-w-[30rem] flex-wrap justify-end gap-1">{fieldActions(r.onglet)}</span>
                      : <button type="button" onClick={() => onNavigate(r.onglet)} className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-accent">Ouvrir le tableau<ChevronRight className="size-3.5 text-accent" /></button>
                  )}
                </td>
              </tr>
              {canManageRecap && ouvert === r.onglet && r.count > 0 && (
                <tr>
                  <td colSpan={4} className="p-0">
                    {detail(r)}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border border-y border-border lg:hidden">
        {visibleRows.map((r) => {
          const rowLabel = label(r.onglet);
          const statusLabel =
            r.statut === "envoye"
              ? "Envoyé — en attente"
              : r.statut === "repondu"
                ? "Complété par le client"
                : r.count === 0
                  ? "Complet"
                  : "Non envoyé";

          return (
            <div key={r.onglet}>
            <article className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-sm font-semibold text-foreground">
                  {rowLabel}
                </h3>
                {!isClient && <EcartsRepartition ecarts={r.ecarts} />}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.count} {r.count === 1 ? "case" : "cases"} à compléter
                </p>
                <StatusDot
                  className="mt-1 text-xs"
                  tone={
                    r.statut === "repondu"
                      ? "success"
                      : r.statut === "envoye"
                        ? "warning"
                        : "muted"
                  }
                  label={statusLabel}
                />
              </div>
              <div className="shrink-0">
                {canManageRecap && r.count > 0 && boutonDetail(r, true)}
                {canManageRecap && r.statut !== "none" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10 px-2.5"
                    aria-label={`Clore la demande pour ${rowLabel}`}
                    disabled={sending === r.onglet}
                    onClick={async () => {
                      setSending(r.onglet);
                      try {
                        await closeRecapSection(collecte.id, r.onglet);
                        toast.success(`« ${rowLabel} » clôturé`);
                      } finally {
                        setSending(null);
                      }
                    }}
                  >
                    Clore
                  </Button>
                )}
                {isClient && r.statut === "envoye" && (
                  r.count > 0
                    ? <span className="mt-2 flex flex-wrap gap-1">{fieldActions(r.onglet)}</span>
                    : <button type="button" aria-label={`Ouvrir le tableau ${rowLabel}`} onClick={() => onNavigate(r.onglet)} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ouvrir le tableau<ChevronRight className="size-3.5 text-accent" /></button>
                )}
              </div>
            </article>
            {canManageRecap && ouvert === r.onglet && r.count > 0 && detail(r)}
            </div>
          );
        })}
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
            <div key={n.id} className="border-b border-border px-3 py-2">
              <p className="text-sm text-foreground">{n.texte}</p>
              <p className="text-[11px] text-muted-foreground">
                {n.auteur === "admin" ? "Cabinet" : "Client"} ·{" "}
                {formatRelative(n.creeLe)}
              </p>
            </div>
          ))}
          {(canManageRecap || isClient) && (
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

      {canManageRecap && anyRepondu && (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Le client a renvoyé. Complétez ce qui reste puis validez la collecte.
        </p>
      )}
    </div>
  );
}
