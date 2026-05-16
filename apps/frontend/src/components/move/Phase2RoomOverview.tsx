"use client";

import { ArrowRight, ChevronRight, Package } from "lucide-react";
import type { MoveItem, MoveRoom } from "@/lib/move/types";
import { getRoomDecisionProgress, getRoomItemCount } from "@/lib/move/derive";

interface Phase2RoomOverviewProps {
  rooms: MoveRoom[];
  items: MoveItem[];
  onSelectRoom: (id: string) => void;
  onContinue: () => void;
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="36" height="36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
      <circle
        cx="18" cy="18" r={r} fill="none"
        stroke="currentColor" strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="text-emerald-500 transition-all duration-500"
      />
    </svg>
  );
}

export function Phase2RoomOverview({ rooms, items, onSelectRoom, onContinue }: Phase2RoomOverviewProps) {
  const totalItems = items.length;

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-6 overflow-auto pb-6">
      <div>
        <h2 className="text-2xl font-semibold">Seus cômodos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Entre em cada cômodo para adicionar os itens que você tem.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {rooms.map((room) => {
          const count = getRoomItemCount(items, room.id);
          const progress = getRoomDecisionProgress(items, room.id);
          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-foreground/40 hover:shadow-sm"
            >
              <div className="relative flex-shrink-0">
                <ProgressRing pct={count > 0 ? progress : 0} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                  {count > 0 ? `${progress}%` : ""}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{room.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {count === 0 ? "Vazio" : `${count} item${count > 1 ? "s" : ""}`}
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">
          {totalItems === 0
            ? "Adicione itens nos cômodos para continuar"
            : `${totalItems} item${totalItems > 1 ? "s" : ""} no inventário`}
        </span>
        <button
          onClick={onContinue}
          disabled={totalItems === 0}
          className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity disabled:opacity-40 hover:opacity-80"
        >
          Ir para Decisões
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
