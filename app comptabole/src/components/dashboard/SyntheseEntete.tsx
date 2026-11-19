import { useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, BellRing, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { dureeAvantCloture, exerciceDuJour } from "@/lib/dashboard/exercice";
import type { DashboardTriageItem, DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { cn } from "@/lib/utils";
import { useCollectes } from "@/store/collectes";
import { useUi } from "@/store/ui";
import "./synthese-entete.css";

const NOM_CABINET = "Cabinet Ayadi Mohamed";
const MOIS = ["JAN", "MAR", "MAI", "JUIL", "SEP", "NOV", "DÉC"];

const jours = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

function echeance(item: DashboardTriageItem): { texte: string; retard: boolean } | null {
  const d = item.daysFromToday;
  if (d === null) return null;
  if (d < 0) return { texte: `échéance dépassée de ${jours(-d)}`, retard: true };
  if (d === 0) return { texte: "échéance aujourd'hui", retard: false };
  return { texte: `échéance dans ${jours(d)}`, retard: false };
}

function tableaux(item: DashboardTriageItem): string {
  const recus = item.tableauxTransmis + item.tableauxValides;
  if (item.tableauxDemandes === 0) return "aucun tableau n'a encore été demandé";
  if (recus === 0) return `aucun des ${item.tableauxDemandes} tableaux n'a été transmis`;
  return `${recus} des ${item.tableauxDemandes} tableaux transmis`;
}

const ETAPES = ["Pièces attendues du client", "Transmise au cabinet", "Validée"] as const;
const ETAPE_DU_STATUT: Record<string, number> = { brouillon: 0, a_corriger: 0, transmis: 1, valide: 2, archive: 2 };

interface Props {
  salutation: string;
  dateLabel: string;
  data: DashboardViewModel;
  loading: boolean;
  error: boolean;
  now: Date;
  societeNom?: string | null;
}

/**
 * Haut de la Synthèse du cabinet : identité et exercice, puis la priorité du jour.
 * Les onglets de la page se posent juste dessous (même bloc marine) : voir DashboardTabs.
 */
export function SyntheseEntete({ salutation, dateLabel, data, loading, error, now, societeNom = null }: Props) {
  const { canManageCollaborateurs } = usePermissions();
  const relanceNow = useCollectes((s) => s.relanceNow);
  const [relance, setRelance] = useState(false);
  // L'exercice figure dans ce bloc : la bande d'exercice globale (et ses pastilles d'état) ferait doublon.
  const ajusterBandeau = useUi((s) => s.ajusterBandeauIntegre);
  useLayoutEffect(() => {
    ajusterBandeau(1);
    return () => ajusterBandeau(-1);
  }, [ajusterBandeau]);
  const exercice = exerciceDuJour(now);
  const indisponible = loading || error;
  const premier = indisponible ? null : data.triage[0] ?? null;
  const suite = premier ? data.triage.length - 1 : 0;
  const ech = premier ? echeance(premier) : null;
  const etape = premier ? ETAPE_DU_STATUT[premier.statut] ?? 0 : 0;
  const attendClient = premier ? premier.statut === "brouillon" || premier.statut === "a_corriger" : false;

  return (
    <section className="synthese-entete" aria-label="Synthèse du cabinet" data-tour="dashboard-summary">
      <div className="synthese-entete__haut">
        <div className="min-w-0">
          <p className="synthese-entete__sur">{dateLabel}</p>
          <h1>{salutation}</h1>
          <p className="synthese-entete__sous">{societeNom ? `${societeNom} · vue limitée à cette société` : `${NOM_CABINET} · Synthèse du portefeuille`}</p>
        </div>
        <div className="synthese-exercice" role="group" aria-label={`Exercice ${exercice.annee}`}>
          <p><b>Exercice {exercice.annee}</b><span>Clôture le 31 décembre · {dureeAvantCloture(exercice.joursRestants)}</span></p>
          <div className="synthese-exercice__jauge" role="img" aria-label={`${exercice.pourcent} % de l'exercice écoulé`}><i style={{ width: `${exercice.pourcent}%` }} /></div>
          <div className="synthese-exercice__mois" aria-hidden="true">{MOIS.map((m) => <span key={m}>{m}</span>)}</div>
        </div>
      </div>
      <div className="synthese-entete__filet" aria-hidden="true" />
      <div className="synthese-priorite" data-tour="dashboard-resume">
        <span className={cn("synthese-priorite__icone", !premier && "is-calme")} aria-hidden="true">{premier ? <AlertTriangle /> : <CheckCircle2 />}</span>
        <div className="min-w-0">
          <p className="synthese-priorite__sur">Priorité du jour</p>
          {indisponible ? (
            <>
              <h2>{loading ? "Chargement du suivi…" : "Le suivi des collectes est indisponible"}</h2>
              <p className="synthese-priorite__texte">{loading ? "La priorité du jour sera établie après chargement." : "Réessayez dans un instant."}</p>
            </>
          ) : premier ? (
            <>
              <h2>{premier.societeName}</h2>
              <p className="synthese-priorite__texte">
                Collecte {premier.periode ? `de ${premier.periode.charAt(0).toLowerCase()}${premier.periode.slice(1)}` : ""}
                {ech && <> · <span className={cn(ech.retard && "est-retard")}>{ech.texte}</span></>}
                {" "}· <b>{tableaux(premier)}</b>
              </p>
              <ol className="synthese-suivi" aria-label="Avancement de la collecte">
                {ETAPES.map((nom, i) => <li key={nom} aria-current={i === etape ? "step" : undefined} className={cn(i === etape && "is-courante", i < etape && "is-faite")}><i aria-hidden="true" />{nom}</li>)}
                {suite > 0 && <li className="synthese-suivi__suite"><a href="#registre-revision"><b>{suite} autre{suite > 1 ? "s" : ""} dossier{suite > 1 ? "s" : ""}</b> au registre de révision ↓</a></li>}
              </ol>
            </>
          ) : (
            <>
              <h2>Aucune priorité</h2>
              <p className="synthese-priorite__texte">Aucune collecte ne demande d'action du cabinet pour le moment.</p>
            </>
          )}
        </div>
        {premier && (
          <div className="synthese-priorite__actions">
            <Link to={premier.route} className="synthese-bouton synthese-bouton--principal">Ouvrir le dossier <ArrowRight aria-hidden="true" /></Link>
            {canManageCollaborateurs && attendClient && (
              <button
                type="button"
                disabled={relance}
                className="synthese-bouton synthese-bouton--secondaire"
                onClick={() => {
                  setRelance(true);
                  void relanceNow(premier.id).then(() => toast.success("Relance envoyée au client")).catch(() => {}).finally(() => setRelance(false));
                }}
              >
                <BellRing aria-hidden="true" /> {relance ? "Envoi…" : "Relancer le client"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
