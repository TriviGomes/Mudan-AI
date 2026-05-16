import type { ItemDecision, MoveFilter, MoveItem, MovingBox } from "./types";

export function applyMoveFilter(items: MoveItem[], filter: MoveFilter) {
  const q = filter.search.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.room !== "all" && item.room !== filter.room) return false;
    if (filter.decision !== "all" && item.decision !== filter.decision) {
      return false;
    }
    if (!q) return true;
    return [
      item.name,
      item.room,
      item.furniture,
      item.category,
      item.notes,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });
}

export function roomNames(items: MoveItem[]) {
  return Array.from(new Set(items.map((item) => item.room).filter(Boolean)));
}

export function decisionCounts(items: MoveItem[]) {
  return {
    take: items.filter((item) => item.decision === "take").length,
    sell: items.filter((item) => item.decision === "sell").length,
    donate: items.filter((item) => item.decision === "donate").length,
    discard: items.filter((item) => item.decision === "discard").length,
    undecided: items.filter((item) => item.decision === "undecided").length,
  };
}

export function boxProgress(box: MovingBox) {
  if (box.items.length === 0) return 0;
  return Math.round((box.packedItems.length / box.items.length) * 100);
}

export function getRoomItemCount(items: MoveItem[], roomId: string): number {
  return items.filter((i) => i.room === roomId).length;
}

export function getRoomDecisionProgress(items: MoveItem[], roomId: string): number {
  const roomItems = items.filter((i) => i.room === roomId);
  if (roomItems.length === 0) return 0;
  const decided = roomItems.filter((i) => i.decision !== "undecided").length;
  return Math.round((decided / roomItems.length) * 100);
}

export function getOverallDecisionProgress(items: MoveItem[]): number {
  if (items.length === 0) return 0;
  const decided = items.filter((i) => i.decision !== "undecided").length;
  return Math.round((decided / items.length) * 100);
}

export function getTakeItems(items: MoveItem[]): MoveItem[] {
  return items.filter((i) => i.decision === "take");
}

export function getDecisionFilteredItems(items: MoveItem[], decision: ItemDecision | "all", roomId: string | "all"): MoveItem[] {
  return items.filter((i) => {
    if (roomId !== "all" && i.room !== roomId) return false;
    if (decision !== "all" && i.decision !== decision) return false;
    return true;
  });
}

export function moveProgress(items: MoveItem[], boxes: MovingBox[]) {
  const takeItems = items.filter((item) => item.decision === "take");
  const packed = takeItems.filter((item) => item.packingStatus === "packed");
  const sealed = boxes.filter((box) => box.status === "sealed").length;
  return {
    totalItems: items.length,
    takeItems: takeItems.length,
    packedItems: packed.length,
    boxes: boxes.length,
    sealedBoxes: sealed,
    fragileBoxes: boxes.filter((box) => box.fragile).length,
  };
}
