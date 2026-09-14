import { forwardRef, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generatePassword, scorePassword } from "@/lib/password";

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: string;
  onValueChange: (value: string) => void;
  showGenerator?: boolean;
  showStrength?: boolean;
}

const strengthColor = ["bg-destructive", "bg-destructive", "bg-warning", "bg-accent", "bg-success"];

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    { value, onValueChange, showGenerator = true, showStrength = true, className, ...props },
    ref,
  ) => {
    const [visible, setVisible] = useState(false);
    const { score, level } = scorePassword(value);

    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={ref}
              type={visible ? "text" : "password"}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              className={cn("pr-9 font-mono", className)}
              {...props}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={visible ? "Masquer" : "Afficher"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {showGenerator && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                onValueChange(generatePassword());
                setVisible(true);
              }}
              aria-label="Générer un mot de passe"
            >
              <RefreshCw />
            </Button>
          )}
        </div>

        {showStrength && value.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < score ? strengthColor[score] : "bg-border",
                  )}
                />
              ))}
            </div>
            <span className="w-16 text-right text-xs capitalize text-muted-foreground">
              {level}
            </span>
          </div>
        )}
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
