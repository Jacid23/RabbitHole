import template from "../../../integrations/comfyui/tool_template.py?raw";
import panel from "../../../integrations/openwebui/panel.py?raw";
import controls from "../../../integrations/comfyui/controls.py?raw";
import type { Recipe } from "./types";
import { validateOptions } from "./validateOptions";
export function buildTool(recipe: Recipe, server: string) {
  if (recipe.enhancer_model !== undefined && (typeof recipe.enhancer_model !== "string" || recipe.enhancer_model.length > 200 || recipe.enhancer_model.trim() !== recipe.enhancer_model))
    throw Error("Choose a valid enhancer model or leave it blank.");
  validateOptions(recipe.workflow, recipe.options);
  if (!/^[a-z][a-z0-9_]{2,55}$/.test(recipe.id))
    throw Error(
      "Use a tool ID with 3–56 lowercase letters, numbers or underscores, starting with a letter.",
    );
  if (!recipe.description.trim() || !recipe.name.trim())
    throw Error("Add a name and purpose.");
  if (!recipe.prompt_inputs.length && !recipe.image_inputs.length)
    throw Error("Choose a prompt input or an image input.");
  if (!recipe.output_nodes.length)
    throw Error("Choose at least one image output node.");
  if (!/^https?:\/\//.test(server))
    throw Error("ComfyUI URL must start with http:// or https://.");
  const options = recipe.options || {};
  const parameters: string[] = [],
    optionValues: string[] = [];
  if (recipe.seed_inputs.length) {
    parameters.push("seed: int = -1, ");
    optionValues.push('"seed": seed');
  }
  for (const [enabled, fields] of [
    [
      options.size,
      [
        ["aspect_ratio", "str", "''"],
        ["resolution", "str", "''"],
      ],
    ],
    [options.steps, [["steps", "int", "0"]]],
    [
      options.loras,
      [
        ["loras", "list[str]", "None"],
        ["lora_strength", "float", "1.0"],
      ],
    ],
  ] as [unknown, string[][]][]) {
    if (enabled)
      for (const [key, type, value] of fields) {
        parameters.push(`${key}: ${type} = ${value}, `);
        optionValues.push(`${JSON.stringify(key)}: ${key}`);
      }
  }
  let description =
    recipe.description +
    ". Runs the administrator workflow with approved controls only; never accepts arbitrary model filenames, LoRA filenames, workflow graphs or workflow IDs. Display returned image URLs with Markdown image syntax. Omit size and steps to preserve workflow defaults; use options tool for approved options. ";
  if (options.size)
    description += `Ratios: ${options.size.ratios.join(", ")}. Resolution long-edge tiers: ${JSON.stringify(options.size.resolutions)}. `;
  if (options.steps)
    description += `Steps: ${options.steps.min}–${options.steps.max}. `;
  if (options.loras)
    description += `Approved LoRA names: ${JSON.stringify(options.loras.entries.map((e) => e.id))}. No LoRAs unless explicitly requested.`;
  const values: Record<string, string> = {
    __SERVER_LITERAL__: JSON.stringify(server),
    __PANEL_SOURCE__: panel.replaceAll("Qwen Image", "ComfyUI"),
    __CONTROLS_SOURCE__: controls,
    __TOOL_FUNCTION__: "run_" + recipe.id,
    __CHECK_FUNCTION__: "check_" + recipe.id,
    __SETTINGS_FUNCTION__: "options_" + recipe.id,
    __CONTROL_PARAMETERS__: parameters.join(""),
    __CONTROL_VALUES__: "{" + optionValues.join(", ") + "}",
    __DESCRIPTION_LITERAL__: JSON.stringify(description),
    __IMAGE_PARAMETER__: recipe.image_inputs.length ? "image: str = '', " : "",
    __IMAGE_VALUE__: recipe.image_inputs.length ? "image" : "''",
  };
  let code = template;
  for (const [key, value] of Object.entries(values))
    code = code.replaceAll(key, () => value);
  code = code.replace(
    "__RECIPE_LITERAL__",
    () => "json.loads(" + JSON.stringify(JSON.stringify(recipe)) + ")",
  );
  return {
    id: recipe.id,
    name: recipe.name,
    content: code,
    meta: { description: recipe.description, manifest: { version: "1.1.0" } },
    access_grants: [],
  };
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
