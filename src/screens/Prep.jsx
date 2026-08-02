import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Body, Button } from "../components/UI";
import FlowHeader from "../components/FlowHeader";

const RING_R = 54;
const RING_CIRC = 2 * Math.PI * RING_R;

export default function Prep({ exercise, onProceed, onCancel }) {
  const color = exercise.color;
  const [secondsLeft, setSecondsLeft] = useState(exercise.prepSeconds);
  const intervalRef = useRef(null);
  const proceededRef = useRef(false);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          proceed();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proceed = () => {
    if (proceededRef.current) return;
    proceededRef.current = true;
    clearInterval(intervalRef.current);
    onProceed();
  };

  const pct = secondsLeft / exercise.prepSeconds;
  const offset = RING_CIRC * (1 - pct);

  return (
    <div className="center-screen">
      <div>
        <FlowHeader step="prep" exercise={exercise} onClose={onCancel} />
        <span className="demo-card-eyebrow" style={{ display: "block", marginTop: 18 }}>
          Think it through
        </span>

        <div className="prompt-box">
          <p className="prompt-serif">{exercise.prompt}</p>
          {exercise.extract ? (
            <Body className="dim" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
              {exercise.extract}
            </Body>
          ) : null}
        </div>

        {exercise.word ? (
          <div className="word-box">
            <div className="word-text">{exercise.word}</div>
            <Body className="dim" style={{ marginTop: 4 }}>
              {exercise.definition}
            </Body>
          </div>
        ) : null}
      </div>

      <div className="timer-wrap">
        <div className="ring">
          <svg viewBox="0 0 120 120">
            <circle className="ring-track" cx="60" cy="60" r={RING_R} />
            <circle
              className="ring-fill"
              cx="60"
              cy="60"
              r={RING_R}
              stroke={color}
              strokeDasharray={RING_CIRC}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="timer-number">{secondsLeft}</span>
        </div>
        <Body className="dim" style={{ marginTop: 24, textAlign: "center", maxWidth: "26em" }}>
          {exercise.id === "explain_simply"
            ? "This one gives you extra time — look the topic up and read a bit online if you need to, then sketch a first line, a middle, and a landing. Don't write a script — you won't get to read it."
            : "Sketch a first line, a middle, and a landing. Don't write a script — you won't get to read it."}
        </Body>
      </div>

      <div>
        <Button title="I'm ready — start recording" icon={ArrowRight} onClick={proceed} style={{ background: color }} />
      </div>
    </div>
  );
}
