import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LedgerPageHeader } from "@/components/ledger/LedgerPageHeader";
import {
  Messenger,
  type MessengerActiveConversation,
  type MessengerAttachment,
  type MessengerAttachmentItem,
  type MessengerConversationItem,
  type MessengerMessageItem,
} from "@/components/uitripled/messenger-shadcnui";
import { employeNomComplet } from "@/data/employes";
import { usePermissions } from "@/hooks/usePermissions";
import { downloadDataUrl, fileExtension, formatFileSize, readFileAsDataUrl } from "@/lib/file";
import { contenuNoeud, contenuPieceJointe, noeudADuContenu } from "@/lib/contenus";
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
import type { Conversation, Message, Noeud } from "@/types";
import { ClasserPieceJointeDialog } from "./ClasserPieceJointeDialog";
import { GroupeFormDialog } from "./GroupeFormDialog";

/** Pièce jointe telle qu'affichée : le contenu n'est plus dans la liste des
 * messages, seulement l'indication qu'il est disponible. Les anciens
 * messages référençaient un document de la Structuration (`noeudId`) au lieu
 * de porter leur propre contenu : c'est alors ce document qui fait foi. */
function resolveAttachment(
  pieceJointe: Message["pieceJointe"],
  noeuds: Noeud[],
): MessengerAttachment | undefined {
  if (!pieceJointe) return undefined;
  const propre = Boolean(pieceJointe.dataUrl || pieceJointe.aContenu);
  if (propre || !pieceJointe.noeudId) return { ...pieceJointe, disponible: propre };
  const noeud = noeuds.find((n) => n.id === pieceJointe.noeudId);
  return { ...pieceJointe, disponible: noeudADuContenu(noeud) };
}

