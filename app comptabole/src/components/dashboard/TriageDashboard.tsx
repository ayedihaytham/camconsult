import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { DashboardTriageItem, TriageGroupe } from "@/lib/dashboard/dashboardData";
import { WorkspaceLoading } from "./WorkspaceSection";
import "./triage.css";

const GROUPES: Array<{ groupe: TriageGroupe; titre: string }> = [
  { groupe: "retard", titre: "En retard" },
  { groupe: "examiner", titre: "À examiner" },
  { groupe: "corriger", titre: "À corriger côté client" },
];

const TON_STATUT: Record<string, string> = { brouillon: "client", transmis: "transmis", a_corriger: "corriger", valide: "valide", archive: "archive" };

function delai(item: DashboardTriageItem): string {
  const d = item.daysFromToday;
  if (d === null) return "";
  if (d < 0) return `${-d} j de retard`;
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Demain";
  return `dans ${d} j`;
}

interface Props {
  items: DashboardTriageItem[];
  /** Filtre posé par la semaine : « retard », une date AAAA-MM-JJ, ou rien (toute la file). */
  filtre: string | null;
  onEffacerFiltre: () => void;
  loading: boolean;
  error: boolean;
}

/** « À traiter maintenant » (maquette) : la file des collectes qui demandent une action, et le dossier ouvert à droite. */
export function TriageDashboard({ items, filtre, onEffacerFiltre, loading, error }: Props) {
  const visibles = useMemo(
    () => items.filter((i) => !filtre || (filtre === "retard" ? i.groupe === "retard" : i.echeance === filtre)),
    [items, filtre],
  );
  const [choisi, setChoisi] = useState<string | null>(null);
  const courant = visibles.find((i) => i.id === choisi) ?? visibles[0] ?? null;
  useEffect(() => {
    if (choisi && !visibles.some((i) => i.id === choisi)) setChoisi(null);
  }, [visibles, choisi]);

  return (
    <section className="bureau-card triage" aria-labelledby="triage-titre" data-tour="dashboard-triage">
      <div className="triage-entete">
        <h2 id="triage-titre">À traiter maintenant</h2>
        {filtre && (
          <button type="button" className="triage-filtre" onClick={onEffacerFiltre}>
            {filtre === "retard" ? "En retard" : formatDate(filtre)} · effacer le filtre
          </button>
        )}
      </div>
      {loading ? (
        <WorkspaceLoading />
      ) : error ? (
        <p className="admin-brief-empty">La file de traitement est indisponible.</p>
      ) : visibles.length === 0 ? (
        <p className="admin-brief-empty">{filtre ? "Rien à traiter pour ce filtre." : "Aucune collecte à traiter pour le moment."}</p>
      ) : (
        <div className="triage-grille">
          <div className="triage-file" role="listbox" aria-label="Collectes à traiter">
            {GROUPES.map(({ groupe, titre }) => {
              const liste = visibles.filter((i) => i.groupe === groupe);
              if (liste.length === 0) return null;
              return (
                <div key={groupe} role="group" aria-label={titre}>
                  <h3 className="triage-groupe" data-groupe={groupe}>
                    {titre} <span>{liste.length}</span>
                  </h3>
                  {liste.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={courant?.id === item.id}
                      className="triage-ligne"
                      data-ton={TON_STATUT[item.statut]}
                      onClick={() => setChoisi(item.id)}
                    >
                      <span className="triage-point" aria-hidden="true" />
                      <span className="triage-nom">
                        <strong>{item.societeName}</strong>
                        <small>{item.periode} · {COLLECTE_STATUT_LABELS[item.statut]}</small>
                      </span>
                      {delai(item) && <em className={cn(item.groupe === "retard" && "is-retard")}>{delai(item)}</em>}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {courant && (
            <article className="triage-detail" aria-live="polite">
              <p className="triage-eyebrow">{courant.periode}</p>
              <h3>{courant.societeName}</h3>
              <span className="triage-pastille" data-ton={TON_STATUT[courant.statut]}>{COLLECTE_STATUT_LABELS[courant.statut]}</span>
              <dl className="triage-faits">
                <div>
                  <dt>Échéance</dt>
                  <dd>
                    {courant.echeance ? formatDate(courant.echeance) : "—"}
                    {delai(courant) && <small className={cn(courant.groupe === "retard" && "is-retard")}>{delai(courant)}</small>}
                  </dd>
                </div>
                <div>
                  <dt>Tableaux demandés</dt>
                  <dd>{courant.tableauxDemandes}</dd>
                </div>
              </dl>

              <h4 className="triage-sous-titre">Circuit de la collecte</h4>
              <div className="triage-circuit">
                <div data-ton="client"><b>{courant.tableauxDemandes}</b><span>Demandés</span></div>
                <div data-ton="transmis"><b>{courant.tableauxTransmis}</b><span>À examiner</span></div>
                <div data-ton="valide"><b>{courant.tableauxValides}</b><span>Validés</span></div>
              </div>

              <Link to={courant.route} className="triage-action">
                {courant.groupe === "corriger" ? "Ouvrir la collecte" : "Examiner la collecte"} <ArrowRight aria-hidden="true" />
              </Link>

              {courant.autres.length > 0 && (
                <>
                  <h4 className="triage-sous-titre">Autres collectes de la société</h4>
                  <ul className="triage-autres">
                    {courant.autres.map((autre) => (
                      <li key={autre.id}>
                        <Link to={autre.route} data-ton={TON_STATUT[autre.statut]}>
                          <span className="triage-point" aria-hidden="true" />
                          <span>{autre.periode}</span>
                          <em>{COLLECTE_STATUT_LABELS[autre.statut]}</em>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
