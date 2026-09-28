import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  editableRowColumns,
  parseRowDraft,
  type RowDraft,
} from "@/lib/collecte/rowDraft";
import type { TabDef, TabRow } from "@/lib/collecte/tabs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  def: TabDef;
  rowCount: number;
  devise: string;
  onAdd: (row: TabRow) => void;
  triggerRef: RefObject<HTMLButtonElement>;
}

export function RequestedTableRowDrawer({
  open,
  onOpenChange,
  def,
  rowCount,
  devise,
  onAdd,
  triggerRef,
}: Props) {
  const isMobile = useIsMobile();
  const formId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<RowDraft>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const initialBalance = def.key === "etat_caisse" && rowCount === 0;
  const columns = editableRowColumns(def, rowCount);
  const currency = devise === "EUR" ? "€" : devise === "USD" ? "$" : devise;

  useEffect(() => {
    if (!open) return;
    setDraft({});
    setErrors({});
    setMessage(null);
  }, [open, def.key, rowCount]);

  function update(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setMessage(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseRowDraft(def, rowCount, draft);
    if (!result.row) {
      setErrors(result.errors);
      setMessage(result.message);
      return;
    }
    try {
      onAdd(result.row);
      onOpenChange(false);
    } catch {
      setMessage("Impossible d'ajouter la ligne. Réessayez.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[90dvh] rounded-t-2xl border-x-0 px-4 pt-5 sm:px-6"
            : "h-dvh w-full max-w-[500px] gap-0 overflow-hidden rounded-none p-0 sm:max-w-[500px]"
        }
        onOpenAutoFocus={(event) => {
          if (firstFieldRef.current) {
            event.preventDefault();
            firstFieldRef.current.focus();
          }
        }}
        onCloseAutoFocus={(event) => {
          if (triggerRef.current?.isConnected) {
            event.preventDefault();
            triggerRef.current.focus();
          }
        }}
      >
        {isMobile && (
          <div
            className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/30"
            aria-hidden="true"
          />
        )}
        <SheetHeader className={isMobile ? "border-0 px-0 py-0 pr-9" : "pr-12"}>
          <SheetTitle>
            {initialBalance
              ? "Solde initial"
              : def.key === "bordereaux_remise_cheques"
                ? "Nouvelle remise de chèques"
                : "Nouvelle ligne"}
          </SheetTitle>
          <SheetDescription>{def.label}</SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={submit}
          aria-describedby={message ? `${formId}-error` : undefined}
        >
          <SheetBody className={isMobile ? "space-y-4 px-0 py-5" : "space-y-4 px-5 py-5 sm:px-6"}>
            {initialBalance && (
              <p className="text-sm text-muted-foreground">
                Première ligne du tableau. Renseignez le solde initial.
              </p>
            )}
            {message && (
              <p id={`${formId}-error`} role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}
            {columns.map((column, index) => {
              const id = `${formId}-${column.key}`;
              const error = errors[column.key];
              const label =
                column.type === "number" &&
                !column.label.includes("%") &&
                !/\(.+\)$/.test(column.label)
                  ? `${column.label} (${currency})`
                  : column.label;
              return (
                <div key={column.key} className="space-y-1.5">
                  <Label htmlFor={id}>{label}</Label>
                  {column.type === "select" ? (
                    <Select
                      value={draft[column.key] || undefined}
                      onValueChange={(value) => update(column.key, value)}
                    >
                      <SelectTrigger id={id} className="min-h-11" aria-invalid={Boolean(error)}>
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {(column.options ?? []).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      ref={index === 0 ? firstFieldRef : undefined}
                      id={id}
                      className="min-h-11"
                      type={column.type}
                      inputMode={column.type === "number" ? "decimal" : undefined}
                      step={column.type === "number" ? "any" : undefined}
                      value={draft[column.key] ?? ""}
                      onChange={(event) => update(column.key, event.target.value)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${id}-error` : undefined}
                    />
                  )}
                  {error && (
                    <p id={`${id}-error`} className="text-xs text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}
            {def.key === "etat_caisse" && !initialBalance && (
              <p className="text-xs text-muted-foreground">
                Le solde est calculé automatiquement à partir de la ligne précédente.
              </p>
            )}
          </SheetBody>
          <SheetFooter
            className={
              isMobile
                ? "flex-row items-center justify-end px-0 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
                : undefined
            }
          >
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" variant="ledger" className="min-h-11">
              Ajouter la ligne
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
