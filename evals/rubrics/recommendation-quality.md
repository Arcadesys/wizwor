# Recommendation Quality Rubric

Score the top-three reveal against the product intent.

- Core fit dimensions: genre, play style, difficulty, obscurity, and romhack openness.
- Pass: three or fewer ranked recommendations, top score is at least 96%, reasons clearly tie to at least three of the core fit dimensions, and romhack/original preference is respected.
- Borderline: top pick is strong, but reasons are generic, mention fewer than three core fit dimensions, or the third pick feels weak.
- Fail: fewer or more than three options, threshold not met, reasons do not map to the profile, or romhack/original preference is violated.

Use deterministic assertions for catalog scores and rubric assertions for natural-language reasons.
