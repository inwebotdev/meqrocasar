"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The header's one navigation link, replacing the old bottom bar: "Recintos"
 * everywhere, flipping to "Quiz" (back to `/`) on the Recintos page itself —
 * never both at once, so there's always exactly one way to reach the other
 * section. Split out as its own client component so `AppHeader` (every
 * other bit of it is static) can stay a server component.
 */
export function HeaderNavLink() {
  const pathname = usePathname();
  const onRecintos = pathname === "/recintos";

  const href = onRecintos ? "/" : "/recintos";
  const label = onRecintos ? "Quiz" : "Recintos";

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1.5 font-label-sm text-label-sm font-bold text-primary hover:text-primary/80"
    >
      <span>{label}</span>
    </Link>
  );
}
