import { Icon } from "./Icons";
import { WorldScene } from "./WorldScene";
import type { Workflow } from "./types";

export function WonderlandWelcome({
  onPrompt,
  onCreate,
  world,
  interactive = true,
}: {
  onPrompt: (text: string) => void;
  onCreate: (text: string) => void;
  world?: Workflow;
  interactive?: boolean;
}) {
  const themed = world?.theme && world.theme !== "custom";
  const headings: Record<string, [string, string, string]> = {
    gonzo: ["Buy the ticket.", "Take the ride.", "Past the neon. Into the strange. Bring your imagination."],
    wonka: ["A golden ticket.", "An impossible world.", "A little mischief. A lot of imagination. Everything begins with an idea."],
    mars: [
      "Touch down.",
      "A world beyond.",
      "Your alien guide awaits. Follow a signal. Make first contact.",
    ],
    estate: [
      "Welcome home.",
      "How may we help?",
      "A little imagination, served with impeccable taste.",
    ],
    cartoon: [
      "Think it.",
      "Toon it.",
      "Big ideas. Improbable adventures. A world with a little extra bounce.",
    ],
  };
  const text = headings[world?.theme || ""];
  return (
    <div className="wonder-welcome">
      <div className="wonder-hero">
        <div className="wonder-copy">
          <span className="wonder-chapter">
            <span>01</span> THE ADVENTURE IS YOURS
          </span>
          <h1>
            {text?.[0] || "A curious mind."}
            <br />
            <em>{text?.[1] || "A world away."}</em>
          </h1>
          <p>
            {text?.[2] || "Ask the impossible. Make the imaginary."}
            <br />
            {themed ? world?.name : "See where the rabbit hole takes you."}
          </p>
          <div className="wonder-signpost">
            <span className="wonder-star">✧</span> A little wonder goes a long
            way.
          </div>
        </div>
        <div className="wonder-portal">
          {themed ? (
            <WorldScene theme={world!.theme!} />
          ) : (
            <>
              <img
                src="/assets/wonderland/portal.webp"
                width="1536"
                height="1024"
                alt="A white rabbit follows a checkerboard path through a glowing doorway into a surreal mushroom garden."
                fetchPriority="high"
              />
              <span className="floating-card card-spade" aria-hidden="true">
                ♠
              </span>
              <span className="floating-card card-diamond" aria-hidden="true">
                ♦
              </span>
              <span className="portal-caption">
                CURIOSITY IS THE ONLY WAY IN <Icon name="key" size={14} />
              </span>
            </>
          )}
        </div>
      </div>
      <div className="wonder-path-heading">
        <span>CHOOSE A THREAD TO FOLLOW</span>
        <span aria-hidden="true">↘</span>
      </div>
      <div className="wonder-paths">
        <button
          disabled={!interactive}
          className="wonder-path path-learn"
          onClick={() =>
            onPrompt(
              "Teach me something wonderfully strange about the world. Explain it simply, then give me one question to explore next.",
            )
          }
        >
          <span className="path-icon">
            <Icon name="book" size={22} />
          </span>
          <span>
            <strong>Follow a question</strong>
            <small>Discover something you didn’t know.</small>
          </span>
          <Icon name="external" size={17} />
        </button>
        <button
          disabled={!interactive}
          className="wonder-path path-create"
          onClick={() =>
            onCreate(
              world?.theme === "gonzo" ? "A yellow convertible on an endless desert highway, impossible sunset, distant neon and a sky full of strange possibilities." : world?.theme === "wonka" ? "An impossible chocolate factory with copper pipes, candy trees and a winding chocolate river." : "A secret garden on the moon, glowing flowers, impossible colors, a little storybook magic.",
            )
          }
        >
          <span className="path-icon">
            <Icon name="spark" size={23} />
          </span>
          <span>
            <strong>Dream up an image</strong>
            <small>Impossible is a good place to start.</small>
          </span>
          <Icon name="external" size={17} />
        </button>
        <button
          disabled={!interactive}
          className="wonder-path path-imagine"
          onClick={() =>
            onPrompt(
              "Let’s invent a curious little world together. Start by asking me one imaginative question, then build on my answer.",
            )
          }
        >
          <span className="path-icon">
            <Icon name="rabbit" size={24} />
          </span>
          <span>
            <strong>Get wonderfully lost</strong>
            <small>A story, a spark, a wild little idea.</small>
          </span>
          <Icon name="external" size={17} />
        </button>
      </div>
    </div>
  );
}
