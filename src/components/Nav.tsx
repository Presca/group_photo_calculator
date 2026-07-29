"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Setup", icon: "⚙" },
  { href: "/plan", label: "Plan", icon: "▦" },
  { href: "/operate", label: "Operate", icon: "▶" },
  { href: "/commands", label: "Commands", icon: "🗣" },
  { href: "/print", label: "Print", icon: "⎙" },
];

/**
 * Mobile-first navigation: a fixed bottom tab bar in thumb reach on
 * phones/tablets, a conventional top bar on wide screens.
 */
export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Top bar — wide screens only */}
      <header className="no-print sticky top-0 z-40 hidden border-b border-slate-200 bg-white/95 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex shrink-0 items-baseline gap-1">
            <span className="text-lg font-black tracking-tight text-blue-700">
              Group Photo
            </span>
            <span className="text-lg font-black tracking-tight">Planner</span>
          </Link>
          <nav className="flex flex-1 gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`min-h-12 flex-1 rounded-xl px-4 py-3 text-center text-base font-bold whitespace-nowrap transition-colors ${
                  isActive(tab.href)
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Bottom tab bar — phones and tablets */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
              isActive(tab.href) ? "text-blue-700" : "text-slate-500"
            }`}
          >
            <span
              aria-hidden
              className={`text-lg leading-none ${
                isActive(tab.href) ? "" : "opacity-70"
              }`}
            >
              {tab.icon}
            </span>
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
