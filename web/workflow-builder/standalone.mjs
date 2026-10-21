import fs from "node:fs/promises";
import path from "node:path";
let html = await fs.readFile("dist/index.html", "utf8");
const script = html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/);
const css = html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/);
if (script) {
  const js = await fs.readFile(path.join("dist", script[1]), "utf8");
  html = html.replace(
    script[0],
    () =>
      '<script type="module">' +
      js.replace(/<\/script/gi, "<\\/script") +
      "</script>",
  );
}
if (css) {
  const styles = await fs.readFile(path.join("dist", css[1]), "utf8");
  html = html.replace(css[0], () => "<style>" + styles + "</style>");
}
const out = "../../integrations/comfyui/Workflow Tool Builder.html";
await fs.writeFile(out, html, "utf8");
console.log("Standalone builder:", out);
