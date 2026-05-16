"""Backend helper tools for the Move Planner agent."""

from __future__ import annotations

import json
from typing import Annotated, Any, Dict, List

from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command


@tool
def find_move_item(
    query: Annotated[
        str,
        "Name, category, room, or furniture text to search in state.items.",
    ],
    state: Annotated[Dict[str, Any], InjectedState] = None,
) -> str:
    """Find inventory items in the current move canvas state."""
    items_raw = (state or {}).get("items") or []
    items: List[Dict[str, Any]] = [
        item for item in items_raw if isinstance(item, dict) and item.get("id")
    ]
    q = (query or "").strip().lower()
    if not items:
        return json.dumps({"error": "no inventory items yet"})
    if not q:
        return json.dumps({"matches": [], "hint": "query was empty"})

    matches = []
    for item in items:
        haystack = " ".join(
            str(item.get(key) or "")
            for key in ("name", "room", "furniture", "category", "notes")
        ).lower()
        if q in haystack:
            matches.append(
                {
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "room": item.get("room"),
                    "category": item.get("category"),
                    "decision": item.get("decision"),
                    "boxId": item.get("boxId"),
                }
            )
    return json.dumps({"matches": matches[:12]}, ensure_ascii=False)


@tool
def packing_safety_tip(
    category: Annotated[
        str,
        "Item category, e.g. glassware, plates, books, cables, clothing, liquids.",
    ],
    item_names: Annotated[
        List[str],
        "Specific item names in the box.",
    ] = [],
) -> str:
    """Return concise packing instructions for a category."""
    cat = (category or "").lower()
    names = ", ".join(item_names[:5])
    prefix = f"For {names}: " if names else ""

    if any(word in cat for word in ("glass", "cup", "mug", "plate", "dish")):
        return (
            prefix
            + "wrap each piece individually, line the box bottom, pack plates vertically, "
            "fill gaps with paper or towels, and mark every side FRAGILE."
        )
    if any(word in cat for word in ("book", "paper", "document")):
        return (
            prefix
            + "use small boxes only, keep the weight low, and pack books flat or spine-down."
        )
    if any(word in cat for word in ("pan", "pot", "appliance", "heavy")):
        return (
            prefix
            + "keep heavy items in a dedicated medium box, cushion handles and lids, "
            "and avoid adding fragile pieces."
        )
    if any(word in cat for word in ("cable", "electronics", "remote")):
        return (
            prefix
            + "bag cables by device, label each bag, tape remotes to their device group, "
            "and keep chargers in one essentials pouch."
        )
    if any(word in cat for word in ("liquid", "cleaning", "bathroom")):
        return (
            prefix
            + "tighten caps, tape lids, bag liquids upright, and keep them away from clothes, "
            "books, and electronics."
        )
    if any(word in cat for word in ("clothing", "clothes", "shoes")):
        return (
            prefix
            + "use suitcases or soft bags, keep seasonal clothing grouped, and label shoes separately."
        )
    return (
        prefix
        + "group similar items, avoid overfilling, fill empty space, and label origin and destination rooms."
    )


@tool
def optimize_packing_plan(
    constraints: Annotated[
        Dict[str, Any],
        "Packing constraints such as defaultDestinationRoom, maxWeight, moveDate, or special notes.",
    ],
    tool_call_id: Annotated[str, InjectedToolCallId] = "",
    state: Annotated[Dict[str, Any], InjectedState] = None,
) -> Command:
    """Optimize the box plan by executing the optimizer in Daytona.

    Daytona is required for the hackathon path. The tool updates `boxes` and
    item packingStatus/boxId in state so the canvas reflects the sandbox output.
    """
    items: List[Dict[str, Any]] = [
        item
        for item in ((state or {}).get("items") or [])
        if isinstance(item, dict) and item.get("id")
    ]
    if not items:
        return Command(
            update={
                "messages": [
                    ToolMessage(
                        content="Daytona optimization skipped: no inventory items yet.",
                        tool_call_id=tool_call_id,
                    )
                ]
            }
        )

    try:
        from .daytona_optimizer import DaytonaNotConfigured, optimize_with_daytona

        result = optimize_with_daytona(items, constraints or {})
        boxes = result.get("boxes") or []
        if not isinstance(boxes, list) or not boxes:
            raise RuntimeError("Daytona returned no boxes.")

        item_to_box: Dict[str, str] = {}
        packed_items: set[str] = set()
        for box in boxes:
            if not isinstance(box, dict):
                continue
            box_id = str(box.get("id") or "")
            for item_id in box.get("items") or []:
                item_to_box[str(item_id)] = box_id
            for item_id in box.get("packedItems") or []:
                packed_items.add(str(item_id))

        updated_items: List[Dict[str, Any]] = []
        for item in items:
            item_id = str(item.get("id"))
            box_id = item_to_box.get(item_id)
            if box_id:
                updated_items.append(
                    {
                        **item,
                        "boxId": box_id,
                        "packingStatus": "packed"
                        if item_id in packed_items
                        else "suggested",
                    }
                )
            else:
                updated_items.append(item)

        warnings = result.get("warnings") or []
        warning_text = f" Warnings: {len(warnings)}." if warnings else ""
        return Command(
            update={
                "boxes": boxes,
                "items": updated_items,
                "messages": [
                    ToolMessage(
                        content=(
                            f"Daytona optimized {len(boxes)} boxes from "
                            f"{len(items)} inventory items.{warning_text}"
                        ),
                        tool_call_id=tool_call_id,
                    )
                ],
            }
        )
    except DaytonaNotConfigured as e:
        return Command(
            update={
                "messages": [
                    ToolMessage(
                        content=f"Daytona optimization failed: {e}",
                        tool_call_id=tool_call_id,
                    )
                ]
            }
        )
    except Exception as e:  # noqa: BLE001
        return Command(
            update={
                "messages": [
                    ToolMessage(
                        content=f"Daytona optimization failed: {e}",
                        tool_call_id=tool_call_id,
                    )
                ]
            }
        )


def load_moving_tools() -> List[Any]:
    tools: List[Any] = [find_move_item, packing_safety_tip, optimize_packing_plan]
    print(f"Moving tools loaded: {len(tools)} tools")
    return tools
