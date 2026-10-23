import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Icon } from "./Icons";
import { Gallery, imageUrl } from "./Gallery";
import { ImageControls } from "./ImageControls";
import { ImagePrompt } from "./ImagePrompt";
import type { ImageItem, ImageOptions, Job, Workflow } from "./types";
const defaults = (workflow?: Workflow): ImageOptions => ({
  aspect_ratio: workflow?.size?.default_ratio || "1:1",
  resolution: workflow?.size?.default_resolution || "1K",
  steps: workflow?.steps?.default || 8,
  seed: -1,
});
export function CreateView({
  workflows,
  images,
  initialPrompt,
  initialWorkflow,
  preview,
  onSignin,
  onSaved,
  activeJob,
  model,
}: {
  workflows: Workflow[];
  images: ImageItem[];
  initialPrompt: string;
  initialWorkflow?: string;
  preview: boolean;
  onSignin: () => void;
  onSaved: () => void;
  activeJob?: Job;
  model: string;
}) {
  const [workflowId, setWorkflowId] = useState(
      initialWorkflow || workflows[0]?.id || "",
    ),
    [prompt, setPrompt] = useState(initialPrompt),
    [options, setOptions] = useState<ImageOptions>(defaults(workflows[0])),
    [job, setJob] = useState<Job | undefined>(activeJob),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mobilePanel, setMobilePanel] = useState("image"),
    [inputImage, setInputImage] = useState("");
  const poll = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    workflow = workflows.find((w) => w.id === workflowId) || workflows[0];
  useEffect(() => {
    if (workflow) setOptions(defaults(workflow));
  }, [workflow?.id]);
  useEffect(() => {
    setPrompt(initialPrompt);
    if (initialWorkflow) setWorkflowId(initialWorkflow);
  }, [initialPrompt, initialWorkflow]);
  useEffect(() => {
    if (activeJob) setJob(activeJob);
  }, [activeJob?.id]);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.state)) return;
    const id = job.id;
    let alive = true;
    const update = async () => {
      try {
        const next = await api<Job>("/api/jobs/" + id);
        if (!alive) return;
        setJob(next);
        if (["queued", "running"].includes(next.state))
          poll.current = setTimeout(update, 1000);
        else onSaved();
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    poll.current = setTimeout(update, 700);
    return () => {
      alive = false;
      clearTimeout(poll.current);
    };
  }, [job?.id, job?.state]);
  async function generate() {
    if (preview) {
      onSignin();
      return;
    }
    if (!workflow || !prompt.trim()) return;
    setError("");
    setBusy(true);
    try {
      const next = await api<Job>("/api/generate", {
        workflow: workflow.id,
        prompt,
        options,
        input_image: inputImage || null,
      });
      setJob(next);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setError("");
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw Error((await response.json()).error);
      const value = await response.json();
      setInputImage(value.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const running = busy || (!!job && ["queued", "running"].includes(job.state));
  const recent = job?.images
    ?.map((id) => images.find((image) => image.id === id))
    .filter(Boolean) as ImageItem[] | undefined;
  const friendly = job?.message.startsWith("Running ")
    ? "Bringing your idea to life"
    : job?.message.replace(/\(current node\)/, "");
  return (
    <section className={`create-page panel-${mobilePanel}`}>
      <div className="view-top">
        <div className="breadcrumb">
          Your space <span>/</span> Create image
        </div>
        <span className="page-tag">
          <Icon name="spark" size={13} />
          IMAGINATION, MADE VISIBLE
        </span>
      </div>
      <div className="create-panel-switch" role="group" aria-label="Image workspace">
        <button type="button" aria-pressed={mobilePanel === "image"} onClick={() => setMobilePanel("image")}>Image</button>
        <button type="button" aria-pressed={mobilePanel === "settings"} onClick={() => setMobilePanel("settings")}><Icon name="settings" size={15} />Settings</button>
      </div>
      <div className="create-layout">
        <div className="create-main">
          <div className="create-heading">
            <p className="eyebrow">THROUGH THE LOOKING GLASS</p>
            <h1>
              Make <em>the impossible.</em>
            </h1>
            <p>
              A world that only exists in your head. Let’s give it somewhere to
              live.
            </p>
          </div>
          <ImagePrompt
            prompt={prompt}
            onPrompt={setPrompt}
            model={workflow?.enhancer_model || model}
            workflow={workflow?.id}
            running={running}
            canGenerate={!!workflow}
            preview={preview}
            onSignin={onSignin}
            onGenerate={() => void generate()}
            ideas={[...(workflow?.opening?.examples || []).map((example) => example.prompt), ...(workflow?.opening?.image_starters || []).map((idea) => idea.prompt)]}
          >
            {!!workflow?.opening?.image_starters?.length && (
              <div className="image-starting-ideas" role="group" aria-label="Image ideas">
                {workflow.opening.image_starters.map((idea, index) => (
                  <button key={index} type="button" className="starting-idea-chip" disabled={running} onClick={() => setPrompt(idea.prompt)}>{idea.label}</button>
                ))}
              </div>
            )}
            {workflow?.needs_image && (
              <label className="attach-input">
                {inputImage ? "Image attached ✓" : "Choose the image to edit"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={preview}
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                  }}
                />
              </label>
            )}
          </ImagePrompt>
          <div className="creation-results panel-scroll" role="region" aria-label="Image results" tabIndex={0}>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {job && (
              <div className={`generation-status ${job.state}`} role="status">
                <div>
                  <span className="status-orb" />
                  <strong>
                    {job.state === "ready"
                      ? "A little imagination, brought to life."
                      : job.state === "error"
                        ? "Your image couldn’t finish"
                        : job.state === "interrupted"
                          ? "Your image request is saved"
                          : friendly}
                  </strong>
                  <small>{job.elapsed || 0}s</small>
                </div>
                {["queued", "running"].includes(job.state) && (
                  <>
                    <div
                      className={`generation-track ${job.progress === null ? "indeterminate" : ""}`}
                    >
                      <span
                        style={{
                          width:
                            job.progress === null ? "35%" : `${job.progress}%`,
                        }}
                      />
                    </div>
                    <p>
                      {job.progress === null
                        ? "Preparing your image. You can come back to it here."
                        : "Progress of the current sampling stage."}
                    </p>
                  </>
                )}
                {["error", "interrupted"].includes(job.state) && (
                  <>
                    <p>
                      {job.state === "error"
                        ? "Your settings are saved. Recover this job before trying a new generation."
                        : job.message}
                    </p>
                    {job.comfy_id && (
                      <button
                        className="secondary"
                        onClick={async () => {
                          try {
                            setJob(
                              await api<Job>(
                                "/api/jobs/" + job.id + "/recover",
                                {},
                              ),
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Recover existing image
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {recent?.length ? (
              <div className="latest-image">
                <img src={imageUrl(recent[0])} alt={recent[0].prompt} />
                <div>
                  <span>{recent[0].prompt}</span>
                  <a href={imageUrl(recent[0]) + "?download=1"} download>
                    <Icon name="download" size={16} />
                    Download
                  </a>
                </div>
              </div>
            ) : null}
            <div className="creations-heading">
              <h2>{preview ? "A few possibilities" : "Your recent creations"}</h2>
              <span>
                {preview
                  ? "Made with your local workflow"
                  : "SAVED IN YOUR LIBRARY"}
              </span>
            </div>
            <Gallery
              images={images.slice(0, 6)}
              preview={preview}
              onChanged={onSaved}
              onReuse={(image) => {
                setPrompt(image.prompt);
                if (image.workflow) setWorkflowId(image.workflow);
              }}
            />
          </div>
        </div>
        <aside className="settings-panel panel-scroll" aria-label="Image settings" tabIndex={0}>
          <div className="settings-title">
            <Icon name="settings" size={18} />
            <h2>Make it yours</h2>
          </div>

          {workflow ? (
            <ImageControls
              workflow={workflow}
              value={options}
              onChange={setOptions}
            />
          ) : (
            <p className="control-hint">
              Your administrator can assign image workflows to your account.
            </p>
          )}
          <div className="settings-footer">
            <Icon name="lock" size={13} />
            <span>
              Only the options approved for your account are shown here.
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}
