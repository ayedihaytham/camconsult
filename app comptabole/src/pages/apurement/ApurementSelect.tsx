import { useState, type ReactNode } from "react";
import { ListFilter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { value: string; label: ReactNode; disabled?: boolean };
type Props = {
  options: Option[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  groupLabel?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

// Radix reserves the empty string for clearing a selection. Keep that value in
// its native form control; only the menu item needs a nonempty identifier.
const EMPTY_OPTION = "__apurement_empty_option__";

export function ApurementSelect({
  options,
  value,
  defaultValue = "",
  onValueChange,
  name,
  required,
  disabled,
  className,
  groupLabel,
  ...triggerProps
}: Props) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const selected = value ?? localValue;
  const placeholder = options.find((option) => option.value === "")?.label;
  return (
    <Select
      name={name}
      required={required}
      disabled={disabled}
      value={selected}
      onValueChange={(next) => {
        const actual = next === EMPTY_OPTION ? "" : next;
        setLocalValue(actual);
        onValueChange?.(actual);
      }}
    >
      <SelectTrigger
        {...triggerProps}
        className={cn(
          "apurement-select h-11 min-w-0 gap-2 text-left text-foreground [&>span:first-of-type]:min-w-0 [&>span:first-of-type]:flex-1 [&>span:first-of-type]:line-clamp-none",
          className,
        )}
      >
        <ListFilter
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <SelectValue
          placeholder={
            <span className="block truncate">{placeholder ?? "Choisir…"}</span>
          }
        >
          {selected ? (
            <span className="block truncate">
              {options.find((option) => option.value === selected)?.label}
            </span>
          ) : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        className="max-h-[min(70dvh,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] rounded-sm"
      >
        <SelectGroup>
          {groupLabel && <SelectLabel>{groupLabel}</SelectLabel>}
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value || EMPTY_OPTION}
              disabled={option.disabled}
              className="rounded-sm py-2 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
            >
              <span className="block whitespace-normal break-words">
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
