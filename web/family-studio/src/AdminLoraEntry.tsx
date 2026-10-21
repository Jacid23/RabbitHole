export type LoraEntry = {
  id: string;
  label?: string;
  filename: string;
  strength: number;
  trigger?: string;
};
export function AdminLoraEntry({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: LoraEntry;
  index: number;
  onChange: (patch: Partial<LoraEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="admin-lora">
      <div className="section-heading">
        <span>STYLE {index + 1}</span>
        <button className="text-button" onClick={onRemove}>
          Remove
        </button>
      </div>
      <label>
        Name your family sees
        <input
          value={entry.id}
          placeholder="Watercolor"
          onChange={(e) =>
            onChange({
              id: e.target.value,
              label: e.target.value,
            })
          }
        />
      </label>
      <label>
        Installed LoRA file
        <input
          value={entry.filename}
          list="admin-lora-files"
          onChange={(e) => onChange({ filename: e.target.value })}
          placeholder="Choose from the installed catalog"
        />
      </label>
      <div className="admin-step-grid">
        <label>
          Maximum strength
          <input
            type="number"
            min={0}
            max={2}
            step={0.05}
            value={entry.strength}
            onChange={(e) =>
              onChange({
                strength: Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Trigger words
          <input
            value={entry.trigger || ""}
            onChange={(e) => onChange({ trigger: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
