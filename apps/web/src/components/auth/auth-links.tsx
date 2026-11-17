import Link from "next/link";

export function AuthLinks({
  links,
}: {
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <nav
      aria-label="Authentication"
      className="mt-6 flex w-[calc(100vw-3rem)] min-w-0 max-w-full flex-wrap items-center justify-center gap-3 text-sm"
    >
      {links.map((link) => (
        <Link
          className="rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:text-primary"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
