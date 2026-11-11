import { matchPath } from "react-router-dom";
import type { Balance, Collecte, Societe, SuiviDevise } from "@/types";

export interface AppBreadcrumb {
  label: string;
  to?: string;
}

export interface BreadcrumbData {
  societes: Pick<Societe, "id" | "raisonSociale">[];
  collectes: Pick<Collecte, "id" | "societeId" | "periode">[];
  balances: Pick<Balance, "id" | "exercice">[];
  suiviDevise: Pick<SuiviDevise, "id" | "societeId" | "client" | "exercice">[];
}

const STATIC_ROUTES: Record<string, string> = {
  "/": "Tableau de bord",
  "/societes": "Sociétés",
  "/employes": "Équipe",
  "/taches": "Mes tâches",
  "/collectes": "Collectes de pièces",
  "/stock": "Stock",
  "/cours-change": "Cours de change",
  "/fournisseurs": "Fournisseurs",
  "/banque": "Suivi bancaire",
  "/etats-financiers": "États financiers",
  "/grille-affectat": "Paramétrage AFFECTAT",
  "/bordereaux": "Bordereaux",
  "/facturation": "Facturation",
  "/honoraires": "Honoraires",
  "/souche-cheques": "Souche de chèques",
  "/suivi-devise": "Suivi client devise",
  "/etat-swift": "État SWIFT",
  "/structuration": "Structuration",
  "/messagerie": "Messagerie",
  "/conversions": "Conversions",
  "/simulation-paie": "Simulation de paie",
  "/journal": "Journal",
  "/parametres": "Paramètres",
};

/** Libellé court d'une adresse de l'application (« Collecte de pièces », « Suivi bancaire »…), pour les raccourcis qui y ramènent. */
export function labelDeChemin(chemin: string): string {
  const sansRequete = chemin.split("?")[0];
  if (STATIC_ROUTES[sansRequete]) return STATIC_ROUTES[sansRequete];
  const racine = "/" + (sansRequete.split("/").filter(Boolean)[0] ?? "");
  return STATIC_ROUTES[racine] ?? "Page précédente";
}

function paramsFor(path: string, pathname: string) {
  return matchPath({ path, end: true }, pathname)?.params;
}

export function getAppBreadcrumbs(
  pathname: string,
  { societes, collectes, balances, suiviDevise }: BreadcrumbData,
): AppBreadcrumb[] {
  const societeName = (id: string | undefined) =>
    societes.find((societe) => societe.id === id)?.raisonSociale ?? "Société";

  const printParams = paramsFor(
    "/etats-financiers/:societeId/imprimer",
    pathname,
  );
  if (printParams) {
    const company = societeName(printParams.societeId);
    return [
      { label: "États financiers", to: "/etats-financiers" },
      {
        label: company,
        to: `/etats-financiers/${printParams.societeId}`,
      },
      { label: "Impression" },
    ];
  }

  const balanceParams = paramsFor(
    "/etats-financiers/:societeId/:balanceId",
    pathname,
  );
  if (balanceParams) {
    const balance = balances.find(
      (item) => item.id === balanceParams.balanceId,
    );
    return [
      { label: "États financiers", to: "/etats-financiers" },
      {
        label: societeName(balanceParams.societeId),
        to: `/etats-financiers/${balanceParams.societeId}`,
      },
      { label: balance ? `Balance ${balance.exercice}` : "Balance" },
    ];
  }

  const financialParams = paramsFor(
    "/etats-financiers/:societeId",
    pathname,
  );
  if (financialParams) {
    return [
      { label: "États financiers", to: "/etats-financiers" },
      { label: societeName(financialParams.societeId) },
    ];
  }

  const stockParams = paramsFor("/stock/:societeId", pathname);
  if (stockParams) {
    return [
      { label: "Stock", to: "/stock" },
      { label: societeName(stockParams.societeId) },
    ];
  }

  const fournisseursParams = paramsFor("/fournisseurs/:societeId", pathname);
  if (fournisseursParams) {
    return [
      { label: "Fournisseurs", to: "/fournisseurs" },
      { label: societeName(fournisseursParams.societeId) },
    ];
  }

  const banqueParams = paramsFor("/banque/:societeId", pathname);
  if (banqueParams) {
    return [
      { label: "Suivi bancaire", to: "/banque" },
      { label: societeName(banqueParams.societeId) },
    ];
  }

  const honorairesParams = paramsFor("/honoraires/:societeId", pathname);
  if (honorairesParams) {
    return [
      { label: "Honoraires", to: "/honoraires" },
      { label: societeName(honorairesParams.societeId) },
    ];
  }

  const soucheParams = paramsFor("/souche-cheques/:societeId", pathname);
  if (soucheParams) {
    return [
      { label: "Souche de chèques", to: "/souche-cheques" },
      { label: societeName(soucheParams.societeId) },
    ];
  }

  const suiviFicheParams = paramsFor("/suivi-devise/:societeId/:suiviId", pathname);
  if (suiviFicheParams) {
    const fiche = suiviDevise.find((f) => f.id === suiviFicheParams.suiviId);
    const label = fiche
      ? fiche.exercice
        ? `${fiche.client} — ${fiche.exercice}`
        : fiche.client
      : "Fiche";
    return [
      { label: "Suivi client devise", to: "/suivi-devise" },
      {
        label: societeName(suiviFicheParams.societeId),
        to: `/suivi-devise/${suiviFicheParams.societeId}`,
      },
      { label },
    ];
  }

  const suiviSocieteParams = paramsFor("/suivi-devise/:societeId", pathname);
  if (suiviSocieteParams) {
    return [
      { label: "Suivi client devise", to: "/suivi-devise" },
      { label: societeName(suiviSocieteParams.societeId) },
    ];
  }

  const swiftSocieteParams = paramsFor("/etat-swift/:societeId", pathname);
  if (swiftSocieteParams) {
    return [
      { label: "État SWIFT", to: "/etat-swift" },
      { label: societeName(swiftSocieteParams.societeId) },
    ];
  }

  const collecteParams = paramsFor("/collectes/:id", pathname);
  if (collecteParams) {
    const collecte = collectes.find((item) => item.id === collecteParams.id);
    const label = collecte
      ? collecte.periode.trim()
        ? `${societeName(collecte.societeId)} · ${collecte.periode.trim()}`
        : societeName(collecte.societeId)
      : "Collecte";
    return [
      { label: "Collectes de pièces", to: "/collectes" },
      { label },
    ];
  }

  return [{ label: STATIC_ROUTES[pathname] ?? "Cabinet" }];
}
