/**
 * apps/web/components/form-banner.tsx
 *
 * Barcha auth formalarida (register, login, forgot-password,
 * reset-password, verify-email) umumiy — maydonga bog'liq bo'lmagan —
 * xato yoki muvaffaqiyat xabarlarini bir xil, aniq ko'rinadigan uslubda
 * ko'rsatish uchun. Field-level xatolar (masalan email formati noto'g'ri)
 * hamon har bir input ostida alohida ko'rsatiladi — bu komponent faqat
 * "forma ustida"gi umumiy xabarlar uchun.
 */

interface FormBannerProps {
  variant: "error" | "success";
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<FormBannerProps["variant"], string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-700",
};

export function FormBanner({ variant, children, className = "" }: FormBannerProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </div>
  );
}