"""MovePlannerStateMiddleware.

The filename is kept for compatibility with the existing runtime import, but
the schema now describes the moving-planner canvas: home profile, rooms,
inventory items, moving boxes, filters, and selections.

CopilotKit state snapshots replace the frontend state after agent turns. If
these keys are not declared on the LangGraph state schema, the visual canvas
can get wiped back to messages-only after a run. This middleware contributes
the canvas keys so frontend tools and backend tools can share one state object.
"""

from __future__ import annotations

from typing import Annotated, Any, Optional

from langchain.agents.middleware.types import AgentMiddleware, AgentState
from typing_extensions import NotRequired, TypedDict


def _replace(_left: Any, right: Any) -> Any:
    return right


class _HomeProfile(TypedDict, total=False):
    currentHome: str
    newHome: str
    moveDate: str


class _MoveRoom(TypedDict, total=False):
    id: str
    name: str
    kind: str
    notes: str


class _MoveItem(TypedDict, total=False):
    id: str
    name: str
    room: str
    furniture: str
    category: str
    quantity: int
    fragile: bool
    bulky: bool
    priority: str
    decision: str
    packingStatus: str
    boxId: str
    notes: str


class _MovingBox(TypedDict, total=False):
    id: str
    alias: str
    originRoom: str
    destinationRoom: str
    items: list[str]
    packedItems: list[str]
    fragile: bool
    weightEstimate: str
    packingInstructions: list[str]
    status: str


class _MoveFilter(TypedDict, total=False):
    room: str
    decision: str
    search: str


class _Header(TypedDict, total=False):
    title: str
    subtitle: str


class LeadCanvasState(AgentState):
    """Extended state for the move-planning canvas.

    The class name stays the same so `runtime.py` does not need a wider rename.
    """

    profile: NotRequired[Annotated[_HomeProfile, _replace]]
    rooms: NotRequired[Annotated[list[_MoveRoom], _replace]]
    items: NotRequired[Annotated[list[_MoveItem], _replace]]
    boxes: NotRequired[Annotated[list[_MovingBox], _replace]]
    filter: NotRequired[Annotated[_MoveFilter, _replace]]
    selectedBoxId: NotRequired[Annotated[Optional[str], _replace]]
    highlightedItemIds: NotRequired[Annotated[list[str], _replace]]
    header: NotRequired[Annotated[_Header, _replace]]


class LeadStateMiddleware(AgentMiddleware[LeadCanvasState, Any]):  # type: ignore[type-arg]
    """Contributes the move canvas state schema.

    No auto-hydration is performed. The user's onboarding description is the
    source of truth for the first inventory.
    """

    state_schema = LeadCanvasState
