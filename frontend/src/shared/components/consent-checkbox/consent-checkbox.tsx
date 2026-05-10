import { useState } from "react";
import { Link } from "react-router-dom";

export interface ConsentEvidence {
  granted_at: string;
  text_shown: string;
  channel: string;
  user_agent: string;
}

interface ConsentCheckboxProps {
  /** Finalidades para las que se pide consentimiento (ej. ["operacional", "marketing"]). */
  purposes: string[];
  /** Llamado cada vez que el usuario alterna el checkbox. evidence != null cuando aceptó. */
  onChange: (evidence: ConsentEvidence | null) => void;
  /** Canal de captura para registrar en evidencia. */
  channel?: string;
  /** Versión de la política aceptada. */
  version?: string;
  className?: string;
}

const PURPOSE_LABELS: Record<string, string> = {
  operacional: "operación del servicio",
  marketing: "comunicaciones de marketing",
  whatsapp_marketing: "marketing por WhatsApp",
  ia_anita: "uso del asistente IA",
  analitica: "análisis interno del servicio",
};

function describePurposes(purposes: string[]): string {
  if (purposes.length === 0) return "el tratamiento de mis datos";
  return purposes.map((p) => PURPOSE_LABELS[p] ?? p).join(", ");
}

/**
 * Checkbox NO premarcado para captura de consentimiento.
 * Ley N° 21.719 Art. 12 — el consentimiento debe ser libre, específico,
 * inequívoco e informado. La evidencia (timestamp + UA + texto mostrado)
 * se devuelve para persistir vía POST /compliance/contacts/{id}/consent.
 */
export function ConsentCheckbox({
  purposes,
  onChange,
  channel = "web",
  version = "1.0",
  className = "",
}: ConsentCheckboxProps) {
  const [checked, setChecked] = useState(false);

  const textShown = `He leído y acepto la política de privacidad para ${describePurposes(purposes)}.`;

  const handleToggle = (next: boolean) => {
    setChecked(next);
    if (next) {
      onChange({
        granted_at: new Date().toISOString(),
        text_shown: textShown,
        channel,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } else {
      onChange(null);
    }
  };

  return (
    <label className={`flex items-start gap-2 text-sm text-foreground ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => handleToggle(event.target.checked)}
        className="mt-1 h-4 w-4 cursor-pointer rounded border-border bg-background accent-primary"
        aria-label="Acepto la política de privacidad"
      />
      <span>
        He leído y acepto la{" "}
        <Link to="/privacidad" target="_blank" className="font-medium text-primary hover:underline">
          política de privacidad
        </Link>{" "}
        para {describePurposes(purposes)}.{" "}
        <span className="text-xs text-muted-foreground">(v{version})</span>
      </span>
    </label>
  );
}
