import type { FormEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  FileText,
  FolderInput,
  FolderOpen,
  MoreVertical,
  Paperclip,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  Users2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface MessengerAttachment {
  libelle: string;
  dataUrl?: string;
  mime?: string;
  tailleOctets?: number;
  noeudId?: string;
  /** Contenu téléchargeable côté serveur (chargé au clic, pas dans la liste). */
  disponible?: boolean;
}

const pieceDisponible = (a: MessengerAttachment) => Boolean(a.dataUrl || a.disponible);

export interface MessengerAttachmentItem {
  id: string;
  label: string;
}

export interface MessengerConversationItem {
  id: string;
  name: string;
  secondary: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  initials: string;
  isGroup: boolean;
  isOnline?: boolean;
  avatarClassName: string;
  /** Rubrique de la liste (la société) : les conversations sont rangées par rubrique quand il y en a plusieurs. */
  groupe?: string;
  /** Faux tant qu'aucun message n'a été échangé : la liste n'affiche alors ni heure ni dernier message. */
  hasMessages?: boolean;
}

type FiltreConversations = "toutes" | "non_lues" | "groupes" | "sans_echange";

const FILTRES: { value: FiltreConversations; label: string; garde: (c: MessengerConversationItem) => boolean }[] = [
  { value: "toutes", label: "Toutes", garde: () => true },
  { value: "non_lues", label: "Non lues", garde: (c) => c.unread > 0 },
  { value: "groupes", label: "Groupes", garde: (c) => c.isGroup },
  { value: "sans_echange", label: "Sans échange", garde: (c) => c.hasMessages === false },
];

export interface MessengerActiveConversation {
  id: string;
  name: string;
  subtitle: string;
  initials: string;
  isGroup: boolean;
  isOnline?: boolean;
  avatarClassName: string;
  canManageGroup: boolean;
}

export interface MessengerMessageItem {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  dateLabel: string;
  showDate: boolean;
  showAuthor: boolean;
  isMine: boolean;
  isRead: boolean;
  attachment?: MessengerAttachment;
}

interface MessengerProps {
  conversations: MessengerConversationItem[];
  selectedConversationId: string | null;
  activeConversation: MessengerActiveConversation | null;
  messages: MessengerMessageItem[];
  mobileView: "list" | "chat";
  search: string;
  draft: string;
  attachment: MessengerAttachment | null;
  attachmentItems: MessengerAttachmentItem[];
  /** Admin uniquement — propose "Classer dans la Structuration" sur les
   * messages reçus avec une pièce jointe. */
  canClassifyAttachments: boolean;
  onClassifyAttachment: (messageId: string) => void;
  /** Télécharge la pièce jointe d'un message (contenu chargé à la demande). */
  onDownloadAttachment: (messageId: string) => void;
  canCreateGroup: boolean;
  emptyConversationDescription: string;
  messagesContainerRef: RefObject<HTMLDivElement>;
  onSearchChange: (value: string) => void;
  onSelectConversation: (id: string) => void;
  onBack: () => void;
  onCreateGroup: () => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onDraftChange: (value: string) => void;
  onFileSelected: (file: File) => void;
  onSelectAttachment: (item: MessengerAttachmentItem) => void;
  onRemoveAttachment: () => void;
  onSend: () => void;
}

function ConversationAvatar({
  initials,
  isGroup,
  isOnline,
  size = "default",
}: Pick<
  MessengerConversationItem,
  "initials" | "isGroup" | "isOnline" | "avatarClassName"
> & { size?: "default" | "large" }) {
  const avatarSize = size === "large" ? "h-11 w-11" : "h-10 w-10";

  return (
    <span className="relative shrink-0">
      <Avatar className={cn(avatarSize, isGroup ? "rounded-md" : "rounded-full")}>
        <AvatarFallback
          className={cn(
            "bg-secondary text-xs font-semibold text-primary",
            isGroup ? "rounded-md" : "rounded-full",
          )}
        >
          {isGroup ? <Users2 className="h-4 w-4" aria-hidden="true" /> : initials}
        </AvatarFallback>
      </Avatar>
      {!isGroup && isOnline !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card",
            isOnline ? "bg-success" : "bg-muted-foreground/40",
          )}
          aria-label={isOnline ? "En ligne" : "Hors ligne"}
        />
      )}
    </span>
  );
}

