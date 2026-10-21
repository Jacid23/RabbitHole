import type { Binding, Candidate } from "./types";
export function Bindings({
  title,
  hint,
  items,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  items: Candidate[];
  value: Binding[];
  onChange: (v: Binding[]) => void;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <p className="hint">{hint}</p>
      {items.length ? (
        items.map((item) => {
          const active = value.some(
            (v) => v.node === item.node && v.key === item.key,
          );
          return (
            <label
              className={`node-choice ${active ? "selected" : ""}`}
              key={item.node + "." + item.key}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() =>
                  onChange(
                    active
                      ? value.filter(
                          (v) => v.node !== item.node || v.key !== item.key,
                        )
                      : [...value, { node: item.node, key: item.key }],
                  )
                }
              />
              <span>{item.label}</span>
            </label>
          );
        })
      ) : (
        <p className="empty">No matching inputs in this workflow.</p>
      )}
    </fieldset>
  );
}
