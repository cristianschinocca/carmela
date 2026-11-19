ALTER TABLE floor_sectors ADD COLUMN client_key VARCHAR(120), ADD COLUMN config JSONB;
CREATE UNIQUE INDEX floor_sectors_client_key_key ON floor_sectors(client_key);
ALTER TABLE dining_tables ADD COLUMN client_key VARCHAR(120);
CREATE UNIQUE INDEX dining_tables_client_key_key ON dining_tables(client_key);
CREATE TABLE floor_revision (id TEXT PRIMARY KEY DEFAULT 'floor', version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0));
CREATE TABLE floor_operations (id UUID PRIMARY KEY, payload_hash VARCHAR(64) NOT NULL, result_version INTEGER NOT NULL, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP);
