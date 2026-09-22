import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireAdmin } from "@/components/auth/RequireAdmin";
import { RequireEquipe } from "@/components/auth/RequireEquipe";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { registerQuotaHandler } from "@/lib/safeStorage";
import { startLiveEvents } from "@/lib/liveEvents";

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
const BordereauxPage = lazy(() =>
  import("@/pages/bordereaux/BordereauxPage").then((m) => ({
    default: m.BordereauxPage,
  })),
);
const StockPage = lazy(() =>
  import("@/pages/stock/StockPage").then((m) => ({ default: m.StockPage })),
);
const StockSocietePage = lazy(() =>
  import("@/pages/stock/StockSocietePage").then((m) => ({
    default: m.StockSocietePage,
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
const EtatsFinanciersPage = lazy(() =>
  import("@/pages/etatsFinanciers/EtatsFinanciersPage").then((m) => ({
    default: m.EtatsFinanciersPage,
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

  useEffect(() => {
    clearLocal();
    hydrate().catch(() => {
      toast.error("Impossible de charger les données du cabinet.");
    });
    // Signal temps réel (messages/notifications) — voir src/lib/liveEvents.ts.
    // Le sondage 20s existant (Topbar) reste en filet de sécurité.
    const stopLiveEvents = startLiveEvents({
      onMessage: () => void refreshMessages(),
      onNotification: () => void refreshNotifications(),
    });
    // recharge quand on change de compte
    return stopLiveEvents;
  }, [
    session?.employeId,
    session?.role,
    hydrate,
    clearLocal,
    refreshMessages,
    refreshNotifications,
  ]);

  if (!hydrated) return <FullScreenLoader label="Chargement des données…" />;
  return <>{children}</>;
}

export default function App() {
  const status = useAuth((s) => s.status);
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    restore();
    registerQuotaHandler(() =>
      toast.error("Stockage local saturé", {
        description: "Videz le cache du navigateur si le problème persiste.",
      }),
    );
  }, [restore]);

  if (status === "loading") {
    return <FullScreenLoader label="Connexion…" />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
              <Route element={<RequireEquipe />}>
                <Route
                  path="/taches"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <TachesPage />
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
                  path="/etats-financiers/:societeId/:balanceId"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <BalanceEditorPage />
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
              <Route element={<RequireAdmin />}>
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
                <Route
                  path="/bordereaux"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <BordereauxPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/employes"
                  element={
                    <Suspense fallback={<PageFallback />}>
                      <EmployesListPage />
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
