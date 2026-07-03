# Recommendation Quality Rubric

Score the top-three reveal against the product intent.

- Pass: exactly three ranked recommendations, top score is at least 90%, and reasons connect to the player profile.
- Borderline: top pick is strong but reasons are generic or the third pick is weak.
- Fail: fewer or more than three options, threshold not met, or romhack/original preference is violated.

Use deterministic assertions for catalog scores and rubric assertions for natural-language reasons.
