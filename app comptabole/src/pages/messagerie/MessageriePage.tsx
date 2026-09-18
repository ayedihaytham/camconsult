import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  FileText,
  X,
} from "lucide-react";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  avatarColor,
  cn,
  formatTime,
  formatDayLabel,
  formatRelative,
  initials,
  toTitleCase,
} from "@/lib/utils";
import {
  useData,
  useEmployes,
  useNoeuds,
  useSocietes,
  useConversations,
} from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/store/auth";
import { employeNomComplet } from "@/data/employes";
import { GroupeFormDialog } from "./GroupeFormDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Users2, Pencil, Trash2, Plus } from "lucide-react";
import type { Conversation } from "@/types";

export function MessageriePage() {
  const { isAdmin, can, canSeeSociete, employeId } = usePermissions();
  const adminName = toTitleCase(useAuth((s) => s.session?.cabinetNom ?? "Cabinet"));
  const adminLastSeen = useAuth((s) => s.session?.cabinetDerniereConnexion);
  const viewerAuthor = isAdmin ? "me" : (employeId ?? "me");
  const hasAccess = isAdmin || can("messagerie");

  const employes = useEmployes();
  const societes = useSocietes();
  const allNoeuds = useNoeuds();
  const noeuds = allNoeuds.filter((n) => canSeeSociete(n.societeId));
  const messages = useData((s) => s.messages);
  const addMessage = useData((s) => s.addMessage);
  const markConversationRead = useData((s) => s.markConversationRead);
  const addGroupConversation = useData((s) => s.addGroupConversation);
  const updateGroupConversation = useData((s) => s.updateGroupConversation);
  const deleteGroupConversation = useData((s) => s.deleteGroupConversation);
  const allConversations = useConversations(viewerAuthor);
  const conversations = isAdmin
    ? allConversations
    : allConversations.filter(
        (c) => c.type === "groupe" || c.employeId === employeId,
      );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<{
    noeudId: string;
    libelle: string;
  } | null>(null);
  const [groupeFormOpen, setGroupeFormOpen] = useState(false);
  const [groupeEditing, setGroupeEditing] = useState<Conversation | null>(null);
  const [groupeToDelete, setGroupeToDelete] = useState<Conversation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const empById = (id: string) => employes.find((e) => e.id === id) ?? null;
  const socById = (id: string | null) =>
    societes.find((s) => s.id === id) ?? null;

  type Emp = ReturnType<typeof empById>;
  const partnerLabel = (c: Conversation, emp: Emp) =>
    c.type === "groupe"
      ? toTitleCase(c.titre ?? "Groupe")
      : isAdmin
        ? (emp ? employeNomComplet(emp) : "—")
        : adminName;
  const partnerInitials = (c: Conversation, emp: Emp) =>
    c.type === "groupe"
      ? "GR"
      : isAdmin
        ? emp
          ? emp.prenom[0] + emp.nom[0]
          : "?"
        : initials(adminName) || "CB";

  /** Nom de l'expéditeur d'un message dans un groupe — indispensable pour
   * s'y retrouver dès qu'il y a plus de deux interlocuteurs. */
  const senderName = (auteurId: string) => {
    if (auteurId === "me") return adminName;
    const emp = empById(auteurId);
    return emp ? employeNomComplet(emp) : "—";
  };

  // Sélectionne la première conversation par défaut
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
    if (activeId && !conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0]?.id ?? null);
    }
  }, [conversations, activeId]);

  const filteredConvs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => {
        const emp = c.employeId ? empById(c.employeId) : null;
        const soc = socById(c.societeId);
        return (
          !q ||
          [
            c.titre ?? "",
            emp ? employeNomComplet(emp) : "",
            soc?.raisonSociale ?? "",
            c.dernierMessage,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) => b.dernierMessageLe.localeCompare(a.dernierMessageLe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, search]);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const isGroup = activeConv?.type === "groupe";
  const activeEmp =
    activeConv && activeConv.employeId ? empById(activeConv.employeId) : null;
  const activeSoc = activeConv ? socById(activeConv.societeId) : null;

  const threadMessages = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === activeId)
        .sort((a, b) => a.envoyeLe.localeCompare(b.envoyeLe)),
    [messages, activeId],
  );

  useEffect(() => {
    if (activeId) markConversationRead(activeId, viewerAuthor);
  }, [activeId, markConversationRead, viewerAuthor]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [threadMessages.length, activeId]);

  function send() {
    if ((!draft.trim() && !attachment) || !activeId) return;
    addMessage({
      conversationId: activeId,
      auteurId: viewerAuthor,
      contenu: draft.trim(),
      envoyeLe: new Date().toISOString(),
      statut: "envoye",
      pieceJointe: attachment ?? undefined,
    });
    setDraft("");
    setAttachment(null);
  }

  function submitGroupe(values: { titre: string; membreIds: string[] }) {
    if (groupeEditing) {
      updateGroupConversation(groupeEditing.id, values);
    } else {
      addGroupConversation(values).then((g) => setActiveId(g.id));
    }
    setGroupeEditing(null);
  }

  const fichiers = noeuds.filter((n) => n.type === "fichier");

  if (!hasAccess) {
    return (
      <div>
        <LedgerPageHeader title="Messagerie" />
        <div className="rounded-sm border border-border bg-card">
          <EmptyState
            icon={MessageSquare}
            title="Accès non autorisé"
            description="Vous n'avez pas l'autorisation d'accéder à la messagerie."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[32rem] flex-col">
      <LedgerPageHeader
        title="Messagerie"
        description={
          isAdmin
            ? "Échanges avec les collaborateurs, liés aux dossiers clients."
            : "Échange avec le responsable du cabinet."
        }
        className="mb-3"
      />

      {conversations.length === 0 && !isAdmin ? (
        <div className="flex flex-1 items-center justify-center rounded-sm border border-border bg-card">
          <EmptyState
            icon={MessageSquare}
            title="Aucune conversation"
            description="Aucun échange pour le moment."
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-sm border border-border bg-card md:grid-cols-[320px_1fr]">
          {/* Liste des conversations */}
          <div
            className={cn(
              "min-h-0 flex-col border-r border-border md:flex",
              mobileView === "chat" ? "hidden" : "flex",
            )}
          >
            <div className="space-y-2 border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une conversation…"
                  className="pl-8"
                />
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setGroupeEditing(null);
                    setGroupeFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Nouveau groupe
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredConvs.length === 0 && (
                <EmptyState
                  icon={MessageSquare}
                  title="Aucune conversation"
                  description={
                    isAdmin
                      ? "Ajoutez des employés ou créez un groupe."
                      : "Aucune conversation pour le moment."
                  }
                />
              )}
              {filteredConvs.map((c) => {
                const emp = c.employeId ? empById(c.employeId) : null;
                const soc = socById(c.societeId);
                const active = c.id === activeId;
                const colorClass = c.type === "groupe" ? "bg-accent/12 text-accent" : avatarColor(c.employeId ?? c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveId(c.id);
                      setMobileView("chat");
                    }}
                    className={cn(
                      "relative flex w-full gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors duration-150 hover:bg-secondary/50",
                      active && "bg-accent/[0.06]",
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden="true" />
                    )}
                    {/* Cercle = personne, carré arrondi = groupe (silhouette,
                        pas seulement le libellé) — voir DESIGN-SYSTEM.md §5.
                        Couleur stable par personne (avatarColor) pour repérer
                        un interlocuteur d'un coup d'œil, façon Slack/Teams. */}
                    <span className="relative shrink-0">
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center text-xs font-bold",
                          c.type === "groupe" ? "rounded-[11px]" : "rounded-full",
                          colorClass,
                        )}
                      >
                        {c.type === "groupe" ? (
                          <Users2 className="h-5 w-5" />
                        ) : (
                          partnerInitials(c, emp)
                        )}
                      </span>
                      {c.type !== "groupe" && c.enLigne !== undefined && (
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                            c.enLigne ? "bg-success" : "bg-muted-foreground/40",
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm text-foreground", c.nonLus > 0 ? "font-bold" : "font-medium")}>
                          {partnerLabel(c, emp)}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatTime(c.dernierMessageLe)}
                        </span>
                      </div>
                      {c.type === "groupe" ? (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {c.membreIds?.length ?? 0} membre
                          {(c.membreIds?.length ?? 0) > 1 ? "s" : ""}
                        </span>
                      ) : (
                        soc && (
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {soc.raisonSociale}
                          </span>
                        )
                      )}
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={cn("truncate text-xs", c.nonLus > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {c.dernierMessage}
                        </span>
                        {c.nonLus > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground">
                            {c.nonLus}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fenêtre de discussion */}
          {activeConv && (isGroup || activeEmp) ? (
            <div
              className={cn(
                "min-h-0 flex-col md:flex",
                mobileView === "list" ? "hidden" : "flex",
              )}
            >
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button
                  onClick={() => setMobileView("list")}
                  className="-ml-1 rounded-md p-1 text-muted-foreground hover:bg-secondary md:hidden"
                  aria-label="Retour aux conversations"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="relative shrink-0">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center text-xs font-bold",
                      isGroup ? "rounded-[10px]" : "rounded-full",
                      isGroup ? "bg-accent/12 text-accent" : avatarColor(activeConv.employeId ?? activeConv.id),
                    )}
                  >
                    {isGroup ? (
                      <Users2 className="h-4 w-4" />
                    ) : (
                      partnerInitials(activeConv, activeEmp)
                    )}
                  </span>
                  {!isGroup && activeConv.enLigne !== undefined && (
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                        activeConv.enLigne ? "bg-success" : "bg-muted-foreground/40",
                      )}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {partnerLabel(activeConv, activeEmp)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {isGroup ? (
                      <>
                        {activeConv.membreIds?.length ?? 0} membre
                        {(activeConv.membreIds?.length ?? 0) > 1 ? "s" : ""}
                        {" · "}
                        {(activeConv.membreIds ?? [])
                          .map((id) => empById(id)?.prenom)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(", ")}
                        {(activeConv.membreIds?.length ?? 0) > 3 ? "…" : ""}
                      </>
                    ) : isAdmin ? (
                      <>
                        {activeEmp?.type}
                        {activeConv.enLigne ? (
                          <span className="inline-flex items-center gap-1">
                            {" · "}
                            <span className="h-[6px] w-[6px] rounded-[2px] bg-success" />
                            En ligne
                          </span>
                        ) : (
                          <span>
                            {" "}
                            · Vu {formatRelative(activeConv.derniereConnexion)}
                          </span>
                        )}
                        {activeSoc && <span> · {activeSoc.raisonSociale}</span>}
                      </>
                    ) : (
                      <>
                        Responsable du cabinet · Vu{" "}
                        {formatRelative(adminLastSeen)}
                      </>
                    )}
                  </p>
                </div>

                {isAdmin && isGroup && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        setGroupeEditing(activeConv);
                        setGroupeFormOpen(true);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Modifier le groupe"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setGroupeToDelete(activeConv)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Supprimer le groupe"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-muted/20 px-4 py-4"
              >
                {threadMessages.length === 0 && (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState
                      icon={Send}
                      title="Aucun message"
                      description="Écrivez le premier ci-dessous."
                    />
                  </div>
                )}
                {threadMessages.map((m, i) => {
                  const mine = m.auteurId === viewerAuthor;
                  const prev = threadMessages[i - 1];
                  const showDay =
                    !prev ||
                    new Date(prev.envoyeLe).toDateString() !==
                      new Date(m.envoyeLe).toDateString();
                  const showSender =
                    isGroup &&
                    !mine &&
                    (showDay || !prev || prev.auteurId !== m.auteurId);
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-sm border border-border bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                            {formatDayLabel(m.envoyeLe)}
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex flex-col",
                          mine ? "items-end" : "items-start",
                          showSender ? "mt-2.5" : "mt-0.5",
                        )}
                      >
                        {showSender && (
                          <span className="mb-0.5 px-1 text-[11px] font-bold text-primary">
                            {senderName(m.auteurId)}
                          </span>
                        )}
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                            mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md border border-border bg-card text-foreground",
                          )}
                        >
                          {m.contenu && (
                            <p className="whitespace-pre-wrap">{m.contenu}</p>
                          )}
                          {m.pieceJointe && (
                            <div
                              className={cn(
                                "mt-1.5 flex items-center gap-2 rounded-[5px] border px-2.5 py-1.5",
                                mine
                                  ? "border-white/20 bg-white/10"
                                  : "border-border bg-secondary/60",
                              )}
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate text-xs font-medium">
                                {m.pieceJointe.libelle}
                              </span>
                            </div>
                          )}
                          <div
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1 text-[10px]",
                              mine
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatTime(m.envoyeLe)}
                            {mine &&
                              (m.statut === "lu" ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Saisie */}
              <div className="border-t border-border p-3">
                {attachment && (
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-secondary/60 px-2.5 py-1.5 text-xs">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">
                      {attachment.libelle}
                    </span>
                    <button
                      onClick={() => setAttachment(null)}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      aria-label="Retirer la pièce jointe"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-1.5 pl-2 shadow-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 rounded-xl text-muted-foreground"
                        aria-label="Joindre un document"
                        title={
                          fichiers.length === 0
                            ? "Aucun document dans la structuration à joindre — déposez-en d'abord depuis Structuration"
                            : "Joindre un document"
                        }
                        disabled={fichiers.length === 0}
                      >
                        <Paperclip />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      side="top"
                      className="max-h-72 w-72 overflow-y-auto"
                    >
                      <DropdownMenuLabel>
                        Joindre un document de la structuration
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {fichiers.map((f) => (
                        <DropdownMenuItem
                          key={f.id}
                          onClick={() =>
                            setAttachment({
                              noeudId: f.id,
                              libelle: f.libelle,
                            })
                          }
                        >
                          <FileText className="h-4 w-4" />
                          <span className="truncate">{f.libelle}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Écrivez un message… (Entrée pour envoyer)"
                    className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:ring-0"
                    rows={1}
                  />

                  <Button
                    variant="ledger"
                    size="icon"
                    className="shrink-0 rounded-xl"
                    onClick={send}
                    disabled={!draft.trim() && !attachment}
                    aria-label="Envoyer"
                  >
                    <Send />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden items-center justify-center text-sm text-muted-foreground md:flex">
              Sélectionnez une conversation
            </div>
          )}
        </div>
      )}

      <GroupeFormDialog
        open={groupeFormOpen}
        onOpenChange={(o) => {
          setGroupeFormOpen(o);
          if (!o) setGroupeEditing(null);
        }}
        groupe={groupeEditing}
        employes={employes}
        onSubmit={submitGroupe}
      />

      <ConfirmDialog
        open={Boolean(groupeToDelete)}
        onOpenChange={(o) => !o && setGroupeToDelete(null)}
        title="Supprimer ce groupe ?"
        description={
          <>
            Le groupe{" "}
            <span className="font-medium text-foreground">
              {groupeToDelete?.titre}
            </span>{" "}
            et tous ses messages seront définitivement supprimés.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (groupeToDelete) {
            deleteGroupConversation(groupeToDelete.id);
            if (activeId === groupeToDelete.id) setActiveId(null);
          }
          setGroupeToDelete(null);
        }}
      />
    </div>
  );
}