export function Messenger({
  conversations,
  selectedConversationId,
  activeConversation,
  messages,
  mobileView,
  search,
  draft,
  attachment,
  attachmentItems,
  canClassifyAttachments,
  onClassifyAttachment,
  onDownloadAttachment,
  canCreateGroup,
  emptyConversationDescription,
  messagesContainerRef,
  onSearchChange,
  onSelectConversation,
  onBack,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
  onDraftChange,
  onFileSelected,
  onSelectAttachment,
  onRemoveAttachment,
  onSend,
}: MessengerProps) {
  const shouldReduceMotion = useReducedMotion();
  const [filtre, setFiltre] = useState<FiltreConversations>("toutes");
  const liveRegionRef = useRef<HTMLDivElement>(null);
  // Les filtres et les rubriques par société n'ont d'intérêt qu'avec assez de conversations.
  const avecFiltres = conversations.length > 3;
  const garde = FILTRES.find((f) => f.value === filtre)!.garde;
  const visibles = useMemo(() => (avecFiltres ? conversations.filter(garde) : conversations), [conversations, avecFiltres, garde]);
  const rubriques = useMemo(() => {
    const noms = [...new Set(visibles.map((c) => c.groupe).filter((g): g is string => Boolean(g)))];
    if (!avecFiltres || noms.length < 2) return [{ nom: null as string | null, items: visibles }];
    return noms
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
      .map((nom) => ({ nom: nom as string | null, items: visibles.filter((c) => c.groupe === nom) }));
  }, [visibles, avecFiltres]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!liveRegionRef.current || !lastMessage) return;
    liveRegionRef.current.textContent = `${lastMessage.author}, ${lastMessage.timestamp} : ${lastMessage.text}`;
  }, [messages]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <section className="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border border-border bg-card md:grid-cols-[minmax(18rem,22.5rem)_minmax(0,1fr)]">
      <aside data-tour="messages-list"
        className={cn(
          "min-h-0 flex-col border-border bg-card md:flex md:border-r",
          mobileView === "chat" ? "hidden" : "flex",
        )}
        aria-label="Conversations"
      >
        <div className={cn("space-y-3 p-4", avecFiltres ? "pb-0" : "border-b border-border")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-primary">Conversations</h2>
              <p className="text-xs text-muted-foreground">
                {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
              </p>
            </div>
            {canCreateGroup && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={onCreateGroup}
                aria-label="Nouveau groupe"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden min-[360px]:inline md:hidden lg:inline">Nouveau groupe</span>
              </Button>
            )}
          </div>

          <label htmlFor="messenger-search" className="sr-only">
            Rechercher une conversation
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="messenger-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Rechercher une conversation..."
              className="h-9 w-full bg-card pl-9"
            />
          </div>

          {avecFiltres && (
            <div className="-mx-4 flex overflow-x-auto border-b border-border px-4 [scrollbar-width:none]" role="group" aria-label="Filtrer les conversations">
              {FILTRES.map((f) => {
                const total = conversations.filter(f.garde).length;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filtre === f.value}
                    onClick={() => setFiltre(f.value)}
                    className={cn(
                      "-mb-px flex-1 shrink-0 whitespace-nowrap border-b-2 px-2 pb-2 pt-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      filtre === f.value ? "border-accent font-semibold text-primary" : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                    <span className={cn("ml-1 font-semibold tabular-nums", f.value === "non_lues" && total > 0 && "text-chart-2")}>{total}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibles.length === 0 ? (
            <div className="flex h-full min-h-40 items-center justify-center px-4 text-center">
              <div>
                <p className="text-sm font-medium text-foreground">Aucune conversation.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {conversations.length > 0 ? "Aucune conversation dans ce filtre." : emptyConversationDescription}
                </p>
              </div>
            </div>
          ) : (
            <ul aria-label="Liste des conversations">
              {rubriques.flatMap((rubrique) => [
                ...(rubrique.nom ? [<li key={`rubrique-${rubrique.nom}`} role="presentation" className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground"><span>{rubrique.nom}</span><span className="font-medium tracking-normal">· {rubrique.items.length}</span></li>] : []),
                ...rubrique.items,
              ]).map((entree) => {
                if (!("id" in entree)) return entree;
                const conversation = entree;
                const isActive = conversation.id === selectedConversationId;

                return (
                  <li key={conversation.id}>
                    <motion.button
                      type="button"
                      onClick={() => onSelectConversation(conversation.id)}
                      aria-current={isActive ? "true" : undefined}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                      className={cn(
                        "group relative flex w-full min-w-0 items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        isActive
                          ? "bg-accent/10 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent"
                          : "hover:bg-background",
                      )}
                    >
                      <ConversationAvatar {...conversation} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm",
                              conversation.unread > 0 ? "font-semibold text-primary" : "font-medium text-foreground",
                            )}
                          >
                            {conversation.name}
                          </span>
                          {conversation.hasMessages !== false && (
                            <span className={cn("shrink-0 text-[11px]", conversation.unread > 0 ? "font-semibold text-primary" : "text-muted-foreground")}>
                              {conversation.lastMessageTime}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {conversation.secondary}
                        </span>
                        <span className="mt-1 flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-xs",
                              conversation.unread > 0
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {conversation.hasMessages === false ? "Pas encore d'échange" : conversation.lastMessage}
                          </span>
                          {conversation.unread > 0 && (
                            <Badge
                              className="h-5 min-w-5 shrink-0 justify-center px-1.5 text-[11px]"
                              aria-label={`${conversation.unread} message${conversation.unread > 1 ? "s" : ""} non lu${conversation.unread > 1 ? "s" : ""}`}
                            >
                              {conversation.unread}
                            </Badge>
                          )}
                        </span>
                      </span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <AnimatePresence initial={false} mode="wait">
        {activeConversation ? (
          <motion.div
            key={activeConversation.id}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "min-h-0 min-w-0 flex-col bg-background md:flex",
              mobileView === "list" ? "hidden" : "flex",
            )}
            aria-label={`Conversation avec ${activeConversation.name}`}
          >
            <header className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-ml-1 shrink-0 md:hidden"
                onClick={onBack}
                aria-label="Retour aux conversations"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Button>

              <ConversationAvatar {...activeConversation} size="large" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                  {activeConversation.name}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {activeConversation.subtitle}
                </p>
              </div>

              {activeConversation.canManageGroup && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onEditGroup}
                    aria-label="Modifier le groupe"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDeleteGroup}
                    aria-label="Supprimer le groupe"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </header>

            <div data-tour="messages-thread"
              ref={messagesContainerRef}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5"
              aria-label={`Messages avec ${activeConversation.name}`}
              aria-live="off"
            >
              {messages.length === 0 ? (
                <div className="flex h-full min-h-40 items-center justify-center text-center">
                  <div>
                    <Send className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Aucun message pour le moment.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Écrivez le premier message ci-dessous.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={
                          shouldReduceMotion
                            ? false
                            : { opacity: 0, y: 8, scale: 0.99 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      >
                        {message.showDate && (
                          <div className="my-4 flex items-center gap-3" role="separator">
                            <span className="h-px flex-1 bg-border" />
                            <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                              {message.dateLabel}
                            </span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                        )}

                        <div
                          className={cn(
                            "flex flex-col",
                            message.isMine ? "items-end" : "items-start",
                            message.showAuthor ? "mt-2.5" : "mt-1",
                          )}
                          role="group"
                          aria-label={`${message.author}, ${message.timestamp}`}
                        >
                          {message.showAuthor && (
                            <span className="mb-1 px-1 text-[11px] font-semibold text-primary">
                              {message.author}
                            </span>
                          )}
                          <div
                            className={cn(
                              "max-w-[88%] rounded-lg border px-3 py-2 text-sm sm:max-w-[78%]",
                              message.isMine
                                ? "rounded-tr-sm border-primary bg-primary text-primary-foreground"
                                : "rounded-tl-sm border-border bg-card text-foreground",
                            )}
                          >
                            {message.text && (
                              <p className="whitespace-pre-wrap break-words leading-relaxed">
                                {message.text}
                              </p>
                            )}
                            {message.attachment && (
                              <div
                                className={cn(
                                  "mt-1.5 flex min-w-0 items-stretch gap-0.5 rounded-md border",
                                  message.isMine
                                    ? "border-white/20 bg-white/10"
                                    : "border-border bg-muted/60",
                                )}
                              >
                                <button
                                  type="button"
                                  disabled={!pieceDisponible(message.attachment)}
                                  onClick={() => onDownloadAttachment(message.id)}
                                  className={cn(
                                    "flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left transition-colors",
                                    pieceDisponible(message.attachment) && "cursor-pointer hover:brightness-95",
                                    !pieceDisponible(message.attachment) && "cursor-not-allowed opacity-70",
                                  )}
                                  title={
                                    pieceDisponible(message.attachment)
                                      ? "Télécharger la pièce jointe"
                                      : "Pièce jointe non disponible (fichier trop volumineux ou ancien message)"
                                  }
                                >
                                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span className="min-w-0 break-all text-xs font-medium underline-offset-2">
                                    {message.attachment.libelle}
                                  </span>
                                </button>
                                {canClassifyAttachments && pieceDisponible(message.attachment) && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className={cn(
                                          "flex shrink-0 items-center justify-center px-1.5 transition-colors",
                                          message.isMine
                                            ? "text-primary-foreground/70 hover:text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground",
                                        )}
                                        aria-label="Plus d'actions sur cette pièce jointe"
                                      >
                                        <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => onClassifyAttachment(message.id)}
                                      >
                                        <FolderInput className="h-4 w-4" aria-hidden="true" />
                                        Classer dans la Structuration
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            )}
                            <div
                              className={cn(
                                "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                message.isMine
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground",
                              )}
                            >
                              <span>{message.timestamp}</span>
                              {message.isMine &&
                                (message.isRead ? (
                                  <CheckCheck className="h-3 w-3" aria-label="Lu" />
                                ) : (
                                  <Check className="h-3 w-3" aria-label="Envoyé" />
                                ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <form data-tour="messages-composer"
              onSubmit={handleSubmit}
              className="border-t border-border bg-card p-3 pr-16 sm:p-4 sm:pr-16"
              aria-label="Écrire un message"
            >
              {attachment && (
                <div className="mb-2 flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/60 px-2.5 py-2 text-xs">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {attachment.libelle}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={onRemoveAttachment}
                    aria-label="Retirer la pièce jointe"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              )}

              <div className="flex min-w-0 items-end gap-1.5 rounded-md border border-input bg-card p-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-accent/35 sm:gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFileSelected(file);
                    event.target.value = "";
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-lg text-muted-foreground"
                      aria-label="Joindre un fichier"
                      title="Joindre un fichier"
                    >
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    side="top"
                    className="max-h-72 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto"
                  >
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Depuis mon appareil (PC, photo, téléphone)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={attachmentItems.length === 0}>
                        <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                        Depuis la Structuration
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto">
                        <DropdownMenuLabel>
                          Joindre un document de la structuration
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {attachmentItems.map((item) => (
                          <DropdownMenuItem
                            key={item.id}
                            onClick={() => onSelectAttachment(item)}
                          >
                            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>

                <label htmlFor="messenger-editor" className="sr-only">
                  Écrivez un message
                </label>
                <Textarea
                  id="messenger-editor"
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder="Écrivez un message..."
                  rows={1}
                  className="max-h-28 min-h-9 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0"
                />

                <Button
                  type="submit"
                  className="shrink-0 gap-1.5 rounded-md max-sm:w-9 max-sm:px-0"
                  disabled={!draft.trim() && !attachment}
                  aria-label="Envoyer"
                >
                  <span className="hidden sm:inline" aria-hidden="true">Envoyer</span>
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:block">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</p>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="empty-thread"
            initial={false}
            className="hidden min-h-0 items-center justify-center bg-background px-6 text-center md:flex"
          >
            <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-card text-left">
              <div className="flex items-start gap-3.5 px-5 py-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-accent" aria-hidden="true">
                  <MessageSquare className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-primary">
                    Choisissez une conversation
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ou démarrez un échange avec une personne de la liste.
                  </p>
                </div>
              </div>
              {conversations.length > 0 && (
                <div className="border-t border-border">
                  <p className="px-5 pb-1.5 pt-3 text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Démarrer un échange</p>
                  <ul>
                    {(conversations.some((c) => c.hasMessages === false) ? conversations.filter((c) => c.hasMessages === false) : conversations).slice(0, 2).map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          aria-label={`Écrire à ${c.name}`}
                          onClick={() => onSelectConversation(c.id)}
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border px-5 py-2.5 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <ConversationAvatar initials={c.initials} isGroup={c.isGroup} avatarClassName={c.avatarClassName} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{c.secondary}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary" aria-hidden="true">
                            Écrire <Send className="h-4 w-4" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={liveRegionRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />
    </section>
  );
}