/** Contenu (data URL) de la pièce jointe d'un message, chargé à la demande. */
async function contenuDuMessage(message: Message | undefined, noeuds: Noeud[]) {
  const pj = message?.pieceJointe;
  if (!message || !pj) return undefined;
  if (pj.dataUrl || pj.aContenu) return contenuPieceJointe(message.id, pj);
  const noeud = pj.noeudId ? noeuds.find((n) => n.id === pj.noeudId) : undefined;
  return noeud ? contenuNoeud(noeud) : undefined;
}

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
  const fichiers = allNoeuds.filter(
    (noeud) => noeud.type === "fichier" && canSeeSociete(noeud.societeId),
  );
  const messages = useData((state) => state.messages);
  const addMessage = useData((state) => state.addMessage);
  const addNoeud = useData((state) => state.addNoeud);
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
  const [attachment, setAttachment] = useState<MessengerAttachment | null>(
    null,
  );
  const [groupeFormOpen, setGroupeFormOpen] = useState(false);
  const [groupeEditing, setGroupeEditing] = useState<Conversation | null>(null);
  const [groupeToDelete, setGroupeToDelete] = useState<Conversation | null>(
    null,
  );
  const [classifying, setClassifying] = useState<Message["pieceJointe"] | null>(
    null,
  );
  const [classifyingSocieteId, setClassifyingSocieteId] = useState<
    string | null
  >(null);
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
    // Pas de sélection automatique au chargement : on affiche la liste et on
    // laisse l'utilisateur choisir. On ne referme que si la conversation
    // active a disparu (groupe supprimé…).
    if (
      activeId &&
      !conversations.some((conversation) => conversation.id === activeId)
    ) {
      setActiveId(null);
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
    // Redéclenché aussi quand de nouveaux messages arrivent dans la
    // conversation déjà ouverte (signal temps réel) — sinon un message reçu
    // pendant que la conversation est déjà active n'était jamais marqué lu
    // (l'effet ne se relançait qu'au changement de conversation), même si
    // l'utilisateur le voyait et y répondait aussitôt.
    if (activeId) markConversationRead(activeId, viewerAuthor);
  }, [activeId, threadMessages.length, markConversationRead, viewerAuthor]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [threadMessages.length, activeId]);

  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

  async function handleFileSelected(file: File) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(
        `Fichier trop volumineux (${formatFileSize(file.size)}) — 8 Mo maximum.`,
      );
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachment({
        libelle: file.name,
        dataUrl,
        mime: file.type,
        tailleOctets: file.size,
      });
    } catch {
      toast.error("Impossible de lire ce fichier.");
    }
  }

  async function handleSelectAttachment(item: MessengerAttachmentItem) {
    const noeud = fichiers.find((f) => f.id === item.id);
    // Le message emporte sa propre copie du document : on charge son
    // contenu maintenant (il n'est plus dans la liste de la Structuration).
    let dataUrl: string | undefined;
    try {
      dataUrl = noeud ? await contenuNoeud(noeud) : undefined;
    } catch {
      dataUrl = undefined;
    }
    setAttachment({
      libelle: item.label,
      noeudId: item.id,
      dataUrl,
      mime: undefined,
      tailleOctets: undefined,
    });
    if (!dataUrl) {
      toast.warning(
        "Ce document dépasse 2 Mo dans la Structuration : joint en référence seule, non téléchargeable depuis la messagerie.",
      );
    }
  }

  async function handleDownloadAttachment(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    try {
      const dataUrl = await contenuDuMessage(message, allNoeuds);
      if (dataUrl && message?.pieceJointe) downloadDataUrl(dataUrl, message.pieceJointe.libelle);
    } catch {
      toast.error("Téléchargement impossible");
    }
  }

  async function handleClassifyAttachment(messageId: string) {
    const message = messages.find((m) => m.id === messageId);
    const resolved = resolveAttachment(message?.pieceJointe, allNoeuds);
    if (!resolved) return;
    let dataUrl: string | undefined;
    try {
      dataUrl = await contenuDuMessage(message, allNoeuds);
    } catch {
      dataUrl = undefined;
    }
    if (!dataUrl) {
      toast.error("Contenu de la pièce jointe indisponible");
      return;
    }
    setClassifying({ ...resolved, dataUrl });
    // Le document appartient forcément à la société de la conversation
    // ouverte (client) — on restreint le choix de dossier à son espace.
    setClassifyingSocieteId(activeConversation?.societeId ?? null);
  }

  async function handleConfirmClasser(targetParentId: string | null) {
    if (!classifying?.dataUrl) return;
    const parentNoeud = targetParentId
      ? allNoeuds.find((n) => n.id === targetParentId)
      : null;
    try {
      await addNoeud({
        libelle: classifying.libelle,
        description: "",
        type: "fichier",
        societeId: parentNoeud?.societeId ?? classifyingSocieteId ?? null,
        parentId: targetParentId,
        format: fileExtension(classifying.libelle),
        taille: classifying.tailleOctets
          ? formatFileSize(classifying.tailleOctets)
          : undefined,
        dataUrl: classifying.dataUrl,
      });
      toast.success("Classé dans la Structuration", {
        description: classifying.libelle,
      });
      setClassifying(null);
      setClassifyingSocieteId(null);
    } catch {
      toast.error("Impossible de classer ce fichier.");
    }
  }

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
        attachment: resolveAttachment(message.pieceJointe, allNoeuds),
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
        canClassifyAttachments={isAdmin}
        onClassifyAttachment={(id) => void handleClassifyAttachment(id)}
        onDownloadAttachment={(id) => void handleDownloadAttachment(id)}
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
        onFileSelected={handleFileSelected}
        onSelectAttachment={(item) => void handleSelectAttachment(item)}
        onRemoveAttachment={() => setAttachment(null)}
        onSend={send}
      />

      <ClasserPieceJointeDialog
        open={Boolean(classifying)}
        onOpenChange={(open) => {
          if (!open) {
            setClassifying(null);
            setClassifyingSocieteId(null);
          }
        }}
        attachmentLabel={classifying?.libelle ?? null}
        nodes={allNoeuds}
        restrictToSocieteId={classifyingSocieteId}
        restrictToSocieteLabel={socById(classifyingSocieteId)?.raisonSociale}
        onConfirm={handleConfirmClasser}
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
