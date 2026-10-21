export function AssignmentGuide() {
  return (
    <section className="card next">
      <p className="eyebrow">IN OPEN WEBUI</p>
      <ol>
        <li>
          <strong>Workspace → Tools</strong>
          <br />
          Create menu → Import your exported JSON.
        </li>
        <li>
          <strong>Tool → Access</strong>
          <br />
          Keep private or assign an approved user group.
        </li>
        <li>
          <strong>Workspace → Models → Edit</strong>
          <br />
          Attach the tool and keep it enabled by default.
        </li>
        <li>
          <strong>Match the model's access</strong>
          <br />
          Give the same approved group access to the model.
        </li>
      </ol>
      <p className="hint">
        Assign several tools to one model when users should have several
        workflows. Separate groups need separate tool permissions. A workflow
        assignment is not a content-moderation filter.
      </p>
    </section>
  );
}
