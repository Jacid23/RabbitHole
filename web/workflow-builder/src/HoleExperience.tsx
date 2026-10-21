import { EnhancerModel } from "./EnhancerModel";
import type { Recipe, WorkflowOptions } from "./types";
import presets from "../../../integrations/comfyui/world-presets.json";

export type Experience = Pick<
  Recipe,
  | "chat_model"
  | "chat_prompt"
  | "enhancer_prompt"
  | "default_loras"
  | "theme"
  | "content_level"
  | "min_age"
  | "image_prompt"
>;
export function HoleExperience({
  value,
  options,
  onChange,
  onStarter,
}: {
  value: Experience;
  options: WorkflowOptions;
  onChange: (value: Experience) => void;
  onStarter: (name: string, description: string) => void;
}) {
  const selected = value.default_loras || [];
  return (
    <>
      <label>
        World theme / starter
        <select
          value={value.theme || "custom"}
          onChange={(event) => {
            const preset = presets.find(
              (row) => row.theme === event.target.value,
            );
            if (preset) {
              onChange({
                ...value,
                theme: preset.theme,
                chat_prompt: preset.chat_prompt,
                enhancer_prompt: preset.enhancer_prompt,
                image_prompt: preset.image_prompt,
              });
              onStarter(preset.name, preset.description);
            } else onChange({ ...value, theme: "custom" });
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
      <p className="hint">
        Starters fill the name and prompts and change the interface theme.
        Select your own compatible models and LoRAs; none are downloaded or
        assigned automatically.
      </p>
      <label>
        Hole content level
        <select
          value={value.content_level || "general"}
          onChange={(event) =>
            onChange({ ...value, content_level: event.target.value })
          }
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
            onChange({ ...value, min_age: Number(event.target.value) })
          }
        />
      </label>
      <EnhancerModel
        label="Chat model"
        value={value.chat_model || ""}
        onChange={(chat_model) => onChange({ ...value, chat_model })}
      />
      <label>
        Chat instructions
        <textarea
          rows={4}
          maxLength={12000}
          value={value.chat_prompt || ""}
          onChange={(event) =>
            onChange({ ...value, chat_prompt: event.target.value })
          }
          placeholder="Define this hole’s personality, purpose, approach and boundaries."
        />
      </label>
      <label>
        Enhance instructions
        <textarea
          rows={3}
          maxLength={12000}
          value={value.enhancer_prompt || ""}
          onChange={(event) =>
            onChange({ ...value, enhancer_prompt: event.target.value })
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
          onChange={(event) =>
            onChange({ ...value, image_prompt: event.target.value })
          }
          placeholder="Applied to every image, even without Enhance."
        />
      </label>
      {!!options.loras?.entries.length && (
        <fieldset>
          <legend>Always use these LoRAs</legend>
          {options.loras.entries.map((entry) => (
            <label key={entry.id}>
              <input
                type="checkbox"
                checked={selected.includes(entry.id)}
                disabled={
                  !selected.includes(entry.id) &&
                  selected.length >= (options.loras?.max_count || 0)
                }
                onChange={() =>
                  onChange({
                    ...value,
                    default_loras: selected.includes(entry.id)
                      ? selected.filter((id) => id !== entry.id)
                      : [...selected, entry.id],
                  })
                }
              />
              {entry.label || entry.id}
            </label>
          ))}
        </fieldset>
      )}
      <p className="hint">
        Users choose this hole’s experience. Model and LoRA choices stay here;
        their prompt, shape, size and steps remain editable.
      </p>
    </>
  );
}
