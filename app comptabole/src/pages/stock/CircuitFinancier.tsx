import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Landmark } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { fmtMontant } from "@/lib/stockRecap";
import type { CircuitBanque, CircuitStock } from "@/types";

const COURS_SOURCE: Record<string, string> = {
  tnd: "dinars",
  reglement: "cours du règlement",
  achat: "cours de la facture d'achat, estimé",
  vente: "cours de la vente, estimé",
};
const cours = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const tnd = (n: number | null) => (n === null ? "—" : `${fmtMontant(n)} TND`);

function Bloc({ titre, filet, children }: { titre: string; filet: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-lg border border-border border-t-2 bg-card px-3 py-2.5", filet)}>
      <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.09em] text-primary">{titre}</h3>
      <div className="mt-1.5 space-y-2">{children}</div>
    </section>
  );
}

function Chiffre({ libelle, valeur, ton }: { libelle: string; valeur: string; ton?: "bon" | "mauvais" }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{libelle}</dt>
      <dd className={cn("m-0 mt-0.5 truncate text-sm font-bold tabular-nums", ton === "bon" && "text-success", ton === "mauvais" && "text-destructive")}>{valeur}</dd>
    </div>
  );
}

function PastilleBanque({ banque, societeId }: { banque: CircuitBanque | null; societeId: string }) {
  if (!banque) return <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[0.65rem] font-semibold text-warning">Pas rapproché en banque</span>;
  return (
    <Link to={`/banque/${societeId}`} className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] font-semibold text-success hover:underline" title={banque.libelle}>
      <Landmark className="size-3" aria-hidden="true" />
      Banque {formatDate(banque.dateOp ?? "")} · {fmtMontant(banque.montant)} {banque.devise}
    </Link>
  );
}

