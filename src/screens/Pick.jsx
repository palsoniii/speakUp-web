import { X } from "lucide-react";
import { Body, Card, Label, Title } from "../components/UI";
import { EXERCISE_TYPES } from "../lib/content";

// The practice flow's first step when it's launched from the nav's
// "Practise" button rather than from a category card already on Home —
// "What are we working on?" (see the design handoff, Practice flow / Pick).
export default function Pick({ onChoose, onCancel }) {
  return (
    <div className="center-screen">
      <div className="flow-header">
        <div className="flow-header-left">
          <Label>Practise</Label>
        </div>
        <button className="flow-close" onClick={onCancel} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Title>What are we working on?</Title>
        <Body className="dim" style={{ marginTop: 6 }}>
          Pick a category — the prompt itself is a spin, so you can't rehearse it.
        </Body>
      </div>

      <div className="category-grid" style={{ marginTop: 26, flex: 1, alignContent: "start" }}>
        {EXERCISE_TYPES.map((ex) => (
          <Card className="category-card" large key={ex.id} onClick={() => onChoose(ex)}>
            <div className="category-card-bloom" style={{ background: ex.color }} />
            <span className="category-dot" style={{ background: ex.color }} />
            <div className="category-title">{ex.title}</div>
            <div className="category-tagline">{ex.tagline}</div>
            <div className="category-meta">
              {ex.prepSeconds}s think · {ex.speakSeconds}s speak
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
