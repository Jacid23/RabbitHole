import { useState } from "react";
import { WorldPreview } from "./WorldPreview";
import type { Model } from "./types";
import presets from "../../../integrations/comfyui/world-presets.json";

export type HoleConfiguration = {
  name?: string;
  description?: string;
  theme?: string;
  content_level?: string;
  min_age?: number;
  image_prompt?: string;
  chat_model?: string;
  chat_prompt?: string;
  enhancer_model?: string;
  enhancer_prompt?: string;
  default_loras?: string[];
};
export function HoleSettings({
  value,
  models,
  loras,
  maxLoras,
  onChange,
}: {
  value: HoleConfiguration;
  models: Model[];
  loras: { id: string; label?: string }[];
  maxLoras: number;
  onChange: (patch: HoleConfiguration) => void;
}) {
  const selected = value.default_loras || [];
  const [preview, setPreview] = useState(false);
  return (
    <fieldset className="hole-configuration">
      <legend>This hole’s experience</legend>
      <label>
        World theme / starter
        <select
          value={value.theme || "custom"}
          onChange={(event) => {
            const starter = presets.find(
              (preset) => preset.theme === event.target.value,
            );
            onChange(starter || { theme: "custom" });
          }}
        >
          <option value="custom">Rabbit Hole · custom</option>
          {presets.map((preset) => (
            <option key={preset.theme} value={preset.theme}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() => setPreview(true)}
      >
        Preview this world
      </button>
      {preview && (
        <WorldPreview
          theme={value.theme || "custom"}
          name={value.name}
          onClose={() => setPreview(false)}
        />
      )}
      <p className="control-hint">
        Choosing a starter fills its name and prompts. It changes the interface
        theme, not the installed models or LoRAs. Review your choices before
        publishing.
      </p>
      <label>
        Hole content level
        <select
          value={value.content_level || "general"}
          onChange={(event) => onChange({ content_level: event.target.value })}
        >
          <option value="general">General · all ages</option>
          <option value="teen">Teen · 13+</option>
          <option value="adult">Adult · 18+</option>
        </select>
      </label>
      <label>
        Minimum age
        <input
          type="number"
          min={0}
          max={120}
          value={value.min_age || 0}
          onChange={(event) =>
            onChange({ min_age: Number(event.target.value) })
          }
        />
      </label>
      {(
        [
          ["chat_model", "Chat model"],
          ["enhancer_model", "Enhancer model"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <select
            value={value[key] || ""}
            onChange={(event) => onChange({ [key]: event.target.value })}
          >
            <option value="">
              {key === "chat_model"
                ? "Use the account default"
                : "Use this hole’s chat model"}
            </option>
            {value[key] && !models.some((model) => model.id === value[key]) && (
              <option value={value[key]}>{value[key]} (unavailable)</option>
            )}
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label>
        Chat instructions
        <textarea
          rows={4}
          maxLength={12000}
          value={value.chat_prompt || ""}
          onChange={(event) => onChange({ chat_prompt: event.target.value })}
          placeholder="Personality, purpose, teaching approach, boundaries…"
        />
      </label>
      <label>
        Enhance instructions
        <textarea
          rows={3}
          maxLength={12000}
          value={value.enhancer_prompt || ""}
          onChange={(event) =>
            onChange({ enhancer_prompt: event.target.value })
          }
          placeholder="Your full enhancer instructions. Blank uses the standard prompt refiner."
        />
      </label>
      <label>
        Fixed image style
        <textarea
          rows={3}
          maxLength={12000}
          value={value.image_prompt || ""}
          onChange={(event) => onChange({ image_prompt: event.target.value })}
          placeholder="Applied to every image, even when Enhance is skipped."
        />
      </label>
      {!!loras.length && (
        <div className="fixed-loras">
          <strong>Always use these LoRAs</strong>
          {loras.map((lora) => (
            <label key={lora.id}>
              <input
                type="checkbox"
                checked={selected.includes(lora.id)}
                disabled={
                  !selected.includes(lora.id) && selected.length >= maxLoras
                }
                onChange={() =>
                  onChange({
                    default_loras: selected.includes(lora.id)
                      ? selected.filter((id) => id !== lora.id)
                      : [...selected, lora.id],
                  })
                }
              />
              {lora.label || lora.id}
            </label>
          ))}
        </div>
      )}
      <p className="control-hint">
        Users pick the hole, not its models or LoRAs. Fixed LoRAs use the
        strengths in your pool; LoRAs already in the workflow remain in place.
        Members still need access to the assigned models in Open WebUI.
      </p>
    </fieldset>
  );
}
