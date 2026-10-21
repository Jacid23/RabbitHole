import { useDialog } from "./useDialog";
import type { Workflow } from "./types";
import { Icon } from "./Icons";

export function HolePicker({
  holes,
  selected,
  onChoose,
  onClose,
}: {
  holes: Workflow[];
  selected?: string;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useDialog(true, onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="hole-picker"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Pick a hole"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">WHERE WILL CURIOSITY TAKE YOU?</p>
            <h2>Pick a hole.</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close hole picker"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {!!holes.length && (
          <button
            className="random-hole"
            onClick={() => {
              const values = new Uint32Array(1);
              const range =
                Math.floor(0x100000000 / holes.length) * holes.length;
              do {
                crypto.getRandomValues(values);
              } while (values[0] >= range);
              onChoose(holes[values[0] % holes.length].id);
            }}
          >
            <Icon name="spark" />
            Surprise me<span>Enter a random hole</span>
          </button>
        )}
        <div className="hole-doors">
          {holes.map((hole) => (
            <button
              key={hole.id}
              data-theme={hole.theme || "custom"}
              className="hole-door"
              aria-pressed={hole.id === selected}
              onClick={() => onChoose(hole.id)}
            >
              <Icon name="key" size={26} />
              <strong>{hole.name}</strong>
              <span>{hole.description}</span>
              <small>
                {hole.id === selected ? "YOU’RE HERE" : "STEP INSIDE →"}
              </small>
            </button>
          ))}
        </div>
        {!holes.length && (
          <p>Your administrator hasn’t assigned any holes yet.</p>
        )}
      </section>
    </div>
  );
}
