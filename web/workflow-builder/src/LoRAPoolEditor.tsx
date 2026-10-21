import { useState } from "react";
import type { Graph, WorkflowOptions } from "./types";
type Pool = NonNullable<WorkflowOptions["loras"]>;
export function LoRAPoolEditor({
  graph,
  pool,
  onChange,
}: {
  graph: Graph;
  pool?: Pool;
  onChange: (pool?: Pool) => void;
}) {
  const [catalog, setCatalog] = useState<string[]>([]),
    [error, setError] = useState("");
  const targets = Object.entries(graph).filter(([, node]) =>
    Array.isArray(node.inputs.model),
  );
  const update = (index: number, patch: Partial<Pool["entries"][number]>) =>
    pool &&
    onChange({
      ...pool,
      entries: pool.entries.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry,
      ),
    });
  async function load(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || !data.every((v) => typeof v === "string"))
        throw Error(
          "Choose the installed LoRA catalog JSON, a list of filenames.",
        );
      setCatalog(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <fieldset className="option-section">
      <legend>Approved LoRA pool</legend>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={!!pool}
          disabled={!targets.length}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    target: { node: targets[0][0], key: "model" },
                    max_count: 3,
                    entries: [],
                  }
                : undefined,
            )
          }
        />
        Allow users to choose from this pool
      </label>
      <p className="hint">
        Only these approved files can be loaded. The stack is inserted before
        the selected MODEL input; existing workflow LoRAs remain in place. This
        adapter loads model weights only, without changing CLIP. Choose
        compatible LoRAs.
      </p>
      {pool && (
        <>
          <label>
            Apply the pool before
            <select
              value={pool.target.node}
              onChange={(e) =>
                onChange({
                  ...pool,
                  target: { node: e.target.value, key: "model" },
                })
              }
            >
              {targets.map(([id, n]) => (
                <option key={id} value={id}>
                  #{id} · {n._meta?.title || n.class_type} · model
                </option>
              ))}
            </select>
          </label>
          <label>
            Maximum selected LoRAs
            <input
              type="number"
              min={1}
              max={4}
              value={pool.max_count}
              onChange={(e) =>
                onChange({ ...pool, max_count: Number(e.target.value) })
              }
            />
          </label>
          <label className="catalog-input">
            Load installed LoRA catalog{" "}
            <span className="optional">optional · LoRA Catalog.json</span>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                if (e.target.files?.[0]) void load(e.target.files[0]);
              }}
            />
          </label>
          {catalog.length > 0 && (
            <p className="hint">
              {catalog.length} installed filenames loaded. The catalog is
              inventory, not a compatibility or age-rating check.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {pool.entries.map((entry, index) => (
            <section className="lora-entry" key={index}>
              <div className="section-title">
                <h3>LoRA {index + 1}</h3>
                <button
                  type="button"
                  className="remove"
                  aria-label={`Remove LoRA ${index + 1}`}
                  onClick={() =>
                    onChange({
                      ...pool,
                      entries: pool.entries.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove
                </button>
              </div>
              <label>
                Approved name
                <input
                  value={entry.id}
                  placeholder="watercolor"
                  onChange={(e) =>
                    update(index, { id: e.target.value, label: e.target.value })
                  }
                />
              </label>
              <label>
                Installed filename
                <input
                  list="installed-loras"
                  value={entry.filename}
                  spellCheck={false}
                  placeholder="Krea2\Watercolor.safetensors"
                  onChange={(e) => update(index, { filename: e.target.value })}
                />
              </label>
              <div className="control-grid">
                <label>
                  Approved maximum strength
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.05}
                    value={entry.strength}
                    onChange={(e) =>
                      update(index, { strength: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Trigger words
                  <input
                    value={entry.trigger || ""}
                    placeholder="optional"
                    onChange={(e) => update(index, { trigger: e.target.value })}
                  />
                </label>
              </div>
            </section>
          ))}
          <datalist id="installed-loras">
            {catalog.map((file) => (
              <option value={file} key={file} />
            ))}
          </datalist>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              onChange({
                ...pool,
                entries: [
                  ...pool.entries,
                  { id: "", filename: "", strength: 1, trigger: "" },
                ],
              })
            }
          >
            Add approved LoRA
          </button>
          <p className="hint">
            Chat selects approved names and can reduce strength with a 0–1
            multiplier. An empty pool allows no LoRAs. Filenames and trigger
            words stay in the administrator configuration.
          </p>
        </>
      )}
    </fieldset>
  );
}
