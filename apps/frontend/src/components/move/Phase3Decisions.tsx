"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical, Package, ShieldAlert } from "lucide-react";
import type { ItemDecision, MoveItem, MoveRoom } from "@/lib/move/types";
import { getOverallDecisionProgress } from "@/lib/move/derive";

const COLUMNS: {
  id: ItemDecision;
  label: string;
  textColor: string;
  borderAccent: string;
  bgOver: string;
  bgDefault: string;
}[] = [
  {
    id: "undecided",
    label: "Indeciso",
    textColor: "text-muted-foreground",
    borderAccent: "border-border",
    bgOver: "bg-muted/60 ring-2 ring-muted-foreground/30",
    bgDefault: "bg-muted/20",
  },
  {
    id: "take",
    label: "✓ Vai",
    textColor: "text-emerald-700",
    borderAccent: "border-emerald-400",
    bgOver: "bg-emerald-50 ring-2 ring-emerald-400",
    bgDefault: "bg-emerald-50/30",
  },
  {
    id: "sell",
    label: "$ Vende",
    textColor: "text-sky-700",
    borderAccent: "border-sky-400",
    bgOver: "bg-sky-50 ring-2 ring-sky-400",
    bgDefault: "bg-sky-50/30",
  },
  {
    id: "donate",
    label: "♥ Doa",
    textColor: "text-amber-700",
    borderAccent: "border-amber-400",
    bgOver: "bg-amber-50 ring-2 ring-amber-400",
    bgDefault: "bg-amber-50/30",
  },
  {
    id: "discard",
    label: "✕ Descarta",
    textColor: "text-rose-700",
    borderAccent: "border-rose-400",
    bgOver: "bg-rose-50 ring-2 ring-rose-400",
    bgDefault: "bg-rose-50/30",
  },
];

function ItemCard({
  item,
  roomName,
  isOverlay = false,
}: {
  item: MoveItem;
  roomName?: string;
  isOverlay?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card px-3 py-2.5 text-sm select-none ${
        isOverlay ? "shadow-xl rotate-1 opacity-95" : "shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="size-3.5 text-muted-foreground/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {roomName ? `${roomName}` : ""}
            {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
          </div>
        </div>
        {item.fragile && <ShieldAlert className="size-3.5 text-rose-500 flex-shrink-0" />}
      </div>
    </div>
  );
}

function DraggableItem({ item, roomName }: { item: MoveItem; roomName?: string }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <ItemCard item={item} roomName={roomName} />
    </div>
  );
}

function KanbanColumn({
  col,
  items,
  roomById,
}: {
  col: (typeof COLUMNS)[number];
  items: MoveItem[];
  roomById: Map<string, MoveRoom>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex flex-col w-52 flex-shrink-0 h-full">
      <div className={`mb-2 border-b-2 pb-2 flex-shrink-0 ${col.borderAccent}`}>
        <span className={`text-xs font-bold uppercase tracking-[0.1em] ${col.textColor}`}>
          {col.label}
        </span>
        <span className="ml-1.5 text-xs text-muted-foreground">({items.length})</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 overflow-y-auto rounded-xl p-2 space-y-2 transition-all ${
          isOver ? col.bgOver : col.bgDefault
        }`}
      >
        {items.map((item) => (
          <DraggableItem
            key={item.id}
            item={item}
            roomName={roomById.get(item.room)?.name}
          />
        ))}
        {items.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/40 pointer-events-none">
            Arraste aqui
          </div>
        )}
      </div>
    </div>
  );
}

interface Phase3DecisionsProps {
  rooms: MoveRoom[];
  items: MoveItem[];
  onDecide: (itemId: string, decision: ItemDecision) => void;
  onContinue: () => void;
}

export function Phase3Decisions({ rooms, items, onDecide, onContinue }: Phase3DecisionsProps) {
  const [filterRoom, setFilterRoom] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const progress = getOverallDecisionProgress(items);
  const decidedCount = items.filter((i) => i.decision !== "undecided").length;
  const hasTakeItems = items.some((i) => i.decision === "take");

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const filtered = useMemo(
    () => (filterRoom === "all" ? items : items.filter((i) => i.room === filterRoom)),
    [items, filterRoom],
  );

  const byDecision = useMemo(() => {
    const map = new Map<ItemDecision, MoveItem[]>(COLUMNS.map((c) => [c.id, []]));
    for (const item of filtered) map.get(item.decision)?.push(item);
    return map;
  }, [filtered]);

  const activeItem = useMemo(
    () => (activeId ? items.find((i) => i.id === activeId) : null),
    [activeId, items],
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const target = over.id as ItemDecision;
    const item = items.find((i) => i.id === active.id);
    if (item && item.decision !== target) {
      onDecide(item.id, target);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-4 overflow-hidden pb-6">
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-semibold">Decisões</h2>
          <span className="text-sm text-muted-foreground">
            {decidedCount} de {items.length} decidido{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Room filter */}
      <div className="flex-shrink-0">
        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
        >
          <option value="all">Todos os cômodos</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="ml-3 text-xs text-muted-foreground">
          Arraste os cards para as colunas de decisão
        </span>
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex gap-3 h-full" style={{ minWidth: "max-content" }}>
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                items={byDecision.get(col.id) ?? []}
                roomById={roomById}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <ItemCard
              item={activeItem}
              roomName={roomById.get(activeItem.room)?.name}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Footer */}
      <div className="flex-shrink-0 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">
          {!hasTakeItems
            ? "Arraste itens para '✓ Vai' para liberar a montagem de caixas"
            : `${items.filter((i) => i.decision === "take").length} item${
                items.filter((i) => i.decision === "take").length > 1 ? "s" : ""
              } indo para a nova casa`}
        </span>
        {hasTakeItems && (
          <button
            onClick={onContinue}
            className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
          >
            <Package className="size-4" />
            Montar Caixas
          </button>
        )}
      </div>
    </div>
  );
}
