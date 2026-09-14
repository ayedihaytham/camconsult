import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Maximize2,
  MessageSquare,
  Search,
  Send,
  Users2,
  X,
} from "lucide-react";
import { cn, formatTime, initials } from "@/lib/utils";
import { useData, useEmployes, useSocietes, useConversations } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/store/auth";
import { employeNomComplet } from "@/data/employes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Conversation } from "@/types";

/**
 * Bulle de conversation flottante, présente sur toutes les pages de l'app
 * (montée une fois dans AppLayout) — accès rapide à un échange avec un
 * collaborateur ou un contact de société cliente sans quitter l'écran en
 * cours. Réutilise le même modèle de données que la Messagerie complète
 * (une conversation directe par employé + les groupes) ; la gestion des
 * groupes et les pièces jointes restent réservées à la page Messagerie.
 */
export function ChatBubble() {
  const { isAdmin, can, employeId } = usePermissions();
  const hasAccess = isAdmin || can("messagerie");
  const adminName = useAuth((s) => s.session?.cabinetNom ?? "Cabinet");
  const viewerAuthor = isAdmin ? "me" : (employeId ?? "me");

  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const employes = useEmployes();
  const societes = useSocietes();
  const messages = useData((s) => s.messages);
  const addMessage = useData((s) => s.addMessage);
  const markConversationRead = useData((s) => s.markConversationRead);
  const allConversations = useConversations(viewerAuthor);
  const conversations = isAdmin
    ? allConversations
    : allConversations.filter(
        (c) => c.type === "groupe" || c.employeId === employeId,
      );

  const totalUnread = conversations.reduce((n, c) => n + c.nonLus, 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const empById = (id: string) => employes.find((e) => e.id === id) ?? null;
  const socById = (id: string | null) =>
    societes.find((s) => s.id === id) ?? null;
  type Emp = ReturnType<typeof empById>;
  const partnerLabel = (c: Conversation, emp: Emp) =>
    c.type === "groupe"
      ? (c.titre ?? "Groupe")
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations
      .filter((c) => {
        if (!q) return true;
        const emp = c.employeId ? empById(c.employeId) : null;
        const soc = socById(c.societeId);
        return [c.titre ?? "", emp ? employeNomComplet(emp) : "", soc?.raisonSociale ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.dernierMessageLe.localeCompare(a.dernierMessageLe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, search]);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;
  const activeEmp = activeConv?.employeId ? empById(activeConv.employeId) : null;
  const threadMessages = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === activeId)
        .sort((a, b) => a.envoyeLe.localeCompare(b.envoyeLe)),
    [messages, activeId],
  );

  useEffect(() => {
    if (open && activeId) markConversationRead(activeId, viewerAuthor);
  }, [open, activeId, markConversationRead, viewerAuthor]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [threadMessages.length, activeId]);

  function send() {
    if (!draft.trim() || !activeId) return;
    addMessage({
      conversationId: activeId,
      auteurId: viewerAuthor,
      contenu: draft.trim(),
      envoyeLe: new Date().toISOString(),
      statut: "envoye",
    });
    setDraft("");
  }

  if (!hasAccess) return null;

  return (
    <div ref={panelRef} className="fixed bottom-5 right-5 z-40 no-print">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
          {activeConv ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
                <button
                  onClick={() => setActiveId(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                  aria-label="Retour aux conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center border border-border text-xs font-bold text-foreground",
                    activeConv.type === "groupe" ? "rounded-[9px]" : "rounded-full",
                  )}
                >
                  {activeConv.type === "groupe" ? (
                    <Users2 className="h-4 w-4" />
                  ) : (
                    partnerInitials(activeConv, activeEmp)
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {partnerLabel(activeConv, activeEmp)}
                </span>
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate("/messagerie");
                  }}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                  aria-label="Ouvrir la messagerie complète"
                  title="Ouvrir la messagerie complète"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-muted/20 px-3 py-3">
                {threadMessages.length === 0 && (
                  <p className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                    Aucun message. Écrivez le premier ci-dessous.
                  </p>
                )}
                {threadMessages.map((m) => {
                  const mine = m.auteurId === viewerAuthor;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-md px-3 py-1.5 text-[13px]",
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border bg-card text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.contenu}</p>
                        <div className={cn("mt-0.5 text-right text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {formatTime(m.envoyeLe)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-end gap-2 border-t border-border p-2.5">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Écrivez un message…"
                  className="max-h-24 min-h-[36px] flex-1 resize-none py-1.5 text-sm"
                  rows={1}
                />
                <button
                  onClick={send}
                  disabled={!draft.trim()}
                  aria-label="Envoyer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-accent to-accent/90 text-accent-foreground shadow-md shadow-accent/30 transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
                <span className="text-sm font-bold text-foreground">Messagerie</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate("/messagerie");
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Ouvrir la messagerie complète"
                    title="Ouvrir la messagerie complète"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="border-b border-border p-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Aucune conversation.
                  </p>
                )}
                {filtered.map((c) => {
                  const emp = c.employeId ? empById(c.employeId) : null;
                  const soc = socById(c.societeId);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className="flex w-full gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center border border-border text-[11px] font-bold text-foreground",
                          c.type === "groupe" ? "rounded-[9px]" : "rounded-full",
                        )}
                      >
                        {c.type === "groupe" ? <Users2 className="h-4 w-4" /> : partnerInitials(c, emp)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {partnerLabel(c, emp)}
                          </span>
                          {c.nonLus > 0 && (
                            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-sidebar-accent px-1 text-[10px] font-bold text-sidebar">
                              {c.nonLus}
                            </span>
                          )}
                        </div>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {soc?.raisonSociale ?? c.dernierMessage}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer la messagerie" : "Ouvrir la messagerie"}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-accent shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
