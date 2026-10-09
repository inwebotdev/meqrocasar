"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Quiz", icon: "style" },
  { href: "/resultados", label: "Moodboard", icon: "auto_awesome" },
  { href: "/recintos", label: "Recintos", icon: "castle" },
  { href: "/resultados#reel", label: "Reel", icon: "play_circle" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pb-safe fixed bottom-0 z-50 w-full bg-surface/90 shadow-nav backdrop-blur-xl">
      <div className="flex h-16 items-center justify-around px-space-sm">
        {NAV_ITEMS.map((item) => {
          const itemPathname = item.href.split("#")[0];
          const isActive = itemPathname === pathname;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center px-space-xs transition-colors",
                isActive ? "font-bold text-primary" : "text-on-surface-variant hover:text-primary",
              )}
            >
              <Icon name={item.icon} size={24} />
              <span className="mt-0.5 font-label-sm text-label-sm">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
