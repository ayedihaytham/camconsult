import { matchPath } from "react-router-dom";
import type { Balance, Collecte, Societe } from "@/types";

export interface AppBreadcrumb {
  label: string;
  to?: string;
}

export interface BreadcrumbData {
  societes: Pick<Societe, "id" | "raisonSociale">[];
  collectes: Pick<Collecte, "id" | "societeId" | "periode">[];
  balances: Pick<Balance, "id" | "exercice">[];
}

const STATIC_ROUTES: Record<string, string> = {
  "/": "Dashboard",
  "/societes": "Sociétés",
  "/employes": "Collaborateurs",
  "/taches": "Tâches",
  "/collectes": "Collecte de pièces",
  "/stock": "Gestion de stock",
  "/etats-financiers": "États financiers",
  "/grille-affectat": "Paramétrage",
  "/bordereaux": "Bordereaux bancaires",
  "/structuration": "Structuration",
  "/messagerie": "Messagerie",
  "/journal": "Journal",
  "/parametres": "Paramètres",
};

function paramsFor(path: string, pathname: string) {
  return matchPath({ path, end: true }, pathname)?.params;
}

export function getAppBreadcrumbs(
  pathname: string,
  { societes, collectes, balances }: BreadcrumbData,
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
      { label: "Gestion de stock", to: "/stock" },
      { label: societeName(stockParams.societeId) },
    ];
  }

  const collecteParams = paramsFor("/collectes/:id", pathname);
  if (collecteParams) {
    const collecte = collectes.find((item) => item.id === collecteParams.id);
    const label = collecte
      ? `${societeName(collecte.societeId)} · ${collecte.periode}`
      : "Collecte";
    return [
      { label: "Collecte de pièces", to: "/collectes" },
      { label },
    ];
  }

  return [{ label: STATIC_ROUTES[pathname] ?? "Cabinet" }];
}
