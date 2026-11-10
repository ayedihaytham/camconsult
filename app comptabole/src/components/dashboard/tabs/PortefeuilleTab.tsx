import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { DashboardPortefeuilleItem } from "@/lib/dashboard/dashboardData";
import { WorkspaceLoading } from "../WorkspaceSection";
import "../triage.css";

const CIRCUIT: Array<{ cle: "brouillon" | "transmis" | "aCorriger" | "valide"; libelle: string }> = [
  { cle: "brouillon", libelle: "Chez le client" },
  { cle: "transmis", libelle: "À examiner" },
  { cle: "aCorriger", libelle: "À corriger" },
  { cle: "valide", libelle: "Validées" },
];

/** « Portefeuille » (maquette) : une ligne par société, avec le circuit de ses collectes. */
export function PortefeuilleTab({ items, loading, error }: { items: DashboardPortefeuilleItem[]; loading: boolean; error: boolean }) {
  const [filtre, setFiltre] = useState("");
  const visibles = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    return q ? items.filter((i) => i.societeName.toLowerCase().includes(q)) : items;
  }, [items, filtre]);

  return (
    <section className="bureau-card portefeuille" aria-labelledby="portefeuille-titre">
      <div className="triage-entete">
        <h2 id="portefeuille-titre">Portefeuille</h2>
        <label className="portefeuille-recherche">
          <Search aria-hidden="true" />
          <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Filtrer une société" aria-label="Filtrer une société" />
        </label>
      </div>
      <ul className="portefeuille-legende" aria-label="Légende du circuit">
        {CIRCUIT.map((c) => <li key={c.cle} data-cle={c.cle}><span aria-hidden="true" />{c.libelle}</li>)}
      </ul>
      {loading ? (
        <WorkspaceLoading />
      ) : error ? (
        <p className="admin-brief-empty">Le portefeuille est indisponible.</p>
      ) : visibles.length === 0 ? (
        <p className="admin-brief-empty">{filtre ? "Aucune société ne correspond." : "Aucune collecte en cours dans le portefeuille."}</p>
      ) : (
        <ul className="portefeuille-liste">
          {visibles.map((item) => {
            const total = item.brouillon + item.transmis + item.aCorriger + item.valide;
            return (
              <li key={item.societeId}>
                <Link to={item.route} className="portefeuille-ligne">
                  <span className="triage-nom">
                    <strong>{item.societeName}</strong>
                    <small>{item.enCours} en cours</small>
                  </span>
                  <span className="portefeuille-barre" role="img" aria-label={CIRCUIT.map((c) => `${item[c.cle]} ${c.libelle.toLowerCase()}`).join(", ")}>
                    {CIRCUIT.map((c) => item[c.cle] > 0 && <i key={c.cle} data-cle={c.cle} style={{ flexGrow: item[c.cle] }} title={`${item[c.cle]} ${c.libelle.toLowerCase()}`} />)}
                    {total === 0 && <i data-cle="vide" style={{ flexGrow: 1 }} />}
                  </span>
                  <span className={item.enRetard > 0 ? "portefeuille-retard is-retard" : "portefeuille-retard"}>
                    {item.enRetard > 0 ? `${item.enRetard} en retard` : "—"}
                  </span>
                  <span className="portefeuille-echeance">
                    {item.prochaine ? <><b>{formatDate(item.prochaine.echeance)}</b><small>{item.prochaine.periode}</small></> : <small>Aucune échéance</small>}
                  </span>
                  <ChevronRight className="portefeuille-chevron" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
