import { useId } from "react";
import type { HoleOpening, StartingIdea } from "./types";
import { OpeningExamples } from "./OpeningExamples";

export function OpeningSettings({ value, onChange, uploadEnabled }: {
  value?: HoleOpening;
  onChange: (value: HoleOpening) => void;
  uploadEnabled?: boolean;
}) {
  const id = useId();
  const patch = (change: Partial<HoleOpening>) => onChange({ ...value, ...change });
  const edit = (kind: "chat_starters" | "image_starters", index: number, change: Partial<StartingIdea>) =>
    patch({ [kind]: (value?.[kind] || []).map((row, i) => i === index ? { ...row, ...change } : row) });
  return (
    <fieldset className="opening-settings">
      <legend>When someone enters</legend>
      <label>Opening screen
        <select value={value?.screen || "chat"} onChange={(event) => patch({ screen: event.target.value as "chat" | "create" })}>
          <option value="chat">Chat · meet the character</option>
          <option value="create">Create image · start with an idea</option>
        </select>
      </label>
      <label>Character’s opening greeting
        <textarea rows={3} maxLength={1600} value={value?.greeting || ""} onChange={(event) => patch({ greeting: event.target.value })} placeholder="Welcome them in your character’s voice. Leave blank for the theme’s usual introduction." />
      </label>
      <p className="control-hint">Shown in a new chat and included in its context. Existing conversations keep their history.</p>
      <OpeningExamples value={value?.examples || []} onChange={(examples) => patch({ examples })} uploadEnabled={uploadEnabled} />
      {!!value?.examples?.length && <p className="control-hint">The selected postcard supplies the two opening buttons. Remove all postcards to use standalone conversation starters and image ideas instead.</p>}
      {!value?.examples?.length && (["chat_starters", "image_starters"] as const).map((kind) => (
        <div className="opening-ideas-editor" key={kind}>
          <strong>{kind === "chat_starters" ? "Conversation starters" : "Image ideas"}</strong>
          {(value?.[kind] || []).map((idea, index) => (
            <div className="opening-idea-editor" key={index}>
              <label htmlFor={`${id}-${kind}-${index}-label`}>Button label
                <input id={`${id}-${kind}-${index}-label`} value={idea.label} maxLength={70} onChange={(event) => edit(kind, index, { label: event.target.value })} />
              </label>
              <label htmlFor={`${id}-${kind}-${index}-prompt`}>{kind === "chat_starters" ? "Message to start with" : "Image prompt to start with"}
                <textarea id={`${id}-${kind}-${index}-prompt`} rows={3} maxLength={12000} value={idea.prompt} onChange={(event) => edit(kind, index, { prompt: event.target.value })} />
              </label>
              <button type="button" className="text-button" aria-label={`Remove ${idea.label || 'starting idea'}`} onClick={() => patch({ [kind]: (value?.[kind] || []).filter((_, i) => i !== index) })}>Remove idea</button>
            </div>
          ))}
          <button type="button" className="secondary" disabled={(value?.[kind]?.length || 0) >= 3} onClick={() => patch({ [kind]: [...(value?.[kind] || []), { label: "", prompt: "" }] })}>Add {kind === "chat_starters" ? "conversation starter" : "image idea"}</button>
        </div>
      ))}
      <p className="control-hint">Up to three of each. Buttons put the idea into the editor so people can change it before sending. Opening on Create image uses your first image idea as the initial draft. Nothing sends or generates automatically.</p>
    </fieldset>
  );
}
