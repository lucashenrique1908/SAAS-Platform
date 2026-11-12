import Link from "next/link";

export function AuthLinks({
  links,
}: {
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <nav
      aria-label="Authentication"
      className="mt-6 flex flex-wrap gap-4 text-sm"
    >
      {links.map((link) => (
        <Link
          className="underline underline-offset-4"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
