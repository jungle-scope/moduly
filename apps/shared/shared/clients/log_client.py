import os
import uuid
from typing import Any, Dict, Optional

import httpx


class LogClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or os.getenv("LOG_SYSTEM_URL", "http://localhost:8002")
        # Ensure no trailing slash
        self.base_url = self.base_url.rstrip("/")

    async def create_run_log(self, data: Dict[str, Any]) -> Optional[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.base_url}/logs/runs", json=data)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"[LogClient] Error creating run log: {e}")
                return None

    async def update_run_log(
        self, run_id: uuid.UUID, data: Dict[str, Any]
    ) -> Optional[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/logs/runs/{str(run_id)}", json=data
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"[LogClient] Error updating run log: {e}")
                return None

    async def create_node_log(
        self, run_id: uuid.UUID, data: Dict[str, Any]
    ) -> Optional[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/logs/runs/{str(run_id)}/nodes", json=data
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"[LogClient] Error creating node log: {e}")
                return None

    async def update_node_log(
        self, run_id: uuid.UUID, node_id_or_uuid: str, data: Dict[str, Any]
    ) -> Optional[Dict]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/logs/runs/{str(run_id)}/nodes/{node_id_or_uuid}",
                    json=data,
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"[LogClient] Error updating node log: {e}")
                return None


# Singleton instance for easy usage
log_client = LogClient()
