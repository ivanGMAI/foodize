"""
Demo seed script. Run from repo root:
    cd src/backend && uv run python ../../tools/seed.py
Or via Makefile:
    make seed
"""

import asyncio
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "backend"))

from sqlalchemy import select

from database import db_helper
from features.favorites.crud import create_favorite, get_favorite
from features.menu.crud import (
    create_menu_item,
    create_option_group,
    get_menu_item_by_id,
)
from features.menu.models import MenuItem
from features.menu.schemas import MenuItemCreate, MenuItemOptionGroupCreate
from features.orders.models import Order, OrderItem, OrderItemOption
from features.promos.crud import create_promo
from features.promos.schemas import PromoCreate
from features.restaurants.crud import create_restaurant
from features.restaurants.models import Restaurant
from features.restaurants.schemas import RestaurantCreate
from features.reviews.crud import create_review, get_restaurant_avg_rating
from features.reviews.models import Review
from features.reviews.schemas import ReviewCreate
from features.staff.crud import create_staff_profile, get_staff_profile_by_user_id
from features.users.crud import create_user, update_user
from features.users.models import User
from features.users.schemas import UserCreate, UserUpdate
from features.vendors.crud import create_vendor_profile, get_vendor_by_user_id
from features.vendors.schemas import VendorCreate
from shared.enums.category import Category
from shared.enums.order_status import OrderStatus
from shared.permissions import (
    ADMIN_PERMISSIONS,
    CUSTOMER_PERMISSIONS,
    VENDOR_PERMISSIONS,
    permissions_with,
    serialize_permissions,
)

OPTION_GROUP_PRESETS = {
    "Шаурма классик": [
        {
            "name": "Соус",
            "selection_type": "single",
            "is_required": True,
            "min_selected": 1,
            "max_selected": 1,
            "sort_order": 10,
            "options": [
                {"name": "Чесночный", "price_delta": 0, "sort_order": 0},
                {"name": "Томатный", "price_delta": 0, "sort_order": 1},
                {"name": "Острый", "price_delta": 15, "sort_order": 2},
            ],
        },
        {
            "name": "Добавки",
            "selection_type": "multiple",
            "is_required": False,
            "min_selected": 0,
            "max_selected": 2,
            "sort_order": 20,
            "options": [
                {"name": "Сыр", "price_delta": 40, "sort_order": 0},
                {"name": "Халапеньо", "price_delta": 25, "sort_order": 1},
            ],
        },
    ],
    "Чизбургер": [
        {
            "name": "Соус",
            "selection_type": "single",
            "is_required": True,
            "min_selected": 1,
            "max_selected": 1,
            "sort_order": 10,
            "options": [
                {"name": "Кетчуп", "price_delta": 0, "sort_order": 0},
                {"name": "Майонез", "price_delta": 0, "sort_order": 1},
                {"name": "Барбекю", "price_delta": 20, "sort_order": 2},
            ],
        },
        {
            "name": "Дополнительно",
            "selection_type": "multiple",
            "is_required": False,
            "min_selected": 0,
            "max_selected": 3,
            "sort_order": 20,
            "options": [
                {"name": "Бекон", "price_delta": 60, "sort_order": 0},
                {"name": "Грибы", "price_delta": 35, "sort_order": 1},
            ],
        },
    ],
    "Ролл Калифорния": [
        {
            "name": "Соус",
            "selection_type": "single",
            "is_required": True,
            "min_selected": 1,
            "max_selected": 1,
            "sort_order": 10,
            "options": [
                {"name": "Соевый", "price_delta": 0, "sort_order": 0},
                {"name": "Унаги", "price_delta": 20, "sort_order": 1},
            ],
        },
    ],
    "Маргарита": [
        {
            "name": "Дополнительный сыр",
            "selection_type": "single",
            "is_required": False,
            "min_selected": 0,
            "max_selected": 1,
            "sort_order": 10,
            "options": [
                {"name": "Пармезан", "price_delta": 50, "sort_order": 0},
            ],
        },
    ],
}


