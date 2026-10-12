import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Champ numérique libre (step="any") : un montant garde toujours 3 décimales (0.4 → 0.400). */
function completerDecimales(el: HTMLInputElement) {
  const v = el.value;
  if (v === "" || !Number.isFinite(Number(v))) return;
  const decimales = v.includes(".") ? v.split(".")[1].length : 0;
  if (decimales < 3 && !/e/i.test(v)) el.value = Number(v).toFixed(3);
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onBlur, ...props }, ref) => {
    const interne = React.useRef<HTMLInputElement | null>(null);
    const fixe = type === "number" && props.step === "any";
    // À chaque rendu, hors saisie en cours : une valeur chargée (modification d'une fiche) s'affiche aussi à 3 décimales.
    React.useLayoutEffect(() => {
      const el = interne.current;
      if (fixe && el && document.activeElement !== el) completerDecimales(el);
    });
    return (
      <input
        type={type}
        onBlur={(e) => {
          if (fixe) completerDecimales(e.target);
          onBlur?.(e);
        }}
        className={cn(
          "flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={(el) => {
          interne.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
