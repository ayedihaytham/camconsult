import { Truck } from "lucide-react";
import { SocieteChoixPage } from "@/components/common/SocieteChoixPage";

export function FournisseursPage() {
  return (
    <SocieteChoixPage
      icon={Truck}
      eyebrow="Clients & travail · Fournisseurs"
      title="Suivi fournisseur"
      description="Choisissez une société pour suivre les factures d'achat de ses fournisseurs et leurs règlements."
      basePath="/fournisseurs"
      tourId="fournisseurs-societes"
    />
  );
}
