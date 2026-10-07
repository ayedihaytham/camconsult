import { Wallet } from "lucide-react";
import { SocieteChoixPage } from "@/components/common/SocieteChoixPage";

export function BanquePage() {
  return (
    <SocieteChoixPage
      icon={Wallet}
      eyebrow="Clients & travail · Banque"
      title="Suivi bancaire"
      description="Choisissez une société pour suivre ses comptes bancaires et rapprocher les paiements de ses fournisseurs."
      basePath="/banque"
      tourId="banque-societes"
    />
  );
}
