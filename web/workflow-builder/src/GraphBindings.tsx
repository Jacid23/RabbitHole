import type { Dispatch, SetStateAction } from "react";
import { Bindings } from "./Bindings";
import { candidates, type Binding, type Graph } from "./types";
type Props = {
  graph: Graph;
  prompts: Binding[];
  seeds: Binding[];
  images: Binding[];
  prefix: string;
  outputs: string[];
  setPrompts: Dispatch<SetStateAction<Binding[]>>;
  setSeeds: Dispatch<SetStateAction<Binding[]>>;
  setImages: Dispatch<SetStateAction<Binding[]>>;
  setPrefix: Dispatch<SetStateAction<string>>;
  setOutputs: Dispatch<SetStateAction<string[]>>;
};
export function GraphBindings({
  graph,
  prompts,
  seeds,
  images,
  prefix,
  outputs,
  setPrompts,
  setSeeds,
  setImages,
  setPrefix,
  setOutputs,
}: Props) {
  return (
    <section className="card">
      <div className="section-title">
        <span className="index">03</span>
        <h2>Choose what can change</h2>
      </div>
      <Bindings
        title="Prompt inputs"
        hint="Only these text inputs receive the user's image request. Existing negative prompts stay fixed."
        items={candidates(graph, "prompt")}
        value={prompts}
        onChange={setPrompts}
      />
      <label>
        Fixed prompt prefix <span className="optional">optional</span>
        <textarea
          rows={2}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="Your fixed style instructions, followed by a space…"
        />
      </label>
      <Bindings
        title="Fresh seed"
        hint="Selected seed inputs share one new seed per request. Uncheck to preserve the workflow's fixed seeds."
        items={candidates(graph, "seed")}
        value={seeds}
        onChange={setSeeds}
      />
      <Bindings
        title="Image input"
        hint="For editing/upscaling: selected LoadImage nodes receive the image attached in chat. Leave empty for text-to-image or fixed source images."
        items={candidates(graph, "image")}
        value={images}
        onChange={setImages}
      />
      <fieldset>
        <legend>Image output nodes</legend>
        <p className="hint">
          Select nodes that return image files, usually SaveImage. Only these
          outputs are delivered to chat.
        </p>
        {Object.entries(graph).map(([key, node]) => (
          <label
            className={`node-choice ${outputs.includes(key) ? "selected" : ""}`}
            key={key}
          >
            <input
              type="checkbox"
              checked={outputs.includes(key)}
              onChange={() =>
                setOutputs((v) =>
                  v.includes(key) ? v.filter((n) => n !== key) : [...v, key],
                )
              }
            />
            <span>
              #{key} · {node._meta?.title || node.class_type}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
