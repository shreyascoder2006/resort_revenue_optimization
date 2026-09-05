"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palmtree } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/revenue", label: "Revenue & Pricing" },
  { href: "/dashboard/guest-experience", label: "Guest Experience" },
  { href: "/dashboard/operations", label: "Operations" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden sticky top-0 z-10 border-b border-border-strong bg-surface">
      <Link href="/" className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Palmtree className="h-5 w-5 text-series-1" strokeWidth={2} />
        <p className="text-sm font-semibold">Smart Resort 360</p>
      </Link>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-series-1 text-white" : "bg-page text-ink-secondary"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
