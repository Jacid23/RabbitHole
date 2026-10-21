import type { Graph, WorkflowOptions } from "./types";
import { LoRAPoolEditor } from "./LoRAPoolEditor";
const ratios = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];
export function OptionsEditor({
  graph,
  value,
  onChange,
}: {
  graph: Graph;
  value: WorkflowOptions;
  onChange: (value: WorkflowOptions) => void;
}) {
  const sizeNodes = Object.entries(graph).filter(
    ([, node]) => "width" in node.inputs && "height" in node.inputs,
  );
  const stepNodes = Object.entries(graph).filter(
    ([, node]) => typeof node.inputs.steps === "number",
  );
  return (
    <section className="card">
      <div className="section-title">
        <span className="index">04</span>
        <h2>Approved image controls</h2>
      </div>
      <p className="hint">
        Expose ordinary generation options while keeping the rest of your
        workflow fixed. Omitted options preserve the exported settings.
      </p>
      <fieldset className="option-section">
        <legend>Aspect ratio & resolution</legend>
        <label className="toggle-row">
          <input
            type="checkbox"
            disabled={!sizeNodes.length}
            checked={!!value.size}
            onChange={(e) =>
              onChange({
                ...value,
                size: e.target.checked
                  ? {
                      node: sizeNodes[0][0],
                      width_key: "width",
                      height_key: "height",
                      ratios: [...ratios],
                      resolutions: { "1K": 1024, "2K": 2048 },
                      default_ratio: "1:1",
                      default_resolution: "1K",
                      multiple: 8,
                    }
                  : undefined,
              })
            }
          />
          Let users request ratio and resolution
        </label>
        {value.size && (
          <>
            <label>
              Width / height node
              <select
                value={value.size.node}
                onChange={(e) =>
                  onChange({
                    ...value,
                    size: { ...value.size!, node: e.target.value },
                  })
                }
              >
                {sizeNodes.map(([id, n]) => (
                  <option key={id} value={id}>
                    #{id} · {n._meta?.title || n.class_type}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              An explicit size request replaces this node's width/height values
              or links. Other resolution branches remain fixed. Tiers specify
              the long edge: 1K = 1024 px, 2K = 2048 px. Dimensions round to
              multiples of 8.
            </p>
            <div className="ratio-options">
              {ratios.map((ratio) => (
                <label className="toggle-row" key={ratio}>
                  <input
                    type="checkbox"
                    checked={value.size!.ratios.includes(ratio)}
                    onChange={() => {
                      const size = value.size!;
                      const next = size.ratios.includes(ratio)
                        ? size.ratios.filter((r) => r !== ratio)
                        : [...size.ratios, ratio];
                      onChange({
                        ...value,
                        size: {
                          ...size,
                          ratios: next,
                          default_ratio: next.includes(size.default_ratio)
                            ? size.default_ratio
                            : next[0] || "",
                        },
                      });
                    }}
                  />
                  {ratio}
                </label>
              ))}
            </div>
            <div className="control-grid">
              <label>
                Default ratio for a resolution-only request
                <select
                  value={value.size.default_ratio}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      size: { ...value.size!, default_ratio: e.target.value },
                    })
                  }
                >
                  {value.size.ratios.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label>
                Default tier for a ratio-only request
                <select
                  value={value.size.default_resolution}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      size: {
                        ...value.size!,
                        default_resolution: e.target.value,
                      },
                    })
                  }
                >
                  {Object.keys(value.size.resolutions).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
      </fieldset>
      <fieldset className="option-section">
        <legend>Sampling steps</legend>
        <label className="toggle-row">
          <input
            type="checkbox"
            disabled={!stepNodes.length}
            checked={!!value.steps}
            onChange={(e) =>
              onChange({
                ...value,
                steps: e.target.checked
                  ? { node: stepNodes[0][0], key: "steps", min: 1, max: 50 }
                  : undefined,
              })
            }
          />
          Let users request steps within a range
        </label>
        {value.steps && (
          <>
            <label>
              Sampler node
              <select
                value={value.steps.node}
                onChange={(e) =>
                  onChange({
                    ...value,
                    steps: { ...value.steps!, node: e.target.value },
                  })
                }
              >
                {stepNodes.map(([id, n]) => (
                  <option key={id} value={id}>
                    #{id} · {n._meta?.title || n.class_type}
                  </option>
                ))}
              </select>
            </label>
            <div className="control-grid">
              <label>
                Minimum
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={value.steps.min}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      steps: { ...value.steps!, min: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={value.steps.max}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      steps: { ...value.steps!, max: Number(e.target.value) },
                    })
                  }
                />
              </label>
            </div>
            <p className="hint">
              Default is the exported sampler setting. More steps can take
              longer without improving turbo/distilled models; choose a range
              suited to the checkpoint.
            </p>
          </>
        )}
      </fieldset>
      <LoRAPoolEditor
        graph={graph}
        pool={value.loras}
        onChange={(loras) => onChange({ ...value, loras })}
      />
    </section>
  );
}
