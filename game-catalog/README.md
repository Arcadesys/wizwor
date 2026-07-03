# game-catalog

SQLite database of every video game listed in [EveryVideoGameEver](https://github.com/Elbriga14/EveryVideoGameEver) (175,303 games across 58 platform files), enriched with YouTube longplay links and AI-generated tags.

## Rebuilding

```
git clone https://github.com/Elbriga14/EveryVideoGameEver.git source
python3 import.py       # imports all 175,303 games' base metadata into games.db
python3 pilot_update.py # attaches youtube_link + tags for the pilot batch (see below)
```

`source/` and `games.db` are gitignored — both are reproducible from the two scripts above.

## Schema

- `games(id, title, year, dev, dev_link, publisher, publisher_link, genre, description, game_link, platform, platform_link, youtube_link)`
  — `genre`/`description` are only populated for platforms whose source data included them (mainly Itch.io/Arcade); most rows leave them null.
- `tags(id, name)` / `game_tags(game_id, tag_id)` — many-to-many, only populated where enrichment has run.

## Status

- **All 175,303 games**: base metadata imported (title/year/dev/publisher/links). No YouTube link or tags yet.
- **9 pilot NES titles** (Bubble Bobble, Castlevania, Double Dragon, Final Fantasy, Kirby's Adventure, Metroid, Super Mario Bros. 3, Tetris, The Legend of Zelda): fully enriched — real YouTube longplay link (verified via web search, each explicitly labeled "no commentary"/"longplay" by its uploader) + AI-generated tags.

## Why only 9 enriched so far

Finding a *verified* no-commentary longplay per game requires a real web search per title — there's no way to batch or fabricate this reliably, and at 175K games it's not feasible to do in one pass (a real search API's free quota alone would take years at that volume). Tags likewise need a genuine per-game judgment call, not a template. The pilot proves the pipeline; scaling further means deciding a priority order (e.g. by platform, by notability) and running it incrementally.
