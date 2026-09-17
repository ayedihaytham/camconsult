import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Boxes,
  Building2,
  Calculator,
  ClipboardList,
  FolderTree,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquare,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelative, toTitleCase } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/store/auth";
import { useData, useNotifications } from "@/store/data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Classes Tailwind écrites en toutes lettres (jamais construites par
 * interpolation) : le scanner JIT de Tailwind ne détecte que des chaînes
 * littérales présentes dans le code source. */
const ACCENTS = {
  1: { rule: "text-chart-1", badge: "bg-chart-1/10 text-chart-1" },
  2: { rule: "text-chart-2", badge: "bg-chart-2/10 text-chart-2" },
  3: { rule: "text-chart-3", badge: "bg-chart-3/10 text-chart-3" },
  4: { rule: "text-chart-4", badge: "bg-chart-4/10 text-chart-4" },
  5: { rule: "text-chart-5", badge: "bg-chart-5/10 text-chart-5" },
} as const;
type AccentKey = keyof typeof ACCENTS;

interface PageMeta {
  title: string;
  icon: LucideIcon;
  accent: AccentKey;
}

const PAGES: Record<string, PageMeta> = {
  "/": { title: "Tableau de bord", icon: LayoutDashboard, accent: 1 },
  "/societes": { title: "Sociétés", icon: Building2, accent: 2 },
  "/employes": { title: "Collaborateurs", icon: Users, accent: 2 },
  "/taches": { title: "Tâches", icon: ListChecks, accent: 4 },
  "/collectes": { title: "Collecte de pièces", icon: ClipboardList, accent: 3 },
  "/stock": { title: "Gestion de stock", icon: Boxes, accent: 4 },
  "/etats-financiers": { title: "États financiers", icon: Calculator, accent: 1 },
  "/grille-affectat": { title: "Grille de reclassement", icon: Calculator, accent: 1 },
  "/bordereaux": { title: "Bordereaux bancaires", icon: Landmark, accent: 2 },
  "/structuration": { title: "Structuration", icon: FolderTree, accent: 3 },
  "/messagerie": { title: "Messagerie", icon: MessageSquare, accent: 4 },
  "/journal": { title: "Journal d'activité", icon: ScrollText, accent: 5 },
  "/parametres": { title: "Paramètres", icon: Settings, accent: 5 },
};

const TODAY_LABEL = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

function pageMetaFor(pathname: string): PageMeta {
  if (PAGES[pathname]) return PAGES[pathname];
  const match = Object.keys(PAGES)
    .filter((p) => p !== "/" && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGES[match] : { title: "Cabinet", icon: LayoutDashboard, accent: 1 };
}

export function Topbar() {
  const { session, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { title, icon: PageIcon, accent } = pageMetaFor(pathname);

  const nom = toTitleCase(session?.nom ?? "Utilisateur");
  const role = session?.fonction ?? "";
  const isAdmin = session?.role === "admin";
  const initiales =
    nom
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "?";

  async function handleLogout() {
    await logout();
    toast.success("Déconnexion réussie");
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card no-print">
      <div className="flex h-[64px] items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger
          className="h-9 w-9 lg:hidden"
          aria-label="Ouvrir le menu"
        />

        <span
          className={cn(
            "hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:flex",
            ACCENTS[accent].badge,
          )}
        >
          <PageIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="truncate text-sm font-bold text-foreground lg:text-base">
            {title}
          </h2>
          <p className="hidden truncate text-xs capitalize text-muted-foreground lg:block">
            {TODAY_LABEL}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-2xl py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary sm:pr-2.5">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-accent">
                  <span className="text-xs font-bold tracking-wide">
                    {initiales}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium text-foreground">
                    {nom}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {isAdmin ? "Administrateur" : role}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate("/parametres")}>
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const refresh = useData((s) => s.refreshNotifications);
  const markRead = useData((s) => s.markNotificationsRead);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Poll en continu (même onglet en arrière-plan, où le navigateur ralentit
    // à ~1×/min) + rafraîchissement immédiat au retour sur l'onglet.
    const id = setInterval(refresh, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const unread = notifications.filter((n) => !n.lu).length;
  const recent = notifications.slice(0, 10);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              onClick={() => markRead()}
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              Tout marquer lu
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {recent.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune notification.
          </p>
        )}
        <div className="max-h-80 overflow-y-auto">
          {recent.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                markRead([n.id]);
                navigate(n.lien || "/taches");
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-secondary",
                !n.lu && "bg-accent/5",
              )}
            >
              <span className="flex w-full items-start gap-2">
                {!n.lu && (
                  <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-accent" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {n.titre}
                </span>
              </span>
              {n.corps && (
                <span className="pl-3.5 text-xs text-muted-foreground">
                  {n.corps}
                </span>
              )}
              <span className="pl-3.5 text-[11px] text-muted-foreground">
                {formatRelative(n.creeLe)}
              </span>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
