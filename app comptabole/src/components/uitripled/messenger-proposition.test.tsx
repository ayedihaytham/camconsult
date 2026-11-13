// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Messenger } from "./messenger-shadcnui";

afterEach(cleanup);

function monter(extra: Partial<React.ComponentProps<typeof Messenger>> = {}, draft = "") {
  const onDraftChange = vi.fn();
  const onCreerTache = vi.fn();
  render(
    <Messenger
      conversations={[{ id: "1", name: "Leila Benali", secondary: "Assistante", lastMessage: "", lastMessageTime: "", unread: 0, initials: "LB", isGroup: false, avatarClassName: "" }]}
      selectedConversationId="1"
      activeConversation={{ id: "1", name: "Leila Benali", subtitle: "Assistante", initials: "LB", isGroup: false, avatarClassName: "", canManageGroup: false }}
      messages={[]}
      mobileView="chat"
      search=""
      draft={draft}
      attachment={null}
      attachmentItems={[]}
      canClassifyAttachments={false}
      onClassifyAttachment={vi.fn()}
      onDownloadAttachment={vi.fn()}
      canCreateGroup={false}
      emptyConversationDescription=""
      messagesContainerRef={{ current: null } as never}
      onSearchChange={vi.fn()}
      onSelectConversation={vi.fn()}
      onBack={vi.fn()}
      onCreateGroup={vi.fn()}
      onEditGroup={vi.fn()}
      onDeleteGroup={vi.fn()}
      onDraftChange={onDraftChange}
      onFileSelected={vi.fn()}
      onSelectAttachment={vi.fn()}
      onRemoveAttachment={vi.fn()}
      onSend={vi.fn()}
      onCreerTache={onCreerTache}
      {...extra}
    />,
  );
  return { onDraftChange, onCreerTache };
}

describe("Messagerie : dossier lié, réponses prêtes, tâche, membres", () => {
  it("affiche la bande du dossier lié dans l'onglet Conversation", () => {
    monter({ contexte: <p>Dossier lié : Atlas Textile</p> });
    expect(screen.getByText("Dossier lié : Atlas Textile")).toBeTruthy();
  });

  it("une réponse prête s'ajoute à la saisie", () => {
    const { onDraftChange } = monter({ reponsesRapides: ["Pièces bien reçues ✓"] }, "Bonjour");
    fireEvent.click(screen.getByRole("button", { name: "Pièces bien reçues ✓" }));
    expect(onDraftChange).toHaveBeenCalledWith("Bonjour Pièces bien reçues ✓");
  });

  it("« Créer une tâche » appelle le rappel", () => {
    const { onCreerTache } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Créer une tâche à partir de ce message" }));
    expect(onCreerTache).toHaveBeenCalledTimes(1);
  });

  it("l'onglet Membres liste les participants", () => {
    monter({ membres: [{ nom: "Leila Benali", role: "Assistante", enLigne: true }, { nom: "Vous", role: "Votre compte" }] });
    fireEvent.click(screen.getByRole("tab", { name: "Membres" }));
    expect(screen.getByRole("list", { name: "Membres de la conversation" }).textContent).toContain("Leila Benali");
  });
});
