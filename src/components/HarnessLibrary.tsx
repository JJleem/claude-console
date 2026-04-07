"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, ChevronUp, Search } from "lucide-react";
import type { Harness } from "@/lib/db/schema";

interface HarnessLibraryProps {
  harnessList: Harness[];
  slotA: Harness | null;
  slotB: Harness | null;
  onAssignA: (h: Harness | null) => void;
  onAssignB: (h: Harness | null) => void;
  onDelete: (id: string) => void;
  onCreated: () => void;
}

function getPreview(text: string): string {
  if (!text?.trim()) return "(시스템 없음)";
  return text.split("\n").filter((l) => l.trim()).slice(0, 2).join(" ↵ ");
}

export function HarnessLibrary({
  harnessList,
  slotA,
  slotB,
  onAssignA,
  onAssignB,
  onDelete,
  onCreated,
}: HarnessLibraryProps) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSystem, setNewSystem] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const filtered = harnessList.filter((h) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      h.name.toLowerCase().includes(q) ||
      h.system.toLowerCase().includes(q) ||
      (h.description ?? "").toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    await fetch("/api/harness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", name: newName, system: newSystem, description: newDesc }),
    });
    setCreateOpen(false);
    setNewName(""); setNewSystem(""); setNewDesc("");
    onCreated();
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-foreground">Harness</span>
        <button
          onClick={() => setCreateOpen(true)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="새 하네스 만들기"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* 검색 */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색"
            className="w-full text-xs bg-secondary border border-border rounded-md pl-7 pr-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* 목록 */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">
              {query ? `"${query}" 없음` : "하네스가 없습니다"}
            </p>
          )}

          {filtered.map((h) => {
            const isA = slotA?.id === h.id;
            const isB = slotB?.id === h.id;
            const isExpanded = expandedId === h.id;

            return (
              <div key={h.id} className="border-b border-border/40 last:border-b-0">
                {/* 메인 행 */}
                <div className="px-3 py-2.5">
                  {/* 이름 + 슬롯 배지 */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs font-medium text-foreground flex-1 truncate">{h.name}</p>
                    {isA && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium shrink-0">A</span>
                    )}
                    {isB && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium shrink-0">B</span>
                    )}
                  </div>

                  {/* 프롬프트 미리보기 */}
                  <p className="text-[11px] text-muted-foreground font-mono line-clamp-2 leading-snug">
                    {getPreview(h.system)}
                  </p>

                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1 mt-2">
                    <button
                      onClick={() => onAssignA(isA ? null : h)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        isA
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                          : "border-border text-muted-foreground hover:border-blue-500/40 hover:text-blue-400"
                      }`}
                    >
                      {isA ? "A 해제" : "→ A"}
                    </button>
                    <button
                      onClick={() => onAssignB(isB ? null : h)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        isB
                          ? "bg-green-500/15 border-green-500/40 text-green-400"
                          : "border-border text-muted-foreground hover:border-green-500/40 hover:text-green-400"
                      }`}
                    >
                      {isB ? "B 해제" : "→ B"}
                    </button>
                    <div className="ml-auto flex items-center gap-0.5">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : h.id)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      <button
                        onClick={() => onDelete(h.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 상세 펼치기 */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border/40 pt-2 bg-secondary/20 space-y-2">
                    {h.description && (
                      <p className="text-[11px] text-muted-foreground italic">{h.description}</p>
                    )}
                    <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap leading-snug bg-background/60 rounded p-2 max-h-36 overflow-y-auto">
                      {h.system || "(시스템 없음)"}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* 새 하네스 생성 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-sm">새 하네스 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">이름</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 친절한 고객센터 CS"
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">시스템 프롬프트</label>
              <textarea
                value={newSystem}
                onChange={(e) => setNewSystem(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder="시스템 프롬프트를 입력하세요 (비워두면 기본값과 동일)"
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none leading-relaxed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">설명 (선택)</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="어떤 용도의 하네스인지"
                className="w-full text-sm bg-secondary border border-border rounded-md px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!newName.trim()} className="flex-1">
                <Plus size={13} className="mr-1.5" />저장
              </Button>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