/** Le chemin de l'argent d'un mouvement de stock : facture d'achat → règlements → banque, vente → fiche client devise → encaissements → banque, en dinars. */
export function CircuitFinancier({ mouvementId, societeId }: { mouvementId: string; societeId: string }) {
  const [circuit, setCircuit] = useState<CircuitStock | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let courant = true;
    setCircuit(null);
    setErreur("");
    api.get<CircuitStock>(`/stock/mouvements/${mouvementId}/circuit`).then(
      (c) => courant && setCircuit(c),
      (e) => courant && setErreur(e instanceof Error ? e.message : "Circuit indisponible"),
    );
    return () => {
      courant = false;
    };
  }, [mouvementId]);

  if (erreur) return <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erreur}</p>;
  if (!circuit) return <p className="px-1 py-6 text-center text-sm text-muted-foreground">Chargement du circuit…</p>;
  const { totaux } = circuit;

  return (
    <div className="space-y-2.5">
      <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <Chiffre libelle="Décaissé" valeur={tnd(totaux.decaisseTnd)} />
        <Chiffre libelle="Encaissé" valeur={tnd(totaux.encaisseTnd)} />
        <Chiffre libelle="Trésorerie" valeur={tnd(totaux.tresorerieTnd)} ton={totaux.tresorerieTnd > 0 ? "bon" : totaux.tresorerieTnd < 0 ? "mauvais" : undefined} />
      </dl>
      {totaux.incomplet && (
        <p role="alert" className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          Un règlement en devise n'a aucun cours connu (ni le sien, ni celui de la facture) : les totaux en dinars sont incomplets.
        </p>
      )}

      <Bloc titre="Achat et règlements fournisseur" filet="border-t-warning">
        {circuit.achat ? (
          <p className="text-sm">
            Facture <b>{circuit.achat.numFacture || "sans numéro"}</b> · {circuit.achat.fournisseur || "fournisseur inconnu"} ·{" "}
            <b className="tabular-nums">{fmtMontant(circuit.achat.montant)} {circuit.achat.devise}</b>
            {circuit.achat.montantTnd > 0 && <span className="text-muted-foreground"> ({fmtMontant(circuit.achat.montantTnd)} TND)</span>}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Pas de facture d'achat sur ce mouvement.</p>
        )}
        {circuit.achat && circuit.reglementsFournisseur.length === 0 && <p className="text-sm text-muted-foreground">Aucun règlement fournisseur enregistré.</p>}
        {circuit.reglementsFournisseur.map((r) => (
          <div key={r.id} className="rounded-md border border-border/70 px-2.5 py-2 text-xs">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b>{formatDate(r.date ?? "")}</b>
              <span className="capitalize">{r.mode}</span>
              <span className="tabular-nums">
                {fmtMontant(r.brut)} {r.devise}
                {r.retenue > 0 && <span className="text-muted-foreground"> − retenue {fmtMontant(r.retenue)} = viré {fmtMontant(r.vire)}</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">{r.cours === null ? "cours inconnu" : r.devise === "TND" ? "" : `cours ${cours(r.cours)} (${COURS_SOURCE[r.coursSource ?? ""] ?? ""})`}</span>
              <b className="ml-auto tabular-nums">{tnd(r.vireTnd)}</b>
            </p>
            <p className="mt-1">
              <PastilleBanque banque={r.banque} societeId={societeId} />
            </p>
          </div>
        ))}
        {circuit.totaux.resteAPayer && (
          <p className={cn("text-xs font-semibold tabular-nums", circuit.totaux.resteAPayer.montant > 0.0005 ? "text-warning" : circuit.totaux.resteAPayer.montant < -0.0005 ? "text-destructive" : "text-success")}>
            {circuit.totaux.resteAPayer.montant > 0.0005
              ? `Reste à payer : ${fmtMontant(circuit.totaux.resteAPayer.montant)} ${circuit.totaux.resteAPayer.devise}`
              : circuit.totaux.resteAPayer.montant < -0.0005
                ? `Sur-réglé de ${fmtMontant(-circuit.totaux.resteAPayer.montant)} ${circuit.totaux.resteAPayer.devise}`
                : "Facture d'achat soldée"}
          </p>
        )}
      </Bloc>

      <Bloc titre="Vente et encaissements client" filet="border-t-success">
        {circuit.vente ? (
          <p className="text-sm">
            Facture <b>{circuit.vente.numFacture || "sans numéro"}</b> · {circuit.vente.client || "client inconnu"} ·{" "}
            <b className="tabular-nums">{fmtMontant(circuit.vente.montant)} {circuit.vente.devise}</b>
            {circuit.vente.montantTnd > 0 && <span className="text-muted-foreground"> ({fmtMontant(circuit.vente.montantTnd)} TND)</span>}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Pas de facture de vente sur ce mouvement.</p>
        )}
        {circuit.vente && !circuit.suiviDevise && <p className="text-sm text-muted-foreground">Cette vente n'est pas reprise dans le suivi client devise : ses encaissements n'y sont pas suivis.</p>}
        {circuit.suiviDevise && (
          <p className="text-xs">
            <Link to={`/suivi-devise/${societeId}/${circuit.suiviDevise.suiviId}`} className="font-semibold text-primary hover:underline">
              Fiche {circuit.suiviDevise.client} {circuit.suiviDevise.exercice}
            </Link>{" "}
            · facture {circuit.suiviDevise.nFacture} · {fmtMontant(circuit.suiviDevise.montantTotal)} {circuit.suiviDevise.devise}
          </p>
        )}
        {circuit.suiviDevise && circuit.reglementsClient.length === 0 && <p className="text-sm text-muted-foreground">Aucun règlement client affecté à cette facture.</p>}
        {circuit.reglementsClient.map((r) => (
          <div key={r.id} className="rounded-md border border-border/70 px-2.5 py-2 text-xs">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <b>{formatDate(r.date ?? "")}</b>
              <span className="min-w-0 truncate">{r.libelle}</span>
              <span className="tabular-nums">{fmtMontant(r.montant)} {r.devise}</span>
              <span className="tabular-nums text-muted-foreground">{r.cours === null ? "cours inconnu" : r.devise === "TND" ? "" : `cours ${cours(r.cours)} (${COURS_SOURCE[r.coursSource ?? ""] ?? ""})`}</span>
              <b className="ml-auto tabular-nums">{tnd(r.montantTnd)}</b>
            </p>
            <p className="mt-1">
              <PastilleBanque banque={r.banque} societeId={societeId} />
            </p>
          </div>
        ))}
        {circuit.totaux.resteAEncaisser && (
          <p className={cn("text-xs font-semibold tabular-nums", circuit.totaux.resteAEncaisser.montant > 0.0005 ? "text-warning" : circuit.totaux.resteAEncaisser.montant < -0.0005 ? "text-destructive" : "text-success")}>
            {circuit.totaux.resteAEncaisser.montant > 0.0005
              ? `Reste à encaisser : ${fmtMontant(circuit.totaux.resteAEncaisser.montant)} ${circuit.totaux.resteAEncaisser.devise}`
              : circuit.totaux.resteAEncaisser.montant < -0.0005
                ? `Sur-encaissé de ${fmtMontant(-circuit.totaux.resteAEncaisser.montant)} ${circuit.totaux.resteAEncaisser.devise}`
                : "Facture de vente encaissée"}
          </p>
        )}
      </Bloc>
    </div>
  );
}
