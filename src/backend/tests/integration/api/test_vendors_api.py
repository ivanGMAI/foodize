import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from shared.enums.moderation_status import ModerationStatus


class TestVendorsAPI:
    @pytest.mark.asyncio
    async def test_create_vendor(self, client: AsyncClient, as_vendor):
        mock_vendor = {
            "id": str(uuid.uuid4()),
            "user_id": str(as_vendor.id),
            "approval_status": ModerationStatus.PENDING.value,
            "rejection_reason": None,
        }

        with patch(
            "features.vendors.api.service.register_vendor",
            new_callable=AsyncMock,
            return_value=mock_vendor,
        ) as mock_add:
            response = await client.post("/api/v1/vendors/", json={})

        assert response.status_code == 201
        assert response.json()["data"]["approval_status"] == ModerationStatus.PENDING.value
        mock_add.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_my_vendor_profile(self, vendor_client):
        client, vendor_profile = vendor_client
        vendor_profile.approval_status = ModerationStatus.APPROVED.value

        response = await client.get("/api/v1/vendors/")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["approval_status"] == ModerationStatus.APPROVED.value

    @pytest.mark.asyncio
    async def test_create_vendor_requires_permission(self, client: AsyncClient, as_user):
        response = await client.post("/api/v1/vendors/", json={})
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_vendor_requires_auth(self, client: AsyncClient):
        response = await client.post("/api/v1/vendors/", json={"description": "x"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_read_my_vendor_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/vendors/")
        assert response.status_code == 401
