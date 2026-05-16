"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AnimatePresence, motion } from "motion/react";
import {
  CopilotChatConfigurationProvider,
  CopilotSidebar,
  useAgent,
  useConfigureSuggestions,
  useDefaultRenderTool,
  useFrontendTool,
  useCopilotKit,
} from "@copilotkit/react-core/v2";

import { ThreadsDrawer } from "@/components/threads-drawer";
import drawerStyles from "@/components/threads-drawer/threads-drawer.module.css";
import { ToolFallbackCard } from "@/components/copilot/ToolFallbackCard";
import { PhaseIndicator } from "@/components/move/PhaseIndicator";
import { Phase1RoomSetup } from "@/components/move/Phase1RoomSetup";
import { Phase2RoomOverview } from "@/components/move/Phase2RoomOverview";
import { Phase2RoomDetail } from "@/components/move/Phase2RoomDetail";
import { Phase3Decisions } from "@/components/move/Phase3Decisions";
import { Phase4BoxPlanning } from "@/components/move/Phase4BoxPlanning";
import { SuggestItemsModal } from "@/components/move/SuggestItemsModal";

import { initialMoveState } from "@/lib/move/state";
import type {
  ItemDecision,
  ItemSuggestion,
  MoveItem,
  MoveRoom,
  MovingBox,
  MoveState,
  SuggestionPayload,
} from "@/lib/move/types";

// ─── Zod schemas ────────────────────────────────────────────────────────────

const itemShape = z.object({
  id: z.string(),
  name: z.string(),
  room: z.string(),
  furniture: z.string().optional(),
  category: z.string().default("general"),
  quantity: z.number().default(1),
  fragile: z.boolean().default(false),
  bulky: z.boolean().default(false),
  priority: z.enum(["essential", "normal", "low"]).default("normal"),
  decision: z
    .enum(["take", "sell", "donate", "discard", "undecided"])
    .default("undecided"),
  packingStatus: z.enum(["unpacked", "suggested", "packed"]).default("unpacked"),
  boxId: z.string().optional(),
  notes: z.string().optional(),
});

const roomShape = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string().default("room"),
  notes: z.string().optional(),
});

