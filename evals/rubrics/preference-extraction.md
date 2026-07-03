# Preference Extraction Rubric

Score whether free-form player text maps to the intended typed profile fields.

- Pass: exact labels, synonyms, and natural phrases set the expected field without changing unrelated fields.
- Borderline: a phrase has competing signals and the chosen value is defensible but should be reviewed in traces.
- Fail: a clear preference is ignored, mapped to the wrong field, or accepted without enough evidence.

Good eval cases include the raw utterance, the active question, expected field/value, and at least one plausible wrong mapping.
