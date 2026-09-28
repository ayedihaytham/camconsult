import { useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import {
  AMOUNT_DECIMALS,
  formatAmountInput,
  parseAmount,
  sanitizeAmountInput,
} from "@/lib/amount";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
  decimals?: number;
  allowNegative?: boolean;
};

/** Champ montant/quantité : jusqu'à 3 décimales, « , » ou « . » acceptés.
 * Texte libre en cours de saisie (« 12, » ne redevient pas 0), nombre propre
 * remonté à chaque frappe. */
export function AmountInput({
  value,
  onValueChange,
  decimals = AMOUNT_DECIMALS,
  allowNegative = true,
  className,
  onFocus,
  onBlur,
  ...props
}: Props) {
  const [text, setText] = useState(() => formatAmountInput(value));

  // Valeur modifiée depuis l'extérieur (reset du formulaire, calcul auto) :
  // on ne réécrit le texte que si elle diffère de ce qui est déjà saisi.
  useEffect(() => {
    setText((current) => (parseAmount(current) === value ? current : formatAmountInput(value)));
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      className={className}
      onFocus={(e) => {
        e.target.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = sanitizeAmountInput(e.target.value, { decimals, allowNegative });
        setText(next);
        onValueChange(parseAmount(next));
      }}
      onBlur={(e) => {
        setText(formatAmountInput(parseAmount(text)));
        onBlur?.(e);
      }}
    />
  );
}
