"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  List,
  Bot,
  FileText,
  Webhook,
  Zap,
  Brain,
  Settings,
  FlaskConical,
  Radio,
} from "lucide-react";

const navItems = [
  { href: "/",        icon: LayoutDashboard, label: "Overview" },
  { href: "/runs",    icon: List,            label: "Runs" },
  { href: "/agents",  icon: Bot,             label: "Agents" },
  { href: "/prompts", icon: FileText,        label: "Prompts" },
  { href: "/hooks",   icon: Webhook,         label: "Hooks" },
  { href: "/skills",  icon: Zap,             label: "Skills" },
  { href: "/memory",  icon: Brain,           label: "Memory" },
  { href: "/settings",icon: Settings,        label: "Settings" },
  { href: "/eval",    icon: FlaskConical,    label: "Eval" },
  { href: "/live",    icon: Radio,           label: "Live", live: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-sidebar h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-border">
        <span className="text-sm font-semibold text-foreground tracking-tight">
          Claude <span className="text-primary">Console</span>
        </span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
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
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-accent text-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon
                size={15}
                className={cn(
                  "shrink-0",
                  item.live && "text-green-400",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span>{item.label}</span>
              {item.live && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">localhost:3000</p>
      </div>
    </aside>
  );
}
