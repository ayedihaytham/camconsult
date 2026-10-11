import { useId } from "react";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { COLLECTE_ETATS, COLLECTE_TABS, etatDeTableau } from "@/lib/collecte/tabs";

interface Props {
  selected: string[];
  onChange: (keys: string[]) => void;
  available?: string[];
  disabled?: boolean;
  label?: string;
  error?: string;
}

/** Sélection commune à la création d'une collecte et à l'ajout de tableaux. */
export function CollecteTableSelection({ selected, onChange, available, disabled = false, label = "Tableaux demandés", error }: Props) {
  const id = useId();
  const tables = COLLECTE_TABS.filter((table) => !available || available.includes(table.key));
  const keys = tables.map((table) => table.key);
  const count = keys.filter((key) => selected.includes(key)).length;
  const allSelected = keys.length > 0 && count === keys.length;
  const groups = [
    ...COLLECTE_ETATS.map((etat) => ({ label: etat.label, code: etat.code, tables: tables.filter((table) => etat.tableaux.includes(table.key)) })),
    { label: "Autres tableaux", code: null, tables: tables.filter((table) => !etatDeTableau(table.key)) },
  ].filter((group) => group.tables.length > 0);

  function toggleGroup(groupKeys: string[]) {
    const all = groupKeys.every((key) => selected.includes(key));
    onChange(all ? selected.filter((key) => !groupKeys.includes(key)) : [...new Set([...selected, ...groupKeys])]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h3 id={`${id}-label`} className="text-base font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground" role="status">{count} / {keys.length} sélectionnés</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-9" disabled={disabled || keys.length === 0} onClick={() => toggleGroup(keys)}>
          {allSelected ? "Tout décocher" : "Tout cocher"}
        </Button>
      </div>
      <div role="group" aria-labelledby={`${id}-label`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className="space-y-5">
        {groups.map((group) => {
          const groupKeys = group.tables.map((table) => table.key);
          const groupCount = groupKeys.filter((key) => selected.includes(key)).length;
          const all = groupCount === groupKeys.length;
          return (
            <div key={group.label} role="group" aria-label={group.label}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                  {group.code && <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px]">{group.code}</span>}
                  {group.label}
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">{groupCount} / {groupKeys.length}</span>
                </span>
                <button type="button" disabled={disabled} onClick={() => toggleGroup(groupKeys)} aria-label={`${all ? "Tout décocher" : "Tout cocher"} : ${group.label}`}
                  className="min-h-9 rounded-sm px-1 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                  {all ? "Tout décocher" : "Tout cocher"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.tables.map((table) => {
                  const checked = selected.includes(table.key);
                  return (
                    <label key={table.key} className={cn(
                      "flex min-h-16 min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                      checked ? "border-accent/70 bg-accent/10" : "border-border bg-card hover:border-primary/30 hover:bg-muted/30",
                      disabled && "cursor-default opacity-60",
                    )}>
                      <Table2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                        {table.label}
                        {table.cabinetSeul && <span className="mt-1 block text-xs font-normal text-muted-foreground">Tenu par le cabinet</span>}
                      </span>
                      <Checkbox aria-label={table.label} checked={checked} disabled={disabled}
                        onCheckedChange={(value) => onChange(value === true ? [...new Set([...selected, table.key])] : selected.filter((key) => key !== table.key))}
                        className="size-5 shrink-0 rounded-md" />
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
