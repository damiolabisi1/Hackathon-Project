"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChefHat,
  Heart,
  Home,
  Mic,
  ScanLine,
  Settings,
  UserRound,
  CalendarDays,
  Sparkles,
} from "lucide-react";

const navigationItems = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Scan Ingredients",
    href: "/scan?mode=photo",
    icon: ScanLine,
  },
  {
    label: "Describe Recipes",
    href: "/scan?mode=chat",
    icon: Sparkles,
  },
  {
    label: "Cook Mode",
    href: "/cook",
    icon: Mic,
  },
  {
    label: "Saved Recipes",
    href: "/saved",
    icon: Heart,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserRound,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function isActiveRoute(href: string) {
    const [targetPath, targetQuery] = href.split("?");

    if (pathname !== targetPath) {
      return false;
    }

    if (!targetQuery) {
      return true;
    }

    const targetParams = new URLSearchParams(targetQuery);

    return Array.from(targetParams.entries()).every(
      ([key, value]) => searchParams.get(key) === value,
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r bg-white lg:flex lg:flex-col">
      <div className="flex h-20 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-green-600 text-white">
            <ChefHat className="size-5" />
          </span>

          <span className="text-lg font-bold tracking-tight">
            Kitchen<span className="text-green-600">Aid</span>
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-950"
              }`}
            >
              <Icon
                className={`size-[18px] ${
                  active ? "text-green-600" : "text-gray-500"
                }`}
              />

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="m-4 rounded-2xl bg-green-50 p-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-white text-green-600 shadow-sm">
          <ChefHat className="size-5" />
        </div>

        <p className="mt-4 text-sm font-semibold text-gray-950">
          Reduce food waste
        </p>

        <p className="mt-1 text-xs leading-5 text-gray-600">
          Save money and cook delicious meals with what you already have.
        </p>
      </div>
    </aside>
  );
}
