UPDATE products
SET category_id = (SELECT id FROM categories WHERE name = '간편식')
WHERE id IN (9,17,18,19) AND is_active = 1;
UPDATE products
SET category_id = (SELECT id FROM categories WHERE name = '베이커리')
WHERE id = 10 AND is_active = 1;
UPDATE products
SET category_id = (SELECT id FROM categories WHERE name = '신선식품')
WHERE id IN (11,12,13,14,16) AND is_active = 1;
UPDATE products
SET category_id = (SELECT id FROM categories WHERE name = '반찬')
WHERE id = 15 AND is_active = 1;
