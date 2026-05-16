"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Plus, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import type { MoveItem, MoveRoom } from "@/lib/move/types";

interface Phase2RoomDetailProps {
  room: MoveRoom;
  items: MoveItem[];
  isSuggesting: boolean;
  onBack: () => void;
  onSuggestItems: () => void;
  onAddItem: (item: Omit<MoveItem, "id" | "room" | "decision" | "packingStatus" | "highlightedItemIds">) => void;
  onDeleteItem: (id: string) => void;
}

export function Phase2RoomDetail({
  room,
  items,
  isSuggesting,
  onBack,
  onSuggestItems,
  onAddItem,
  onDeleteItem,
}: Phase2RoomDetailProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [fragile, setFragile] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function submitItem() {
    const n = name.trim();
    if (!n) return;
    onAddItem({ name: n, category: "geral", quantity, fragile, bulky: false, priority: "normal" });
    setName("");
    setQuantity(1);
    setFragile(false);
    setShowForm(false);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-4 overflow-auto pb-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-4" />
          Cômodos
        </button>
        <h2 className="text-xl font-semibold">{room.name}</h2>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSuggestItems}
          disabled={isSuggesting}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          {isSuggesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isSuggesting ? "Gerando sugestões..." : "Sugerir itens"}
        </button>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Plus className="size-4" />
          Adicionar item
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitItem()}
            placeholder="Nome do item..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Qtd:
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={fragile}
                onChange={(e) => setFragile(e.target.checked)}
                className="rounded"
              />
              <ShieldAlert className="size-3.5 text-rose-500" />
              Frágil
            </label>
            <button
              onClick={submitItem}
              disabled={!name.trim()}
              className="ml-auto rounded-lg bg-foreground px-4 py-1.5 text-sm font-semibold text-background disabled:opacity-40 hover:opacity-80"
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-12 text-sm text-muted-foreground text-center">
          Nenhum item ainda. Clique em{" "}
          <span className="mx-1 font-semibold text-foreground">Sugerir itens</span> ou adicione
          manualmente.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Qtd: {item.quantity}
                  {item.category && item.category !== "geral" ? ` · ${item.category}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {item.fragile && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                    <ShieldAlert className="size-3" />
                    Frágil
                  </span>
                )}
                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="rounded-md p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
