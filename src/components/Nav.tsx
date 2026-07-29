"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Setup" },
  { href: "/plan", label: "Plan" },
  { href: "/operate", label: "Operate" },
  { href: "/commands", label: "Commands" },
  { href: "/print", label: "Print" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="hidden shrink-0 items-baseline gap-1 sm:flex">
          <span className="text-lg font-black tracking-tight text-blue-700">
            Group Photo
          </span>
          <span className="text-lg font-black tracking-tight">Planner</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`min-h-12 flex-1 rounded-xl px-4 py-3 text-center text-base font-bold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
