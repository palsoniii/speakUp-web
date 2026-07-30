import { Repeat, Home } from "lucide-react";
import { Body, Button, Title } from "../components/UI";

// Shown after Reflect's Save & finish, before landing back on Home — a beat
// of positive reinforcement rather than an abrupt cut back to the dashboard.
export default function Celebrate({ streak, isFirstSession, note, color, onHome, onAgain }) {
  const heading = isFirstSession ? "That's one." : "Streak extended";
  const big = isFirstSession ? "First Step unlocked." : `${streak} day${streak === 1 ? "" : "s"}.`;
  const sub = isFirstSession
    ? "The hard part was starting; tomorrow is just repeating it."
    : note || "Keep it going — same time tomorrow.";

  return (
    <div className="center-screen">
      <div />
      <div className="celebrate-wrap">
        <div className="celebrate-disc-wrap">
          <span className="celebrate-ring" style={{ borderColor: color || "var(--accent)" }} />
          <span className="celebrate-ring ring-2" style={{ borderColor: color || "var(--accent)" }} />
          <div className="celebrate-disc">{isFirstSession ? "1" : streak}</div>
        </div>
        <Body
          style={{
            marginTop: 14,
            fontWeight: 800,
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.13em",
            color: color || "var(--accent)",
          }}
        >
          {heading}
        </Body>
        <Title style={{ marginTop: 2 }}>{big}</Title>
        <Body className="dim" style={{ marginTop: 8, maxWidth: 360 }}>
          {sub}
        </Body>
      </div>
      <div>
        <Button title="One more round" icon={Repeat} variant="secondary" onClick={onAgain} />
        <Button title="Back to home" icon={Home} onClick={onHome} style={{ marginTop: 10 }} />
      </div>
    </div>
  );
}
