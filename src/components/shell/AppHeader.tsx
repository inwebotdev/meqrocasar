import Link from "next/link";

import { Icon, Pill } from "@/components/ui";

export interface AppHeaderProps {
  title: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  return (
    <header className="pt-safe fixed top-0 z-50 w-full bg-surface/85 shadow-header backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between px-margin">
        <Link href="/" className="flex items-center gap-space-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- the brand logo is a static SVG, not a candidate for next/image optimization */}
          <img
            src="/brand/logo.svg"
            alt="Querétaro Romance AI"
            className="h-8 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm font-bold tracking-widest text-secondary uppercase">
              Querétaro Romance AI
            </span>
            <span className="font-headline-sm text-headline-sm tracking-tight text-primary">
              {title}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-space-sm">
          <Pill tone="primary-soft" icon="verified">
            SECTUR Querétaro
          </Pill>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <Icon name="person" size={18} className="text-on-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}
