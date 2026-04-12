"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  CalendarDays,
  Table2,
  Clock,
  TrendingUp,
  KeyRound,
  BarChart3,
  Receipt,
  ClipboardList,
  GitBranch,
  Shield,
  FileText,
  FolderOpen,
  Building2,
  Building,
  Users,
  Contact,
  Upload,
  Settings,
  Key,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    items: [
      { label: "Oversikt", href: "/", icon: LayoutGrid },
      { label: "Hendelser", href: "/hendelser", icon: CalendarDays },
    ],
  },
  {
    title: "Innsikt",
    items: [
      { label: "Rent roll", href: "/rent-roll", icon: Table2 },
      { label: "Tidslinje", href: "/tidslinje", icon: Clock },
      { label: "Indeksregulering", href: "/indeksregulering", icon: TrendingUp },
      { label: "Ledighet", href: "/ledighet", icon: KeyRound },
      { label: "Utløpsprofil", href: "/utlopsprofil", icon: BarChart3 },
      { label: "Fakturering", href: "/fakturering", icon: Receipt },
      { label: "Garantier", href: "/garantier", icon: Shield },
      { label: "Dokumenter", href: "/dokumenter", icon: FileText },
    ],
  },
  {
    title: "Entiteter",
    items: [
      { label: "Selskaper", href: "/selskaper", icon: Building2 },
      { label: "Eiendommer", href: "/eiendommer", icon: Building },
      { label: "Leietakere", href: "/leietakere", icon: Users },
      { label: "Kontakter", href: "/kontakter", icon: Contact },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Import", href: "/import", icon: Upload },
      { label: "API-nøkler", href: "/admin/api-keys", icon: Key },
      { label: "Avsendere", href: "/admin/senders", icon: Mail },
      { label: "Innstillinger", href: "/admin/users", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-gray-100 bg-white">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">hybelrentroll</span>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {navigation.map((section, sIdx) => (
            <div key={sIdx} className={cn(sIdx > 0 && "mt-6")}>
              {section.title && (
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-purple-50 text-purple-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px]",
                        isActive ? "text-purple-600" : "text-gray-400"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
