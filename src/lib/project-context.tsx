"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Project } from "./db/schema";

type ProjectContextType = {
  selectedProject: Project | null;
  setSelectedProject: (p: Project | null) => void;
};

const ProjectContext = createContext<ProjectContextType>({
  selectedProject: null,
  setSelectedProject: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedProject, setSelectedProjectState] = useState<Project | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("selectedProject");
    if (saved) setSelectedProjectState(JSON.parse(saved));
  }, []);

  function setSelectedProject(p: Project | null) {
    setSelectedProjectState(p);
    if (p) localStorage.setItem("selectedProject", JSON.stringify(p));
    else localStorage.removeItem("selectedProject");
  }

  return (
    <ProjectContext.Provider value={{ selectedProject, setSelectedProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
