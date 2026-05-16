export type ItemDecision =
  | "take"
  | "sell"
  | "donate"
  | "discard"
  | "undecided";

export type PackingStatus = "unpacked" | "suggested" | "packed";

export type BoxStatus =
  | "suggested"
  | "packing"
  | "sealed"
  | "loaded"
  | "delivered"
  | "unpacked";

export type WeightEstimate = "light" | "medium" | "heavy";

export interface HomeProfile {
  currentHome: string;
  newHome: string;
  moveDate?: string;
}

export interface MoveRoom {
  id: string;
  name: string;
  kind: string;
  notes?: string;
}

export interface MoveItem {
  id: string;
  name: string;
  room: string;
  furniture?: string;
  category: string;
  quantity: number;
  fragile: boolean;
  bulky: boolean;
  priority: "essential" | "normal" | "low";
  decision: ItemDecision;
  packingStatus: PackingStatus;
  boxId?: string;
  notes?: string;
}

export interface MovingBox {
  id: string;
  alias: string;
  originRoom: string;
  destinationRoom?: string;
  items: string[];
  packedItems: string[];
  fragile: boolean;
  weightEstimate: WeightEstimate;
  packingInstructions: string[];
  status: BoxStatus;
}

export interface MoveFilter {
  room: string;
  decision: ItemDecision | "all";
  search: string;
}

export interface MoveState {
  profile: HomeProfile;
  rooms: MoveRoom[];
  items: MoveItem[];
  boxes: MovingBox[];
  filter: MoveFilter;
  selectedBoxId: string | null;
  highlightedItemIds: string[];
  header: { title: string; subtitle: string };
}

export interface ItemSuggestion {
  id: string;
  name: string;
  category: string;
  quantity: number;
  fragile: boolean;
}

export interface SuggestionPayload {
  roomId: string;
  roomName: string;
  suggestions: ItemSuggestion[];
}
