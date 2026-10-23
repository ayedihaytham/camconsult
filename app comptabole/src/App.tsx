import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireAdmin } from "@/components/auth/RequireAdmin";
import { RequireEquipeManager } from "@/components/auth/RequireEquipeManager";
import { RequireEquipe } from "@/components/auth/RequireEquipe";
import { RequireEtatClient } from "@/components/auth/RequireEtatClient";
import { RequireSuiviFournisseur } from "@/components/auth/RequireSuiviFournisseur";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { registerQuotaHandler } from "@/lib/safeStorage";
import { registerSessionExpiredHandler } from "@/lib/api";
import { startLiveEvents } from "@/lib/liveEvents";
import { useCollectes } from "@/store/collectes";
import { cheminAutoriseClient } from "@/components/layout/sidebar/navigation";
import { Button } from "@/components/ui/button";

const ActivationPage = lazy(() =>
  import("@/pages/ActivationPage").then((m) => ({ default: m.ActivationPage })),
);
const LoginPage = lazy(() =>
  import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const SocietesListPage = lazy(() =>
  import("@/pages/societes/SocietesListPage").then((m) => ({
    default: m.SocietesListPage,
  })),
);
const EmployesListPage = lazy(() =>
  import("@/pages/employes/EmployesListPage").then((m) => ({
    default: m.EmployesListPage,
  })),
);
const TachesPage = lazy(() =>
  import("@/pages/taches/TachesPage").then((m) => ({
    default: m.TachesPage,
  })),
);
const CollectesListPage = lazy(() =>
  import("@/pages/collectes/CollectesListPage").then((m) => ({
    default: m.CollectesListPage,
  })),
);
const CollecteEditorPage = lazy(() =>
  import("@/pages/collectes/CollecteEditorPage").then((m) => ({
    default: m.CollecteEditorPage,
  })),
);
const FacturationPage = lazy(() =>
  import("@/pages/facturation/FacturationPage").then((m) => ({
    default: m.FacturationPage,
  })),
);
const BordereauxPage = lazy(() =>
  import("@/pages/bordereaux/BordereauxPage").then((m) => ({
    default: m.BordereauxPage,
  })),
);
const CoursChangePage = lazy(() =>
  import("@/pages/coursChange/CoursChangePage").then((m) => ({ default: m.CoursChangePage })),
);
const EtatSwiftListPage = lazy(() =>
  import("@/pages/etatSwift/EtatSwiftListPage").then((m) => ({ default: m.EtatSwiftListPage })),
);
const EtatSwiftSocietePage = lazy(() =>
  import("@/pages/etatSwift/EtatSwiftSocietePage").then((m) => ({ default: m.EtatSwiftSocietePage })),
);
const SoucheClientPage = lazy(() =>
  import("@/pages/soucheCheques/SoucheClientPage").then((m) => ({ default: m.SoucheClientPage })),
);
const ApurementPage = lazy(() => import("@/pages/apurement/ApurementPage").then(m => ({ default: m.ApurementPage })));
const StockPage = lazy(() =>
  import("@/pages/stock/StockPage").then((m) => ({ default: m.StockPage })),
);
const StockSocietePage = lazy(() =>
  import("@/pages/stock/StockSocietePage").then((m) => ({
    default: m.StockSocietePage,
  })),
);
const FournisseursPage = lazy(() =>
  import("@/pages/fournisseurs/FournisseursPage").then((m) => ({
    default: m.FournisseursPage,
  })),
);
const FournisseursSocietePage = lazy(() =>
  import("@/pages/fournisseurs/FournisseursSocietePage").then((m) => ({
    default: m.FournisseursSocietePage,
  })),
);
const BanquePage = lazy(() =>
  import("@/pages/banque/BanquePage").then((m) => ({ default: m.BanquePage })),
);
const BanqueSocietePage = lazy(() =>
  import("@/pages/banque/BanqueSocietePage").then((m) => ({
    default: m.BanqueSocietePage,
  })),
);
const HonorairesListPage = lazy(() =>
  import("@/pages/honoraires/HonorairesListPage").then((m) => ({
    default: m.HonorairesListPage,
  })),
);
const HonorairesSocietePage = lazy(() =>
  import("@/pages/honoraires/HonorairesSocietePage").then((m) => ({
    default: m.HonorairesSocietePage,
  })),
);
const SoucheChequesListPage = lazy(() =>
  import("@/pages/soucheCheques/SoucheChequesListPage").then((m) => ({
    default: m.SoucheChequesListPage,
  })),
);
const SoucheChequesSocietePage = lazy(() =>
  import("@/pages/soucheCheques/SoucheChequesSocietePage").then((m) => ({
    default: m.SoucheChequesSocietePage,
  })),
);
const EtatsFinanciersPage = lazy(() =>
  import("@/pages/etatsFinanciers/EtatsFinanciersPage").then((m) => ({
    default: m.EtatsFinanciersPage,
  })),
);
const SuiviDeviseSocietesPage = lazy(() =>
  import("@/pages/suiviDevise/SuiviDeviseSocietesPage").then((m) => ({
    default: m.SuiviDeviseSocietesPage,
  })),
);
const SuiviDeviseListPage = lazy(() =>
  import("@/pages/suiviDevise/SuiviDeviseListPage").then((m) => ({
    default: m.SuiviDeviseListPage,
  })),
);
const SuiviDeviseEditorPage = lazy(() =>
  import("@/pages/suiviDevise/SuiviDeviseEditorPage").then((m) => ({
    default: m.SuiviDeviseEditorPage,
  })),
);
const BalancesListPage = lazy(() =>
  import("@/pages/etatsFinanciers/BalancesListPage").then((m) => ({
    default: m.BalancesListPage,
  })),
);
const BalanceEditorPage = lazy(() =>
  import("@/pages/etatsFinanciers/BalanceEditorPage").then((m) => ({
    default: m.BalanceEditorPage,
  })),
);
const GrilleAffectatPage = lazy(() =>
  import("@/pages/etatsFinanciers/GrilleAffectatPage").then((m) => ({
    default: m.GrilleAffectatPage,
  })),
);
const PrintClasseurPage = lazy(() =>
  import("@/pages/etatsFinanciers/PrintClasseurPage").then((m) => ({
    default: m.PrintClasseurPage,
  })),
);
const StructurationPage = lazy(() =>
  import("@/pages/structuration/StructurationPage").then((m) => ({
    default: m.StructurationPage,
  })),
);
const MessageriePage = lazy(() =>
  import("@/pages/messagerie/MessageriePage").then((m) => ({
    default: m.MessageriePage,
  })),
);
const ParametresPage = lazy(() =>
  import("@/pages/ParametresPage").then((m) => ({ default: m.ParametresPage })),
);
const SimulationPaiePage = lazy(() =>
  import("@/pages/SimulationPaiePage").then((m) => ({ default: m.SimulationPaiePage })),
);
const ConversionsPage = lazy(() =>
  import("@/pages/ConversionsPage").then((m) => ({ default: m.ConversionsPage })),
);
const JournalPage = lazy(() =>
  import("@/pages/JournalPage").then((m) => ({ default: m.JournalPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Charge les données du cabinet une fois la session établie. */
function DataBoundary({ children }: { children: React.ReactNode }) {
  const session = useAuth((s) => s.session);
  const hydrated = useData((s) => s.hydrated);
  const hydrate = useData((s) => s.hydrate);
  const clearLocal = useData((s) => s.clearLocal);
  const refreshMessages = useData((s) => s.refreshMessages);
  const refreshNotifications = useData((s) => s.refreshNotifications);
  const refreshPresence = useData((s) => s.refreshPresence);
  const [erreurChargement, setErreurChargement] = useState(false);

  useEffect(() => {
    clearLocal();
    setErreurChargement(false);
    hydrate().catch(() => {
      setErreurChargement(true);
      toast.error("Impossible de charger les données du cabinet.");
    });
    // Signal temps réel (messages/notifications) — voir src/lib/liveEvents.ts.
    // Le sondage 20s existant (Topbar) reste en filet de sécurité.
    const stopLiveEvents = startLiveEvents({
      onMessage: () => void refreshMessages(),
      onNotification: () => void refreshNotifications(),
      // Collecte de pièces ouverte : mise à jour en direct quand l'autre partie (client ou cabinet) la modifie, sans rechargement.
      onCollecte: (id) => void useCollectes.getState().synchroniser(id),
      // Structuration : un dossier ou un fichier ajouté, déplacé ou supprimé ailleurs apparaît tout de suite.
      onNoeuds: () => void useData.getState().refreshNoeuds(),
      onResync: () => {
        void useCollectes.getState().synchroniser();
        void useData.getState().refreshNoeuds();
        void refreshPresence();
      },
    });
    // Présence (en ligne / hors ligne) : relue toutes les 30 s tant que l'onglet est visible.
    void refreshPresence();
    const presence = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshPresence();
    }, 30_000);
    // recharge quand on change de compte
    return () => {
      stopLiveEvents();
      window.clearInterval(presence);
    };
  }, [
    session?.employeId,
    session?.role,
    hydrate,
    clearLocal,
    refreshMessages,
    refreshNotifications,
    refreshPresence,
  ]);

  const { pathname } = useLocation();
  // Compte de société cliente : Dashboard, Collecte de pièces, Structuration et Messagerie ; toute autre adresse l'y ramène.
  if (session?.poste === "societe_employe" && !cheminAutoriseClient(pathname)) return <Navigate to="/collectes" replace />;

  if (!hydrated && erreurChargement) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm font-medium text-foreground">Les données du cabinet n'ont pas pu être chargées.</p>
        <p className="text-xs text-muted-foreground">Le serveur est peut-être en cours de mise à jour. Réessayez dans un instant.</p>
        <Button
          onClick={() => {
            setErreurChargement(false);
            hydrate().catch(() => setErreurChargement(true));
          }}
        >
          Réessayer
        </Button>
      </div>
    );
  }
  if (!hydrated) return <FullScreenLoader label="Chargement des données…" />;
  return <>{children}</>;
}

export default function App() {
  const status = useAuth((s) => s.status);
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    restore();
    // Session expirée (jeton refusé par le serveur) : retour à la connexion, sans requêtes qui échouent en boucle.
    registerSessionExpiredHandler(() => {
      if (useAuth.getState().status !== "authed") return;
      useAuth.setState({ status: "anon", session: null });
      toast.info("Votre session a expiré : reconnectez-vous.");
    });
    registerQuotaHandler(() =>
      toast.error("Stockage local saturé", {
        description: "Videz le cache du navigateur si le problème persiste.",
      }),
    );
  }, [restore]);

  if (status === "loading") {
    return <FullScreenLoader label="Connexion…" />;
  }
  if (status === "indisponible") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div role="alert" className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="font-serif text-xl font-semibold text-primary">Serveur momentanément indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">Votre session est conservée. Vérifiez votre connexion, puis réessayez : vous reprendrez là où vous en étiez.</p>
          <Button type="button" variant="ledger" className="mt-4" onClick={() => { useAuth.setState({ status: "loading" }); void restore(); }}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activation" element={<ActivationPage />} />
          <Route element={<RequireAuth />}>
            <Route
              element={
                <DataBoundary>
                  <AppLayout />
                </DataBoundary>
              }
            >
              <Route
                path="/"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route
                path="/societes"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SocietesListPage />
                  </Suspense>
                }
              />
              <Route
                path="/taches"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <TachesPage />
                  </Suspense>
                }
              />
              <Route element={<RequireEquipe />}>
                <Route path="/apurement" element={<Suspense fallback={<PageFallback />}><ApurementPage /></Suspense>} />
                <Route path="/apurement/:societeId" element={<Suspense fallback={<PageFallback />}><ApurementPage /></Suspense>} />
                <Route path="/apurement/:societeId/bcs/:bcId" element={<Suspense fallback={<PageFallback />}><ApurementPage /></Suspense>} />
                <Route path="/apurement/:societeId/factures/:factureId" element={<Suspense fallback={<PageFallback />}><ApurementPage /></Suspense>} />
                <Route path="/apurement/:societeId/imports" element={<Suspense fallback={<PageFallback />}><ApurementPage /></Suspense>} />
                <Route path="/apurement/:societeId/declarations/:declarationId" element={<Suspense fallback={<PageFallback />}><ApurementPage /></Suspense>} />
                <Route
                  path="/cours-change"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <CoursChangePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/stock"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <StockPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/stock/:societeId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <StockSocietePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/etats-financiers"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <EtatsFinanciersPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/etats-financiers/:societeId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <BalancesListPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/etats-financiers/:societeId/imprimer"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PrintClasseurPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/etats-financiers/:societeId/imprimer/:section"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <PrintClasseurPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/etats-financiers/:societeId/:balanceId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <BalanceEditorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/suivi-devise"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <SuiviDeviseSocietesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/suivi-devise/:societeId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <SuiviDeviseListPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/suivi-devise/:societeId/:suiviId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <SuiviDeviseEditorPage />
                    </Suspense>
                  }
                />
              </Route>
              <Route
                path="/collectes"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CollectesListPage />
                  </Suspense>
                }
              />
              <Route
                path="/collectes/:id"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <CollecteEditorPage />
                  </Suspense>
                }
              />
              <Route
                path="/structuration"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <StructurationPage />
                  </Suspense>
                }
              />
              <Route
                path="/messagerie"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <MessageriePage />
                  </Suspense>
                }
              />
              <Route
                path="/conversions"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <ConversionsPage />
                  </Suspense>
                }
              />
              <Route
                path="/simulation-paie"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SimulationPaiePage />
                  </Suspense>
                }
              />
              <Route
                path="/ma-souche"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <SoucheClientPage />
                  </Suspense>
                }
              />
              <Route
                path="/etat-swift"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <EtatSwiftListPage />
                  </Suspense>
                }
              />
              <Route
                path="/etat-swift/:societeId"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <EtatSwiftSocietePage />
                  </Suspense>
                }
              />
              <Route element={<RequireSuiviFournisseur />}>
                <Route
                  path="/fournisseurs"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <FournisseursPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/fournisseurs/:societeId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <FournisseursSocietePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/banque"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <BanquePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/banque/:societeId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <BanqueSocietePage />
                    </Suspense>
                  }
                />
              </Route>
              <Route element={<RequireEtatClient />}>
                <Route
                  path="/honoraires"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <HonorairesListPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/honoraires/:societeId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <HonorairesSocietePage />
                    </Suspense>
                  }
                />
              </Route>
              <Route element={<RequireAdmin />}>
                <Route
                  path="/souche-cheques"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <SoucheChequesListPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/souche-cheques/:societeId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <SoucheChequesSocietePage />
                    </Suspense>
                  }
                />
                <Route
                  path="/bordereaux"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <BordereauxPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/facturation"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <FacturationPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/parametres"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <ParametresPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/journal"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <JournalPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/grille-affectat"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <GrilleAffectatPage />
                    </Suspense>
                  }
                />
              </Route>
              <Route element={<RequireEquipeManager />}>
                <Route
                  path="/employes"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <EmployesListPage />
                    </Suspense>
                  }
                />
              </Route>
              <Route
                path="*"
                element={
                  <Suspense fallback={<PageFallback />}>
                    <NotFoundPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </TooltipProvider>
  );
}
