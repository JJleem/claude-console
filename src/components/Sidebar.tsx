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
  FolderOpen,
  Sun,
  Moon,
  GitCompare,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useTheme } from "@/lib/theme-context";

const navItems = [
  { href: "/",        icon: LayoutDashboard, label: "Overview" },
  { href: "/runs",    icon: List,            label: "Runs" },
  { href: "/agents",  icon: Bot,             label: "Subagents" },
  { href: "/prompts", icon: FileText,        label: "Prompts" },
  { href: "/hooks",   icon: Webhook,         label: "Hooks" },
  { href: "/skills",  icon: Zap,             label: "Skills" },
  { href: "/memory",  icon: Brain,           label: "Memory" },
  { href: "/settings",icon: Settings,        label: "Settings" },
  { href: "/eval",    icon: FlaskConical,    label: "Eval" },
  { href: "/ab",      icon: GitCompare,      label: "A/B Test" },
  { href: "/live",    icon: Radio,           label: "Live", live: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { selectedProject } = useProject();
  const { theme, toggle } = useTheme();

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

      <div className="px-3 py-2 border-t border-border flex items-center justify-between">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-accent/50"
        >
          {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>

      <div className="px-5 py-4 border-t border-border">
        {selectedProject ? (
          <div className="flex items-center gap-2">
            <FolderOpen size={12} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{selectedProject.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedProject.path.split("/").slice(-2).join("/")}
              </p>
            </div>
          </div>
        ) : (
          <Link href="/settings" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
            <FolderOpen size={12} />
            프로젝트 선택
          </Link>
        )}
      </div>
    </aside>
  );
}
