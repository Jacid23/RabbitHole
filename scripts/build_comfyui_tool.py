"""Build a private Open WebUI tool from a fixed ComfyUI API workflow recipe."""
import argparse
import ast
import json
import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "integrations/comfyui/tool_template.py"
PANEL = ROOT / "integrations/openwebui/panel.py"
CONTROLS = ROOT / "integrations/comfyui/controls.py"


def validate_recipe(recipe):
    validate_opening = runpy.run_path(str(ROOT / "integrations/comfyui/opening.py"))["validate_opening"]
    validate_opening(recipe.get("opening"))
    enhancer_model = recipe.get("enhancer_model", "")
    if not isinstance(enhancer_model, str) or len(enhancer_model) > 200 or enhancer_model != enhancer_model.strip():
        raise ValueError("Enhancer model must be a valid model ID")
    for key in ("chat_model", "chat_prompt", "enhancer_prompt", "image_prompt"):
        value = recipe.get(key, "")
        if not isinstance(value, str) or len(value) > (200 if key.endswith("model") else 12000):
            raise ValueError("Invalid hole model or instructions")
    if recipe.get("theme", "custom") not in {"custom", "mars", "estate", "cartoon", "gonzo", "wonka"} or recipe.get("content_level", "general") not in {"general", "teen", "adult"}:
        raise ValueError("Choose a supported theme and content level")
    if type(recipe.get("min_age", 0)) is not int or not 0 <= recipe.get("min_age", 0) <= 120:
        raise ValueError("Minimum age must be between 0 and 120")
    fixed = recipe.get("default_loras", [])
    pool = (recipe.get("options") or {}).get("loras") or {}
    allowed = {entry["id"] for entry in pool.get("entries", [])}
    if not isinstance(fixed, list) or any(not isinstance(item, str) or item not in allowed for item in fixed) or len(set(fixed)) != len(fixed) or len(fixed) > pool.get("max_count", 0):
        raise ValueError("Fixed LoRAs must come from this workflow's approved pool")
    ident = recipe.get("id", "")
    if not re.fullmatch(r"[a-z][a-z0-9_]{2,55}", ident):
        raise ValueError("Tool ID must start with a letter and use 3-56 lowercase letters, numbers or underscores")
    graph = recipe.get("workflow")
    if not isinstance(graph, dict) or not graph or "nodes" in graph:
        raise ValueError("Export the ComfyUI workflow in API format, not the canvas/UI format")
    for node in graph.values():
        if not isinstance(node,dict) or not isinstance(node.get("class_type"),str) or not isinstance(node.get("inputs"),dict):
            raise ValueError("Each API node must have class_type and inputs")
    if not recipe.get("prompt_inputs") and not recipe.get("image_inputs"):
        raise ValueError("Select a prompt input or an image input")
    seen=set()
    for group in ["prompt_inputs","seed_inputs","image_inputs"]:
        for item in recipe.get(group,[]):
            node,key=str(item["node"]),item["key"]
            if (node,key) in seen:
                raise ValueError("An input cannot have more than one binding")
            seen.add((node,key))
            value=graph.get(node,{}).get("inputs",{}).get(key)
            expected=int if group=="seed_inputs" else str
            if not isinstance(value,expected):
                raise ValueError(f"{group}: {node}.{key} must be a literal {expected.__name__}; linked inputs cannot be overwritten")
    if not recipe.get("output_nodes") or any(str(n) not in graph for n in recipe["output_nodes"]):
        raise ValueError("Select at least one valid image output node")
    if not recipe.get("name") or not recipe.get("description"):
        raise ValueError("Give the workflow a name and a clear purpose for the chat model")
    runpy.run_path(str(CONTROLS))["validate_controls"](recipe)


def build(recipe, server="http://127.0.0.1:8188"):
    validate_recipe(recipe)
    code=TEMPLATE.read_text(encoding="utf8")
    options=recipe.get("options") or {}
    params=[]
    values=[]
    if recipe.get("seed_inputs"):
        params.append("seed: int = -1, ")
        values.append("'seed': seed")
    for enabled, fields in [(options.get("size"),[("aspect_ratio","str","''"),("resolution","str","''")]),(options.get("steps"),[("steps","int","0")]),(options.get("loras"),[("loras","list[str]","None"),("lora_strength","float","1.0")])]:
        if enabled:
            for name,kind,default in fields:
                params.append(f"{name}: {kind} = {default}, ")
                values.append(repr(name)+": "+name)
    description=recipe["description"]+". Runs the administrator workflow with approved controls only; never accepts arbitrary model filenames, LoRA filenames, workflow graphs or workflow IDs. Display returned image URLs with Markdown image syntax. Omit size and steps to preserve workflow defaults; use settings tool for approved options. "
    if options.get("size"):
        description+="Ratios: "+", ".join(options["size"]["ratios"])+". Resolution long-edge tiers: "+json.dumps(options["size"]["resolutions"])+". "
    if options.get("steps"):
        description+=f"Steps: {options['steps']['min']}–{options['steps']['max']}. "
    if options.get("loras"):
        description+="Approved LoRA names: "+json.dumps([e["id"] for e in options["loras"].get("entries",[])])+". No LoRAs unless explicitly requested."
    replacements={
        "__RECIPE_LITERAL__":repr(recipe),
        "__SERVER_LITERAL__":repr(server),
        "__PANEL_SOURCE__":PANEL.read_text(encoding="utf8").replace("Qwen Image","ComfyUI"),
        "__CONTROLS_SOURCE__":CONTROLS.read_text(encoding="utf8"),
        "__TOOL_FUNCTION__":"run_"+recipe["id"],
        "__CHECK_FUNCTION__":"check_"+recipe["id"],
        "__SETTINGS_FUNCTION__":"options_"+recipe["id"],
        "__DESCRIPTION_LITERAL__":repr(description),
        "__CONTROL_PARAMETERS__":"".join(params),
        "__CONTROL_VALUES__":"{"+", ".join(values)+"}",
        "__IMAGE_PARAMETER__":"image: str = '', " if recipe.get("image_inputs") else "",
        "__IMAGE_VALUE__":"image" if recipe.get("image_inputs") else "''",
    }
    # Replacement order is explicit; user graph strings are inserted last and never
    # interpreted as template placeholders or Python source.
    recipe_literal=replacements.pop("__RECIPE_LITERAL__")
    for key,value in replacements.items():
        code=code.replace(key,value)
    code=code.replace("__RECIPE_LITERAL__",recipe_literal)
    ast.parse(code)
    return {"id":recipe["id"],"name":recipe["name"],"content":code,"meta":{"description":recipe["description"],"manifest":{"version":"1.1.0"}},"access_grants":[]}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recipe",type=Path)
    parser.add_argument("--server",default="http://127.0.0.1:8188")
    parser.add_argument("--output",type=Path,default=ROOT/"integrations/comfyui/generated")
    args=parser.parse_args()
    recipe=json.loads(args.recipe.read_text(encoding="utf-8-sig"))
    item=build(recipe,args.server)
    args.output.mkdir(parents=True,exist_ok=True)
    path=args.output/(item["id"]+".json")
    path.write_text(json.dumps([item],ensure_ascii=False,indent=2),encoding="utf8")
    path.with_suffix(".py").write_text(item["content"],encoding="utf8")
    print(path)


if __name__=="__main__":
    main()
