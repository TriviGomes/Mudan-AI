"use client";

import { useState } from "react";
import {
  Bath,
  Bed,
  BookOpen,
  Car,
  ChefHat,
  Flower2,
  Home,
  Layers,
  Monitor,
  Plus,
  Sofa,
  Truck,
  WashingMachine,
  X,
} from "lucide-react";
import type { MoveRoom } from "@/lib/move/types";

const PRESET_ROOMS: { id: string; name: string; kind: string; Icon: React.ElementType }[] = [
  { id: "sala", name: "Sala", kind: "living_room", Icon: Sofa },
  { id: "cozinha", name: "Cozinha", kind: "kitchen", Icon: ChefHat },
  { id: "quarto-1", name: "Quarto Principal", kind: "bedroom", Icon: Bed },
  { id: "quarto-2", name: "Quarto 2", kind: "bedroom", Icon: Bed },
  { id: "escritorio", name: "Escritório", kind: "office", Icon: Monitor },
  { id: "lavanderia", name: "Lavanderia", kind: "laundry", Icon: WashingMachine },
  { id: "banheiro", name: "Banheiro", kind: "bathroom", Icon: Bath },
  { id: "garagem", name: "Garagem", kind: "garage", Icon: Car },
  { id: "varanda", name: "Varanda", kind: "balcony", Icon: Flower2 },
  { id: "despensa", name: "Despensa", kind: "storage", Icon: Layers },
];

interface Phase1RoomSetupProps {
  rooms: MoveRoom[];
  onSetRooms: (rooms: MoveRoom[]) => void;
  onContinue: () => void;
}

export function Phase1RoomSetup({ rooms, onSetRooms, onContinue }: Phase1RoomSetupProps) {
  const [customName, setCustomName] = useState("");

  const selectedIds = new Set(rooms.map((r) => r.id));

  function togglePreset(preset: (typeof PRESET_ROOMS)[number]) {
    if (selectedIds.has(preset.id)) {
      onSetRooms(rooms.filter((r) => r.id !== preset.id));
    } else {
      onSetRooms([...rooms, { id: preset.id, name: preset.name, kind: preset.kind }]);
    }
  }

  function addCustomRoom() {
    const name = customName.trim();
    if (!name) return;
    const id = `custom-${Date.now()}`;
    onSetRooms([...rooms, { id, name, kind: "room" }]);
    setCustomName("");
  }

  function removeCustom(id: string) {
    onSetRooms(rooms.filter((r) => r.id !== id));
  }

  const customRooms = rooms.filter((r) => !PRESET_ROOMS.some((p) => p.id === r.id));

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-6 overflow-auto pb-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-1">
          <Home className="size-4" />
          Sua casa
        </div>
        <h2 className="text-2xl font-semibold">Quais cômodos você tem?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione os que fazem parte da sua casa. Você pode descrever no chat também.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {PRESET_ROOMS.map((preset) => {
          const selected = selectedIds.has(preset.id);
          return (
            <button
              key={preset.id}
              onClick={() => togglePreset(preset)}
              className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                selected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:border-foreground/40"
              }`}
            >
              <preset.Icon className="size-6" />
              {preset.name}
              {selected && (
                <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-background text-foreground text-[9px] font-bold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {customRooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customRooms.map((r) => (
            <span
              key={r.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-sm"
            >
              {r.name}
              <button onClick={() => removeCustom(r.id)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomRoom()}
          placeholder="Adicionar outro cômodo..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <button
          onClick={addCustomRoom}
          disabled={!customName.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 disabled:opacity-40"
        >
          <Plus className="size-4" />
          Adicionar
        </button>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">
          {rooms.length === 0
            ? "Nenhum cômodo selecionado"
            : `${rooms.length} cômodo${rooms.length > 1 ? "s" : ""} selecionado${rooms.length > 1 ? "s" : ""}`}
        </span>
        <button
          onClick={onContinue}
          disabled={rooms.length === 0}
          className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity disabled:opacity-40 hover:opacity-80"
        >
          Continuar
          <Truck className="size-4" />
        </button>
      </div>
    </div>
  );
}
