"use client";

import { ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { ItemSuggestion, SuggestionPayload } from "@/lib/move/types";

interface SuggestItemsModalProps {
  payload: SuggestionPayload | null;
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: (selected: ItemSuggestion[]) => void;
  onDismiss: () => void;
}

export function SuggestItemsModal({
  payload,
  checkedIds,
  onToggle,
  onConfirm,
  onDismiss,
}: SuggestItemsModalProps) {
  const selected = payload?.suggestions.filter((s) => checkedIds.has(s.id)) ?? [];

  return (
    <Dialog open={payload !== null} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Itens sugeridos — {payload?.roomName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          Desmarque os itens que você não tem.
        </p>

        <div className="max-h-80 overflow-auto space-y-1 pr-1">
          {payload?.suggestions.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted transition-colors"
            >
              <Checkbox
                checked={checkedIds.has(item.id)}
                onCheckedChange={() => onToggle(item.id)}
                id={item.id}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.name}</div>
                {item.category && item.category !== "geral" && (
                  <div className="text-xs text-muted-foreground">{item.category}</div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted-foreground">
                {item.quantity > 1 && <span>×{item.quantity}</span>}
                {item.fragile && (
                  <span className="flex items-center gap-0.5 text-rose-600">
                    <ShieldAlert className="size-3" />
                    frágil
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={onDismiss}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={selected.length === 0}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-40 hover:opacity-80 transition-opacity"
          >
            Adicionar {selected.length > 0 ? `${selected.length} item${selected.length > 1 ? "s" : ""}` : "itens"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
