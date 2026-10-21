import { useMemo, useState } from "react";
import { AssignmentGuide } from "./AssignmentGuide";
import { BuilderHeader } from "./BuilderHeader";
import { GraphBindings } from "./GraphBindings";
import { OptionsEditor } from "./OptionsEditor";
import { EnhancerModel } from "./EnhancerModel";
import { HoleExperience, type Experience } from "./HoleExperience";
import { validateOptions } from "./validateOptions";
import { buildTool, download } from "./export";
import {
  candidates,
  parseGraph,
  type Binding,
  type Graph,
  type Recipe,
  type WorkflowOptions,
} from "./types";
import "./style.css";
export function App() {
  const [options, setOptions] = useState<WorkflowOptions>({});
  const [experience, setExperience] = useState<Experience>({});
  const [graph, setGraph] = useState<Graph | null>(null),
    [fileName, setFileName] = useState(""),
    [name, setName] = useState(""),
    [id, setId] = useState(""),
    [description, setDescription] = useState(""),
    [enhancerModel, setEnhancerModel] = useState(""),
    [server, setServer] = useState("http://127.0.0.1:8188");
  const [prompts, setPrompts] = useState<Binding[]>([]),
    [seeds, setSeeds] = useState<Binding[]>([]),
    [images, setImages] = useState<Binding[]>([]),
    [outputs, setOutputs] = useState<string[]>([]),
    [prefix, setPrefix] = useState(""),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [notice, setNotice] = useState("");
  const [idEdited, setIdEdited] = useState(false),
    [pasted, setPasted] = useState("");
  const count = graph ? Object.keys(graph).length : 0;
  const recipe: Recipe | null = useMemo(
    () =>
      graph
        ? {
            id,
            name,
            description,
            enhancer_model: enhancerModel,
            ...experience,
            workflow: graph,
            prompt_inputs: prompts.map((p) => ({
              ...p,
              ...(prefix ? { prefix } : {}),
            })),
            seed_inputs: seeds,
            image_inputs: images,
            output_nodes: outputs,
            options,
          }
        : null,
    [
      graph,
      id,
      name,
      description,
      enhancerModel,
      experience,
      prompts,
      seeds,
      images,
      outputs,
      prefix,
      options,
    ],
  );
  function loadText(text: string, label: string) {
    try {
      const parsed = JSON.parse(text);
      const saved = parsed.workflow ? parsed : null;
      const next = parseGraph(saved ? saved.workflow : parsed);
      if (saved) validateOptions(next, saved.options);
      setGraph(next);
      setOptions(saved?.options || {});
      setEnhancerModel(saved?.enhancer_model || "");
      setExperience({
        chat_model: saved?.chat_model || "",
        chat_prompt: saved?.chat_prompt || "",
        enhancer_prompt: saved?.enhancer_prompt || "",
        default_loras: saved?.default_loras || [],
        theme: saved?.theme || "custom",
        content_level: saved?.content_level || "general",
        min_age: saved?.min_age || 0,
        image_prompt: saved?.image_prompt || "",
      });
      setFileName(label);
      setPrompts(
        saved
          ? saved.prompt_inputs
          : candidates(next, "prompt")
              .filter((c) => !/negative/i.test(c.label))
              .slice(0, 1)
              .map(({ node, key }) => ({ node, key })),
      );
      setSeeds(
        saved
          ? saved.seed_inputs
          : candidates(next, "seed").map(({ node, key }) => ({ node, key })),
      );
      setImages(saved ? saved.image_inputs : []);
      setOutputs(
        saved
          ? saved.output_nodes
          : Object.entries(next)
              .filter(([, n]) => /SaveImage/.test(n.class_type))
              .map(([key]) => key),
      );
      if (saved) {
        setName(saved.name);
        setId(saved.id);
        setIdEdited(true);
        setDescription(saved.description);
        setPrefix(saved.prompt_inputs?.[0]?.prefix || "");
      } else {
        setPrefix("");
      }
      setCode("");
      setError("");
      setNotice(
        "Workflow loaded. Review the selected inputs before exporting.",
      );
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  async function load(file: File) {
    loadText(await file.text(), file.name);
  }
  function exportTool() {
    try {
      if (!recipe) throw Error("Load a workflow first.");
      const tool = buildTool(recipe, server);
      setCode(tool.content);
      download(id + ".json", JSON.stringify([tool], null, 2));
      setError("");
      setNotice(
        "Tool exported. Import it into Open WebUI, then assign it to a Workspace model.",
      );
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }
  return (
    <main>
      <BuilderHeader />
      <div className="workspace">
        <div className="editor">
          <section className="card upload">
            <div className="section-title">
              <span className="index">01</span>
              <h2>Choose your workflow</h2>
            </div>
            <p className="hint">
              In ComfyUI: File → Export (API). Choose that JSON file here.
            </p>
            <label className="file-picker">
              <input
                aria-label="Choose API workflow JSON"
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  if (e.target.files?.[0]) void load(e.target.files[0]);
                }}
              />
              <span className="upload-icon">↗</span>
              <strong>{fileName || "Open API workflow JSON"}</strong>
              <span>
                {graph
                  ? `${count} nodes · original graph preserved`
                  : "Stays on this computer. No service or account needed."}
              </span>
            </label>
            <details>
              <summary>Or paste API JSON / a saved builder recipe</summary>
              <textarea
                aria-label="Paste workflow JSON"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={5}
              />
              <button
                className="secondary"
                onClick={() => loadText(pasted, "Pasted workflow")}
              >
                Load pasted JSON
              </button>
            </details>
          </section>
          <section className="card">
            <div className="section-title">
              <span className="index">02</span>
              <h2>Name & purpose</h2>
            </div>
            <label>
              Tool name
              <input
                value={name}
                placeholder="ComfyUI Portraits"
                onChange={(e) => {
                  setName(e.target.value);
                  if (!idEdited)
                    setId(
                      "comfy_" +
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "_")
                          .replace(/_+$/, ""),
                    );
                }}
              />
            </label>
            <label>
              Tool ID
              <input
                value={id}
                onChange={(e) => {
                  setIdEdited(true);
                  setId(e.target.value);
                }}
                placeholder="comfy_portraits"
                spellCheck={false}
              />
            </label>
            <label>
              When should the chat model use it?
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Create a tall character portrait. Use when the user asks for a portrait or vertical image."
                rows={3}
              />
            </label>
            <label>
              ComfyUI server URL
              <input
                value={server}
                onChange={(e) => setServer(e.target.value)}
                spellCheck={false}
              />
            </label>
            <EnhancerModel value={enhancerModel} onChange={setEnhancerModel} />
            <HoleExperience
              value={experience}
              options={options}
              onChange={setExperience}
              onStarter={(nextName, nextDescription) => {
                setName(nextName);
                setDescription(nextDescription);
                if (!idEdited)
                  setId(
                    nextName
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "_")
                      .replace(/^_|_$/g, ""),
                  );
              }}
            />
            <p className="hint">
              This address is used by the Open WebUI server. Users never connect
              to it directly.
            </p>
          </section>
          {graph && (
            <GraphBindings
              graph={graph}
              prompts={prompts}
              seeds={seeds}
              images={images}
              prefix={prefix}
              outputs={outputs}
              setPrompts={setPrompts}
              setSeeds={setSeeds}
              setImages={setImages}
              setPrefix={setPrefix}
              setOutputs={setOutputs}
            />
          )}
          {graph && (
            <OptionsEditor
              graph={graph}
              value={options}
              onChange={(next) => {
                setOptions(next);
                const allowed =
                  next.loras?.entries.map((entry) => entry.id) || [];
                setExperience((current) => ({
                  ...current,
                  default_loras: (current.default_loras || [])
                    .filter((id) => allowed.includes(id))
                    .slice(0, next.loras?.max_count || 0),
                }));
              }}
            />
          )}
        </div>
        <aside>
          <section className="card summary">
            <p className="eyebrow">THE TOOL CONTRACT</p>
            <h2>{name || "Your next workflow"}</h2>
            <p>
              {description ||
                "A clear purpose lets the model choose the right tool when several are assigned."}
            </p>
            <dl>
              <div>
                <dt>Workflow nodes</dt>
                <dd>{count || "—"}</dd>
              </div>
              <div>
                <dt>Prompt inputs</dt>
                <dd>{prompts.length}</dd>
              </div>
              <div>
                <dt>Seed inputs</dt>
                <dd>{seeds.length}</dd>
              </div>
              <div>
                <dt>Image inputs</dt>
                <dd>{images.length}</dd>
              </div>
              <div>
                <dt>Output nodes</dt>
                <dd>{outputs.length}</dd>
              </div>
            </dl>
            <p className="locked">
              <span>⌁</span> Your base model, sampler and other graph settings
              stay fixed. Chat can change only approved size/step controls and
              choose LoRAs from your pool.
            </p>
            <button className="primary" disabled={!graph} onClick={exportTool}>
              Export Open WebUI tool <span>↗</span>
            </button>
            {recipe && (
              <button
                className="secondary"
                onClick={() =>
                  download(
                    (id || "workflow") + ".recipe.json",
                    JSON.stringify(recipe, null, 2),
                  )
                }
              >
                Save builder recipe
              </button>
            )}
            {code && (
              <button
                className="secondary"
                onClick={() => download(id + ".py", code, "text/x-python")}
              >
                Download Python source
              </button>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
          </section>
          <AssignmentGuide />
        </aside>
      </div>
      {code && (
        <details className="card source">
          <summary>
            Python source · paste into Tools if JSON import is unavailable
          </summary>
          <textarea
            aria-label="Generated Python source"
            readOnly
            rows={12}
            value={code}
          />
        </details>
      )}
      <footer>
        Runs locally · API graphs remain on your computer · Full-resolution
        images and metadata are delivered through Open WebUI
      </footer>
    </main>
  );
}