async def _create_sample_option_groups(session, item):
    presets = OPTION_GROUP_PRESETS.get(item.name)
    if not presets:
        return []
    created_groups = []
    for preset in presets:
        group = await create_option_group(
            session,
            item,
            MenuItemOptionGroupCreate(**preset),
        )
        created_groups.append(group)
    return created_groups


SEED_USERS = [
    {
        "name": "Алексей Смирнов",
        "first_name": "Алексей",
        "last_name": "Смирнов",
        "middle_name": "Игоревич",
        "email": "admin@foodize.dev",
        "phone_number": "+70000000001",
        "password": "admin1234",
        "role": "admin",
    },
    {
        "name": "Дмитрий Козлов",
        "first_name": "Дмитрий",
        "last_name": "Козлов",
        "middle_name": "Андреевич",
        "email": "vendor1@foodize.dev",
        "phone_number": "+70000000002",
        "password": "vendor1234",
        "role": "vendor",
    },
    {
        "name": "Ирина Новикова",
        "first_name": "Ирина",
        "last_name": "Новикова",
        "middle_name": "Сергеевна",
        "email": "vendor2@foodize.dev",
        "phone_number": "+70000000003",
        "password": "vendor1234",
        "role": "vendor",
    },
    {
        "name": "Артём Петров",
        "first_name": "Артём",
        "last_name": "Петров",
        "middle_name": "Викторович",
        "email": "staff@foodize.dev",
        "phone_number": "+70000000004",
        "password": "staff1234",
        "role": "staff",
    },
    {
        "name": "Мария Соколова",
        "first_name": "Мария",
        "last_name": "Соколова",
        "middle_name": "Олеговна",
        "email": "customer1@foodize.dev",
        "phone_number": "+70000000005",
        "password": "customer1234",
        "role": "customer",
    },
    {
        "name": "Андрей Волков",
        "first_name": "Андрей",
        "last_name": "Волков",
        "middle_name": "Николаевич",
        "email": "customer2@foodize.dev",
        "phone_number": "+70000000006",
        "password": "customer1234",
        "role": "customer",
    },
    {
        "name": "Екатерина Лебедева",
        "first_name": "Екатерина",
        "last_name": "Лебедева",
        "middle_name": "Дмитриевна",
        "email": "customer3@foodize.dev",
        "phone_number": "+70000000007",
        "password": "customer1234",
        "role": "customer",
    },
    {
        "name": "Тестовый Супер",
        "first_name": "Тестовый",
        "last_name": "Супер",
        "middle_name": None,
        "email": "superuser@foodize.dev",
        "phone_number": "+70000000099",
        "password": "super1234",
        "role": "superuser",
    },
]

