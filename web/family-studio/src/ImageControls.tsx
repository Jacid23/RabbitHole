import { useState } from "react";
import { Icon } from "./Icons";
import type { ImageOptions, Workflow } from "./types";
export function ImageControls({
  workflow,
  value,
  onChange,
}: {
  workflow: Workflow;
  value: ImageOptions;
  onChange: (value: ImageOptions) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const size = workflow.size;
  return (
    <div className="image-controls">
      {size && (
        <>
          <div className="control-heading">
            <span>Shape</span>
            <span>{value.aspect_ratio}</span>
          </div>
          <div className="ratio-picker" role="group" aria-label="Aspect ratio">
            {size.ratios.map((ratio) => {
              const [w, h] = ratio.split(":").map(Number);
              return (
                <button
                  type="button"
                  key={ratio}
                  aria-pressed={value.aspect_ratio === ratio}
                  className={value.aspect_ratio === ratio ? "selected" : ""}
                  onClick={() => onChange({ ...value, aspect_ratio: ratio })}
                >
                  <span
                    className="ratio-shape"
                    style={{
                      width: Math.round((20 * w) / Math.max(w, h)),
                      height: Math.round((20 * h) / Math.max(w, h)),
                    }}
                  />
                  <small>{ratio}</small>
                </button>
              );
            })}
          </div>
          <div className="control-heading">
            <span>Resolution</span>
            <span>Long edge</span>
          </div>
          <div className="segmented">
            {Object.entries(size.resolutions).map(([name, pixels]) => (
              <button
                type="button"
                aria-pressed={value.resolution === name}
                key={name}
                className={value.resolution === name ? "selected" : ""}
                onClick={() => onChange({ ...value, resolution: name })}
              >
                <strong>{name}</strong>
                <span>{pixels.toLocaleString()} px</span>
              </button>
            ))}
          </div>
        </>
      )}
      {workflow.steps && (
        <>
          <div className="control-heading">
            <label htmlFor="image-steps">Detail steps</label>
            <span className="step-value">{value.steps}</span>
          </div>
          <input
            id="image-steps"
            className="range"
            type="range"
            min={workflow.steps.min}
            max={workflow.steps.max}
            value={value.steps}
            onChange={(e) =>
              onChange({ ...value, steps: Number(e.target.value) })
            }
          />
          <p className="control-hint">
            More steps take longer. The default is a good starting point.
          </p>
        </>
      )}
      <button
        type="button"
        className="advanced-toggle"
        aria-expanded={advanced}
        onClick={() => setAdvanced((v) => !v)}
      >
        <Icon name="settings" size={15} />
        Advanced options
        <Icon name="chevron" size={14} />
      </button>
      {advanced && (
        <div className="advanced-options">
          {workflow.seed && (
            <label>
              Seed
              <input
                type="number"
                min={-1}
                max={9007199254740991}
                value={value.seed}
                onChange={(e) =>
                  onChange({ ...value, seed: Number(e.target.value) })
                }
              />
              <small>
                −1 chooses a fresh seed. Reuse a seed to explore variations.
              </small>
            </label>
          )}
          <p>Original generation metadata stays in your downloaded image.</p>
        </div>
      )}
    </div>
  );
}
