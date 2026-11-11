import { type ComponentProps, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useConversations, useData, useNotifications, useTaches } from "@/store/data";
import { useAuth } from "@/store/auth";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { useSocieteActiveStore } from "@/store/societeActive";
import { ChevronLeft } from "lucide-react";
import { useCollectes } from "@/store/collectes";
import { toTitleCase } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useNavigationGroups } from "./useNavigationGroups";
import { SidebarNavigation } from "./SidebarNavigation";
import { unreadMessageCount } from "./navigation";

/** Bloc utilisateur du pied du menu (maquette) : initiales, nom et fonction du compte connecté. */
function SidebarUtilisateur() {
  const { session } = useAuth();
  const nom = toTitleCase(session?.nom ?? "Utilisateur");
  const fonction = session?.fonction ?? "";
  const initiales = nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase()).join("") || "?";
  return (
    <SidebarFooter className="signature-sidebar__footer shrink-0 gap-0 p-2">
      <div className="signature-sidebar__user flex items-center gap-2.5 rounded-[10px] bg-[rgba(254,244,232,.05)] p-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[11px] font-bold text-sidebar-deep" aria-hidden="true">{initiales}</span>
        <div className="min-w-0 text-[12.5px] font-semibold leading-4 text-[#FEF4E8] group-data-[collapsible=icon]:hidden">
          <p className="truncate">{nom}</p>
          {fonction && <small className="block truncate text-[11px] font-medium text-[#9FB4C8]">{fonction}</small>}
        </div>
      </div>
    </SidebarFooter>
  );
}

/** Dossier client ouvert (maquette) : retour au cabinet, puis le nom du dossier au-dessus des pages retargetées sur ce dossier. */
function SidebarDossier() {
  const societe = useSocieteActive();
  const choisir = useSocieteActiveStore((s) => s.setSocieteId);
  if (!societe) return null;
  const initiales = societe.raisonSociale.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0]?.toUpperCase()).join("");
  return (
    <div className="signature-sidebar__dossier shrink-0 px-3 pb-1 pt-2 group-data-[collapsible=icon]:hidden">
      <button type="button" onClick={() => choisir(null)} className="mb-2 inline-flex items-center gap-1.5 rounded-[7px] px-2 py-1 text-[12px] font-semibold text-[#9FB4C8] transition-colors hover:bg-[rgba(254,244,232,.07)] hover:text-[#FEF4E8]">
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Retour au cabinet
      </button>
      <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(201,169,106,.4)] bg-[rgba(254,244,232,.05)] p-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-[11px] font-bold text-sidebar-deep" aria-hidden="true">{initiales}</span>
        <div className="min-w-0 text-[13px] font-bold leading-4 text-[#FEF4E8]">
          <p className="truncate">{societe.raisonSociale}</p>
          <small className="block truncate text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#9FB4C8]">Dossier client · exercice {new Date().getFullYear()}</small>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { isAdmin, employeId, poste } = usePermissions();
  const { pathname } = useLocation();
  const markNotificationsRead = useData((s) => s.markNotificationsRead);
  const conversations = useConversations(
    isAdmin ? "me" : (employeId ?? "me"),
  );
  const unreadNotifications = useNotifications().filter(
    (notification) => !notification.lu,
  );
  const groups = useNavigationGroups();
  const taches = useTaches();
  const collectes = useCollectes((state) => state.list);
  const fetchCollectes = useCollectes((state) => state.fetchList);
  const equipe = poste !== "societe_employe";
  useEffect(() => {
    if (equipe) void fetchCollectes().catch(() => undefined);
  }, [equipe, fetchCollectes]);
  const compteurs = {
    taches: taches.filter((t) => t.statut !== "termine").length,
    collectes: collectes.filter((c) => c.statut === "transmis").length,
  };
  const unreadMessages = unreadMessageCount(
    conversations,
    isAdmin,
    employeId,
  );

  // La pastille rouge du menu (et le badge de la cloche) ne se dissipait
  // qu'en cliquant explicitement une notification ou « Tout marquer lu » —
  // jamais en visitant simplement la page concernée, même après y avoir
  // tout lu (ex. une conversation entièrement lue dans Messagerie). On
  // marque ici comme lue toute notification dont le lien correspond à la
  // page actuellement affichée — même correspondance que `hasPendingNotification`
  // (préfixe de chemin), dans l'autre sens.
  useEffect(() => {
    const toMark = unreadNotifications
      .filter(
        (n) => n.lien === pathname || pathname.startsWith(`${n.lien}/`),
      )
      .map((n) => n.id);
    if (toMark.length > 0) markNotificationsRead(toMark);
    // unreadNotifications volontairement absent des deps : ce tableau est
    // recréé à chaque rendu (.filter()), le réintégrer ferait tourner cet
    // effet en boucle sans navigation réelle. Ne réagir qu'aux changements
    // de page est le comportement voulu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, markNotificationsRead]);

  return (
    <Sidebar collapsible="icon" className="signature-sidebar border-r-0" {...props}>
      <SidebarHeader className="signature-sidebar__brand-cap h-16 shrink-0 gap-0 p-0">
        <SidebarMenu className="h-full gap-0 p-2">
          <SidebarMenuItem className="h-full">
            <SidebarMenuButton
              size="lg"
              tooltip="Cabinet Ayadi Mohamed"
              className="h-12 w-full gap-2.5 rounded-md px-3 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:!p-0"
              aria-label="Cabinet Ayadi Mohamed"
            >
              {/* Menu ouvert : logo officiel complet ; menu réduit : symbole seul. */}
              <img
                src="/brand/logo-cabinet-white.png"
                alt="Cabinet Ayadi Mohamed — Accounting & Consulting"
                width={1500}
                height={382}
                className="h-9 w-auto max-w-full group-data-[collapsible=icon]:hidden"
              />
              <img
                src="/brand/logo-mark-cabinet-white.png"
                alt="Cabinet Ayadi Mohamed"
                width={256}
                height={256}
                className="hidden size-8 shrink-0 object-contain group-data-[collapsible=icon]:block"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarDossier />

      <SidebarContent className="signature-sidebar__content">
        <SidebarNavigation
          groups={groups}
          unreadMessages={unreadMessages}
          unreadNotifications={unreadNotifications}
          compteurs={compteurs}
        />
      </SidebarContent>

      <SidebarUtilisateur />

      <SidebarRail />
    </Sidebar>
  );
}
