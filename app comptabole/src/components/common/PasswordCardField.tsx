import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { CARD_FIELD_INPUT, CardField } from "@/components/common/CardField";
import { generatePassword, scorePassword } from "@/lib/password";
import { cn } from "@/lib/utils";

const STRENGTH_COLOR = ["bg-destructive", "bg-destructive", "bg-warning", "bg-accent", "bg-success"];

/** Champ mot de passe « carte » : œil pour afficher, bouton de génération et
 * jauge de force optionnels (même rendu que le formulaire de compte). */
export function PasswordCardField({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  autoComplete,
  generator = false,
  strength = false,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  generator?: boolean;
  strength?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const { score, level } = scorePassword(value);

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <CardField id={id} label={label} className="flex-1">
          <div className="relative">
            <input
              id={id}
              type={visible ? "text" : "password"}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={placeholder}
              autoComplete={autoComplete}
              className={cn(CARD_FIELD_INPUT, "pr-8 font-mono text-[0.95rem]")}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={visible ? "Masquer" : "Afficher"}
            >
              {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </CardField>
        {generator && (
          <button
            type="button"
            onClick={() => {
              onValueChange(generatePassword());
              setVisible(true);
            }}
            aria-label="Générer un mot de passe"
            className="grid w-14 shrink-0 place-items-center self-stretch rounded-lg border border-accent/35 bg-secondary/60 text-primary transition-colors hover:border-accent hover:bg-card"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        )}
      </div>
      {strength && value.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex flex-1 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? STRENGTH_COLOR[score] : "bg-border")}
              />
            ))}
          </div>
          <span className="w-20 text-right text-sm capitalize text-muted-foreground">{level}</span>
        </div>
      )}
    </div>
  );
}
