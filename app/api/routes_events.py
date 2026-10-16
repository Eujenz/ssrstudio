import asyncio
import json
from typing import AsyncGenerator
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api", tags=["events"])

# Global in-memory subscriber queue list for SSE broadcasting
_event_subscribers = []


async def broadcast_event(event_type: str, data: dict):
    """Utility function to broadcast an event to all connected SSE clients."""
    payload = json.dumps({"event_type": event_type, "data": data}, ensure_ascii=False)
    for queue in list(_event_subscribers):
        try:
            await queue.put(payload)
        except Exception:
            pass


@router.get("/events")
async def events_stream(request: Request):
    """Native SSE endpoint broadcasting real-time workspace and pipeline events to clients."""
    queue = asyncio.Queue()
    _event_subscribers.append(queue)

    async def event_generator() -> AsyncGenerator[str, None]:
        # Send initial connected event
        init_payload = json.dumps({"status": "ready"})
        yield f"event: connected\ndata: {init_payload}\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: message\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment/ping
                    yield ": ping\n\n"
        finally:
            if queue in _event_subscribers:
                _event_subscribers.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
