function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function isResetCommand(value: string) {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }

  // "new game" is deliberately excluded: in an app whose whole purpose is
  // recommending games, that phrase shows up constantly in ordinary requests
  // ("I want a new game", "any new game ideas?") and would wipe the session
  // on a ton of legitimate turns if it were treated as a reset trigger.
  return [
    "clearcontext",
    "clearyourcontext",
    "startover",
    "restart",
    "reset",
    "newsession",
  ].some((command) => normalized === command || normalized.includes(command));
}
