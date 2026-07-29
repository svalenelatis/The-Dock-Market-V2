-- Seed script to populate initial game data from dataObjects.json

-- Insert items with proper PostgreSQL array syntax for tags
INSERT INTO items (name, base_price, components, tags) VALUES
('Grain', 10, ARRAY[]::TEXT[], ARRAY['Food']),
('Water', 10, ARRAY[]::TEXT[], ARRAY['Food']),
('Textiles', 10, ARRAY[]::TEXT[], ARRAY['Raw Materials']),
('Iron Ore', 10, ARRAY[]::TEXT[], ARRAY['Raw Materials']),
('Stone', 10, ARRAY[]::TEXT[], ARRAY['Raw Materials']),
('Wood', 10, ARRAY[]::TEXT[], ARRAY['Raw Materials']),
('Spices', 20, ARRAY[]::TEXT[], ARRAY['Luxury Goods']),
('Fruit', 20, ARRAY[]::TEXT[], ARRAY['Luxury Goods']),
('Gemstones', 20, ARRAY[]::TEXT[], ARRAY['Luxury Goods']),
('Livestock', 20, ARRAY[]::TEXT[], ARRAY['Food']),
('Flour', 15, ARRAY['Grain'], ARRAY['Refined Goods']),
('Iron', 30, ARRAY['Iron Ore', 'Wood'], ARRAY['Refined Goods']),
('Clothing', 40, ARRAY['Textiles', 'Livestock'], ARRAY['Manufactured Goods']),
('Rations', 70, ARRAY['Flour', 'Livestock', 'Water'], ARRAY['Food']),
('Armor and Weapons', 80, ARRAY['Iron', 'Wood', 'Coal'], ARRAY['Manufactured Goods']),
('Tools', 80, ARRAY['Iron', 'Wood', 'Coal'], ARRAY['Manufactured Goods']),
('Building Materials', 80, ARRAY['Stone', 'Wood', 'Iron'], ARRAY['Manufactured Goods']),
('Zerikanium', 270, ARRAY['Tools', 'Rations', 'Gemstones'], ARRAY['Luxury Goods']);

-- Insert city tags (tag definitions — effects describe what the tag does)
-- can_be_permanent: eligible as a base-layer city trait
-- can_be_event: eligible for random assignment by the daily handler
INSERT INTO city_tags (name, description, effects, can_be_permanent, can_be_event) VALUES
('Agricultural', 'This island grows a lot of food.', '{"goods": {"Tools": 0.1}, "tags": {"Food": -0.1}}', true, false),
('Industrial', 'This island produces a lot of goods.', '{"goods": {"Rations": 0.1}, "tags": {"Raw Materials": 0.1, "Manufactured Goods": -0.1}}', true, false),
('Mining', 'This island has a lot of mines.', '{"goods": {"Iron Ore": -0.1, "Stone": -0.1, "Wood": 0.1, "Gemstones": -0.1, "Zerikanium": -0.1, "Tools": 0.1}, "tags": {}}', true, false),
('Mercantile', 'This island is a hub of trade.', '{"goods": {"Zerikanium": 0.1}, "tags": {"Luxury Goods": 0.1, "Refined Goods": 0.1, "Food": -0.1, "Raw Materials": -0.1}}', true, false),
('Military', 'This island has a strong military presence.', '{"goods": {"Armor and Weapons": 0.1, "Building Materials": 0.1, "Rations": 0.2, "Clothing": 0.1}, "tags": {}}', true, false),
('Isolated', 'This island is far from other islands.', '{"goods": {}, "tags": {"Food": 0.1, "Raw Materials": 0.1, "Luxury Goods": 0.1, "Refined Goods": 0.1, "Manufactured Goods": 0.1}}', true, false),
('Cultural', 'This island has a rich cultural history.', '{"goods": {"Clothing": -0.1, "Textiles": -0.1}, "tags": {"Luxury Goods": -0.1}}', true, false),
('Xenophobic', 'This island dislikes other islands.', '{"goods": {"Armor and Weapons": 0.2, "Zerikanium": 0.2}, "tags": {"Food": -0.1, "Raw Materials": -0.1, "Luxury Goods": -0.1, "Refined Goods": -0.1, "Manufactured Goods": -0.1}}', true, false),
('Wealthy', 'This island is very wealthy.', '{"goods": {"Gemstones": 0.2, "Zerikanium": 0.2, "Armor and Weapons": 0.1, "Building Materials": 0.1}, "tags": {"Food": -0.1, "Raw Materials": -0.1}}', true, false),
('Poor', 'This island is very poor.', '{"goods": {"Zerikanium": -0.1}, "tags": {"Food": 0.1, "Raw Materials": 0.1, "Luxury Goods": -0.1, "Refined Goods": -0.1, "Manufactured Goods": -0.1}}', true, false),
('Artisinal', 'This island produces high quality goods.', '{"goods": {"Textiles": 0.1, "Tools": 0.1, "Building Materials": 0.1}, "tags": {"Luxury Goods": 0.1}}', true, false),
('Lawless', 'This island is full of pirates and outlaws.', '{"goods": {"Water": 0.1, "Armor and Weapons": 0.1, "Zerikanium": 0.1}, "tags": {"Manufactured Goods": 0.1}}', true, false),
('Verdant', 'This island is lush and fertile.', '{"goods": {"Wood": -0.1, "Livestock": -0.1, "Tools": 0.1}, "tags": {}}', true, false),
('Blighted', 'This island''s crops are suffering from a blight.', '{"goods": {}, "tags": {"Food": 0.3}}', true, false);

