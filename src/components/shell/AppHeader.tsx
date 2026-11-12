import Link from "next/link";

import { Icon, Pill } from "@/components/ui";

import { HeaderNavLink } from "./HeaderNavLink";

export interface AppHeaderProps {
  title: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="pt-safe fixed top-0 z-50 w-full bg-surface/85 shadow-header backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-full max-w-[520px] items-center justify-between px-margin md:max-w-[768px] md:px-margin-tablet">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-space-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset exported from the Figma file, not a candidate for next/image optimization */}
          <img
            src="/brand/logo.png"
            alt="Me QRO Casar"
            width={411}
            height={212}
            className="h-10 w-auto shrink-0 object-contain sm:h-12"
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-label-sm text-label-sm font-bold tracking-widest text-secondary uppercase">
              Querétaro Romance
            </span>
            <span className="truncate font-headline-sm text-headline-sm tracking-tight text-tertiary">
              {title}
            </span>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-space-sm">
          <HeaderNavLink />
          <Pill tone="primary-soft" icon="verified" aria-label="SECTUR Querétaro">
            <span className="hidden sm:inline">SECTUR Querétaro</span>
          </Pill>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Icon name="person" size={18} className="text-on-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}
