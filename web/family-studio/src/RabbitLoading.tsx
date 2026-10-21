import { Icon } from "./Icons";
export function RabbitLoading() {
  return (
    <div className="loading-screen rabbit-descent" role="status">
      <span className="descent-door" aria-hidden="true">
        <Icon name="rabbit" size={36} />
      </span>
      <p>Going down the rabbit hole…</p>
      <small>A little wonder is on its way.</small>
    </div>
  );
}