-- Insert cities (triggers will auto-generate price_sheets rows)
INSERT INTO cities (name, volatility, location) VALUES
('Katu', 0.2, '{"x": 0, "y": 0}'),
('Blue Harbor', 0.2, '{"x": 1, "y": 0}'),
('The Frem', 0.1, '{"x": -3, "y": 2}'),
('Capricorn', 0.1, '{"x": 1, "y": 1}'),
('Fae''lu', 0.2, '{"x": 3, "y": 3}'),
('Greenlands', 0.1, '{"x": 2, "y": -4}'),
('Southern Islands', 0.2, '{"x": 0, "y": -5}'),
('Metal Isles', 0.2, '{"x": -3, "y": 0}'),
('Magma Noir', 0.1, '{"x": -1, "y": -2}'),
('Blazefin Isles', 0.1, '{"x": -5, "y": -5}'),
('Northern Islands', 0.1, '{"x": 0, "y": 5}'),
('Temikor', 0.1, '{"x": -2, "y": 3}'),
('Eastern Tribes', 0.2, '{"x": 5, "y": 1}'),
('Domain of the Merae', 0.2, '{"x": 5, "y": 1}');

-- Insert random event tags (these are tag definitions that can be temporarily assigned)
INSERT INTO city_tags (name, description, effects, can_be_permanent, can_be_event) VALUES
('Drought', 'A drought has hit the island, causing food prices to rise.', '{"goods": {"Water": 0.05}, "tags": {"Food": 0.05}}', false, true),
('Bountiful Harvest', 'A bountiful harvest has caused food prices to drop.', '{"goods": {}, "tags": {"Food": -0.05}}', false, true),
('Exotic Caravan', 'A large merchant caravan has arrived, increasing the supply of exotic goods.', '{"goods": {}, "tags": {"Luxury Goods": -0.03}}', false, true),
('Market Fire', 'A fire in the central market has destroyed some goods, reducing supply.', '{"goods": {}, "tags": {"Raw Materials": 0.04, "Food": 0.03}}', false, true),
('High Tides', 'Exceptionally high tides have made fishing more difficult, reducing seafood supply.', '{"goods": {"Rations": 0.03}, "tags": {"Food": 0.02}}', false, true),
('Counterfeit Currency', 'A counterfeit currency scandal has made merchants wary, increasing the price of valuable goods.', '{"goods": {}, "tags": {"Luxury Goods": 0.03}}', false, true),
('Architect''s Commission', 'A wealthy noble has ordered new buildings, raising demand for construction materials.', '{"goods": {"Building Materials": 0.04}, "tags": {"Raw Materials": 0.02}}', false, true),
('Guild Regulation', 'A trade guild has imposed new regulations, slightly raising the price of refined goods.', '{"goods": {}, "tags": {"Refined Goods": 0.02}}', false, true),
('Surplus Harvest', 'An unusually good harvest has caused a surplus of grains and produce.', '{"goods": {}, "tags": {"Food": -0.04}}', false, true),
('Drunken Festival', 'A local festival has driven up alcohol consumption and demand for entertainment goods.', '{"goods": {}, "tags": {"Luxury Goods": 0.02}}', false, true),
('Storm at Sea', 'A major storm has delayed merchant ships, reducing supply of imported goods.', '{"goods": {}, "tags": {"Raw Materials": 0.03}}', false, true),
('Plague Outbreak', 'A minor plague outbreak has increased demand for medicinal supplies.', '{"goods": {"Spices": 0.03, "Fruit": 0.02, "Water": 0.02}, "tags": {}}', false, true),
('Flooded Farmlands', 'Heavy rains have flooded farmlands, causing crop shortages.', '{"goods": {}, "tags": {"Food": 0.03}}', false, true),
('Material Stockpile', 'A large stockpile of materials is being sold off, decreasing demand.', '{"goods": {}, "tags": {"Raw Materials": -0.04, "Manufactured Goods": 0.02}}', false, true),
('Merchant Tax', 'New government taxes on merchants have slightly increased trade costs.', '{"goods": {}, "tags": {"Food": 0.02, "Luxury Goods": 0.02, "Refined Goods": 0.02, "Manufactured Goods": 0.02, "Raw Materials": 0.02}}', false, true),
('Black Market Surge', 'Illegal trade has undercut official markets, reducing prices of certain goods.', '{"goods": {"Armor and Weapons": 0.04}, "tags": {"Luxury Goods": -0.04}}', false, true),
('Mystic''s Prophecy', 'A traveling mystic''s prediction has caused panic buying of certain valuables.', '{"goods": {"Gemstones": 0.03, "Spices": 0.02, "Textiles": 0.02}, "tags": {}}', false, true),
('New Trade Agreement', 'A treaty has opened up new trade routes, slightly increasing the supply of imports.', '{"goods": {}, "tags": {"Food": -0.03, "Raw Materials": -0.03}}', false, true),
('Cattle Disease', 'A livestock disease has reduced the supply of meat and leather.', '{"goods": {"Livestock": 0.04, "Grain": 0.02}, "tags": {}}', false, true),
('Mine Collapse', 'A tragic warehouse collapse has decreased ore production, raising metal prices.', '{"goods": {"Tools": 0.03, "Iron Ore": 0.02}, "tags": {"Raw Materials": 0.03}}', false, true),
('Alchemy Breakthrough', 'Alchemists have discovered a new refining method, slightly increasing production of rare goods.', '{"goods": {"Spices": -0.03, "Gemstones": -0.02}, "tags": {}}', false, true),
('Theater Craze', 'A popular play has driven up demand for fine clothing and entertainment goods.', '{"goods": {"Clothing": 0.03}, "tags": {"Luxury Goods": 0.02}}', false, true),
('Bandits', 'Bandits have been spotted in the area, driving up the demand for weapons.', '{"goods": {"Armor and Weapons": 0.04}, "tags": {}}', false, true),
('Shipwreck', 'A ship sank in the nearby ocean, and the locals are diving to collect the valuables.', '{"goods": {"Tools": 0.03}, "tags": {"Luxury Goods": -0.03}}', false, true),
('Embezzlement Bust', 'An important member of the local government was caught embezzling funds, and now they find themself with a surplus to invest.', '{"goods": {"Zerikanium": 0.07, "Iron": -0.06, "Tools": -0.05, "Livestock": -0.04}, "tags": {}}', false, true),
('Rescued Siren', 'A Siren that was previously being abused for tears has been rescued, massively lowering the supply of Siren Tears.', '{"goods": {"Gemstones": 0.1}, "tags": {}}', false, true),
('Refugee Influx', 'An influx of refugees has brought many more hands that are ready to work and mouths that need to be fed.', '{"goods": {"Tools": 0.06}, "tags": {"Food": 0.08, "Manufactured Goods": -0.05}}', false, true);

