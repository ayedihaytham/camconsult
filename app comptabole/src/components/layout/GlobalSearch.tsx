import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, FileText, FolderTree, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useData } from "@/store/data";
import { usePermissions } from "@/hooks/usePermissions";

interface Result {
  id: string;
  label: string;
  sub: string;
  icon: typeof Building2;
  to: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const { isAdmin, canSeeSociete } = usePermissions();
  const societes = useData((s) => s.societes);
  const employes = useData((s) => s.employes);
  const noeuds = useData((s) => s.noeuds);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: Result[] = [];

    societes
      .filter((s) => canSeeSociete(s.id))
      .filter((s) =>
        [s.raisonSociale, s.code, s.rne, s.identifiant]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 5)
      .forEach((s) =>
        out.push({
          id: s.id,
          label: s.raisonSociale,
          sub: `Société · ${s.code}`,
          icon: Building2,
          to: "/societes",
        }),
      );

    if (isAdmin) {
      employes
        .filter((e) =>
          [e.prenom, e.nom, e.identifiant, e.email]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 5)
        .forEach((e) =>
          out.push({
            id: e.id,
            label: `${e.prenom} ${e.nom}`,
            sub: `Employé · ${e.type}`,
            icon: Users,
            to: "/employes",
          }),
        );
    }

    noeuds
      .filter((n) => canSeeSociete(n.societeId))
      .filter((n) =>
        [n.libelle, n.description].join(" ").toLowerCase().includes(q),
      )
      .slice(0, 6)
      .forEach((n) =>
        out.push({
          id: n.id,
          label: n.libelle,
          sub: n.type === "fichier" ? "Fichier" : "Dossier",
          icon: n.type === "fichier" ? FileText : FolderTree,
          to: "/structuration?vue=arbre",
        }),
      );

    return out.slice(0, 12);
  }, [query, societes, employes, noeuds, isAdmin, canSeeSociete]);

  function go(r: Result) {
    setOpen(false);
    setQuery("");
    navigate(r.to);
  }

  return (
    <div ref={ref} className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            go(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Rechercher…"
        className="w-64 rounded-full border-transparent bg-secondary/70 pl-10 pr-12 shadow-none transition-colors focus-visible:border-input focus-visible:bg-card"
        aria-label="Recherche globale"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border/70 bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        ⌘K
      </kbd>
      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-pop">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Aucun résultat.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.map((r, i) => (
                <li key={`${r.to}-${r.id}`}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                      i === active ? "bg-accent/10" : "hover:bg-secondary/60",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <r.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">
                        {r.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.sub}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
