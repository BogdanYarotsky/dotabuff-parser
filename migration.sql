CREATE TABLE IF NOT EXISTS dotabuff_updates (
	id serial PRIMARY KEY,
	timestamp TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS dotabuff_heroes (
	id serial PRIMARY KEY,
    update_id INT NOT NULL,
    game_id INT NOT NULL,
    winrate real NOT NULL, 

    FOREIGN KEY(update_id)
        REFERENCES dotabuff_updates(id),

    FOREIGN KEY(game_id)
        REFERENCES heroes(id)
);

CREATE TABLE IF NOT EXISTS dotabuff_items (
    hero_id INT NOT NULL,
    game_id INT NOT NULL,
    matches INT NOT NULL,
    winrate real NOT NULL,

    PRIMARY KEY (hero_id, game_id),

    FOREIGN KEY(hero_id)
        REFERENCES dotabuff_heroes(id),

    FOREIGN KEY(game_id)
        REFERENCES items(id)
);