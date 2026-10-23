# Rabbit Hole

A phone-first chat and image app built around places to explore. Each **hole** combines a themed interface, chat persona, prompt enhancer, a fixed ComfyUI workflow and an administrator-selected LoRA preset.

React, TypeScript and Vite frontend; Python/Starlette backend. Open WebUI supplies sign-in, account/model/tool permissions and chat completion routing. ComfyUI runs image workflows. No weights or generated media are included.

## Features

- Plain public sign-in with no app preview; a falling silhouette transition during authentication, with reduced-motion support.
- Rabbit Hole, Mars, Grand Estate and Cartoon Land interface themes.
- Named holes and random entry from the current account's permitted holes.
- Administrator-configured models and fixed LoRAs. Users edit prompts, ratio, resolution, steps and seeds where supported.
- Inline Enhance with editable results, repeated enhancement and Undo.
- Image progress/server status, private library, recoverable Trash and original image metadata.
- Administrator user-mode preview and private per-user profiles/instructions/content levels.
- Workflow builder and existing-hole editor with draft visual previews.

## Install

Requires Python 3.12+, Node.js 20.19+ or 22.12+, Open WebUI, and ComfyUI with the nodes/models required by your workflows. From the repository root:

```sh
python -m venv .venv
# Activate the environment using your shell's activation command.
pip install -e ".[test]"
npm ci --prefix web/family-studio
npm ci --prefix web/workflow-builder
npm run build --prefix web/family-studio
npm run build --prefix web/workflow-builder
```

For Python use, set `STUDIO_OPENWEBUI`, `STUDIO_OPENWEBUI_PUBLIC` and `STUDIO_COMFYUI` to your servers, then run:

```sh
python -m family_studio --host 127.0.0.1 --port 5030
```

`STUDIO_DATA` optionally sets the private data folder (default `.runtime/family-studio`). Set `STUDIO_SECURE_COOKIE=1` behind HTTPS and `STUDIO_PREVIEW=0` for production. Python mode reads environment variables directly and does not automatically load `.env`. Default upstreams are local Open WebUI on port 3000 and ComfyUI on 8188. A clean installation has no assigned workflows.

### Docker

Build both frontends first. Copy `.env.example` to `.env` and fill the upstream URLs. Create `data` and `workflows` directories and ensure UID/GID 1000 can write them. Run `docker compose up -d --build` from this root. The service binds only to `127.0.0.1:5030`; configure your own HTTPS reverse proxy for phone access and set `SECURE_COOKIE=1` for HTTPS.

Keep `data` and `workflows` persistent and backed up. Never overwrite them during an update. The image expects built frontend assets and generated standalone builder HTML. Sessions live in memory, so backend restarts require signing in again; profiles, chats and images remain in `data`.

## Add a hole

1. Build and test a ComfyUI graph with compatible models, encoders, VAE and optional fixed LoRAs. Export **API format**, not canvas format.
2. Sign in with an Open WebUI administrator account. Open **Manage Rabbit Hole → Open workflow builder** and import the graph.
3. Set a unique tool ID and purpose. Choose a world starter, then edit its name, chat model/persona, enhancer model/instructions and fixed image style. Starters never download or select models or LoRAs.
4. Bind literal positive prompt inputs, seeds, optional image inputs and image outputs. Configure only the ratios, resolutions and steps supported by your graph. Fixed dimensions may remain fixed.
5. To add a fixed LoRA preset, enable an approved pool, select the MODEL connection it can wrap, add compatible files/strengths, then check **Always use these LoRAs**. Existing graph LoRAs remain fixed. Users get no model or LoRA controls.
6. Download the recipe JSON. In Manage Rabbit Hole, **Import builder recipe**, review, optionally **Preview this world**, then publish. New tools start private. Grant intended members/group access to the tool and assigned chat/enhancer models in Open WebUI.
7. Enter through **Change hole**. Test the persona, Enhance and a real image with that member's account before sharing.

Available visual starters include Mars, Grand Estate, Cartoon Land, Fear & Loathing (desert neon), and Willy Wonka (chocolate factory). They are interface themes; workspace presets and fixed workflow loaders remain your own assignments. A graph can keep its existing custom model/LoRA loader nodes, including Basement loaders, without replacing them with the optional LoRA pool.

Custom enhancer instructions replace the built-in refiner instruction. Fixed image style applies even if Enhance is skipped. Choosing a starter overwrites its name and prompt drafts; review before publishing. The interface theme changes independently of model/LoRA selection.

## Opening a hole

In **Manage Rabbit Hole → When someone enters**, set an optional character greeting, editable chat starters and image ideas. A greeting becomes part of a new conversation so the model understands replies to it. Existing conversations retain their history.

**Random themed postcards** pair a saved image with a scene title, chat idea and image prompt. Add up to twelve images per hole, fill the paired prompts, then publish. Entry picks one at random; **Another glimpse** picks a different postcard. **Ask the guide** fills a chat draft and **Make this scene your own** fills the image editor. Neither submits automatically. These examples load instantly from saved assets without calling a model. The normal image editor’s **Try an idea** also uses the hole’s saved prompts.

Postcard images require sign-in and the same tool access and audience rating as their hole. Uploads accept PNG, JPEG or WebP under 8 MB and 16 megapixels; the app stores optimized previews in `data/opening-images`. Back up that folder alongside the database and recipes. Removing a postcard from the pool retains its file for recovery. Standalone builder recipes preserve postcard references; add the actual images through Manage Rabbit Hole on the destination installation.

## Profiles and access

Administrators manage **User profiles**: preferred name, optional sex/gender and age, personal instructions, and General/Teen/Adult level. Profile context is appended to chat and Enhance instructions. Demographic facts are not automatically inserted into direct image prompts or metadata.

Unknown age defaults to General. Under 13 is capped at General; under 18 at Teen. Hole rating and minimum age are enforced alongside Open WebUI tool access, including saved history and direct generated-media retrieval. Users cannot edit their own rating.

**User mode** hides management controls and blocks administrator endpoints for that session. It uses your own profile and Open WebUI grants; it does not impersonate a family member or reproduce that member's permissions. **Return to admin** exits it.

Content levels guide prompting and gate access. They are **not an output moderation classifier** and cannot guarantee age-appropriate model/LoRA output. Review workflows and outputs before assigning them to younger users. Separately exposed Open WebUI tools and interfaces retain their own controls.

## Development

```sh
pytest -q
npm run dev --prefix web/family-studio
```

Vite proxies `/api` to Python on port 5030. Tests use isolated storage and simulated upstreams; they do not load weights or prove generation on your hardware. The sanitized graph in `tests/fixtures` uses placeholder filenames and is not a runnable model setup. TTS is not implemented in this client.

Do not commit private data, workflows, media, profiles, credentials, databases, weights or `.env`. Back up runtime data separately from source.

## Attribution

The ComfyUI/Open WebUI integration originated in [MCP-Image-Generator-Uncensored](https://github.com/Jacid23/MCP-Image-Generator-Uncensored). Its MIT notice is preserved. The Basement branding belongs to its owner; inclusion does not grant permission to use the brand as your own. Wonderland artwork provenance is in `integrations/design/rabbit-hole/ARTWORK.md`; themed worlds use code-native SVGs.
