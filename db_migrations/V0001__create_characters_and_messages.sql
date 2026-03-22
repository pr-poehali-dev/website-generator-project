CREATE TABLE IF NOT EXISTS characters (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    avatar_emoji TEXT DEFAULT '🤖',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    char_id INTEGER REFERENCES characters(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);