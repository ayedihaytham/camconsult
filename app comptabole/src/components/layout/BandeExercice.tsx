import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { api } from "@/lib/api";
import { cleMois, MOIS_COURTS, MOIS_LONGS, resumeMois, syntheseParMois } from "@/lib/collecte/moisExercice";
import { cn } from "@/lib/utils";
import type { Collecte } from "@/types";
import { AppBreadcrumbs } from "./AppBreadcrumbs";

const NOM = (i: number) => MOIS_LONGS[i].charAt(0).toUpperCase() + MOIS_LONGS[i].slice(1);

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
  const annee = maintenant.getFullYear();
  const societeId = societe?.id ?? null;
  const location = useLocation();
  const [params] = useSearchParams();
  // Mois affiché par le sélecteur : celui du filtre de la liste des collectes, sinon le mois en cours.
  const filtre = location.pathname === "/collectes" ? /^(20\d{2})-(\d{2})$/.exec(params.get("mois") ?? "") : null;
  const moisVu = filtre ? Number(filtre[2]) - 1 : moisCourant;
  const anneeVue = filtre ? Number(filtre[1]) : annee;
  const ouvrirMois = (mois: number, an = annee) => navigate(`/collectes?mois=${cleMois(an, mois)}`);
  const synthese = syntheseParMois(collectes ?? [], annee, maintenant);

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
      <div className="bande-exercice__mois" role="group" aria-label={`Exercice ${annee}`}>
        <span className="bande-exercice__titre">Exercice {annee}</span>
        <ol>
          {MOIS_COURTS.map((m, i) => (
            <li key={i} data-etat={i < moisCourant ? "passe" : i === moisCourant ? "courant" : "avenir"}>
              <button type="button" onClick={() => ouvrirMois(i)} title={`${NOM(i)} · ${resumeMois(synthese[i])}`} aria-label={`${NOM(i)} ${annee} : ${resumeMois(synthese[i])}`} aria-current={i === moisCourant ? "date" : undefined}>
                {m}
                {synthese[i].etat !== "vide" && <i className={`bande-point bande-point--${synthese[i].etat}`} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="bande-exercice__selecteur">
        <Popover>
          <div className="bande-selecteur">
            <button type="button" className="bande-selecteur__fleche" aria-label="Mois précédent" onClick={() => ouvrirMois((moisVu + 11) % 12, moisVu === 0 ? anneeVue - 1 : anneeVue)}><ChevronLeft className="size-4" aria-hidden="true" /></button>
            <PopoverTrigger asChild>
              <button type="button" className="bande-selecteur__valeur" aria-label="Choisir un mois">{NOM(moisVu)} {anneeVue}</button>
            </PopoverTrigger>
            <button type="button" className="bande-selecteur__fleche" aria-label="Mois suivant" onClick={() => ouvrirMois((moisVu + 1) % 12, moisVu === 11 ? anneeVue + 1 : anneeVue)}><ChevronRight className="size-4" aria-hidden="true" /></button>
          </div>
          <PopoverContent align="start" className="w-[19rem] p-3">
            <p className="bande-exercice__titre mb-2">Choisir un mois · {anneeVue}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {MOIS_LONGS.map((nom, i) => (
                <button key={nom} type="button" onClick={() => ouvrirMois(i, anneeVue)} className={cn("rounded-[10px] border px-2 py-1.5 text-left text-xs font-bold capitalize transition-colors hover:bg-muted", i === moisVu ?"border-primary bg-primary text-primary-foreground hover:bg-primary" : synthese[i].etat === "retard" ? "border-destructive/50" : "border-border", i > moisCourant && "opacity-50")}>
                  {nom}
                  <span className={cn("block text-[10.5px] font-medium normal-case", i === moisVu ? "text-primary-foreground/80" : "text-muted-foreground")}>{resumeMois(synthese[i])}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
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
