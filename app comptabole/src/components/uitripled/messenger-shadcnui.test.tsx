// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Messenger, type MessengerConversationItem } from "./messenger-shadcnui";

afterEach(cleanup);

const conv = (id: string, name: string, groupe: string, extra: Partial<MessengerConversationItem> = {}): MessengerConversationItem => ({
  id,
  name,
  secondary: `Assistant · ${groupe}`,
  lastMessage: "Aucun message",
  lastMessageTime: "01:00",
  unread: 0,
  initials: name.slice(0, 2).toUpperCase(),
  isGroup: false,
  isOnline: false,
  avatarClassName: "",
  groupe,
  hasMessages: false,
  ...extra,
});

const LISTE = [
  conv("1", "Hay Aye", "ha"),
  conv("2", "Ha Ay", "05-I CARGO LINE", { hasMessages: true, lastMessage: "Pouvez-vous confirmer ?", lastMessageTime: "09:14", unread: 2 }),
  conv("3", "Skander Ktata", "05-I CARGO LINE"),
  conv("4", "Équipe 05-I CARGO LINE", "05-I CARGO LINE", { isGroup: true, hasMessages: true, lastMessage: "Collecte ouverte.", lastMessageTime: "Lun." }),
];

function afficher(conversations = LISTE) {
  const onSelectConversation = vi.fn();
  render(
    <Messenger
      conversations={conversations}
      selectedConversationId={null}
      activeConversation={null}
      messages={[]}
      mobileView="list"
      search=""
      draft=""
      attachment={null}
      attachmentItems={[]}
      canClassifyAttachments={false}
      onClassifyAttachment={vi.fn()}
      onDownloadAttachment={vi.fn()}
      canCreateGroup
      emptyConversationDescription="Aucun échange."
      messagesContainerRef={{ current: null } as never}
      onSearchChange={vi.fn()}
      onSelectConversation={onSelectConversation}
      onBack={vi.fn()}
      onCreateGroup={vi.fn()}
      onEditGroup={vi.fn()}
      onDeleteGroup={vi.fn()}
      onDraftChange={vi.fn()}
      onFileSelected={vi.fn()}
      onSelectAttachment={vi.fn()}
      onRemoveAttachment={vi.fn()}
      onSend={vi.fn()}
    />,
  );
  return { onSelectConversation };
}

describe("boîte de messagerie du cabinet", () => {
  it("range les conversations par société et ne met ni heure ni message à celles qui n'ont pas d'échange", () => {
    afficher();
    const liste = within(screen.getByRole("list", { name: "Liste des conversations" }));
    expect(liste.getByText("05-I CARGO LINE")).toBeTruthy();
    expect(liste.getByText("ha")).toBeTruthy();
    expect(liste.getAllByText("Pas encore d'échange")).toHaveLength(2);
    expect(liste.queryByText("01:00")).toBeNull();
    expect(liste.getByText("09:14")).toBeTruthy();
  });

  it("filtre les conversations avec leur nombre : non lues, groupes, sans échange", () => {
    afficher();
    expect(screen.getByRole("button", { name: /Toutes\s*4/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Non lues\s*1/ }));
    const liste = within(screen.getByRole("list", { name: "Liste des conversations" }));
    expect(liste.getByText("Ha Ay")).toBeTruthy();
    expect(liste.queryByText("Hay Aye")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Sans échange\s*2/ }));
    expect(within(screen.getByRole("list", { name: "Liste des conversations" })).getByText("Skander Ktata")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Groupes\s*1/ }));
    expect(within(screen.getByRole("list", { name: "Liste des conversations" })).getByText("Équipe 05-I CARGO LINE")).toBeTruthy();
  });

  it("propose, sur l'écran vide, d'écrire aux personnes sans échange", () => {
    const { onSelectConversation } = afficher();
    expect(screen.getByText("Choisissez une conversation")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Écrire à Hay Aye" }));
    expect(onSelectConversation).toHaveBeenCalledWith("1");
  });

  it("garde une liste simple, sans filtres, quand il y a peu de conversations", () => {
    afficher(LISTE.slice(0, 2));
    expect(screen.queryByRole("group", { name: "Filtrer les conversations" })).toBeNull();
  });
});
