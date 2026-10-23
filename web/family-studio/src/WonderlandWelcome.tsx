import { Icon } from "./Icons";
import { WorldScene } from "./WorldScene";
import { StartingIdeas } from "./StartingIdeas";
import { useState } from "react";
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
  const examples = world?.opening?.examples || [];
  const [exampleIndex, setExampleIndex] = useState(() => randomIndex(examples.length));
  const [imageFailed, setImageFailed] = useState(false);
  const example = examples[exampleIndex];
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
    <div className={`wonder-welcome ${example ? "has-postcard-opening" : ""}`}>
      <div className={`wonder-hero ${example ? "has-postcard" : ""}`}>
        <div className="wonder-copy">
          <span className="wonder-chapter">
            <span>01</span> THE ADVENTURE IS YOURS
          </span>
          <h1>
            {text?.[0] || "A curious mind."}
            <br />
            <em>{text?.[1] || "A world away."}</em>
          </h1>
          {world?.opening?.greeting ? <p className="hole-greeting" tabIndex={0} aria-label="Character greeting">{world.opening.greeting}</p> : <p>
            {text?.[2] || "Ask the impossible. Make the imaginary."}
            <br />
            {themed ? world?.name : "See where the rabbit hole takes you."}
          </p>}
          <div className="wonder-signpost">
            <span className="wonder-star">✧</span> A little wonder goes a long
            way.
          </div>
        </div>
        <div className="wonder-portal">
          {example && !imageFailed ? (
            <>
              <img src={interactive ? `/api/workflows/${world!.id}/examples/${example.image}` : `/api/admin/opening-images/${example.image}`} width={1024} height={1024} alt={example.label} fetchPriority="high" onError={() => setImageFailed(true)} />
              <span className="postcard-caption">{example.label}</span>
            </>
          ) : themed ? (
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
              {examples.length > 1 && interactive && <button className="another-glimpse" type="button" onClick={() => { setExampleIndex((exampleIndex + 1 + randomIndex(examples.length - 1)) % examples.length); setImageFailed(false); }}>Another glimpse <span aria-hidden="true">↗</span></button>}
        </div>
      </div>
      <StartingIdeas world={world} example={example} onPrompt={onPrompt} onCreate={onCreate} interactive={interactive} />
    </div>
  );
}

function randomIndex(length: number) {
  if (length < 2) return 0;
  const limit = Math.floor(0x100000000 / length) * length;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % length;
}
