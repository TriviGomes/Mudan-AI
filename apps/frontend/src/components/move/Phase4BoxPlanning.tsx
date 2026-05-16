"use client";

import { useState } from "react";
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
import { Archive, GripVertical, Loader2, MessageCircle, ShieldAlert, Sparkles, X } from "lucide-react";
import type { MoveItem, MovingBox } from "@/lib/move/types";

function boxProgress(box: MovingBox): number {
  if (box.items.length === 0) return 0;
  return Math.round((box.packedItems.length / box.items.length) * 100);
}

// Draggable item row — grip handle separate from checkbox
function DraggableItemRow({
  itemId,
  item,
  boxId,
  packed,
  onTogglePacked,
}: {
  itemId: string;
  item: MoveItem | undefined;
  boxId: string;
  packed: boolean;
  onTogglePacked: (boxId: string, itemId: string, packed: boolean) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: `${boxId}::${itemId}`,
    data: { itemId, sourceBoxId: boxId },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-2 text-sm transition-opacity ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 p-0.5"
        aria-label="Mover item"
      >
        <GripVertical className="size-3.5" />
      </button>
      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
        <input
          type="checkbox"
          checked={packed}
          onChange={(e) => onTogglePacked(boxId, itemId, e.target.checked)}
          className="rounded flex-shrink-0"
        />
        <span className={`truncate ${packed ? "line-through text-muted-foreground" : ""}`}>
          {item?.name ?? itemId}
        </span>
        {item?.fragile && <ShieldAlert className="size-3 text-rose-500 flex-shrink-0 ml-auto" />}
      </label>
    </div>
  );
}

// Droppable box card
function DroppableBox({
  box,
  itemById,
  selected,
  onSelect,
  onTogglePacked,
}: {
  box: MovingBox;
  itemById: Map<string, MoveItem>;
  selected: boolean;
  onSelect: () => void;
  onTogglePacked: (boxId: string, itemId: string, packed: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: box.id });
  const progress = boxProgress(box);

  return (
    <article
      ref={setNodeRef}
      className={`rounded-xl border bg-card p-4 transition-all ${
        selected ? "border-foreground" : "border-border"
      } ${isOver ? "ring-2 ring-emerald-400 bg-emerald-50/20" : ""}`}
    >
      <button
        className="flex w-full items-start justify-between gap-4 text-left"
        onClick={onSelect}
      >
        <div className="flex items-center gap-2 font-semibold">
          {box.fragile ? (
            <ShieldAlert className="size-4 text-rose-600" />
          ) : (
            <Archive className="size-4" />
          )}
          {box.alias}
        </div>
        <span className="text-sm font-semibold text-muted-foreground">{progress}%</span>
      </button>

      <div className="mt-1 text-xs text-muted-foreground">
        {box.originRoom}
        {box.destinationRoom ? ` → ${box.destinationRoom}` : ""} · {box.weightEstimate} ·{" "}
        {box.status}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 space-y-1.5 min-h-[2rem]">
        {box.items.map((itemId) => (
          <DraggableItemRow
            key={itemId}
            itemId={itemId}
            item={itemById.get(itemId)}
            boxId={box.id}
            packed={box.packedItems.includes(itemId)}
            onTogglePacked={onTogglePacked}
          />
        ))}
        {box.items.length === 0 && (
          <div
            className={`flex items-center justify-center h-10 rounded-lg border border-dashed text-xs transition-colors ${
              isOver ? "border-emerald-400 text-emerald-600" : "border-border text-muted-foreground/40"
            }`}
          >
            Solte itens aqui
          </div>
        )}
      </div>

      {box.packingInstructions.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground border-t border-border pt-3">
          {box.packingInstructions.slice(0, 3).map((ins) => (
            <li key={ins}>— {ins}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

interface Phase4BoxPlanningProps {
  items: MoveItem[];
  boxes: MovingBox[];
  selectedBoxId: string | null;
  isSuggesting: boolean;
  chatOpen: boolean;
  onSelectBox: (id: string) => void;
  onTogglePacked: (boxId: string, itemId: string, packed: boolean) => void;
  onMoveItem: (itemId: string, sourceBoxId: string, targetBoxId: string) => void;
  onSuggestBoxPlan: () => void;
  onToggleChat: () => void;
}

export function Phase4BoxPlanning({
  items,
  boxes,
  selectedBoxId,
  isSuggesting,
  chatOpen,
  onSelectBox,
  onTogglePacked,
  onMoveItem,
  onSuggestBoxPlan,
  onToggleChat,
}: Phase4BoxPlanningProps) {
  const itemById = new Map(items.map((i) => [i.id, i]));

  const [activeDrag, setActiveDrag] = useState<{ itemId: string; sourceBoxId: string } | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    const data = active.data.current as { itemId: string; sourceBoxId: string };
    setActiveDrag(data);
  }

  function handleDragEnd({ over }: DragEndEvent) {
    if (over && activeDrag && over.id !== activeDrag.sourceBoxId) {
      onMoveItem(activeDrag.itemId, activeDrag.sourceBoxId, over.id as string);
    }
    setActiveDrag(null);
  }

  const activeItem = activeDrag ? itemById.get(activeDrag.itemId) : null;

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-4 overflow-hidden pb-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-semibold">Caixas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""} para empacotar
            {boxes.length > 0 && (
              <span className="ml-1 text-muted-foreground/60">
                · arraste para reorganizar
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onSuggestBoxPlan}
          disabled={isSuggesting || items.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          {isSuggesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isSuggesting ? "Gerando plano..." : "Sugerir plano de caixas"}
        </button>
      </div>

      {boxes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-12 text-sm text-muted-foreground text-center">
          Clique em{" "}
          <span className="mx-1 font-semibold text-foreground">Sugerir plano de caixas</span>{" "}
          para o assistente organizar seus itens em caixas.
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 min-h-0 overflow-auto space-y-3">
            {boxes.map((box) => (
              <DroppableBox
                key={box.id}
                box={box}
                itemById={itemById}
                selected={selectedBoxId === box.id}
                onSelect={() => onSelectBox(box.id)}
                onTogglePacked={onTogglePacked}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeItem ? (
              <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-xl opacity-95 rotate-1 cursor-grabbing">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-3.5 text-muted-foreground/40" />
                  <span className="font-medium">{activeItem.name}</span>
                  {activeItem.fragile && <ShieldAlert className="size-3 text-rose-500" />}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Floating chat toggle */}
      <button
        onClick={onToggleChat}
        className={`fixed bottom-6 right-6 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition-all z-20 ${
          chatOpen
            ? "bg-foreground text-background"
            : "bg-card border border-border text-foreground hover:bg-muted"
        }`}
      >
        {chatOpen ? <X className="size-4" /> : <MessageCircle className="size-4" />}
        {chatOpen ? "Fechar chat" : "Assistente"}
      </button>
    </div>
  );
}
