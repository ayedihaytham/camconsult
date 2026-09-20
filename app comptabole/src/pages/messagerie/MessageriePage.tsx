import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import {
  Messenger,
  type MessengerActiveConversation,
  type MessengerConversationItem,
  type MessengerMessageItem,
} from "@/components/uitripled/messenger-shadcnui";
import { employeNomComplet } from "@/data/employes";
import { usePermissions } from "@/hooks/usePermissions";
import {
  avatarColor,
  formatDayLabel,
  formatRelative,
  formatTime,
  initials,
  toTitleCase,
} from "@/lib/utils";
import { useAuth } from "@/store/auth";
import {
  useConversations,
  useData,
  useEmployes,
  useNoeuds,
  useSocietes,
} from "@/store/data";
import type { Conversation } from "@/types";
import { GroupeFormDialog } from "./GroupeFormDialog";

export function MessageriePage() {
  const { isAdmin, can, canSeeSociete, employeId } = usePermissions();
  const adminName = toTitleCase(
    useAuth((state) => state.session?.cabinetNom ?? "Cabinet"),
  );
  const adminLastSeen = useAuth(
    (state) => state.session?.cabinetDerniereConnexion,
  );
  const viewerAuthor = isAdmin ? "me" : (employeId ?? "me");
  const hasAccess = isAdmin || can("messagerie");

  const employes = useEmployes();
  const societes = useSocietes();
  const allNoeuds = useNoeuds();
  const noeuds = allNoeuds.filter((noeud) => canSeeSociete(noeud.societeId));
  const messages = useData((state) => state.messages);
  const addMessage = useData((state) => state.addMessage);
  const markConversationRead = useData(
    (state) => state.markConversationRead,
  );
  const addGroupConversation = useData(
    (state) => state.addGroupConversation,
  );
  const updateGroupConversation = useData(
    (state) => state.updateGroupConversation,
  );
  const deleteGroupConversation = useData(
    (state) => state.deleteGroupConversation,
  );
  const allConversations = useConversations(viewerAuthor);
  const conversations = isAdmin
    ? allConversations
    : allConversations.filter(
        (conversation) =>
          conversation.type === "groupe" ||
          conversation.employeId === employeId,
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
  const [groupeToDelete, setGroupeToDelete] = useState<Conversation | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const empById = (id: string) =>
    employes.find((employe) => employe.id === id) ?? null;
  const socById = (id: string | null) =>
    societes.find((societe) => societe.id === id) ?? null;

  type Emp = ReturnType<typeof empById>;
  const partnerLabel = (conversation: Conversation, employee: Emp) =>
    conversation.type === "groupe"
      ? toTitleCase(conversation.titre ?? "Groupe")
      : isAdmin
        ? employee
          ? employeNomComplet(employee)
          : "—"
        : adminName;
  const partnerInitials = (conversation: Conversation, employee: Emp) =>
    conversation.type === "groupe"
      ? "GR"
      : isAdmin
        ? employee
          ? employee.prenom[0] + employee.nom[0]
          : "?"
        : initials(adminName) || "CB";

  const senderName = (authorId: string) => {
    if (authorId === "me") return adminName;
    const employee = empById(authorId);
    return employee ? employeNomComplet(employee) : "—";
  };

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
    if (
      activeId &&
      !conversations.some((conversation) => conversation.id === activeId)
    ) {
      setActiveId(conversations[0]?.id ?? null);
    }
  }, [conversations, activeId]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        const employee = conversation.employeId
          ? empById(conversation.employeId)
          : null;
        const societe = socById(conversation.societeId);
        return (
          !query ||
          [
            conversation.titre ?? "",
            employee ? employeNomComplet(employee) : "",
            societe?.raisonSociale ?? "",
            conversation.dernierMessage,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        );
      })
      .sort((left, right) =>
        right.dernierMessageLe.localeCompare(left.dernierMessageLe),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, search]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;
  const isGroup = activeConversation?.type === "groupe";
  const activeEmployee =
    activeConversation?.employeId
      ? empById(activeConversation.employeId)
      : null;
  const activeSociete = activeConversation
    ? socById(activeConversation.societeId)
    : null;

  const threadMessages = useMemo(
    () =>
      messages
        .filter((message) => message.conversationId === activeId)
        .sort((left, right) => left.envoyeLe.localeCompare(right.envoyeLe)),
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
      addGroupConversation(values).then((group) => setActiveId(group.id));
    }
    setGroupeEditing(null);
  }

  const fichiers = noeuds.filter((noeud) => noeud.type === "fichier");

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

  const conversationItems: MessengerConversationItem[] =
    filteredConversations.map((conversation) => {
      const employee = conversation.employeId
        ? empById(conversation.employeId)
        : null;
      const societe = socById(conversation.societeId);
      const isConversationGroup = conversation.type === "groupe";
      const memberCount = conversation.membreIds?.length ?? 0;
      const directContext = isAdmin
        ? [employee?.type, societe?.raisonSociale].filter(Boolean).join(" · ")
        : ["Responsable du cabinet", societe?.raisonSociale]
            .filter(Boolean)
            .join(" · ");

      return {
        id: conversation.id,
        name: partnerLabel(conversation, employee),
        secondary: isConversationGroup
          ? `${memberCount} membre${memberCount > 1 ? "s" : ""}`
          : directContext || "Conversation directe",
        lastMessage: conversation.dernierMessage,
        lastMessageTime: formatTime(conversation.dernierMessageLe),
        unread: conversation.nonLus,
        initials: partnerInitials(conversation, employee),
        isGroup: isConversationGroup,
        isOnline: isConversationGroup ? undefined : conversation.enLigne,
        avatarClassName: isConversationGroup
          ? "bg-accent/15 text-accent-foreground"
          : avatarColor(conversation.employeId ?? conversation.id),
      };
    });

  let activeConversationItem: MessengerActiveConversation | null = null;
  if (activeConversation && (isGroup || activeEmployee)) {
    const memberCount = activeConversation.membreIds?.length ?? 0;
    const memberNames = (activeConversation.membreIds ?? [])
      .map((id) => empById(id)?.prenom)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const groupSubtitle = [
      `${memberCount} membre${memberCount > 1 ? "s" : ""}`,
      memberNames
        ? `${memberNames}${memberCount > 3 ? "…" : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const directSubtitle = isAdmin
      ? [
          activeEmployee?.type,
          activeConversation.enLigne
            ? "En ligne"
            : `Vu ${formatRelative(activeConversation.derniereConnexion)}`,
          activeSociete?.raisonSociale,
        ]
          .filter(Boolean)
          .join(" · ")
      : `Responsable du cabinet · Vu ${formatRelative(adminLastSeen)}`;

    activeConversationItem = {
      id: activeConversation.id,
      name: partnerLabel(activeConversation, activeEmployee),
      subtitle: isGroup ? groupSubtitle : directSubtitle,
      initials: partnerInitials(activeConversation, activeEmployee),
      isGroup: Boolean(isGroup),
      isOnline: isGroup ? undefined : activeConversation.enLigne,
      avatarClassName: isGroup
        ? "bg-accent/15 text-accent-foreground"
        : avatarColor(activeConversation.employeId ?? activeConversation.id),
      canManageGroup: Boolean(isAdmin && isGroup),
    };
  }

  const messageItems: MessengerMessageItem[] = threadMessages.map(
    (message, index) => {
      const previous = threadMessages[index - 1];
      const showDate =
        !previous ||
        new Date(previous.envoyeLe).toDateString() !==
          new Date(message.envoyeLe).toDateString();
      const isMine = message.auteurId === viewerAuthor;
      const showAuthor = Boolean(
        isGroup &&
          !isMine &&
          (showDate || !previous || previous.auteurId !== message.auteurId),
      );

      return {
        id: message.id,
        author: senderName(message.auteurId),
        text: message.contenu,
        timestamp: formatTime(message.envoyeLe),
        dateLabel: formatDayLabel(message.envoyeLe),
        showDate,
        showAuthor,
        isMine,
        isRead: message.statut === "lu",
        attachment: message.pieceJointe,
      };
    },
  );

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[28rem] min-w-0 flex-col sm:h-[calc(100dvh-6rem)]">
      <LedgerPageHeader
        title="Messagerie"
        description={
          isAdmin
            ? "Échanges avec les collaborateurs, liés aux dossiers clients."
            : "Échange avec le responsable du cabinet."
        }
        className="mb-0"
      />

      <Messenger
        conversations={conversationItems}
        selectedConversationId={activeId}
        activeConversation={activeConversationItem}
        messages={messageItems}
        mobileView={mobileView}
        search={search}
        draft={draft}
        attachment={attachment}
        attachmentItems={fichiers.map((file) => ({
          id: file.id,
          label: file.libelle,
        }))}
        canCreateGroup={isAdmin}
        emptyConversationDescription={
          isAdmin
            ? "Ajoutez des employés ou créez un groupe."
            : "Aucun échange pour le moment."
        }
        messagesContainerRef={scrollRef}
        onSearchChange={setSearch}
        onSelectConversation={(id) => {
          setActiveId(id);
          setMobileView("chat");
        }}
        onBack={() => setMobileView("list")}
        onCreateGroup={() => {
          setGroupeEditing(null);
          setGroupeFormOpen(true);
        }}
        onEditGroup={() => {
          if (!activeConversation) return;
          setGroupeEditing(activeConversation);
          setGroupeFormOpen(true);
        }}
        onDeleteGroup={() => {
          if (activeConversation) setGroupeToDelete(activeConversation);
        }}
        onDraftChange={setDraft}
        onSelectAttachment={setAttachment}
        onRemoveAttachment={() => setAttachment(null)}
        onSend={send}
      />

      <GroupeFormDialog
        open={groupeFormOpen}
        onOpenChange={(open) => {
          setGroupeFormOpen(open);
          if (!open) setGroupeEditing(null);
        }}
        groupe={groupeEditing}
        employes={employes}
        onSubmit={submitGroupe}
      />

      <ConfirmDialog
        open={Boolean(groupeToDelete)}
        onOpenChange={(open) => !open && setGroupeToDelete(null)}
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