SEED_RESTAURANTS = [
    {
        "vendor_index": 0,
        "name": "Шаурма у Ашота",
        "address": "ул. Ленина, д. 1, ТЦ «Центральный»",
        "description": (
            "Настоящая уличная шаурма по армянскому рецепту. "
            "Готовим только из свежего мяса, лаваш выпекаем сами каждое утро. "
            "Работаем с 2015 года."
        ),
        "is_hiring": True,
        "avg_prep_time_minutes": 7,
        "max_active_orders": 12,
        "items": [
            {
                "name": "Шаурма классик",
                "description": "Говядина, свежие овощи, фирменный соус, лаваш",
                "price": 250,
                "category": Category.SHAURMA,
                "prep_time_minutes": 5,
            },
            {
                "name": "Шаурма с курицей",
                "description": "Куриное филе гриль, помидоры, огурцы, сыр, майонез",
                "price": 280,
                "category": Category.SHAURMA,
                "prep_time_minutes": 5,
            },
            {
                "name": "Шаурма двойная",
                "description": "Двойная порция мяса, два вида соуса",
                "price": 380,
                "category": Category.SHAURMA,
                "prep_time_minutes": 7,
            },
            {
                "name": "Картофель фри",
                "description": "Хрустящий картофель, соль, специи",
                "price": 120,
                "category": Category.SNACK,
                "prep_time_minutes": 7,
            },
            {
                "name": "Coca-Cola 0.5",
                "description": "Газированный напиток",
                "price": 80,
                "category": Category.DRINK,
                "prep_time_minutes": 1,
            },
            {
                "name": "Чай с мятой",
                "description": "Горячий чай с мятой и лимоном",
                "price": 60,
                "category": Category.DRINK,
                "prep_time_minutes": 3,
            },
        ],
        "promos": [
            {
                "code": "SHAUR10",
                "discount_type": "PERCENT",
                "discount_value": 10,
                "max_uses": 100,
            },
            {
                "code": "FIRST50",
                "discount_type": "FIXED",
                "discount_value": 50,
                "max_uses": 50,
            },
        ],
    },
    {
        "vendor_index": 0,
        "name": "Бургерная «Котлета»",
        "address": "пр. Мира, д. 42, 1 этаж",
        "description": (
            "Авторские бургеры с фермерской говядиной. "
            "Котлеты готовятся вручную, булочки печём сами. "
            "Нет ничего лишнего — только мясо, хлеб и вкус."
        ),
        "is_hiring": False,
        "avg_prep_time_minutes": 12,
        "max_active_orders": 18,
        "items": [
            {
                "name": "Чизбургер",
                "description": "Говяжья котлета, чеддер, маринованные огурцы, горчица",
                "price": 320,
                "category": Category.BURGER,
                "prep_time_minutes": 8,
            },
            {
                "name": "Двойной бургер",
                "description": "Две котлеты по 150г, двойной чеддер, соус барбекю",
                "price": 480,
                "category": Category.BURGER,
                "prep_time_minutes": 10,
            },
            {
                "name": "Куриный бургер",
                "description": "Куриное филе, салат, томаты, соус ранч",
                "price": 290,
                "category": Category.BURGER,
                "prep_time_minutes": 8,
            },
            {
                "name": "Картофель фри",
                "description": "Картофель фри с фирменной солью",
                "price": 150,
                "category": Category.SNACK,
                "prep_time_minutes": 7,
            },
            {
                "name": "Луковые кольца",
                "description": "Хрустящие луковые кольца в панировке",
                "price": 140,
                "category": Category.SNACK,
                "prep_time_minutes": 8,
            },
            {
                "name": "Молочный коктейль",
                "description": "Ванильный, шоколадный или клубничный",
                "price": 180,
                "category": Category.DRINK,
                "prep_time_minutes": 3,
            },
            {
                "name": "Лимонад домашний",
                "description": "Лимон, мята, имбирь, сахарный сироп",
                "price": 130,
                "category": Category.DRINK,
                "prep_time_minutes": 2,
            },
        ],
        "promos": [
            {
                "code": "BURGER15",
                "discount_type": "PERCENT",
                "discount_value": 15,
                "max_uses": 200,
            },
        ],
    },
    {
        "vendor_index": 1,
        "name": "Суши-бар «Токио»",
        "address": "ул. Садовая, д. 15, ТРЦ «Галерея»",
        "description": (
            "Японская кухня в центре города. "
            "Роллы готовит шеф-повар с 10-летним опытом работы в Токио. "
            "Рыба доставляется ежедневно, рис — только японский."
        ),
        "is_hiring": True,
        "avg_prep_time_minutes": 20,
        "max_active_orders": 10,
        "items": [
            {
                "name": "Ролл Калифорния",
                "description": "Краб, авокадо, огурец, икра тобико",
                "price": 350,
                "category": Category.SUSHI,
                "prep_time_minutes": 15,
            },
            {
                "name": "Ролл Филадельфия",
                "description": "Лосось, сливочный сыр, огурец",
                "price": 420,
                "category": Category.SUSHI,
                "prep_time_minutes": 15,
            },
            {
                "name": "Ролл Дракон",
                "description": "Угорь, авокадо, огурец, соус унаги",
                "price": 480,
                "category": Category.SUSHI,
                "prep_time_minutes": 18,
            },
            {
                "name": "Нигири с лососем (2 шт)",
                "description": "Рис, свежий лосось, васаби",
                "price": 220,
                "category": Category.SUSHI,
                "prep_time_minutes": 10,
            },
            {
                "name": "Мисо-суп",
                "description": "Паста мисо, тофу, водоросли вакамэ",
                "price": 120,
                "category": Category.OTHER,
                "prep_time_minutes": 5,
            },
            {
                "name": "Зелёный чай",
                "description": "Японский зелёный чай сенча",
                "price": 90,
                "category": Category.DRINK,
                "prep_time_minutes": 2,
            },
            {
                "name": "Рамен с курицей",
                "description": "Бульон тонкоцу, куриное филе, яйцо аджицке, нори",
                "price": 390,
                "category": Category.OTHER,
                "prep_time_minutes": 20,
            },
        ],
        "promos": [
            {
                "code": "SUSHI20",
                "discount_type": "PERCENT",
                "discount_value": 20,
                "max_uses": 50,
            },
            {
                "code": "TOKYO100",
                "discount_type": "FIXED",
                "discount_value": 100,
                "max_uses": 30,
            },
        ],
    },
    {
        "vendor_index": 1,
        "name": "Пиццерия «Napoletano»",
        "address": "ул. Тверская, д. 8",
        "description": (
            "Неаполитанская пицца на дровяной печи. "
            "Тесто выдерживается 48 часов, томаты San Marzano, "
            "моцарелла Fior di Latte. Доставка за 25 минут или пицца бесплатно."
        ),
        "is_hiring": True,
        "avg_prep_time_minutes": 18,
        "max_active_orders": 14,
        "items": [
            {
                "name": "Маргарита",
                "description": "Томатный соус, моцарелла, базилик",
                "price": 450,
                "category": Category.PIZZA,
                "prep_time_minutes": 15,
            },
            {
                "name": "Пепперони",
                "description": "Томатный соус, моцарелла, пепперони",
                "price": 520,
                "category": Category.PIZZA,
                "prep_time_minutes": 15,
            },
            {
                "name": "Четыре сыра",
                "description": "Моцарелла, горгонзола, пармезан, рикотта",
                "price": 580,
                "category": Category.PIZZA,
                "prep_time_minutes": 17,
            },
            {
                "name": "Прошутто",
                "description": "Томатный соус, моцарелла, пармская ветчина, руккола",
                "price": 620,
                "category": Category.PIZZA,
                "prep_time_minutes": 18,
            },
            {
                "name": "Тирамису",
                "description": "Классический итальянский десерт",
                "price": 280,
                "category": Category.OTHER,
                "prep_time_minutes": 5,
            },
            {
                "name": "Апероль шприц б/а",
                "description": "Апельсиновый напиток без алкоголя",
                "price": 160,
                "category": Category.DRINK,
                "prep_time_minutes": 2,
            },
        ],
        "promos": [
            {
                "code": "PIZZA10",
                "discount_type": "PERCENT",
                "discount_value": 10,
                "max_uses": 150,
            },
        ],
    },
]

