import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, CornerDownLeft, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useChoisirSociete } from "@/hooks/useSocieteActive";
import { cheminPourSociete } from "@/lib/societeContext";
import { cn } from "@/lib/utils";
import { useSocietes } from "@/store/data";
import { useUi } from "@/store/ui";
import { useNavigationGroups } from "./sidebar/useNavigationGroups";

interface Resultat {
  id: string;
  groupe: "Pages" | "Sociétés";
  libelle: string;
  detail?: string;
  icone?: React.ComponentType<{ className?: string }>;
  ouvrir: () => void;
}

/** Minuscules sans accents : « societes » trouve « Sociétés ». */
export const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tous les mots saisis doivent se retrouver dans le texte ; un texte qui commence par la saisie passe devant. Null : pas de correspondance. */
export function correspond(texte: string, saisie: string): number | null {
  const t = normaliser(texte);
  const mots = normaliser(saisie).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return 0;
  if (!mots.every((m) => t.includes(m))) return null;
  return t.startsWith(mots[0]) ? 0 : 1;
}

/** « Aller à… » (Ctrl K / ⌘ K) : une page ou une société, au clavier. Les pages sont celles du menu du compte connecté ; une société choisie devient la société active. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const groupes = useNavigationGroups();
  const societes = useSocietes();
  const { canSeeSociete, lectureSeule } = usePermissions();
  const choisir = useChoisirSociete();
  const [saisie, setSaisie] = useState("");
  const [actif, setActif] = useState(0);
  const liste = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUi.getState().setPaletteOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);

  useEffect(() => {
    if (!open) {
      setSaisie("");
      setActif(0);
    }
  }, [open]);

  const resultats = useMemo<Resultat[]>(() => {
    const fermerEt = (fn: () => void) => () => {
      setOpen(false);
      fn();
    };
    const pages: Resultat[] = [];
    for (const g of groupes) {
      for (const item of g.items) {
        if (item.to) pages.push({ id: `p-${item.to}`, groupe: "Pages", libelle: item.label, detail: g.label, icone: item.icon, ouvrir: fermerEt(() => navigate(item.to!)) });
        for (const c of item.children ?? [])
          pages.push({ id: `p-${c.to}`, groupe: "Pages", libelle: c.label, detail: item.label, icone: item.icon, ouvrir: fermerEt(() => navigate(c.to)) });
      }
    }
    const lignes: Resultat[] = lectureSeule
      ? []
      : societes
          .filter((s) => canSeeSociete(s.id))
          .sort((a, b) => a.raisonSociale.localeCompare(b.raisonSociale, "fr", { numeric: true }))
          .map((s) => ({
            id: `s-${s.id}`,
            groupe: "Sociétés" as const,
            libelle: s.raisonSociale,
            detail: s.code,
            icone: Building2,
            ouvrir: fermerEt(() => {
              choisir(s.id);
              if (!cheminPourSociete(pathname, s.id)) navigate("/");
            }),
          }));
    const filtre = (items: Resultat[], max: number) =>
      items
        .map((r) => ({ r, rang: correspond(`${r.libelle} ${r.detail ?? ""}`, saisie) }))
        .filter((x): x is { r: Resultat; rang: number } => x.rang !== null)
        .sort((a, b) => a.rang - b.rang)
        .slice(0, max)
        .map((x) => x.r);
    const q = saisie.trim();
    return [...filtre(pages, q ? 8 : 12), ...filtre(lignes, q ? 8 : 5)];
    // choisir/canSeeSociete changent à chaque rendu : seules les données comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupes, societes, saisie, pathname, lectureSeule]);

  useEffect(() => {
    setActif(0);
  }, [saisie]);
  useEffect(() => {
    liste.current?.querySelector<HTMLElement>(`[data-index="${actif}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [actif]);

  function surTouche(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => (resultats.length ? (i + 1) % resultats.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => (resultats.length ? (i - 1 + resultats.length) % resultats.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      resultats[actif]?.ouvrir();
    }
  }

  let dernierGroupe = "";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-describedby={undefined}
        onInteractOutside={() => setOpen(false)}
        className="top-[14%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-lg p-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Aller à…</DialogTitle>
        <DialogDescription className="sr-only">Cherchez une page ou une société, puis validez avec Entrée.</DialogDescription>
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-liste"
            aria-activedescendant={resultats[actif] ? `palette-opt-${actif}` : undefined}
            aria-label="Aller à"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={surTouche}
            placeholder="Une page, une société…"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground sm:block">Échap</kbd>
        </div>
        <ul id="palette-liste" role="listbox" ref={liste} aria-label="Résultats" className="max-h-[22rem] overflow-y-auto p-1.5">
          {resultats.length === 0 && <li role="presentation" className="px-3 py-8 text-center text-sm text-muted-foreground">Aucun résultat pour « {saisie.trim()} ».</li>}
          {resultats.map((r, i) => {
            const entete = r.groupe !== dernierGroupe;
            dernierGroupe = r.groupe;
            const Icone = r.icone;
            return (
              <li key={r.id} role="presentation">
                {entete && <p className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{r.groupe}</p>}
                <div
                  id={`palette-opt-${i}`}
                  role="option"
                  aria-selected={i === actif}
                  data-index={i}
                  onMouseMove={() => setActif(i)}
                  onClick={r.ouvrir}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm", i === actif ? "bg-primary text-primary-foreground" : "text-foreground")}
                >
                  {Icone && <Icone className={cn("size-4 shrink-0", i === actif ? "text-accent" : "text-muted-foreground")} />}
                  <span className="min-w-0 flex-1 truncate font-medium">{r.libelle}</span>
                  {r.detail && <span className={cn("shrink-0 truncate text-xs", i === actif ? "text-primary-foreground/70" : "text-muted-foreground")}>{r.detail}</span>}
                  {i === actif && <CornerDownLeft className="size-3.5 shrink-0 text-primary-foreground/70" aria-hidden="true" />}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="hidden items-center gap-3 border-t border-border bg-muted/50 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
          <span>↑ ↓ naviguer</span>
          <span>Entrée ouvrir</span>
          <span>Échap fermer</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}
