interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "secondary";
}

export function Button({
  isLoading,
  variant = "primary",
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "w-full rounded-md px-4 py-2.5 font-body text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-ink text-paper hover:bg-ink-light"
      : "border border-ink/15 bg-transparent text-ink hover:bg-ink/5";

  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || isLoading} {...rest}>
      {isLoading ? "Yuklanmoqda..." : children}
    </button>
  );
}