REVIEW_TEXTS = [
    (
        5,
        "Отличное место! Шаурма свежая, всё горячее, персонал вежливый. Буду приходить снова.",
    ),
    (5, "Лучшие роллы в городе, без преувеличений. Рыба свежайшая, подача красивая."),
    (4, "Вкусно, быстро, цены адекватные. Единственный минус — очередь в обед."),
    (
        4,
        "Бургеры отличные, котлета сочная. Картошка могла быть горячее, но в целом зашло.",
    ),
    (5, "Пицца просто огонь! Тесто воздушное, начинки много. Рекомендую четыре сыра."),
    (3, "Нормально, но ждал дольше, чем обещали. На вкус без нареканий."),
    (5, "Мисо-суп восхитительный, рамен тоже. Атмосфера приятная, вернусь с друзьями."),
    (4, "Хороший фастфуд без лишних понтов. Шаурма большая, цена честная."),
    (5, "Заказываю здесь каждую неделю. Стабильное качество — это главное."),
    (2, "Ждал 40 минут вместо 15. Еда нормальная, но время — это деньги."),
]


async def _get_or_load_user(session, phone: str, created_users: dict) -> User | None:
    user = created_users.get(phone)
    if user is None:
        result = await session.execute(select(User).where(User.phone_number == phone))
        user = result.scalar_one_or_none()
    return user


