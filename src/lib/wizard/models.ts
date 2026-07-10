// Every OpenAI model id the wizard uses, with its env override, in one place —
// so a model bump is a one-file change instead of a grep across agents.
export const wizardAgentModel = process.env.WIZARD_AGENT_MODEL || "gpt-5.5";
export const enrichmentVideoModel = process.env.ENRICHMENT_VIDEO_MODEL || "gpt-5.5";
export const enrichmentRatingModel = process.env.ENRICHMENT_RATING_MODEL || "gpt-5-nano";
