"use client";

import Link from "next/link";
import { FolderOpen, Settings } from "lucide-react";

export function NoProjectSelected() {
  return (
    <div className="flex-1 flex items-center justify-center h-full py-16">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
          <FolderOpen size={20} className="text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">프로젝트가 선택되지 않았어요</p>
          <p className="text-xs text-muted-foreground">Settings에서 프로젝트를 먼저 선택해주세요</p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Settings size={12} />
          Settings로 이동
        </Link>
      </div>
    </div>
  );
}
