export type Node = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
};
export type Graph = Record<string, Node>;
export type Binding = { node: string; key: string; prefix?: string };
export type WorkflowOptions = {
  size?: {
    node: string;
    width_key: string;
    height_key: string;
    ratios: string[];
    resolutions: Record<string, number>;
    default_ratio: string;
    default_resolution: string;
    multiple: number;
  };
  steps?: { node: string; key: string; min: number; max: number };
  loras?: {
    target: { node: string; key: string };
    max_count: number;
    entries: {
      id: string;
      label?: string;
      filename: string;
      strength: number;
      trigger?: string;
    }[];
  };
};
export type Recipe = {
  opening?: import("../../family-studio/src/types").HoleOpening;
  theme?: string;
  content_level?: string;
  min_age?: number;
  image_prompt?: string;
  chat_model?: string;
  chat_prompt?: string;
  enhancer_prompt?: string;
  default_loras?: string[];
  enhancer_model?: string;
  id: string;
  name: string;
  description: string;
  workflow: Graph;
  prompt_inputs: Binding[];
  seed_inputs: Binding[];
  image_inputs: Binding[];
  output_nodes: string[];
  options?: WorkflowOptions;
};
export type Candidate = Binding & { label: string };
export function candidates(
  graph: Graph,
  kind: "prompt" | "seed" | "image",
): Candidate[] {
  return Object.entries(graph).flatMap(([node, n]) =>
    Object.entries(n.inputs)
      .filter(([key, value]) =>
        kind === "seed"
          ? ["seed", "noise_seed"].includes(key) && typeof value === "number"
          : kind === "image"
            ? n.class_type.includes("LoadImage") &&
              key === "image" &&
              typeof value === "string"
            : ["text", "prompt", "positive_prompt"].includes(key) &&
              typeof value === "string",
      )
      .map(([key]) => ({
        node,
        key,
        label: `#${node} · ${n._meta?.title || n.class_type} · ${key}`,
      })),
  );
}
export function parseGraph(value: unknown): Graph {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Choose a ComfyUI API-format JSON file.");
  const graph = (value as { prompt?: unknown }).prompt ?? value;
  if (
    !graph ||
    typeof graph !== "object" ||
    "nodes" in graph ||
    Array.isArray(graph) ||
    !Object.keys(graph).length
  )
    throw Error(
      "This is the canvas format. In ComfyUI, use File → Export (API).",
    );
  if (
    !Object.values(graph).every(
      (n) =>
        n &&
        typeof n.class_type === "string" &&
        n.inputs &&
        typeof n.inputs === "object" &&
        !Array.isArray(n.inputs),
    )
  )
    throw Error("Each API node needs class_type and inputs.");
  return graph as Graph;
}
