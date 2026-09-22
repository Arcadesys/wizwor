import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Wizwor | Context Engineering Experiment",
  description:
    "How Wizwor uses the OpenAI Agents SDK, deliberately shaped context, deterministic catalog scoring, and agent tools.",
};

const flow = [
  ["01", "LISTEN", "The player talks normally. No giant form, no hidden questionnaire state machine."],
  [
    "02",
    "CONTEXT",
    "Each turn gets a compact snapshot: profile, recent messages, enabled consoles, durable MEMORY.md, and the strongest catalog matches.",
  ],
  [
    "03",
    "AGENT",
    "An OpenAI Agents SDK agent interprets the turn, updates the profile, asks the next useful question, or decides it has enough signal to commit.",
  ],
  [
    "04",
    "TOOLS",
    "The agent can score a hypothetical profile, search the real catalog, and request the showcase panel. Tool calls never get to invent catalog truth.",
  ],
  [
    "05",
    "SHOWCASE",
    "The server re-validates the choice against the current profile, then the UI opens a trusted game card with match reasons, footage, and ratings.",
  ],
  [
    "06",
    "MEMORY",
    "Useful preferences survive in a tiny Markdown memory file. The next turn gets the signal, not the whole universe.",
  ],
] as const;

const tools = [
  {
    name: "lookup_recommendations",
    job: "Scores a hypothetical preference profile against the local game catalog.",
    guard: "Returns server-owned game IDs and scores. The model does not make up the math.",
  },
  {
    name: "search_catalog",
    job: "Finds a real cartridge when the player names a title or franchise directly.",
    guard:
      "Searches the full catalog, including titles intentionally filtered out of open-ended recommendations.",
  },
  {
    name: "open_game_showcase",
    job: "Requests the reveal panel for one to three real games.",
    guard:
      "Validates catalog membership and enabled consoles first. Final eligibility is checked after current-turn profile updates are merged.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="about-shell">
      <div className="about-scanlines" aria-hidden="true" />
      <div className="about-page">
        <header className="about-hero">
          <p className="about-kicker">WIZWOR.EXE / EXPERIMENT NOTES</p>
          <h1>Context engineering, disguised as a haunted game cabinet.</h1>
          <p className="about-lede">
            I wanted to learn context engineering, so I built a retro-game recommender with the OpenAI Agents SDK.
            Then I added a furry skin.
          </p>
          <p className="about-copy">
            The interesting part is not the wizard voice or the CRT chrome. It is deciding exactly what the model needs
            to know on each turn, what should stay deterministic in code, and when an agent should reach for a tool
            instead of trying to be clever.
          </p>
          <div className="about-actions">
            <Link className="about-button about-button-primary" href="/">
              RUN ORIGINAL
            </Link>
            <Link className="about-button about-button-furry" href="/furry">
              RUN HOWLNET
            </Link>
          </div>
        </header>

        <section className="about-panel">
          <div className="about-panel-heading">
            <span>ARCHITECTURE.SYS</span>
            <span>OPENAI AGENTS SDK</span>
          </div>
          <div className="about-grid">
            <div>
              <h2>The agent is not the application.</h2>
              <p>
                Wizwor keeps catalog search, scoring, validation, state, and rendering in ordinary application code.
                The agent handles the fuzzy bit: understanding what a person means, choosing the next useful move, and
                deciding when the evidence is good enough to recommend something.
              </p>
            </div>
            <div>
              <h2>Context is a product surface.</h2>
              <p>
                Instead of dumping the whole conversation and catalog into every request, each turn gets a deliberately
                shaped packet of useful state. That makes the agent faster, cheaper, and much less likely to wander off
                into the fog.
              </p>
            </div>
          </div>
        </section>

        <section className="about-section" aria-labelledby="flow-heading">
          <p className="about-kicker">TURN FLOW</p>
          <h2 id="flow-heading">What actually happens when you type.</h2>
          <div className="about-flow">
            {flow.map(([number, title, body]) => (
              <article className="about-flow-step" key={number}>
                <span className="about-step-number">{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section" aria-labelledby="tools-heading">
          <p className="about-kicker">AGENT TOOLS</p>
          <h2 id="tools-heading">The model can ask for capabilities. It does not own the truth.</h2>
          <div className="about-tools">
            {tools.map((tool) => (
              <article className="about-tool-card" key={tool.name}>
                <code>{tool.name}</code>
                <p>{tool.job}</p>
                <p className="about-guard">{tool.guard}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-panel about-origin">
          <div className="about-panel-heading">
            <span>WHY THIS EXISTS</span>
            <span>BUILD WEIRD THINGS</span>
          </div>
          <div className="about-grid">
            <div>
              <h2>I learn by making the problem tangible.</h2>
              <p>
                “Context engineering” is easy to describe abstractly. It became much more interesting when I had to make
                an agent remember the right things, forget the useless things, call tools at the right moment, and still
                feel responsive enough to be a toy.
              </p>
            </div>
            <div>
              <h2>Then I reskinned the same brain.</h2>
              <p>
                HOWLNET uses the same catalog, scoring, tools, and reveal rules. What changes is the persona, visual
                theme, memory namespace, and the extra context that nudges recommendations toward anthropomorphic
                characters. Same machine. Different haunted terminal.
              </p>
            </div>
          </div>
        </section>

        <footer className="about-footer">
          <span>EXPERIMENTAL SOFTWARE / BUILT TO LEARN IN PUBLIC</span>
          <div className="about-footer-links">
            <Link href="/">ORIGINAL</Link>
            <Link href="/furry">HOWLNET</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
