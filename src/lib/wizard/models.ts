// Every OpenAI model id the wizard uses, with its env override, in one place —
// so a model bump is a one-file change instead of a grep across agents.
//
// Production defaults deliberately use Luna on the interactive hot path and
// cheap enrichment work. Exact video lookup keeps Terra because confirming one
// real YouTube watch URL is a higher-precision web-search task.
export const wizardAgentModel = process.env.WIZARD_AGENT_MODEL || "gpt-5.6-luna";
export const enrichmentVideoModel = process.env.ENRICHMENT_VIDEO_MODEL || "gpt-5.6-terra";
export const enrichmentRatingModel = process.env.ENRICHMENT_RATING_MODEL || "gpt-5.6-luna";
