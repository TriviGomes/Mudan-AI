import type { MoveFilter, MoveState } from "./types";

export const emptyMoveFilter: MoveFilter = {
  room: "all",
  decision: "all",
  search: "",
};

export const initialMoveState: MoveState = {
  profile: {
    currentHome: "",
    newHome: "",
  },
  rooms: [],
  items: [],
  boxes: [],
  filter: emptyMoveFilter,
  selectedBoxId: null,
  highlightedItemIds: [],
  header: {
    title: "Move Planner",
    subtitle: "Describe your home and I will turn it into a packing plan.",
  },
};
