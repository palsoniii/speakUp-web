import { X } from "lucide-react";
import { ProgressRail } from "./UI";

const STEP_PCT = { spin: 25, prep: 50, record: 75, reflect: 100 };
const STEP_LABEL = { spin: 1, prep: 2, record: 3, reflect: 4 };

// Shared chrome across the practice flow's category-scoped steps (spin,
// prep, record, reflect): a dot + category name + "Step n of 4" + close
// button, above the progress rail that fills as you move through the flow.
export default function FlowHeader({ step, exercise, onClose }) {
  const color = exercise.color;
  return (
    <div>
      <div className="flow-header">
        <div className="flow-header-left">
          <span className="dot" style={{ width: 9, height: 9, background: color }} />
          {exercise.title}
        </div>
        <span className="flow-step-label">Step {STEP_LABEL[step]} of 4</span>
        {onClose ? (
          <button className="flow-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        ) : null}
      </div>
      <ProgressRail pct={STEP_PCT[step]} color={color} />
    </div>
  );
}
