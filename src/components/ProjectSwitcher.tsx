"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/lib/db/schema";
import { FolderOpen } from "lucide-react";

export function ProjectSwitcher() {
  const { selectedProject, setSelectedProject } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/settings/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.registered ?? []));
  }, []);

  if (projects.length === 0) return null;

  return (
    <Select
      value={selectedProject?.id ?? ""}
      onValueChange={(id) => {
        const p = projects.find((p) => p.id === id) ?? null;
        setSelectedProject(p);
      }}
    >
      <SelectTrigger className="h-7 text-xs w-48 gap-1.5">
        <FolderOpen size={12} className="text-muted-foreground shrink-0" />
        <SelectValue placeholder="프로젝트 선택" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id} className="text-xs">
            <span className="font-medium">{p.name}</span>
            <span className="text-muted-foreground ml-1.5 font-mono text-xs">
              {p.path.split("/").slice(-2).join("/")}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
