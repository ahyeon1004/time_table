CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL,name TEXT NOT NULL,profile TEXT);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS attempts (token TEXT PRIMARY KEY,state TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS push_devices (endpoint TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),session_token TEXT NOT NULL,subscription TEXT NOT NULL,settings TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS push_device_user ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS push_device_session ON push_devices(session_token);
CREATE TABLE IF NOT EXISTS push_deliveries (device TEXT NOT NULL,lesson TEXT NOT NULL,status TEXT NOT NULL,time BIGINT NOT NULL,PRIMARY KEY(device,lesson));
