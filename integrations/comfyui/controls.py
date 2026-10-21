"""Approved image controls shared by exported tools and the local builder."""
import math


def validate_controls(recipe):
    options = recipe.get("options") or {}
    graph = recipe["workflow"]
    size = options.get("size")
    if size:
        inputs = graph.get(size.get("node"), {}).get("inputs", {})
        if size.get("width_key") not in inputs or size.get("height_key") not in inputs:
            raise ValueError("Size controls need existing width and height inputs")
        ratios = size.get("ratios") or []
        for ratio in ratios:
            parts = str(ratio).split(":")
            if len(parts) != 2 or not all(p.isdigit() and 0 < int(p) <= 32 for p in parts):
                raise ValueError("Ratios must use positive integers such as 16:9")
        resolutions = size.get("resolutions") or {}
        if not ratios or size.get("default_ratio") not in ratios:
            raise ValueError("Select approved aspect ratios and a default")
        if not resolutions or size.get("default_resolution") not in resolutions:
            raise ValueError("Select approved resolution tiers and a default")
        if any(type(v) is not int or not 256 <= v <= 4096 for v in resolutions.values()):
            raise ValueError("Resolution tiers must be 256–4096 pixels on the long edge")
        multiple = size.get("multiple", 8)
        if type(multiple) is not int or not 8 <= multiple <= 128:
            raise ValueError("Dimension rounding must be 8–128 pixels")
    steps = options.get("steps")
    if steps:
        value = graph.get(steps.get("node"), {}).get("inputs", {}).get(steps.get("key"))
        if type(value) is not int:
            raise ValueError("Step controls must target an existing literal integer input")
        low, high = steps.get("min"), steps.get("max")
        if type(low) is not int or type(high) is not int or not 1 <= low <= high <= 100:
            raise ValueError("Approved steps must be between 1 and 100")
    pool = options.get("loras")
    if pool:
        target = pool.get("target") or {}
        value = graph.get(target.get("node"), {}).get("inputs", {}).get(target.get("key"))
        if not isinstance(value, list) or len(value) != 2 or str(value[0]) not in graph:
            raise ValueError("LoRA insertion must target an existing linked MODEL input")
        if type(pool.get("max_count")) is not int or not 1 <= pool["max_count"] <= 4:
            raise ValueError("Allow between 1 and 4 simultaneous LoRAs")
        names = set()
        for item in pool.get("entries", []):
            name = item.get("id", "")
            if not isinstance(name, str) or not name or name in names or len(name) > 100:
                raise ValueError("LoRA names must be distinct, nonempty and at most 100 characters")
            names.add(name)
            if not isinstance(item.get("filename"), str) or not item["filename"]:
                raise ValueError("Each approved LoRA needs its exact installed filename")
            strength = item.get("strength", 1.0)
            if type(strength) not in (int, float) or not math.isfinite(strength) or not 0 <= strength <= 2:
                raise ValueError("Approved LoRA strengths must be between 0 and 2")
        if any(str(n).startswith("owui_lora_") for n in graph):
            raise ValueError("The owui_lora_ node prefix is reserved for the approved pool")


def apply_controls(recipe, graph, values):
    """Mutate only the administrator-selected bindings; filenames come from the pool."""
    validate_controls(recipe)
    options, values = recipe.get("options") or {}, values or {}
    allowed = {"aspect_ratio", "resolution", "steps", "loras", "lora_strength", "seed"}
    if set(values) - allowed:
        raise ValueError("Unknown image control")
    ratio, resolution = values.get("aspect_ratio", ""), values.get("resolution", "")
    if ratio or resolution:
        size = options.get("size")
        if not size:
            raise ValueError("This workflow does not expose size controls")
        ratio = ratio or size["default_ratio"]
        resolution = resolution or size["default_resolution"]
        if ratio not in size["ratios"] or resolution not in size["resolutions"]:
            raise ValueError("Use one of this workflow's approved ratios and resolution tiers")
        w, h = map(int, ratio.split(":"))
        edge, multiple = size["resolutions"][resolution], size.get("multiple", 8)
        width = max(multiple, round(edge * w / max(w, h) / multiple) * multiple)
        height = max(multiple, round(edge * h / max(w, h) / multiple) * multiple)
        graph[size["node"]]["inputs"][size["width_key"]] = width
        graph[size["node"]]["inputs"][size["height_key"]] = height
    requested_steps = values.get("steps", 0)
    if requested_steps:
        steps = options.get("steps")
        if not steps or type(requested_steps) is not int or not steps["min"] <= requested_steps <= steps["max"]:
            raise ValueError("Steps are outside this workflow's approved range")
        graph[steps["node"]]["inputs"][steps["key"]] = requested_steps
    selected = values.get("loras") or []
    if not isinstance(selected, list) or not all(isinstance(v, str) for v in selected):
        raise ValueError("LoRAs must be a list of approved names")
    strength = values.get("lora_strength", 1.0)
    if type(strength) not in (int, float) or not math.isfinite(strength) or not 0 <= strength <= 1:
        raise ValueError("LoRA strength multiplier must be between 0 and 1")
    if selected:
        pool = options.get("loras")
        if not pool or len(selected) > pool["max_count"] or len(set(selected)) != len(selected):
            raise ValueError("Select distinct LoRAs within this workflow's stack limit")
        entries = {item["id"]: item for item in pool.get("entries", [])}
        if any(name not in entries for name in selected):
            raise ValueError("A requested LoRA is outside this workflow's approved pool")
        target = pool["target"]
        link = graph[target["node"]]["inputs"][target["key"]]
        triggers = []
        for index, name in enumerate(selected):
            item = entries[name]
            node = "owui_lora_" + str(index)
            graph[node] = {"class_type": "LoraLoaderModelOnly", "inputs": {
                "model": link, "lora_name": item["filename"],
                "strength_model": item.get("strength", 1.0) * strength,
            }, "_meta": {"title": item.get("label") or name}}
            link = [node, 0]
            if item.get("trigger"):
                triggers.append(item["trigger"])
        graph[target["node"]]["inputs"][target["key"]] = link
        if triggers:
            for binding in recipe["prompt_inputs"]:
                inputs = graph[binding["node"]]["inputs"]
                inputs[binding["key"]] = ", ".join(triggers) + ", " + inputs[binding["key"]]
    return graph
