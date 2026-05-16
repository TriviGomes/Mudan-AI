"""Daytona-backed packing optimizer for Move Planner.

The hackathon thesis is that generated planning logic should run outside the
main app server. This module sends a deterministic optimizer script to a
Daytona sandbox, reads JSON back, and cleans the sandbox up.
"""

from __future__ import annotations

import json
import os
import textwrap
from typing import Any, Dict, List


class DaytonaNotConfigured(RuntimeError):
    """Raised when the required Daytona key is missing."""


def _optimizer_script(payload: Dict[str, Any]) -> str:
    """Return a self-contained Python script executed inside Daytona."""
    payload_json = json.dumps(payload, ensure_ascii=False)
    return textwrap.dedent(
        f"""
        import json
        from collections import defaultdict

        payload = json.loads({payload_json!r})
        items = payload.get("items", [])
        constraints = payload.get("constraints", {{}}) or {{}}

        TAKE_DECISIONS = {{"take", "undecided"}}
        CATEGORY_WEIGHT = {{
            "books": 3,
            "book": 3,
            "paper": 2,
            "documents": 2,
            "pans": 3,
            "pots": 3,
            "appliances": 3,
            "small appliances": 3,
            "clothing": 1,
            "clothes": 1,
            "shoes": 2,
            "glassware": 1,
            "plates": 2,
            "cups": 1,
            "cables": 1,
            "electronics": 2,
        }}

        def slug(value):
            return (
                str(value or "misc")
                .lower()
                .replace("&", "and")
                .replace("/", "-")
                .replace(" ", "-")
            )

        def item_weight(item):
            category = str(item.get("category") or "").lower()
            base = 2 if item.get("bulky") else 1
            for key, value in CATEGORY_WEIGHT.items():
                if key in category:
                    base = max(base, value)
            return base * max(int(item.get("quantity") or 1), 1)

        def weight_label(score):
            if score <= 5:
                return "light"
            if score <= 11:
                return "medium"
            return "heavy"

        def instructions_for(box_items, fragile):
            categories = " ".join(str(i.get("category") or "").lower() for i in box_items)
            names = [str(i.get("name") or "") for i in box_items if i.get("name")]
            out = []
            if fragile or any(w in categories for w in ["glass", "cup", "plate", "dish"]):
                out.extend([
                    "Wrap each fragile item individually.",
                    "Line the bottom and fill gaps with paper, towels, or clothing.",
                    "Label every side as FRAGILE and keep the box upright.",
                ])
            elif any(w in categories for w in ["book", "paper", "document"]):
                out.extend([
                    "Use a small box and keep the total weight low.",
                    "Pack books flat or spine-down to protect bindings.",
                ])
            elif any(w in categories for w in ["cable", "electronics", "remote"]):
                out.extend([
                    "Bag cables by device and label each bag.",
                    "Keep chargers, remotes, and adapters together.",
                ])
            elif any(w in categories for w in ["clothing", "clothes", "shoes"]):
                out.extend([
                    "Use suitcases or soft bags when available.",
                    "Keep seasonal clothing grouped and label shoes separately.",
                ])
            else:
                out.extend([
                    "Group similar items and fill empty space.",
                    "Label origin and destination rooms clearly.",
                ])
            if len(names) <= 4 and names:
                out.append("Contents: " + ", ".join(names) + ".")
            return out[:4]

        candidates = [
            item for item in items
            if str(item.get("decision") or "undecided") in TAKE_DECISIONS
        ]

        first_night = []
        fragile = []
        heavy = []
        electronics = []
        by_room_category = defaultdict(list)

        for item in candidates:
            name = str(item.get("name") or "").lower()
            category = str(item.get("category") or "").lower()
            priority = str(item.get("priority") or "normal")
            if priority == "essential" or any(w in name for w in ["toothbrush", "medication", "charger", "bedding", "towel"]):
                first_night.append(item)
            elif item.get("fragile") or any(w in category for w in ["glass", "cup", "plate", "dish"]):
                fragile.append(item)
            elif any(w in category for w in ["cable", "electronics", "remote"]):
                electronics.append(item)
            elif item_weight(item) >= 6:
                heavy.append(item)
            else:
                by_room_category[(item.get("room") or "General", item.get("category") or "General")].append(item)

        boxes = []

        def add_box(alias, group, status="suggested"):
            if not group:
                return
            room = group[0].get("room") or "General"
            score = sum(item_weight(i) for i in group)
            box = {{
                "id": "box-" + slug(alias),
                "alias": alias,
                "originRoom": room,
                "destinationRoom": constraints.get("defaultDestinationRoom") or room,
                "items": [i["id"] for i in group if i.get("id")],
                "packedItems": [],
                "fragile": any(bool(i.get("fragile")) for i in group),
                "weightEstimate": weight_label(score),
                "packingInstructions": instructions_for(group, any(bool(i.get("fragile")) for i in group)),
                "status": status,
            }}
            boxes.append(box)

        add_box("Box 1 - First night essentials", first_night)
        add_box("Box 2 - Kitchen fragile", fragile)
        add_box("Box 3 - Electronics and cables", electronics)

        heavy_by_room = defaultdict(list)
        for item in heavy:
            heavy_by_room[item.get("room") or "General"].append(item)
        for room, group in heavy_by_room.items():
            add_box(f"Box {{len(boxes) + 1}} - {{room}} heavy items", group)

        for (room, category), group in by_room_category.items():
            chunk = []
            score = 0
            for item in group:
                w = item_weight(item)
                if chunk and score + w > 12:
                    add_box(f"Box {{len(boxes) + 1}} - {{room}} {{category}}", chunk)
                    chunk = []
                    score = 0
                chunk.append(item)
                score += w
            add_box(f"Box {{len(boxes) + 1}} - {{room}} {{category}}", chunk)

        warnings = []
        for box in boxes:
            if box["fragile"] and box["weightEstimate"] == "heavy":
                warnings.append(f"{{box['alias']}} is fragile and heavy; split it if possible.")
            if len(box["items"]) == 0:
                warnings.append(f"{{box['alias']}} has no item ids.")

        print(json.dumps({{
            "boxes": boxes,
            "warnings": warnings,
            "engine": "daytona-python-sandbox",
        }}, ensure_ascii=False))
        """
    ).strip()


def optimize_with_daytona(
    items: List[Dict[str, Any]],
    constraints: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Run the packing optimizer in a Daytona sandbox and return parsed JSON."""
    if not os.getenv("DAYTONA_API_KEY"):
        raise DaytonaNotConfigured(
            "DAYTONA_API_KEY is required. Add it to .env and apps/agent/.env."
        )

    from daytona import Daytona

    daytona = Daytona()
    sandbox = daytona.create()
    try:
        response = sandbox.process.code_run(
            _optimizer_script({"items": items, "constraints": constraints or {}}),
            timeout=30,
        )
        if getattr(response, "exit_code", 0) != 0:
            raise RuntimeError(
                f"Daytona optimizer exited with {response.exit_code}: {response.result}"
            )
        raw = (getattr(response, "result", "") or "").strip()
        if not raw:
            artifacts = getattr(response, "artifacts", None)
            raw = (getattr(artifacts, "stdout", "") or "").strip()
        return json.loads(raw)
    finally:
        try:
            sandbox.delete()
        except Exception:
            pass
