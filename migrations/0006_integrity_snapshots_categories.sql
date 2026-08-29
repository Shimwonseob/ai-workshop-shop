ALTER TABLE order_items ADD COLUMN product_name TEXT;
CREATE TABLE IF NOT EXISTS categories (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 slug TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL UNIQUE,
 sort_order INTEGER NOT NULL DEFAULT 0,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);
INSERT INTO categories (slug,name,sort_order,is_active) VALUES
 ('ready-meal','간편식',1,1),('bakery','베이커리',2,1),('fresh-food','신선식품',3,1),('side-dish','반찬',4,1)
ON CONFLICT(slug) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order,is_active=excluded.is_active;
ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id);
UPDATE products SET category_id=(SELECT id FROM categories c WHERE c.name=products.category) WHERE category_id IS NULL;
UPDATE order_items SET product_name=COALESCE((SELECT name FROM products p WHERE p.id=order_items.product_id),'판매 종료 상품') WHERE product_name IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_active_category_rank ON products(is_active,category_id,sales_rank,id);
CREATE INDEX IF NOT EXISTS idx_products_active_sale_price ON products(is_active,sale_price,id);
SELECT id,name,category FROM products WHERE category_id IS NULL;