SPECIAL_VENDOR_PHONE = "+79608185075"
SPECIAL_VENDOR_RESTAURANT = "Борода"
SPECIAL_VENDOR_ADDRESS = "ул. Бородинская, 1"
SPECIAL_VENDOR_ITEMS = [
    {
        "name": "Шава гавайская",
        "description": "Шаурма с ананасом, курицей и сыром",
        "price": 7777,
        "category": Category.SHAURMA,
        "prep_time_minutes": 12,
    },
    {
        "name": "Кола",
        "description": "Газировка 0.5 л",
        "price": 150,
        "category": Category.DRINK,
        "prep_time_minutes": 1,
    },
    {
        "name": "Апельсиновый сок",
        "description": "Свежевыжатый, 0.3 л",
        "price": 250,
        "category": Category.DRINK,
        "prep_time_minutes": 2,
    },
    {
        "name": "Айран",
        "description": "Кисломолочный напиток, 0.5 л",
        "price": 120,
        "category": Category.DRINK,
        "prep_time_minutes": 1,
    },
]


async def _promote_special_vendor(session) -> None:
    """If a user with SPECIAL_VENDOR_PHONE exists, make them a vendor and give
    them the 'Борода' restaurant with a small menu. Idempotent: safe to re-run."""
    result = await session.execute(
        select(User).where(User.phone_number == SPECIAL_VENDOR_PHONE)
    )
    user = result.scalar_one_or_none()
    if user is None:
        print(f"  skip special vendor: no user {SPECIAL_VENDOR_PHONE}")
        return

    user.permissions = permissions_with(
        user.permissions, CUSTOMER_PERMISSIONS | VENDOR_PERMISSIONS
    )
    await session.commit()

    vendor = await get_vendor_by_user_id(session, user.id)
    if vendor is None:
        vendor = await create_vendor_profile(session, user, VendorCreate())
        print(f"  vendor profile → {user.name} ({SPECIAL_VENDOR_PHONE})")
    vendor.approval_status = "APPROVED"
    vendor.rejection_reason = None
    await session.commit()

    result = await session.execute(
        select(Restaurant).where(
            Restaurant.vendor_id == vendor.id,
            Restaurant.name == SPECIAL_VENDOR_RESTAURANT,
        )
    )
    restaurant = result.scalar_one_or_none()
    if restaurant is None:
        restaurant = await create_restaurant(
            session,
            RestaurantCreate(
                name=SPECIAL_VENDOR_RESTAURANT,
                address=SPECIAL_VENDOR_ADDRESS,
                avg_prep_time_minutes=15,
            ),
            vendor.id,
        )
        restaurant.moderation_status = "APPROVED"
        restaurant.description = "Шаурма и напитки от Бороды"
        await session.commit()
        print(f"  restaurant '{SPECIAL_VENDOR_RESTAURANT}'")

    existing = await session.execute(
        select(MenuItem.name).where(MenuItem.restaurant_id == restaurant.id)
    )
    existing_names = {name for (name,) in existing.all()}
    added = 0
    for item in SPECIAL_VENDOR_ITEMS:
        if item["name"] in existing_names:
            continue
        await create_menu_item(
            session,
            MenuItemCreate(
                name=item["name"],
                description=item["description"],
                price=item["price"],
                category=item["category"],
                prep_time_minutes=item["prep_time_minutes"],
            ),
            restaurant.id,
        )
        added += 1
    print(f"    +{added} menu items for '{SPECIAL_VENDOR_RESTAURANT}'")


