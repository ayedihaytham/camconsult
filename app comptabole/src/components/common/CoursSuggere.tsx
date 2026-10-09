import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MOIS, anneeMois, coursDuMois, coursParUnite } from "@/lib/coursChange";
import { useCoursChange } from "@/store/coursChange";

interface Props {
  /** Devise de la facture ou du règlement (« EUR », « USD »…). Rien n'est proposé pour le dinar ou une devise vide. */
  devise: string;
  /** Date de la facture ou du règlement : le cours proposé est la moyenne du mois de cette date. */
  date: string | null | undefined;
  /** Cours actuellement saisi, pour savoir s'il est déjà appliqué. */
  courant: number;
  onAppliquer: (cours: number) => void;
}

const format = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 8 });

/** Propose, sous un champ « cours », le cours moyen du mois de la date pour la devise (tableau « Cours de change »), à appliquer d'un clic. */
export function CoursSuggere({ devise, date, courant, onAppliquer }: Props) {
  const fetchCours = useCoursChange((s) => s.fetch);
  const charge = useCoursChange((s) => s.charge);
  const cours = useCoursChange((s) => s.cours);
  const devises = useCoursChange((s) => s.devises);
  useEffect(() => {
    void fetchCours();
  }, [fetchCours]);

  const code = devise.trim().toUpperCase();
  if (!code || code === "TND" || !charge) return null;
  const am = anneeMois(date);
  const classe = "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground";
  if (!am) return <p className={classe}>Renseignez la date pour proposer le cours moyen du mois.</p>;
  const mois = `${MOIS[am.mois - 1]} ${am.annee}`;
  const trouve = coursDuMois(cours, code, date);
  if (!trouve) {
    return (
      <p className={classe}>
        Aucun cours {code} pour {mois}.{" "}
        <Link to="/cours-change" className="font-medium text-primary underline underline-offset-2">
          Cours de change
        </Link>
      </p>
    );
  }
  const valeur = coursParUnite(trouve, devises);
  const applique = Math.abs(courant - valeur) < 1e-9;
  return (
    <p className={classe}>
      <span>
        Cours moyen {code} de {mois} : <strong className="tabular-nums text-foreground">{format(valeur)}</strong>
      </span>
      {applique ? (
        <span className="font-medium text-success">Appliqué</span>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onAppliquer(valeur)}>
          Appliquer
        </Button>
      )}
    </p>
  );
}
