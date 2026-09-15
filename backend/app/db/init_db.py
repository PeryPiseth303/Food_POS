import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import Base
from app.db.session import engine, async_session_factory
from app.models.user import AdminUser
from app.models.table import RestaurantTable
from app.models.menu import Category, MenuItem
from app.models.order import Order, OrderItem
from app.core.security import get_password_hash

logger = logging.getLogger("init_db")


async def init_models():
    """Create all tables in the database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified and initialized.")


async def seed_data():
    """Populate default restaurant data, tables, categories, menu items, and admin user."""
    async with async_session_factory() as session:
        # Check if already seeded
        res = await session.execute(select(AdminUser).limit(1))
        if res.scalar_one_or_none():
            logger.info("Database already contains data. Skipping seeding.")
            return

        logger.info("Seeding initial restaurant data...")

        # 1. Admin User
        admin = AdminUser(
            email="admin@restaurant.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Chef & General Manager",
            role="admin",
            is_active=True
        )
        session.add(admin)

        # 2. Restaurant Tables 1 through 12
        tables_list = []
        for num in range(1, 13):
            tbl = RestaurantTable(
                table_number=str(num),
                capacity=4 if num <= 8 else (6 if num <= 10 else 8),
                is_active=True
            )
            session.add(tbl)
            tables_list.append(tbl)

        await session.flush()

        # 3. Categories
        cat_burgers = Category(name="Signature Burgers", icon="Sandwich", sort_order=1, is_active=True)
        cat_pizzas = Category(name="Stone-Fired Pizzas", icon="Pizza", sort_order=2, is_active=True)
        cat_starters = Category(name="Starters & Sides", icon="UtensilsCrossed", sort_order=3, is_active=True)
        cat_drinks = Category(name="Beverages & Cocktails", icon="Wine", sort_order=4, is_active=True)
        cat_desserts = Category(name="Artisan Desserts", icon="Cake", sort_order=5, is_active=True)

        session.add_all([cat_burgers, cat_pizzas, cat_starters, cat_drinks, cat_desserts])
        await session.flush()

        # 4. Menu Items
        menu_items = [
            # Burgers
            MenuItem(
                category_id=cat_burgers.id,
                name="The Truffle Wagyu Burger",
                description="200g Wagyu beef patty, melted aged gruyere, black truffle aioli, caramelized onions on toasted brioche.",
                price=18.50,
                image_url="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="chef-special",
                sort_order=1,
                customizations=[
                    {
                        "id": "doneness",
                        "name": "Meat Doneness",
                        "type": "single",
                        "required": True,
                        "options": ["Medium Rare", "Medium", "Medium Well", "Well Done"]
                    },
                    {
                        "id": "extras",
                        "name": "Delicious Extras",
                        "type": "multiple",
                        "required": False,
                        "options": [
                            {"name": "Crispy Bacon", "price": 2.00},
                            {"name": "Extra Truffle Mayo", "price": 1.50},
                            {"name": "Avocado Slices", "price": 2.00}
                        ]
                    }
                ]
            ),
            MenuItem(
                category_id=cat_burgers.id,
                name="Crispy Nashville Hot Chicken Burger",
                description="Double buttermilk dipped fried chicken thigh, Nashville spices, creamy purple slaw, house dill pickles.",
                price=15.00,
                image_url="https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="spicy",
                sort_order=2,
                customizations=[
                    {
                        "id": "spice_level",
                        "name": "Spice Heat Level",
                        "type": "single",
                        "required": True,
                        "options": ["Mild Tangy", "Medium Kick 🔥", "Nashville Hot 🔥🔥", "Blazing Inferno 🔥🔥🔥"]
                    },
                    {
                        "id": "extras",
                        "name": "Add-ons",
                        "type": "multiple",
                        "required": False,
                        "options": [
                            {"name": "Melted Cheddar", "price": 1.50},
                            {"name": "Extra Pickles", "price": 0.50}
                        ]
                    }
                ]
            ),
            MenuItem(
                category_id=cat_burgers.id,
                name="Smoky Avocado & Black Bean Burger",
                description="House-made spiced black bean patty, crushed hass avocado, pickled red onions, cilantro vegan mayo.",
                price=14.00,
                image_url="https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=800&q=80",
                is_popular=False,
                dietary_tags="vegan,vegetarian",
                sort_order=3,
                customizations=[
                    {
                        "id": "bun",
                        "name": "Choice of Bun",
                        "type": "single",
                        "required": True,
                        "options": ["Artisan Brioche", "Gluten-Free Bun", "Lettuce Wrap"]
                    }
                ]
            ),

            # Pizzas
            MenuItem(
                category_id=cat_pizzas.id,
                name="Classic Margherita D.O.P.",
                description="San Marzano tomato sauce, fresh buffalo mozzarella, fresh sweet basil leaves, Sicilian extra virgin olive oil.",
                price=14.50,
                image_url="https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="vegetarian",
                sort_order=1,
                customizations=[
                    {
                        "id": "crust",
                        "name": "Crust Style",
                        "type": "single",
                        "required": True,
                        "options": ["Neapolitan Thin & Airy", "Garlic Butter Crust (+$1.50)"]
                    }
                ]
            ),
            MenuItem(
                category_id=cat_pizzas.id,
                name="Double Pepperoni & Hot Honey",
                description="Slow-cured spicy pepperoni, charred sweet peppers, hot chili-infused blossom honey drizzle, mozzarella blend.",
                price=17.50,
                image_url="https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="spicy,customer-favorite",
                sort_order=2,
                customizations=[
                    {
                        "id": "extras",
                        "name": "Toppings",
                        "type": "multiple",
                        "required": False,
                        "options": [
                            {"name": "Extra Pepperoni Cups", "price": 2.50},
                            {"name": "Grated Parmesan", "price": 1.00}
                        ]
                    }
                ]
            ),
            MenuItem(
                category_id=cat_pizzas.id,
                name="Wild Mushroom & Truffle Cream Pizza",
                description="Roasted cremini and shiitake mushrooms, thyme garlic cream base, fontina cheese, white truffle oil essence.",
                price=18.00,
                image_url="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
                is_popular=False,
                dietary_tags="vegetarian",
                sort_order=3
            ),

            # Starters & Sides
            MenuItem(
                category_id=cat_starters.id,
                name="Crispy Truffle Parmesan Fries",
                description="Hand-cut golden Idaho potatoes, aromatic white truffle oil, shaved 24-month Parmigiano-Reggiano, rosemary aioli.",
                price=8.50,
                image_url="https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="vegetarian",
                sort_order=1
            ),
            MenuItem(
                category_id=cat_starters.id,
                name="Spicy Buffalo Cauliflower Bites",
                description="Crispy panko battered cauliflower florets tossed in zesty cayenne buffalo sauce with blue cheese dip.",
                price=9.00,
                image_url="https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=800&q=80",
                is_popular=False,
                dietary_tags="vegetarian,spicy",
                sort_order=2
            ),
            MenuItem(
                category_id=cat_starters.id,
                name="Burrata Caprese Crostini",
                description="Creamy Pugliese burrata, heirloom cherry tomatoes, aged balsamic reduction on toasted sourdough.",
                price=11.50,
                image_url="https://images.unsplash.com/photo-1592417817098-8f3d6910985b?auto=format&fit=crop&w=800&q=80",
                is_popular=False,
                dietary_tags="vegetarian",
                sort_order=3
            ),

            # Drinks
            MenuItem(
                category_id=cat_drinks.id,
                name="Passionfruit Mint Refresher",
                description="Fresh passionfruit pulp, crushed garden mint, freshly squeezed lime juice, sparkling mountain mineral water.",
                price=5.50,
                image_url="https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="mocktail,non-alcoholic",
                sort_order=1
            ),
            MenuItem(
                category_id=cat_drinks.id,
                name="Smoked Old Fashioned",
                description="Kentucky bourbon, aromatic Angostura bitters, organic demerara sugar, flamed orange peel, hickory smoke.",
                price=13.00,
                image_url="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="alcoholic",
                sort_order=2
            ),
            MenuItem(
                category_id=cat_drinks.id,
                name="Cold Brew Iced Coffee",
                description="18-hour steeped single-origin Ethiopian roast served over crystal clear ice with oat milk float.",
                price=4.50,
                image_url="https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80",
                is_popular=False,
                dietary_tags="vegan",
                sort_order=3
            ),

            # Desserts
            MenuItem(
                category_id=cat_desserts.id,
                name="Warm Valrhona Molten Lava Cake",
                description="Decadent 70% dark chocolate fondant with a molten center, paired with Madagascar vanilla bean gelato.",
                price=9.50,
                image_url="https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
                is_popular=True,
                dietary_tags="vegetarian",
                sort_order=1
            ),
            MenuItem(
                category_id=cat_desserts.id,
                name="New York Caramel Cheesecake",
                description="Rich baked cream cheese on buttery graham crust, topped with salted butter caramel and roasted pecans.",
                price=8.50,
                image_url="https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80",
                is_popular=False,
                dietary_tags="vegetarian",
                sort_order=2
            )
        ]

        session.add_all(menu_items)
        await session.flush()

        # 5. Sample Orders to populate the admin live board and analytics immediately
        now = datetime.now(timezone.utc)
        sample_orders_data = [
            {
                "num": "ORD-2026-101",
                "table": tables_list[2],  # Table 3
                "status": "pending",
                "payment_status": "paid",
                "name": "Sarah Jenkins",
                "requests": "Extra napkins please!",
                "mins_ago": 4,
                "items": [
                    (menu_items[0], 2, {"Meat Doneness": "Medium"}),
                    (menu_items[6], 1, {})
                ]
            },
            {
                "num": "ORD-2026-102",
                "table": tables_list[4],  # Table 5
                "status": "preparing",
                "payment_status": "paid",
                "name": "David Chen",
                "requests": "Gluten allergy on table",
                "mins_ago": 12,
                "items": [
                    (menu_items[4], 1, {"Toppings": "Grated Parmesan"}),
                    (menu_items[9], 2, {})
                ]
            },
            {
                "num": "ORD-2026-103",
                "table": tables_list[0],  # Table 1
                "status": "ready",
                "payment_status": "paid",
                "name": "Emma Watson",
                "requests": "",
                "mins_ago": 22,
                "items": [
                    (menu_items[1], 1, {"Spice Heat Level": "Nashville Hot 🔥🔥"}),
                    (menu_items[12], 1, {})
                ]
            },
            {
                "num": "ORD-2026-104",
                "table": tables_list[7],  # Table 8
                "status": "served",
                "payment_status": "paid",
                "name": "Michael Taylor",
                "requests": "Split bill",
                "mins_ago": 45,
                "items": [
                    (menu_items[3], 2, {}),
                    (menu_items[10], 2, {})
                ]
            }
        ]

        for sod in sample_orders_data:
            subtotal = sum(float(it[0].price) * it[1] for it in sod["items"])
            tax = round(subtotal * 0.08, 2)
            tip = 3.00
            tot = round(subtotal + tax + tip, 2)
            created_time = now - timedelta(minutes=sod["mins_ago"])

            ord_record = Order(
                order_number=sod["num"],
                table_id=sod["table"].id,
                customer_name=sod["name"],
                special_requests=sod["requests"],
                status=sod["status"],
                payment_status=sod["payment_status"],
                payment_method="mock_card",
                subtotal=subtotal,
                tax=tax,
                tip=tip,
                total_amount=tot,
                estimated_prep_minutes=20,
                created_at=created_time,
                updated_at=created_time
            )
            session.add(ord_record)
            await session.flush()

            for itm, qty, cust in sod["items"]:
                line_cost = float(itm.price) * qty
                oi = OrderItem(
                    order_id=ord_record.id,
                    menu_item_id=itm.id,
                    item_name=itm.name,
                    quantity=qty,
                    unit_price=float(itm.price),
                    item_total=line_cost,
                    customizations=cust
                )
                session.add(oi)

        await session.commit()
        logger.info("Database successfully populated with tables, delicious menu, admin user, and sample orders!")
