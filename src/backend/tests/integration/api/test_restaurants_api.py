import uuid
from unittest.mock import AsyncMock, patch

import pytest


class TestRestaurantsPublicAPI:
    @pytest.mark.asyncio
    async def test_read_public_restaurants_no_auth(self, client):
        mock_restaurants = [
            {
                "id": str(uuid.uuid4()),
                "name": "Шаурма у вуза",
                "address": "ул. Ленина 1",
                "vendor_id": str(uuid.uuid4()),
                "is_hiring": True,
            }
        ]

        with patch(
            "features.restaurants.api.service.get_all_restaurants_public",
            new_callable=AsyncMock,
            return_value=(mock_restaurants, 1),
        ) as mock_get:
            response = await client.get("/api/v1/restaurants/public")

        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["name"] == "Шаурма у вуза"
        assert body["pagination"]["total"] == 1
        mock_get.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_public_restaurants_returns_list(self, client):
        with patch(
            "features.restaurants.api.service.get_all_restaurants_public",
            new_callable=AsyncMock,
            return_value=([], 0),
        ):
            response = await client.get("/api/v1/restaurants/public")

        assert response.status_code == 200
        body = response.json()
        assert body["data"] == []
        assert body["pagination"]["total"] == 0

    @pytest.mark.asyncio
    async def test_read_public_restaurants_with_filters(self, client):
        with patch(
            "features.restaurants.api.service.get_all_restaurants_public",
            new_callable=AsyncMock,
            return_value=([], 0),
        ) as mock_get:
            response = await client.get("/api/v1/restaurants/public?is_open=true&is_hiring=true")

        assert response.status_code == 200
        mock_get.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_public_restaurant_by_display_id(self, client):
        restaurant = {
            "id": str(uuid.uuid4()),
            "display_id": "test-cafe",
            "name": "Test Cafe",
            "address": "Street 1",
            "vendor_id": str(uuid.uuid4()),
            "is_hiring": False,
        }

        with patch(
            "features.restaurants.api.service.get_restaurant_public",
            new_callable=AsyncMock,
            return_value=restaurant,
        ) as mock_get:
            response = await client.get("/api/v1/restaurants/public/test-cafe")

        assert response.status_code == 200
        assert response.json()["data"]["display_id"] == "test-cafe"
        mock_get.assert_awaited_once()
        assert mock_get.call_args.kwargs["identifier"] == "test-cafe"


class TestRestaurantsAPI:
    @pytest.mark.asyncio
    async def test_create_restaurant(self, vendor_client):
        client, vendor_profile = vendor_client

        mock_restaurant = {
            "id": str(uuid.uuid4()),
            "name": "New Sushi",
            "address": "Street 1",
            "vendor_id": str(uuid.uuid4()),
        }

        with patch(
            "features.restaurants.api.service.create_restaurant_for_vendor",
            new_callable=AsyncMock,
            return_value=mock_restaurant,
        ) as mock_register:
            response = await client.post(
                "/api/v1/restaurants/",
                json={"name": "New Sushi", "address": "Street 1"},
            )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["name"] == "New Sushi"
        mock_register.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_restaurant(self, vendor_client):
        client, vendor_profile = vendor_client
        restaurant_id = uuid.uuid4()

        mock_restaurant = {
            "id": str(restaurant_id),
            "name": "Updated Sushi",
            "address": "Street 1",
            "vendor_id": str(uuid.uuid4()),
        }

        with patch(
            "features.restaurants.api.service.update_restaurant_for_vendor",
            new_callable=AsyncMock,
            return_value=mock_restaurant,
        ) as mock_update:
            response = await client.patch(
                f"/api/v1/restaurants/{restaurant_id}", json={"name": "Updated Sushi"}
            )

        assert response.status_code == 200
        assert response.json()["data"]["name"] == "Updated Sushi"
        mock_update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_my_restaurants(self, vendor_client):
        client, vendor_profile = vendor_client

        with patch(
            "features.restaurants.api.service.get_my_restaurants",
            new_callable=AsyncMock,
            return_value=([], 0),
        ) as mock_get:
            response = await client.get("/api/v1/restaurants/")

        assert response.status_code == 200
        assert response.json()["data"] == []
        mock_get.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_restaurant_requires_auth(self, client):
        response = await client.post(
            "/api/v1/restaurants/", json={"name": "Test", "address": "Addr"}
        )
        assert response.status_code == 401
