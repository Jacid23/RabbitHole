import { useDialog } from "./useDialog";
import { Icon } from "./Icons";

export function LeaveTemporary({ onCancel, onLeave }: { onCancel: () => void; onLeave: () => void }) {
  const dialog = useDialog(true, onCancel);
  return <div className="modal-backdrop" onClick={onCancel}>
    <section className="leave-temporary" ref={dialog} role="dialog" aria-modal="true"
      aria-labelledby="leave-temporary-title" aria-describedby="leave-temporary-description" onClick={e => e.stopPropagation()}>
      <Icon name="lock" size={25} />
      <h2 id="leave-temporary-title">Leave this temporary chat?</h2>
      <p id="leave-temporary-description">This conversation won’t be saved. Stay here to keep talking, or leave to continue your journey.</p>
      <div><button className="secondary" onClick={onCancel}>Stay here</button>
        <button className="primary" onClick={onLeave}>Leave temporary chat</button></div>
    </section>
  </div>;
}
