import { Search } from "lucide-react";
import { useUi } from "@/store/ui";

/** Champ « Rechercher… Ctrl K » de la barre du haut : ouvre la même palette que « Aller à… » et le raccourci clavier. */
export function RechercheBouton() {
  return (
    <button
      type="button"
      onClick={() => useUi.getState().setPaletteOpen(true)}
      aria-label="Rechercher une page ou une société (Ctrl K)"
      className="topbar-search"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="topbar-search__texte">Rechercher…</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}
