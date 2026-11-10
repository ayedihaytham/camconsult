import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Collecte } from "@/types";
import { AppBreadcrumbs } from "./AppBreadcrumbs";

const MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const CIRCUIT: Array<{ statut: Collecte["statut"]; label: string; classe: string }> = [
  { statut: "brouillon", label: "Client", classe: "bande-statut--client" },
  { statut: "transmis", label: "Transmis", classe: "bande-statut--transmis" },
  { statut: "a_corriger", label: "Corriger", classe: "bande-statut--corriger" },
  { statut: "valide", label: "Validées", classe: "bande-statut--validees" },
];

/** Bande sous la barre du haut (maquette) : fil d'Ariane, exercice en cours (mois écoulés et mois courant) et circuit des collectes
 * (combien chez le client, transmises, à corriger, validées) ; un clic sur un statut ouvre la collecte de pièces. */
export function BandeExercice() {
  const navigate = useNavigate();
  const societe = useSocieteActive();
  const [collectes, setCollectes] = useState<Collecte[] | null>(null);
  const maintenant = new Date();
  const moisCourant = maintenant.getMonth();
  const societeId = societe?.id ?? null;

  useEffect(() => {
    let annule = false;
    const charger = () => {
      api
        .get<Collecte[]>(`/collectes${societeId ? `?societeId=${societeId}` : ""}`)
        .then((l) => { if (!annule) setCollectes(l); })
        .catch(() => { if (!annule) setCollectes(null); });
    };
    charger();
    const id = setInterval(charger, 120_000);
    const visible = () => { if (document.visibilityState === "visible") charger(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      annule = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [societeId]);

  const compte = (statut: Collecte["statut"]) => (collectes ?? []).filter((c) => c.statut === statut).length;

  return (
    <div className="bande-exercice no-print">
      <div className="bande-exercice__fil"><AppBreadcrumbs clair /></div>
      <div className="bande-exercice__mois" role="group" aria-label={`Exercice ${maintenant.getFullYear()}`}>
        <span className="bande-exercice__titre">Exercice {maintenant.getFullYear()}</span>
        <ol>
          {MOIS.map((m, i) => (
            <li key={i} title={NOMS_MOIS[i]} data-etat={i < moisCourant ? "passe" : i === moisCourant ? "courant" : "avenir"} aria-current={i === moisCourant ? "date" : undefined}>
              {m}
            </li>
          ))}
        </ol>
      </div>
      {collectes && (
        <div className="bande-exercice__circuit" role="group" aria-label="Circuit des collectes">
          {CIRCUIT.map((c) => (
            <button key={c.statut} type="button" onClick={() => navigate("/collectes")} className={cn("bande-statut", c.classe)}>
              <b>{compte(c.statut)}</b> {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
