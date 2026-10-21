import type { Graph, WorkflowOptions } from "./types";
export function validateOptions(graph: Graph, options: WorkflowOptions = {}) {
  const { size, steps, loras } = options;
  if (size) {
    const inputs = graph[size.node]?.inputs;
    if (!inputs || !(size.width_key in inputs) || !(size.height_key in inputs))
      throw Error("Choose an existing width/height node.");
    if (
      !Array.isArray(size.ratios) ||
      !size.ratios.length ||
      size.ratios.some(
        (r) =>
          !/^\d+:\d+$/.test(r) ||
          r.split(":").some((v) => Number(v) < 1 || Number(v) > 32),
      )
    )
      throw Error("Choose valid approved ratios.");
    if (
      !size.ratios.includes(size.default_ratio) ||
      !size.resolutions ||
      !(size.default_resolution in size.resolutions)
    )
      throw Error(
        "Choose defaults from the approved ratios and resolution tiers.",
      );
    if (
      Object.values(size.resolutions).some(
        (v) => !Number.isInteger(v) || v < 256 || v > 4096,
      )
    )
      throw Error(
        "Resolution tiers must use long-edge sizes from 256 through 4096 pixels.",
      );
  }
  if (steps) {
    if (typeof graph[steps.node]?.inputs[steps.key] !== "number")
      throw Error("Choose an existing steps input.");
    if (
      !Number.isInteger(steps.min) ||
      !Number.isInteger(steps.max) ||
      steps.min < 1 ||
      steps.max > 100 ||
      steps.max < steps.min
    )
      throw Error("Choose a step range between 1 and 100.");
  }
  if (loras) {
    if (!Array.isArray(graph[loras.target?.node]?.inputs[loras.target?.key]))
      throw Error("Choose a linked MODEL input for the LoRA pool.");
    if (
      !Number.isInteger(loras.max_count) ||
      loras.max_count < 1 ||
      loras.max_count > 4
    )
      throw Error("Allow between 1 and 4 simultaneous LoRAs.");
    if (!Array.isArray(loras.entries))
      throw Error("LoRA pool entries must be a list.");
    const names = new Set<string>();
    for (const entry of loras.entries) {
      if (
        !entry.id?.trim() ||
        entry.id.length > 100 ||
        names.has(entry.id) ||
        !entry.filename?.trim()
      )
        throw Error(
          "Give every LoRA a distinct approved name and exact installed filename.",
        );
      if (
        !Number.isFinite(entry.strength) ||
        entry.strength < 0 ||
        entry.strength > 2
      )
        throw Error("Approved LoRA strengths must be between 0 and 2.");
      names.add(entry.id);
    }
  }
}
