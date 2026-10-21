import { AdminLoraEntry } from "./AdminLoraEntry";
import { useEffect, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icons";
import type { Model } from "./types";
import { HoleSettings, type HoleConfiguration } from "./HoleSettings";
type Entry = {
  id: string;
  label?: string;
  filename: string;
  strength: number;
  trigger?: string;
};
type Recipe = HoleConfiguration & {
  enhancer_model?: string;
  id: string;
  name: string;
  description: string;
  workflow: Record<string, unknown>;
  options?: {
    steps?: { min: number; max: number };
    loras?: { entries: Entry[]; max_count: number };
  };
  [key: string]: unknown;
};
export function AdminView({ onSaved }: { onSaved: () => void }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]),
    [models, setModels] = useState<Model[]>([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<Recipe | null>(null),
    [catalog, setCatalog] = useState<string[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [openwebui, setOpenwebui] = useState("");
  useEffect(() => {
    api<{ recipes: Recipe[]; openwebui: string; models: Model[] }>("/api/admin/workflows")
      .then((value) => {
        setRecipes(value.recipes);
        setModels(value.models);
        setOpenwebui(value.openwebui);
        setSelected(value.recipes[0]?.id || "");
        setDraft(value.recipes[0] || null);
      })
      .catch((e) => setError(e.message));
  }, []);
  const patchEntry = (index: number, patch: Partial<Entry>) => {
    if (draft?.options?.loras)
      setDraft({
        ...draft,
        default_loras: (draft.default_loras || []).map((id) => id === draft.options!.loras!.entries[index].id && patch.id ? patch.id : id),
        options: {
          ...draft.options,
          loras: {
            ...draft.options.loras,
            entries: draft.options.loras.entries.map((entry, i) =>
              i === index ? { ...entry, ...patch } : entry,
            ),
          },
        },
      });
  };
  return (
    <section className="admin-page">
      <div className="view-top">
        <div className="breadcrumb">
          Your space <span>/</span> Manage Rabbit Hole
        </div>
        <span className="page-tag">ADMINISTRATOR</span>
      </div>
      <div className="admin-intro">
        <p className="eyebrow">THOUGHTFULLY SET UP. SIMPLE TO USE.</p>
        <h1>
          Behind <em>the scenes.</em>
        </h1>
        <p>
          Choose what your family can create with. Account and group permissions
          stay in Open WebUI.
        </p>
      </div>
      <div className="admin-links">
        <a
          href={openwebui + "/workspace/models"}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="lock" />
          Models & account access
          <Icon name="external" size={15} />
        </a>
        <a href="/api/admin/builder" target="_blank" rel="noreferrer">
          <Icon name="grid" />
          Open workflow builder
          <Icon name="external" size={15} />
        </a>
        <label className="import-recipe">
          <Icon name="plus" />
          Import builder recipe
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                const recipe = JSON.parse(await file.text());
                if (!recipe.id || !recipe.workflow)
                  throw Error(
                    "Choose a saved builder recipe, not a canvas export.",
                  );
                setDraft(recipe);
                setSelected("");
                setNotice(
                  "Review the imported recipe, then publish it privately.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        </label>
      </div>
      <div className="admin-layout panel-scroll" role="region" aria-label="Workflow settings" tabIndex={0}>
        <section className="admin-workflows">
          <h2>Image workflows</h2>
          {recipes.map((recipe) => (
            <button
              key={recipe.id}
              className={selected === recipe.id ? "selected" : ""}
              onClick={() => {
                setSelected(recipe.id);
                setDraft(JSON.parse(JSON.stringify(recipe)));
                setError("");
                setNotice("");
              }}
            >
              <Icon name="image" size={18} />
              <span>
                {recipe.name.replace("ComfyUI ", "")}
                <small>{recipe.id}</small>
              </span>
              <Icon name="chevron" size={14} />
            </button>
          ))}
        </section>
        {draft && (
          <section className="admin-editor">
            <div className="section-heading">
              <h2>{draft.name.replace("ComfyUI ", "")}</h2>
              <span>APPROVED OPTIONS</span>
            </div>
            <label>
              Display name
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Purpose
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <HoleSettings value={draft} models={models} loras={draft.options?.loras?.entries || []} maxLoras={draft.options?.loras?.max_count || 0} onChange={(patch) => setDraft({ ...draft, ...patch })} />
            {draft.options?.steps && (
              <div className="admin-step-grid">
                <label>
                  Minimum steps
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.options.steps.min}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        options: {
                          ...draft.options,
                          steps: {
                            ...draft.options!.steps!,
                            min: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Maximum steps
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.options.steps.max}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        options: {
                          ...draft.options,
                          steps: {
                            ...draft.options!.steps!,
                            max: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
              </div>
            )}
            <div className="section-heading pool-heading">
              <h2>Approved LoRA pool</h2>
              <button
                className="text-button"
                onClick={() =>
                  api<string[]>("/api/admin/loras")
                    .then(setCatalog)
                    .catch((e) => setError(e.message))
                }
              >
                <Icon name="refresh" size={14} />
                Load installed files
              </button>
            </div>
            <p className="control-hint">
              Build your fixed LoRA preset above from this pool. Users do not get LoRA controls.
              Select files compatible with its base model; a filename alone does
              not establish compatibility or suitability for younger users.
            </p>
            {draft.options?.loras ? (
              <>
                <label>
                  Maximum LoRAs in one image
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={draft.options.loras.max_count}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        options: {
                          ...draft.options,
                          loras: {
                            ...draft.options!.loras!,
                            max_count: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                </label>
                {draft.options.loras.entries.map((entry, index) => (
                  <AdminLoraEntry
                    key={index}
                    entry={entry}
                    index={index}
                    onChange={(patch) => patchEntry(index, patch)}
                    onRemove={() =>
                      setDraft({
                        ...draft,
                        default_loras: (draft.default_loras || []).filter((id) => id !== entry.id),
                        options: {
                          ...draft.options,
                          loras: {
                            ...draft.options!.loras!,
                            entries: draft.options!.loras!.entries.filter(
                              (_, i) => i !== index,
                            ),
                          },
                        },
                      })
                    }
                  />
                ))}
                <datalist id="admin-lora-files">
                  {catalog.map((file) => (
                    <option key={file}>{file}</option>
                  ))}
                </datalist>
                <button
                  className="secondary"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      options: {
                        ...draft.options,
                        loras: {
                          ...draft.options!.loras!,
                          entries: [
                            ...draft.options!.loras!.entries,
                            { id: "", filename: "", strength: 1 },
                          ],
                        },
                      },
                    })
                  }
                >
                  <Icon name="plus" size={16} />
                  Add approved style
                </button>
              </>
            ) : (
              <p className="control-hint">
                Enable a pool in the workflow builder to choose its MODEL input
                first.
              </p>
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
            <button
              className="primary admin-save"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("/api/admin/workflows", draft);
                  setNotice(
                    "Published. Existing access grants were preserved.",
                  );
                  onSaved();
                  const value = await api<{ recipes: Recipe[] }>(
                    "/api/admin/workflows",
                  );
                  setRecipes(value.recipes);
                  setSelected(draft.id);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Publishing…" : "Publish approved options"}
              <Icon name="check" size={16} />
            </button>
            <p className="control-hint">
              This updates the Open WebUI tool and its saved recipe together.
              New workflows start private; assign their tool access in Open
              WebUI before sharing.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
