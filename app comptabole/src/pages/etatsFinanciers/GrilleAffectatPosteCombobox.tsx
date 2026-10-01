import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { POSTE_OPTIONS } from "@/lib/etatsFinanciers/postes";

interface GrilleAffectatPosteComboboxProps {
  code: string;
  value: string;
  valueLabel: string;
  disabled?: boolean;
  onSelect: (value: string) => void;
}

const EMPTY_OPTION = { value: "", label: "— Non assigné —" };
const POSTE_CHOICES = POSTE_OPTIONS.filter(
  (option, index, options) =>
    options.findIndex((candidate) => candidate.value === option.value) === index,
);
const POSTE_GROUPES = [...new Set(POSTE_CHOICES.map((option) => option.groupe))];

function getChoices(query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
  const matches = (label: string, group = "") =>
    !normalizedQuery ||
    label.toLocaleLowerCase("fr-FR").includes(normalizedQuery) ||
    group.toLocaleLowerCase("fr-FR").includes(normalizedQuery);

  const showUnassigned = matches(EMPTY_OPTION.label);
  const groups = POSTE_GROUPES.map((group) => ({
    group,
    options: POSTE_CHOICES.filter(
      (option) => option.groupe === group && matches(option.label, group),
    ),
  })).filter(({ options }) => options.length > 0);

  return {
    showUnassigned,
    groups,
    values: [
      ...(showUnassigned ? [EMPTY_OPTION.value] : []),
      ...groups.flatMap(({ options }) => options.map((option) => option.value)),
    ],
  };
}

export function GrilleAffectatPosteCombobox({
  code,
  value,
  valueLabel,
  disabled = false,
  onSelect,
}: GrilleAffectatPosteComboboxProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeValue, setActiveValue] = useState(value);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionIdPrefix = useId();

  const choices = useMemo(() => getChoices(search), [search]);

  useEffect(() => {
    setOpen(false);
    setSearch("");
  }, [isMobile]);

  function openPicker() {
    setSearch("");
    setActiveValue(value);
    setOpen(true);
  }

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    const nextChoices = getChoices(nextSearch);
    setActiveValue(
      nextChoices.values.includes(value)
        ? value
        : (nextChoices.values[0] ?? ""),
    );
  }

  function closePicker() {
    setOpen(false);
    setSearch("");
  }

  function choose(nextValue: string) {
    closePicker();
    if (nextValue !== value) onSelect(nextValue);
  }

  function moveActive(direction: 1 | -1) {
    if (choices.values.length === 0) return;
    const currentIndex = choices.values.indexOf(activeValue);
    const startIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex =
      (startIndex + direction + choices.values.length) % choices.values.length;
    setActiveValue(choices.values[nextIndex]);
  }

  function handleSearchKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (choices.values.includes(activeValue)) choose(activeValue);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closePicker();
    }
  }

  const searchInput = (
    <Input
      ref={searchRef}
      value={search}
      onChange={(event) => changeSearch(event.target.value)}
      onKeyDown={handleSearchKeyDown}
      placeholder="Rechercher un poste…"
      aria-label={`Rechercher un poste pour le code ${code}`}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={
        choices.values.includes(activeValue)
          ? `${optionIdPrefix}-${choices.values.indexOf(activeValue)}`
          : undefined
      }
      className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-2"
    />
  );

  const optionList = (
    <div
      id={listId}
      role="listbox"
      aria-label={`Postes disponibles pour le code ${code}`}
      className="min-h-0 overflow-y-auto overscroll-contain p-1"
    >
      {choices.showUnassigned && (
        <div
          id={`${optionIdPrefix}-0`}
          role="option"
          aria-selected={value === EMPTY_OPTION.value}
          className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm outline-none hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring ${activeValue === EMPTY_OPTION.value ? "bg-secondary/50" : ""}`}
          onClick={() => choose(EMPTY_OPTION.value)}
        >
          <span className="whitespace-normal">{EMPTY_OPTION.label}</span>
          {value === EMPTY_OPTION.value && (
            <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
          )}
        </div>
      )}
      {choices.groups.map(({ group, options }) => (
        <div
          key={group}
          role="group"
          aria-label={group}
          className="pt-1 first:pt-0"
        >
          <p className="px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group}
          </p>
          {options.map((option) => {
            const index = choices.values.indexOf(option.value);
            const selected = value === option.value;
            const hasDuplicateLabel =
              options.filter((candidate) => candidate.label === option.label)
                .length > 1;
            return (
              <div
                key={option.value}
                id={`${optionIdPrefix}-${index}`}
                role="option"
                aria-label={`${option.label}, ${group}${hasDuplicateLabel ? `, ${option.value}` : ""}`}
                aria-selected={selected}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm leading-snug outline-none hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring ${activeValue === option.value ? "bg-secondary/50" : ""}`}
                onClick={() => choose(option.value)}
              >
                <span className="min-w-0 whitespace-normal">{option.label}</span>
                {hasDuplicateLabel && (
                  <span className="max-w-[45%] break-all text-right font-mono text-[0.625rem] text-muted-foreground">
                    {option.value}
                  </span>
                )}
                {selected && (
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      ))}
      {choices.values.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground" role="status">
          Aucun poste trouvé
        </p>
      )}
    </div>
  );

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      aria-label={`Poste global du code ${code} : ${valueLabel}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      className="h-auto min-h-11 w-full min-w-0 justify-between gap-2 rounded-[4px] border border-transparent px-2 py-1 text-sm font-normal leading-snug text-foreground hover:border-border/70 hover:bg-secondary/40 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
      onClick={() => isMobile && openPicker()}
    >
      <span className="min-w-0 whitespace-normal text-left">{valueLabel}</span>
      <ChevronDown
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover/poste:text-primary"
      />
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => (nextOpen ? openPicker() : closePicker())}
      >
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
          className="h-[min(82dvh,38rem)] max-h-[92dvh] w-full gap-0 rounded-t-xl px-0 pb-0"
        >
          <SheetHeader className="shrink-0 py-3 pr-12">
            <SheetTitle>Choisir un poste</SheetTitle>
            <SheetDescription>Code {code}</SheetDescription>
          </SheetHeader>
          <div className="shrink-0 border-b border-border px-3 py-2">
            {searchInput}
          </div>
          <SheetBody className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {optionList}
            </div>
          </SheetBody>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? openPicker() : closePicker())}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        className="w-[min(30rem,calc(100vw-1.5rem))] overflow-hidden p-0"
      >
        <div className="border-b border-border px-3 py-2">{searchInput}</div>
        <div className="max-h-[min(16rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain">
          {optionList}
        </div>
      </PopoverContent>
    </Popover>
  );
}
