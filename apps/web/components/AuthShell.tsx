interface AuthShellProps {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}

/**
 * Signature element: "Fork Lineage" chizmasi — platformaning markaziy g'oyasi
 * (Original → Fork → Remix) ni bezak sifatida emas, mahsulotning o'zini
 * anglatadigan tipografik diagramma sifatida ko'rsatadi.
 */
function ForkLineage() {
  const nodes = [
    { label: "ORIGINAL", sub: "@aisha_art" },
    { label: "FORK", sub: "prompt tahrirlandi" },
    { label: "REMIX", sub: "yangi natija" },
  ];

  return (
    <div className="flex flex-col gap-0">
      {nodes.map((node, i) => (
        <div key={node.label} className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-marigold" />
            {i < nodes.length - 1 && <span className="h-12 w-px bg-marigold/40" />}
          </div>
          <div className="-mt-1 pb-8">
            <p className="font-mono text-xs tracking-widest text-marigold">{node.label}</p>
            <p className="mt-1 font-body text-sm text-paper/70">{node.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuthShell({ eyebrow, title, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen">
      {/* Chap panel — brend/kontekst, mobil'da yashiriladi */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-ink px-12 py-14 md:flex">
        <div>
          <p className="font-mono text-xs tracking-widest text-marigold">AI CREATIVE HUB</p>
          <h1 className="mt-6 max-w-xs font-display text-4xl font-medium leading-[1.15] text-paper">
            Har bir natija ortida bitta prompt bor.
          </h1>
          <p className="mt-4 max-w-xs font-body text-sm leading-relaxed text-paper/60">
            Postni emas, uni yaratgan promptni ko&apos;ring — fork qiling, o&apos;zgartiring, o&apos;zingizni yarating.
          </p>
        </div>
        <ForkLineage />
      </div>

      {/* O'ng panel — forma */}
      <div className="flex w-full flex-1 items-center justify-center px-6 py-14 md:w-[58%]">
        <div className="w-full max-w-sm">
          <p className="font-mono text-xs tracking-widest text-marigold-dim">{eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl font-medium text-ink">{title}</h2>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}