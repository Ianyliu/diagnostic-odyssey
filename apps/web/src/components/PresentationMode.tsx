export type Presentation = "focus" | "overview";

export function PresentationMode({
  value,
  onChange
}: {
  value: Presentation;
  onChange: (mode: Presentation) => void;
}) {
  return (
    <div className="presentation-mode" role="group" aria-label="Presentation mode">
      <button type="button" aria-pressed={value === "focus"} onClick={() => onChange("focus")}>Focus</button>
      <button type="button" aria-pressed={value === "overview"} onClick={() => onChange("overview")}>Overview</button>
    </div>
  );
}
