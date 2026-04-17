"""
signaling.py — WebSocket signaling server for WebRTC peer connections.

Each meeting room is a "room". When two peers connect to the same room:
  1. First peer joins → gets role "host", waits
  2. Second peer joins → gets role "participant", triggers offer flow
  3. Host creates offer → sends to participant via server
  4. Participant sends answer back
  5. Both sides exchange ICE candidates
  6. WebRTC peer connection established ✅

Message format (JSON):
  { "type": "join",      "room": "<meetingId>", "userId": "<name>" }
  { "type": "offer",     "sdp": {...} }
  { "type": "answer",    "sdp": {...} }
  { "type": "ice",       "candidate": {...} }
  { "type": "leave" }

Server → client messages:
  { "type": "role",        "role": "host"|"participant" }
  { "type": "peer_joined", "userId": "<name>" }
  { "type": "peer_left" }
  { "type": "offer",       "sdp": {...} }
  { "type": "answer",      "sdp": {...} }
  { "type": "ice",         "candidate": {...} }
"""

import json
import logging
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger("signaling")

# room_id → { "host": WebSocket | None, "participant": WebSocket | None }
rooms: Dict[str, Dict] = {}


async def _send(ws: WebSocket, data: dict):
    try:
        await ws.send_text(json.dumps(data))
    except Exception:
        pass


@router.websocket("/ws/{room_id}")
async def signaling_ws(websocket: WebSocket, room_id: str):
    await websocket.accept()

    # Initialise room if needed
    if room_id not in rooms:
        rooms[room_id] = {"host": None, "participant": None}

    room = rooms[room_id]
    my_role: Optional[str] = None
    my_user_id: str = "Unknown"

    try:
        # ── Assign role ──────────────────────────────────────────────────────
            # Initialise room if needed
        if room_id not in rooms:
            rooms[room_id] = {
                "host": websocket,
                "participant": None
            }
            my_role = "host"
        else:
            room = rooms[room_id]

            if room["host"] is None:
                room["host"] = websocket
                my_role = "host"
            elif room["participant"] is None:
                room["participant"] = websocket
                my_role = "participant"
            else:
                await _send(websocket, {"type": "error", "message": "Room is full"})
                await websocket.close()
                return

        room = rooms[room_id]

        await _send(websocket, {"type": "role", "role": my_role})
        logger.info(f"[{room_id}] {my_role} connected")

        # ── Message loop ─────────────────────────────────────────────────────
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "join":
                my_user_id = msg.get("userId", my_role)
                logger.info(f"[{room_id}] {my_role} identified as '{my_user_id}'")

                # Tell the other peer someone joined
                peer_ws = room["participant"] if my_role == "host" else room["host"]
                if peer_ws:
                    await _send(peer_ws, {
                        "type": "peer_joined",
                        "userId": my_user_id,
                        "role": my_role,
                    })
                    # If participant just joined, tell host to create offer
                    if my_role == "participant":
                        await _send(room["host"], {"type": "make_offer"})

            elif msg_type in ("offer", "answer", "ice"):
                # Relay directly to the other peer
                peer_ws = room["participant"] if my_role == "host" else room["host"]
                if peer_ws:
                    await _send(peer_ws, msg)

            elif msg_type == "leave":
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[{room_id}] Error: {e}")
    finally:
        # Clean up slot
         if my_role and room_id in rooms:
            room = rooms[room_id]

            # Remove current user from room
            if my_role == "host":
                room["host"] = None
                peer_ws = room["participant"]
            else:
                room["participant"] = None
                peer_ws = room["host"]

            logger.info(f"[{room_id}] {my_role} disconnected")

            # Notify the remaining peer
            if peer_ws:
                await _send(peer_ws, {"type": "peer_left"})

            # Delete room ONLY if both users are gone
            if room["host"] is None and room["participant"] is None:
                del rooms[room_id]
                logger.info(f"[{room_id}] Room removed")