export function BuilderHeader() {
  return (
    <>
      {" "}
      <header>
        <a className="wordmark" href="#">
          <span aria-hidden="true">✳</span> COMFYUI <b>/ WORKFLOW TOOLS</b>
        </a>
        <span className="local">
          <i />
          LOCAL · NO UPLOADS
        </span>
      </header>
      <section className="hero">
        <p className="eyebrow">YOUR WORKFLOWS. THEIR WORDS.</p>
        <h1>
          One workflow.
          <br />
          <em>One assigned tool.</em>
        </h1>
        <p className="intro">
          Turn a premade ComfyUI workflow into an Open WebUI tool. Users ask for
          a picture. Your workflow decides how it is made.
        </p>
        <div className="steps">
          <span>
            <b>01</b> Load API workflow
          </span>
          <span>
            <b>02</b> Map its inputs
          </span>
          <span>
            <b>03</b> Export & assign
          </span>
        </div>
      </section>
    </>
  );
}
