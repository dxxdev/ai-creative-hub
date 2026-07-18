interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function FormField({ label, error, id, className = "", ...inputProps }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-body text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-md border border-ink/15 bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none transition-colors placeholder:text-slate-soft/60 focus:border-marigold ${className}`}
        {...inputProps}
      />
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
    </div>
  );
}