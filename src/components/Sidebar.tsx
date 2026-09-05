"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, MessageSquareHeart, Wrench, Palmtree } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/revenue", label: "Revenue & Pricing", icon: TrendingUp },
  { href: "/guest-experience", label: "Guest Experience", icon: MessageSquareHeart },
  { href: "/operations", label: "Operations", icon: Wrench },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border-strong bg-surface px-4 py-6">
      <div className="flex items-center gap-2 px-2 pb-6">
        <Palmtree className="h-6 w-6 text-series-1" strokeWidth={2} />
        <div>
          <p className="text-sm font-semibold leading-tight">Smart Resort 360</p>
          <p className="text-xs text-ink-muted leading-tight">Operations Intelligence</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-series-1/10 text-series-1 font-medium"
                  : "text-ink-secondary hover:bg-page hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-lg border border-border-strong bg-page px-3 py-3 text-xs text-ink-muted">
        Demo data is synthetic and regenerates deterministically - no external services required.
      </div>
    </aside>
  );
}