async def seed():
    print("Seeding demo data...\n")

    async with db_helper.session_factory() as session:
        created_users: dict[str, User] = {}

        print("── Users ──────────────────────────────")
        for u in SEED_USERS:
            result = await session.execute(
                select(User).where(User.phone_number == u["phone_number"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"  skip {u['phone_number']} (exists)")
                created_users[u["phone_number"]] = existing
                continue

            user = await create_user(
                session,
                UserCreate(
                    name=u["name"],
                    phone_number=u["phone_number"],
                    password=u["password"],
                ),
            )
            await update_user(
                session,
                user,
                UserUpdate(
                    first_name=u.get("first_name"),
                    last_name=u.get("last_name"),
                    middle_name=u.get("middle_name"),
                    email=u.get("email"),
                ),
            )

            if u["role"] in ("admin", "superuser"):
                user.permissions = serialize_permissions(ADMIN_PERMISSIONS)
                await session.commit()

            created_users[u["phone_number"]] = user
            print(f"  [{u['role']:8}] {u['name']}  {u['phone_number']}")

        print("\n── Vendors & Restaurants ───────────────")
        vendor_users = [u for u in SEED_USERS if u["role"] == "vendor"]
        all_restaurants: list[Restaurant] = []
        restaurant_items: dict[str, list[MenuItem]] = {}

        for i, vu in enumerate(vendor_users):
            user = await _get_or_load_user(session, vu["phone_number"], created_users)
            if not user:
                continue

            user.permissions = permissions_with(
                user.permissions, CUSTOMER_PERMISSIONS | VENDOR_PERMISSIONS
            )
            await session.commit()

            vendor = await get_vendor_by_user_id(session, user.id)
            if vendor is None:
                vendor = await create_vendor_profile(session, user, VendorCreate())
                vendor.approval_status = "APPROVED"
                await session.commit()
                print(f"  vendor profile → {vu['name']}")

            if vendor is not None and (
                vendor.approval_status != "APPROVED" or vendor.rejection_reason is not None
            ):
                vendor.approval_status = "APPROVED"
                vendor.rejection_reason = None
                await session.commit()

            for rd in SEED_RESTAURANTS:
                if rd["vendor_index"] != i:
                    continue

                result = await session.execute(
                    select(Restaurant).where(Restaurant.address == rd["address"])
                )
                restaurant = result.scalar_one_or_none()

                if restaurant is None:
                    restaurant = await create_restaurant(
                        session,
                        RestaurantCreate(
                            name=rd["name"],
                            address=rd["address"],
                            avg_prep_time_minutes=rd.get("avg_prep_time_minutes", 15),
                            max_active_orders=rd.get("max_active_orders"),
                        ),
                        vendor.id,
                    )
                    restaurant.moderation_status = "APPROVED"
                    restaurant.description = rd["description"]
                    restaurant.is_hiring = rd.get("is_hiring", True)
                    await session.commit()
                    print(f"  restaurant '{rd['name']}'")

                    items: list[MenuItem] = []
                    for item in rd["items"]:
                        mi = await create_menu_item(
                            session,
                            MenuItemCreate(
                                name=item["name"],
                                description=item.get("description"),
                                price=item["price"],
                                category=item["category"],
                                prep_time_minutes=item["prep_time_minutes"],
                            ),
                            restaurant.id,
                        )
                        await _create_sample_option_groups(session, mi)
                        items.append(mi)
                    restaurant_items[str(restaurant.id)] = items
                    print(f"    {len(items)} menu items")

                    for promo_data in rd.get("promos", []):
                        await create_promo(
                            session,
                            PromoCreate(
                                code=promo_data["code"],
                                discount_type=promo_data["discount_type"],
                                discount_value=promo_data["discount_value"],
                                restaurant_id=restaurant.id,
                                max_uses=promo_data.get("max_uses"),
                            ),
                        )
                    if rd.get("promos"):
                        print(f"    {len(rd['promos'])} promo codes")
                else:
                    print(f"  skip restaurant '{rd['name']}' (exists)")
                    result = await session.execute(
                        select(MenuItem).where(
                            MenuItem.restaurant_id == restaurant.id,
                            MenuItem.is_deleted.is_(False),
                        )
                    )
                    restaurant_items[str(restaurant.id)] = list(result.scalars().all())

                restaurant.moderation_status = "APPROVED"
                restaurant.rejection_reason = None
                restaurant.description = rd["description"]
                restaurant.is_hiring = rd.get("is_hiring", True)
                restaurant.is_ordering_paused = False
                restaurant.ordering_paused_until = None
                restaurant.avg_prep_time_minutes = rd.get("avg_prep_time_minutes", 15)
                restaurant.max_active_orders = rd.get("max_active_orders")
                await session.commit()

                all_restaurants.append(restaurant)

        print("\n── Staff ───────────────────────────────")
        staff_data = next((u for u in SEED_USERS if u["role"] == "staff"), None)
        if staff_data and all_restaurants:
            staff_user = await _get_or_load_user(
                session, staff_data["phone_number"], created_users
            )
            if staff_user:
                existing_profile = await get_staff_profile_by_user_id(
                    session, staff_user.id
                )
                if existing_profile is None:
                    await create_staff_profile(
                        session, staff_user.id, all_restaurants[0].id
                    )
                    print(f"  {staff_data['name']} → '{all_restaurants[0].name}'")
                else:
                    print("  skip (exists)")

        superuser_data = next((u for u in SEED_USERS if u["role"] == "superuser"), None)
        if superuser_data and all_restaurants:
            su = await _get_or_load_user(
                session, superuser_data["phone_number"], created_users
            )
            if su:
                su.permissions = permissions_with(
                    su.permissions, CUSTOMER_PERMISSIONS | VENDOR_PERMISSIONS
                )
                await session.commit()

                vendor = await get_vendor_by_user_id(session, su.id)
                if vendor is None:
                    vendor = await create_vendor_profile(session, su, VendorCreate())
                    vendor.approval_status = "APPROVED"
                    await session.commit()
                    print("  superuser vendor profile created")

                assigned_restaurant = all_restaurants[0]
                if assigned_restaurant.vendor_id != vendor.id:
                    assigned_restaurant.vendor_id = vendor.id
                    await session.commit()
                    print(
                        f"  superuser assigned as vendor for '{assigned_restaurant.name}'"
                    )

                existing_staff = await get_staff_profile_by_user_id(session, su.id)
                if existing_staff is None:
                    await create_staff_profile(session, su.id, assigned_restaurant.id)
                    print(f"  superuser staff profile → '{assigned_restaurant.name}'")

        print("\n── Orders ──────────────────────────────")
        customer_phones = [
            u["phone_number"] for u in SEED_USERS if u["role"] == "customer"
        ]
        order_statuses_cycle = [
            OrderStatus.COMPLETED,
            OrderStatus.COMPLETED,
            OrderStatus.COMPLETED,
            OrderStatus.READY,
            OrderStatus.ACCEPTED,
            OrderStatus.PENDING,
        ]

        all_placed_orders: list[tuple[Order, User, Restaurant]] = []

        for restaurant in all_restaurants:
            items = restaurant_items.get(str(restaurant.id), [])
            if not items:
                continue

            for idx, phone in enumerate(customer_phones):
                customer = await _get_or_load_user(session, phone, created_users)
                if not customer:
                    continue

                result = await session.execute(
                    select(Order)
                    .where(
                        Order.user_id == customer.id,
                        Order.restaurant_id == restaurant.id,
                    )
                    .limit(1)
                )
                if result.scalar_one_or_none():
                    print(f"  skip order (exists): {customer.name} @ {restaurant.name}")
                    continue

                selected = random.sample(items, k=min(2, len(items)))
                order = Order(
                    user_id=customer.id,
                    restaurant_id=restaurant.id,
                    total_price=0,
                )
                session.add(order)
                await session.flush()

                for mi in selected:
                    qty = random.randint(1, 2)
                    order_item = OrderItem(
                        order_id=order.id,
                        menu_item_id=mi.id,
                        quantity=qty,
                        price_at_purchase=mi.price,
                    )
                    session.add(order_item)
                    await session.flush()
                    item_total = mi.price * qty

                    full_item = await get_menu_item_by_id(session, mi.id)
                    if full_item is not None and full_item.option_groups:
                        for group in full_item.option_groups:
                            if group.is_active is False:
                                continue
                            available_options = [
                                option
                                for option in group.options
                                if option.is_available is not False
                            ]
                            if not available_options:
                                continue
                            if group.is_required or random.random() < 0.6:
                                selected_option = random.choice(available_options)
                                session.add(
                                    OrderItemOption(
                                        order_item_id=order_item.id,
                                        option_id=selected_option.id,
                                        name_snapshot=selected_option.name,
                                        price_delta_snapshot=selected_option.price_delta,
                                    )
                                )
                                item_total += selected_option.price_delta * qty

                    order.total_price += item_total

                target_status = order_statuses_cycle[idx % len(order_statuses_cycle)]
                path = [OrderStatus.ACCEPTED, OrderStatus.READY, OrderStatus.COMPLETED]
                if target_status == OrderStatus.PENDING:
                    order.status = OrderStatus.PENDING.value
                else:
                    for step in path:
                        order.status = step.value
                        if step == target_status:
                            break
                if target_status == OrderStatus.COMPLETED:
                    order.ready_at = datetime.now(timezone.utc) - timedelta(
                        minutes=random.randint(5, 30)
                    )

                await session.commit()
                await session.refresh(order)

                all_placed_orders.append((order, customer, restaurant))
                print(
                    f"  order #{order.display_id} [{order.status}]: "
                    f"{customer.name} @ {restaurant.name}"
                )

        print("\n── Reviews ─────────────────────────────")
        completed_orders = [
            (o, u, r)
            for o, u, r in all_placed_orders
            if o.status == OrderStatus.COMPLETED.value
        ]
        review_pool = list(REVIEW_TEXTS)
        random.shuffle(review_pool)

        for i, (order, customer, restaurant) in enumerate(completed_orders):
            result = await session.execute(
                select(Review).where(
                    Review.user_id == customer.id,
                    Review.restaurant_id == restaurant.id,
                )
            )
            if result.scalar_one_or_none():
                print(f"  skip review (exists): {customer.name} @ {restaurant.name}")
                continue

            rating, text = review_pool[i % len(review_pool)]
            await create_review(
                session,
                ReviewCreate(rating=rating, text=text),
                user_id=customer.id,
                restaurant_id=restaurant.id,
                is_verified_purchase=True,
            )
            print(f"  review ★{rating}: {customer.name} @ {restaurant.name}")

        print("\n── Ratings recalc ──────────────────────")
        for restaurant in all_restaurants:
            avg, count = await get_restaurant_avg_rating(session, restaurant.id)
            restaurant.average_rating = avg or 0.0
            restaurant.review_count = count
            session.add(restaurant)
        await session.commit()
        print(f"  updated {len(all_restaurants)} restaurants")

        print("\n── Favorites ───────────────────────────")
        fav_assignments = [
            (customer_phones[0], [0, 2]),
            (customer_phones[1], [1, 3]),
            (customer_phones[2], [0, 1, 2]),
        ]
        for phone, indices in fav_assignments:
            customer = await _get_or_load_user(session, phone, created_users)
            if not customer:
                continue
            for idx in indices:
                if idx >= len(all_restaurants):
                    continue
                restaurant = all_restaurants[idx]
                existing = await get_favorite(session, customer.id, restaurant.id)
                if existing is None:
                    await create_favorite(session, customer.id, restaurant.id)
                    print(f"  fav: {customer.name} → {restaurant.name}")
                else:
                    print("  skip fav (exists)")

        print("\n── Special vendor ──────────────────────")
        await _promote_special_vendor(session)

    await db_helper.dispose()

    print("\n" + "═" * 48)
    print("Done! Credentials:")
    print("═" * 48)
    for u in SEED_USERS:
        print(f"  [{u['role']:8}]  {u['phone_number']}  /  {u['password']}")
    print("═" * 48)


if __name__ == "__main__":
    asyncio.run(seed())
