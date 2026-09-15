import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "foodservice.db")
print("Migrating database at:", db_path)

con = sqlite3.connect(db_path)
cur = con.cursor()

# 1. Create customer_users table
cur.execute("""
CREATE TABLE IF NOT EXISTS customer_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    delivery_address TEXT,
    is_active BOOLEAN DEFAULT 1 NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")
cur.execute("CREATE INDEX IF NOT EXISTS ix_customer_users_email ON customer_users (email)")
cur.execute("CREATE INDEX IF NOT EXISTS ix_customer_users_id ON customer_users (id)")
print("customer_users table verified.")

# 2. Check orders columns and constraints
cur.execute("PRAGMA table_info(orders)")
cols_info = {r[1]: r for r in cur.fetchall()}
print("Existing order columns:", list(cols_info.keys()))

# Check if table_id is nullable (cols_info['table_id'][3] == 0 means nullable, 1 means not null)
needs_recreate = False
if "table_id" in cols_info and cols_info["table_id"][3] == 1:
    needs_recreate = True

if needs_recreate:
    print("Recreating orders table with nullable table_id and new fields...")
    cur.execute("PRAGMA foreign_keys=OFF")
    cur.execute("""
    CREATE TABLE orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        order_type VARCHAR(30) DEFAULT 'dine_in' NOT NULL,
        table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES customer_users(id) ON DELETE SET NULL,
        customer_name VARCHAR(100) DEFAULT 'Guest',
        customer_phone VARCHAR(50),
        delivery_address TEXT,
        special_requests TEXT,
        status VARCHAR(30) DEFAULT 'pending' NOT NULL,
        payment_status VARCHAR(30) DEFAULT 'pending' NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'mock_card' NOT NULL,
        payment_intent_id VARCHAR(255),
        subtotal NUMERIC(10, 2) NOT NULL,
        tax NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
        tip NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        estimated_prep_minutes INTEGER DEFAULT 20 NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    # Copy existing columns
    cur.execute("""
    INSERT INTO orders_new (
        id, order_number, order_type, table_id, customer_name, customer_phone,
        special_requests, status, payment_status, payment_method, payment_intent_id,
        subtotal, tax, tip, total_amount, estimated_prep_minutes, created_at, updated_at
    )
    SELECT
        id, order_number, 'dine_in', table_id, customer_name, customer_phone,
        special_requests, status, payment_status, payment_method, payment_intent_id,
        subtotal, tax, tip, total_amount, estimated_prep_minutes, created_at, updated_at
    FROM orders
    """)
    cur.execute("DROP TABLE orders")
    cur.execute("ALTER TABLE orders_new RENAME TO orders")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_orders_order_number ON orders (order_number)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_orders_table_id ON orders (table_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_orders_status ON orders (status)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_orders_payment_status ON orders (payment_status)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_orders_order_type ON orders (order_type)")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_orders_customer_id ON orders (customer_id)")
    cur.execute("PRAGMA foreign_keys=ON")
    print("orders table migrated successfully!")
else:
    # Just add missing columns if any
    for col, col_type in [
        ("order_type", "VARCHAR(30) DEFAULT 'dine_in' NOT NULL"),
        ("delivery_address", "TEXT"),
        ("customer_id", "INTEGER REFERENCES customer_users(id) ON DELETE SET NULL")
    ]:
        if col not in cols_info:
            cur.execute(f"ALTER TABLE orders ADD COLUMN {col} {col_type}")
            print(f"Added {col} column to orders.")

con.commit()
con.close()
print("Migration finished cleanly.")