const boxShape = z.object({
  id: z.string(),
  alias: z.string(),
  originRoom: z.string(),
  destinationRoom: z.string().optional(),
  items: z.array(z.string()).default([]),
  packedItems: z.array(z.string()).default([]),
  fragile: z.boolean().default(false),
  weightEstimate: z.enum(["light", "medium", "heavy"]).default("medium"),
  packingInstructions: z.array(z.string()).default([]),
  status: z
    .enum(["suggested", "packing", "sealed", "loaded", "delivered", "unpacked"])
    .default("suggested"),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

// ─── InlineBoxCard (used by renderBoxPlan tool) ──────────────────────────────

function InlineBoxCard({ box }: { box: MovingBox }) {
  return (
    <div className="my-2 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{box.alias}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {box.originRoom}
            {box.destinationRoom ? ` → ${box.destinationRoom}` : ""} · {box.weightEstimate}
          </div>
        </div>
        {box.fragile && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] text-rose-800">
            frágil
          </span>
        )}
      </div>
      {box.packingInstructions.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {box.packingInstructions.map((ins) => (
            <li key={ins}>— {ins}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── CanvasInner ─────────────────────────────────────────────────────────────

function CanvasInner({ threadId }: { threadId?: string }) {
  useAgent();
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent();

  // Canvas state
  const [state, setCanvasState] = useState<MoveState>(() => initialMoveState);
  const updateState = setCanvasState;

  // Navigation state (ephemeral)
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // Suggestion modal
  const [suggestionPayload, setSuggestionPayload] = useState<SuggestionPayload | null>(null);
  const [checkedSuggestionIds, setCheckedSuggestionIds] = useState<Set<string>>(new Set());

  // ── injectPrompt ──────────────────────────────────────────────────────────

  const injectPrompt = useCallback(
    (prompt: string) => {
      if (!agent) return;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `msg-${Date.now()}`;
      agent.addMessage({ id, role: "user", content: prompt });
      void copilotkit.runAgent({ agent }).catch((error: unknown) => {
        console.error("injectPrompt: runAgent failed", error);
      });
    },
    [agent, copilotkit],
  );

  // ── Suggestions ───────────────────────────────────────────────────────────

  useConfigureSuggestions({
    available: "before-first-message",
    suggestions: [
      {
        title: "Tenho um apartamento de 2 quartos",
        message:
          "Tenho um apartamento de 2 quartos com sala, cozinha, lavanderia e escritório. Quais cômodos devo configurar?",
      },
      {
        title: "Casa com quintal",
        message:
          "Tenho uma casa com sala, cozinha, 3 quartos, banheiro, área de serviço, garagem e quintal.",
      },
    ],
  });

  // ── Frontend tools ────────────────────────────────────────────────────────

  useFrontendTool({
    name: "setMoveHeader",
    description: "Set the move-planning workspace header.",
    parameters: z.object({ title: z.string().optional(), subtitle: z.string().optional() }),
    handler: async ({ title, subtitle }) => {
      updateState((prev) => ({
        ...prev,
        header: {
          title: title ?? prev.header.title,
          subtitle: subtitle ?? prev.header.subtitle,
        },
      }));
      return "move header updated";
    },
  });

  useFrontendTool({
    name: "setHomeProfile",
    description: "Record the user's current home, new home, and optional moving date.",
    parameters: z.object({
      currentHome: z.string().optional(),
      newHome: z.string().optional(),
      moveDate: z.string().optional(),
    }),
    handler: async (profile) => {
      updateState((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...profile },
      }));
      return "home profile updated";
    },
  });

  useFrontendTool({
    name: "setRooms",
    description: "Replace the room list inferred during onboarding.",
    parameters: z.object({ rooms: z.array(roomShape) }),
    handler: async ({ rooms }) => {
      updateState((prev) => ({ ...prev, rooms: rooms as MoveRoom[] }));
      return `set ${rooms.length} rooms`;
    },
  });

  useFrontendTool({
    name: "setMoveItems",
    description: "Replace the full moving inventory.",
    parameters: z.object({ items: z.array(itemShape) }),
    handler: async ({ items }) => {
      updateState((prev) => ({ ...prev, items: items as MoveItem[] }));
      return `set ${items.length} inventory items`;
    },
  });

  useFrontendTool({
    name: "addMoveItems",
    description: "Append new inventory items without replacing existing ones.",
    parameters: z.object({ items: z.array(itemShape) }),
    handler: async ({ items }) => {
      updateState((prev) => ({
        ...prev,
        items: [...prev.items, ...(items as MoveItem[])],
      }));
      return `added ${items.length} inventory items`;
    },
  });

  useFrontendTool({
    name: "setMoveFilter",
    description: "Filter visible inventory.",
    parameters: z.object({
      room: z.string().optional(),
      decision: z.enum(["take", "sell", "donate", "discard", "undecided", "all"]).optional(),
      search: z.string().optional(),
    }),
    handler: async (patch) => {
      updateState((prev) => ({ ...prev, filter: { ...prev.filter, ...patch } }));
      return "move filter updated";
    },
  });

  useFrontendTool({
    name: "clearMoveFilters",
    description: "Clear all move inventory filters.",
    parameters: z.object({}),
    handler: async () => {
      updateState((prev) => ({
        ...prev,
        filter: { room: "all", decision: "all", search: "" },
      }));
      return "move filters cleared";
    },
  });

  useFrontendTool({
    name: "setMovingBoxes",
    description: "Replace all proposed moving boxes.",
    parameters: z.object({ boxes: z.array(boxShape) }),
    handler: async ({ boxes }) => {
      updateState((prev) => ({
        ...prev,
        boxes: boxes as MovingBox[],
        items: prev.items.map((item) => {
          const box = (boxes as MovingBox[]).find((b) => b.items.includes(item.id));
          if (!box) return item;
          return {
            ...item,
            boxId: box.id,
            packingStatus: (box.packedItems ?? []).includes(item.id) ? "packed" : "suggested",
          };
        }),
      }));
      setIsSuggesting(false);
      return `set ${boxes.length} boxes`;
    },
  });

  useFrontendTool({
    name: "updateMovingBox",
    description: "Patch one moving box by id.",
    parameters: z.object({ boxId: z.string(), patch: boxShape.partial().passthrough() }),
    handler: async ({ boxId, patch }) => {
      updateState((prev) => ({
        ...prev,
        boxes: prev.boxes.map((box) =>
          box.id === boxId ? { ...box, ...(patch as Partial<MovingBox>) } : box,
        ),
      }));
      return `updated ${boxId}`;
    },
  });

  useFrontendTool({
    name: "togglePackedItem",
    description: "Mark whether a specific item was actually packed into a box.",
    parameters: z.object({ boxId: z.string(), itemId: z.string(), packed: z.boolean() }),
    handler: async ({ boxId, itemId, packed }) => {
      handleTogglePacked(boxId, itemId, packed);
      return `${packed ? "packed" : "unpacked"} ${itemId} in ${boxId}`;
    },
  });

  useFrontendTool({
    name: "highlightMoveItems",
    description: "Visually highlight inventory items by id.",
    parameters: z.object({ itemIds: z.array(z.string()) }),
    handler: async ({ itemIds }) => {
      updateState((prev) => ({ ...prev, highlightedItemIds: itemIds }));
      return `highlighted ${itemIds.length} items`;
    },
  });

  useFrontendTool({
    name: "selectMovingBox",
    description: "Select a box in the box builder.",
    parameters: z.object({ boxId: z.string().nullable() }),
    handler: async ({ boxId }) => {
      updateState((prev) => ({ ...prev, selectedBoxId: boxId }));
      return boxId ? `selected ${boxId}` : "box selection cleared";
    },
  });

  useFrontendTool({
    name: "presentItemSuggestions",
    description:
      "Open a checklist modal showing suggested items for a room. Do NOT call addMoveItems yourself — the modal handles that after user confirmation.",
    parameters: z.object({
      roomId: z.string(),
      roomName: z.string(),
      suggestions: z.array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          category: z.string().default("geral"),
          quantity: z.number().default(1),
          fragile: z.boolean().default(false),
        }),
      ),
    }),
    handler: async ({ roomId, roomName, suggestions }) => {
      const withIds: ItemSuggestion[] = suggestions.map((s) => ({
        ...s,
        id: s.id ?? crypto.randomUUID(),
        category: s.category ?? "geral",
      }));
      setCheckedSuggestionIds(new Set(withIds.map((s) => s.id)));
      setSuggestionPayload({ roomId, roomName, suggestions: withIds });
      setIsSuggesting(false);
      return `Presented ${suggestions.length} suggestions for ${roomName}. Waiting for user selection.`;
    },
  });

  useFrontendTool({
    name: "renderBoxPlan",
    description: "Render an inline packing box plan in chat.",
    parameters: boxShape,
    render: ({ args }) => <InlineBoxCard box={args as MovingBox} />,
  });

  useDefaultRenderTool({
    render: ({ name, status, result, parameters }) => (
      <ToolFallbackCard name={name} status={status} result={result} parameters={parameters} />
    ),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleTogglePacked(boxId: string, itemId: string, packed: boolean) {
    updateState((prev) => ({
      ...prev,
      boxes: prev.boxes.map((box) => {
        if (box.id !== boxId) return box;
        const packedItems = packed
          ? Array.from(new Set([...box.packedItems, itemId]))
          : box.packedItems.filter((id) => id !== itemId);
        const status =
          packedItems.length === box.items.length && box.items.length > 0 ? "sealed" : "packing";
        return { ...box, packedItems, status };
      }),
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, packingStatus: packed ? "packed" : "suggested" } : item,
      ),
    }));
  }

  function handleDecide(itemId: string, decision: ItemDecision) {
    updateState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, decision } : item,
      ),
    }));
  }

  function handleAddItem(
    roomId: string,
    item: Omit<MoveItem, "id" | "room" | "decision" | "packingStatus">,
  ) {
    const newItem: MoveItem = {
      ...item,
      id: crypto.randomUUID(),
      room: roomId,
      decision: "undecided",
      packingStatus: "unpacked",
    };
    updateState((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  }

  function handleDeleteItem(itemId: string) {
    updateState((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
    }));
  }

  function handleMoveItemToBox(itemId: string, sourceBoxId: string, targetBoxId: string) {
    updateState((prev) => ({
      ...prev,
      boxes: prev.boxes.map((box) => {
        if (box.id === sourceBoxId) {
          return {
            ...box,
            items: box.items.filter((id) => id !== itemId),
            packedItems: box.packedItems.filter((id) => id !== itemId),
          };
        }
        if (box.id === targetBoxId) {
          return { ...box, items: [...box.items, itemId] };
        }
        return box;
      }),
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, boxId: targetBoxId } : item,
      ),
    }));
  }

  function handleConfirmSuggestions(selected: ItemSuggestion[]) {
    if (!suggestionPayload || selected.length === 0) {
      setSuggestionPayload(null);
      return;
    }
    const newItems: MoveItem[] = selected.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name,
      room: suggestionPayload.roomId,
      category: s.category,
      quantity: s.quantity,
      fragile: s.fragile,
      bulky: false,
      priority: "normal",
      decision: "undecided",
      packingStatus: "unpacked",
    }));
    updateState((prev) => ({ ...prev, items: [...prev.items, ...newItems] }));
    setSuggestionPayload(null);
  }

  function handleSuggestItems(room: MoveRoom) {
    setIsSuggesting(true);
    injectPrompt(
      `Suggest 8-12 common items found in a "${room.name}" (kind: ${room.kind}). ` +
        `Call presentItemSuggestions with roomId="${room.id}", roomName="${room.name}", ` +
        `and the suggestions list. Include realistic quantities and fragile flags. ` +
        `Think about what someone moving house typically owns in this room.`,
    );
  }

  function handleSuggestBoxPlan() {
    const takeItems = state.items.filter((i) => i.decision === "take");
    if (takeItems.length === 0) return;
    setIsSuggesting(true);
    injectPrompt(
      `Create a box plan for these ${takeItems.length} items marked "take": ` +
        JSON.stringify(takeItems.map((i) => ({ id: i.id, name: i.name, room: i.room, fragile: i.fragile, bulky: i.bulky }))) +
        `. Group fragile items separately. Label boxes clearly (e.g. "Box 1 – Kitchen fragile"). ` +
        `Call setMovingBoxes with the result.`,
    );
  }

  // Active room
  const activeRoom = useMemo(
    () => state.rooms.find((r) => r.id === activeRoomId),
    [state.rooms, activeRoomId],
  );
  const activeRoomItems = useMemo(
    () => state.items.filter((i) => i.room === activeRoomId),
    [state.items, activeRoomId],
  );
  const takeItems = useMemo(
    () => state.items.filter((i) => i.decision === "take"),
    [state.items],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="flex h-screen flex-col overflow-hidden bg-background px-6 py-6">
        <PhaseIndicator
          current={phase}
          onGoTo={(p) => {
            setPhase(p);
            setActiveRoomId(null);
          }}
        />

        {phase === 1 && (
          <Phase1RoomSetup
            rooms={state.rooms}
            onSetRooms={(rooms) => updateState((prev) => ({ ...prev, rooms }))}
            onContinue={() => setPhase(2)}
          />
        )}

        {phase === 2 && (
          <AnimatePresence mode="wait">
            {activeRoomId === null || !activeRoom ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col min-h-0"
              >
                <Phase2RoomOverview
                  rooms={state.rooms}
                  items={state.items}
                  onSelectRoom={setActiveRoomId}
                  onContinue={() => setPhase(3)}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeRoomId}
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col min-h-0"
              >
                <Phase2RoomDetail
                  room={activeRoom}
                  items={activeRoomItems}
                  isSuggesting={isSuggesting}
                  onBack={() => setActiveRoomId(null)}
                  onSuggestItems={() => handleSuggestItems(activeRoom)}
                  onAddItem={(item) => handleAddItem(activeRoom.id, item as Omit<MoveItem, "id" | "room" | "decision" | "packingStatus">)}
                  onDeleteItem={handleDeleteItem}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {phase === 3 && (
          <Phase3Decisions
            rooms={state.rooms}
            items={state.items}
            onDecide={handleDecide}
            onContinue={() => setPhase(4)}
          />
        )}

        {phase === 4 && (
          <Phase4BoxPlanning
            items={takeItems}
            boxes={state.boxes}
            selectedBoxId={state.selectedBoxId}
            isSuggesting={isSuggesting}
            chatOpen={chatOpen}
            onSelectBox={(id) => updateState((prev) => ({ ...prev, selectedBoxId: id }))}
            onTogglePacked={handleTogglePacked}
            onMoveItem={handleMoveItemToBox}
            onSuggestBoxPlan={handleSuggestBoxPlan}
            onToggleChat={() => setChatOpen((v) => !v)}
          />
        )}
      </main>

      {(phase === 1 || (phase === 4 && chatOpen)) && (
        <CopilotSidebar
          defaultOpen={phase === 1}
          width={430}
          input={{ disclaimer: () => null, className: "pb-6" }}
        />
      )}

      <SuggestItemsModal
        payload={suggestionPayload}
        checkedIds={checkedSuggestionIds}
        onToggle={(id) =>
          setCheckedSuggestionIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          })
        }
        onConfirm={handleConfirmSuggestions}
        onDismiss={() => setSuggestionPayload(null)}
      />
    </>
  );
}

// ─── MovePage ─────────────────────────────────────────────────────────────────

function MovePage() {
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  return (
    <div className={drawerStyles.layout}>
      <ThreadsDrawer agentId="default" threadId={threadId} onThreadChange={setThreadId} />
      <div className={drawerStyles.mainPanel}>
        <CopilotChatConfigurationProvider agentId="default" threadId={threadId}>
          <CanvasInner threadId={threadId} />
        </CopilotChatConfigurationProvider>
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <ClientOnly>
      <MovePage />
    </ClientOnly>
  );
}
