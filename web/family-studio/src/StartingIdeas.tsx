import { Icon } from "./Icons";
import type { Workflow, OpeningExample } from "./types";

export function StartingIdeas({ world, example, onPrompt, onCreate, interactive }: {
  world?: Workflow;
  example?: OpeningExample;
  onPrompt: (text: string) => void;
  onCreate: (text: string) => void;
  interactive: boolean;
}) {
  const chat = example ? [{ label: "Ask the guide", prompt: example.chat }] : world?.opening?.chat_starters ?? [
    { label: "Follow a question", prompt: "Teach me something wonderfully strange about the world. Explain it simply, then give me one question to explore next." },
    { label: "Get wonderfully lost", prompt: "Let’s invent a curious little world together. Start by asking me one imaginative question, then build on my answer." },
  ];
  const images = example ? [{ label: "Make this scene your own", prompt: example.prompt }] : world?.opening?.image_starters ?? [{
    label: "Dream up an image",
    prompt: world?.theme === "gonzo" ? "A red convertible on an endless desert highway, impossible sunset, distant neon and a sky full of strange possibilities." : world?.theme === "wonka" ? "An impossible chocolate factory with copper pipes, candy trees and a winding chocolate river." : "A secret garden on the moon, glowing flowers, impossible colors, a little storybook magic.",
  }];
  const ideas = [
    ...chat.slice(0, 1).map((idea) => ({ ...idea, kind: "chat" as const })),
    ...images.map((idea) => ({ ...idea, kind: "image" as const })),
    ...chat.slice(1).map((idea) => ({ ...idea, kind: "chat" as const })),
  ];
  if (!ideas.length) return null;
  return (
    <div className="opening-paths">
      <div className="wonder-path-heading"><span>CHOOSE A THREAD TO FOLLOW</span><span aria-hidden="true">↘</span></div>
      <div className={`wonder-paths ${example ? "example-starting-ideas" : ""} ${ideas.length > 3 ? "many-starting-ideas" : ""}`}>
        {ideas.map((idea, index) => (
          <button key={`${idea.kind}-${index}`} type="button" disabled={!interactive} className={`wonder-path ${idea.kind === "image" ? "path-create" : "path-learn"}`} onClick={() => (idea.kind === "image" ? onCreate : onPrompt)(idea.prompt)}>
            <span className="path-icon"><Icon name={idea.kind === "image" ? "spark" : "book"} size={22} /></span>
            <span><strong>{idea.label}</strong><small>{example ? (idea.kind === "chat" ? example.chat : example.label) : idea.kind === "image" ? "Image idea · make it your own." : "Chat starter · see where it goes."}</small></span>
            <Icon name="external" size={17} />
          </button>
        ))}
      </div>
    </div>
  );
}
