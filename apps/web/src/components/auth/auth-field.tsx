import type { InputHTMLAttributes } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function AuthField({ label, hint, id, ...props }: AuthFieldProps) {
  const fieldId =
    id ?? props.name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <label htmlFor={fieldId} className="block space-y-2">
      <span className="block text-sm font-medium text-[color:var(--text-primary)]">
        {label}
      </span>
      <input
        id={fieldId}
        {...props}
        className="w-full rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--accent-soft)] focus:ring-2 focus:ring-[color:var(--accent-muted)]"
      />
      {hint ? (
        <span className="block text-xs text-[color:var(--text-soft)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
