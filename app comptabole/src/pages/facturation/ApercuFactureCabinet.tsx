import { useEffect, useRef, useState } from "react";
import { htmlFacture } from "@/lib/facturation";
import type { Facture, FactureCabinet } from "@/types";

/** Facture d'exemple (données fictives) : seule l'identité du cabinet change dans l'aperçu. */
const FACTURE_EXEMPLE: Facture = {
  id: "exemple",
  societeId: "exemple",
  societeNom: "SOCIÉTÉ EXEMPLE SARL",
  clientAdresse: "5 avenue Habib Bourguiba\n3000 Sfax",
  clientTva: "7654321KAM000",
  clientRne: "B0987652019",
  numero: "2026-0001",
  dateEmission: "2026-10-18",
  echeance: "2026-11-17",
  tvaTaux: 19,
  timbre: 1,
  statut: "emise",
  payeLe: null,
  signeeLe: null,
  note: "",
  totalHt: 500,
  tva: 95,
  netAPayer: 596,
  creeLe: "2026-10-18T08:00:00Z",
  einvoice: null,
  lignes: [{ id: "1", ordre: 0, description: "Tenue de comptabilité — octobre 2026", quantite: 1, montantHt: 500 }],
};

const LARGEUR_A4 = 794;
const HAUTEUR_A4 = 1123;

/**
 * Miniature de la vraie facture (même modèle que l'impression) avec l'identité du cabinet en cours de saisie : l'en-tête, les références fiscales,
 * le RIB et le pied de page changent pendant la frappe. Le contenu est inerte (aucun script, aucune interaction) et seul le logo est chargé.
 */
export function ApercuFactureCabinet({ cabinet }: { cabinet: FactureCabinet }) {
  const [html, setHtml] = useState("");
  const [largeur, setLargeur] = useState(250);
  const boite = useRef<HTMLDivElement>(null);

  // Légère temporisation : on ne reconstruit pas la page à chaque touche.
  useEffect(() => {
    const t = window.setTimeout(() => setHtml(htmlFacture(FACTURE_EXEMPLE, cabinet, window.location.origin)), 150);
    return () => window.clearTimeout(t);
  }, [cabinet]);

  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    setLargeur(el.clientWidth || 250);
    if (typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver(() => setLargeur(el.clientWidth || 250));
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const echelle = largeur / LARGEUR_A4;
  return (
    <div ref={boite} className="overflow-hidden rounded-lg border border-accent/25 bg-muted" style={{ height: HAUTEUR_A4 * echelle }}>
      <iframe
        title="Aperçu de la facture avec l'identité du cabinet"
        srcDoc={html}
        sandbox=""
        tabIndex={-1}
        style={{ width: LARGEUR_A4, height: HAUTEUR_A4, transform: `scale(${echelle})`, transformOrigin: "top left", border: 0, background: "#fff", pointerEvents: "none" }}
      />
    </div>
  );
}