-- ============================================================
-- ENSURE price_sheets TABLE IS FULLY POPULATED
-- This runs after all inserts above. The triggers handle initial creation,
-- but this cross-join catch-all ensures no gaps if the seed is re-run
-- or if any rows were missed.
-- ============================================================

INSERT INTO price_sheets (city_id, item_id, price)
SELECT c.id, i.id, i.base_price
FROM cities c
CROSS JOIN items i
WHERE i.active = true
ON CONFLICT (city_id, item_id) DO NOTHING;

-- ============================================================
-- SEED CITY TAG ASSIGNMENTS (permanent tags for each city)
-- Links cities to their tag definitions via the junction table.
-- ============================================================

INSERT INTO city_tag_assignments (city_id, tag_id, is_permanent, active)
SELECT c.id, ct.id, true, true
FROM cities c, city_tags ct
WHERE
    (c.name = 'Katu' AND ct.name IN ('Industrial', 'Cultural', 'Mercantile'))
    OR (c.name = 'Blue Harbor' AND ct.name IN ('Mercantile', 'Lawless', 'Wealthy'))
    OR (c.name = 'The Frem' AND ct.name IN ('Verdant', 'Agricultural', 'Cultural'))
    OR (c.name = 'Capricorn' AND ct.name IN ('Mercantile', 'Wealthy', 'Artisinal', 'Cultural'))
    OR (c.name = 'Fae''lu' AND ct.name IN ('Xenophobic', 'Isolated', 'Wealthy'))
    OR (c.name = 'Greenlands' AND ct.name IN ('Verdant', 'Agricultural', 'Poor'))
    OR (c.name = 'Southern Islands' AND ct.name IN ('Isolated', 'Mining', 'Poor'))
    OR (c.name = 'Metal Isles' AND ct.name IN ('Lawless', 'Isolated', 'Wealthy'))
    OR (c.name = 'Magma Noir' AND ct.name IN ('Mining', 'Xenophobic', 'Isolated'))
    OR (c.name = 'Blazefin Isles' AND ct.name IN ('Xenophobic', 'Cultural', 'Poor', 'Military'))
    OR (c.name = 'Northern Islands' AND ct.name IN ('Isolated', 'Blighted', 'Poor'))
    OR (c.name = 'Temikor' AND ct.name IN ('Mining', 'Artisinal', 'Cultural'))
    OR (c.name = 'Eastern Tribes' AND ct.name IN ('Industrial', 'Isolated', 'Poor'))
    OR (c.name = 'Domain of the Merae' AND ct.name IN ('Agricultural', 'Artisinal', 'Xenophobic'))
ON CONFLICT (city_id, tag_id) DO NOTHING;
