CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tournaments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id            UUID NOT NULL PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  seed          INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id            UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         INT  NOT NULL,
  position      INT  NOT NULL,
  player1_id    UUID REFERENCES players(id),
  player2_id    UUID REFERENCES players(id),
  winner_id     UUID REFERENCES players(id),
  next_match_id UUID REFERENCES matches(id)
);
