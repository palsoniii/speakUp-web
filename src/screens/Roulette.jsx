import { useEffect, useRef, useState } from "react";
import { ArrowRight, Dices } from "lucide-react";
import { Body, Button, Title } from "../components/UI";
import FlowHeader from "../components/FlowHeader";
import { getContentBank } from "../lib/content";

// How many entries flash by before the reel settles, and how the delay
// between flashes eases from fast to slow (a simple quadratic ease-out) so
// it reads as a roulette/slot reel winding down rather than a flicker.
const SPIN_TICKS = 20;
const MIN_DELAY = 55;
const MAX_DELAY = 300;

function randomIndex(length, exclude) {
  if (length <= 1) return 0;
  let i = Math.floor(Math.random() * length);
  while (i === exclude) i = Math.floor(Math.random() * length);
  return i;
}

// Short, single-line label to flash during the spin — a full sentence
// prompt flickering at high speed is unreadable, so word/pair categories
// use their short form and long-prompt categories get truncated.
function flashLabel(entry) {
  if (!entry) return "";
  if (entry.word) return entry.word;
  if (entry.pair) return `${entry.pair[0]} ↔ ${entry.pair[1]}`;
  if (entry.prompt) return entry.prompt.length > 46 ? `${entry.prompt.slice(0, 46).trim()}…` : entry.prompt;
  return "";
}

// Every exercise category plays like a roulette spin instead of a
// pick-a-card flip: the reel cycles through that category's full content
// bank (see getContentBank) and lands on one random entry, revealing it —
// word + meaning for Word of the Day, full prompt for everything else.
export default function Roulette({ exerciseType, onChosen, onCancel }) {
  const bank = getContentBank(exerciseType.id);
  const [displayIndex, setDisplayIndex] = useState(() => randomIndex(bank.length));
  const [resultIndex, setResultIndex] = useState(null);
  const [spinning, setSpinning] = useState(true);
  const timerRef = useRef(null);

  const spin = () => {
    clearTimeout(timerRef.current);
    setSpinning(true);
    setResultIndex(null);

    const target = randomIndex(bank.length, displayIndex);
    let tick = 0;

    const step = () => {
      tick += 1;
      if (tick >= SPIN_TICKS) {
        setDisplayIndex(target);
        setResultIndex(target);
        setSpinning(false);
        return;
      }
      setDisplayIndex((prev) => randomIndex(bank.length, prev));
      const progress = tick / SPIN_TICKS;
      const delay = MIN_DELAY + (MAX_DELAY - MIN_DELAY) * progress ** 2;
      timerRef.current = setTimeout(step, delay);
    };

    timerRef.current = setTimeout(step, MIN_DELAY);
  };

  useEffect(() => {
    spin();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseType.id]);

  const entry = bank[displayIndex] ?? { prompt: "" };

  const proceed = () => {
    if (resultIndex === null) return;
    onChosen({ ...exerciseType, ...bank[resultIndex] });
  };

  return (
    <div className="center-screen">
      <div>
        <FlowHeader step="spin" exercise={exerciseType} onClose={onCancel} />
        <Title style={{ marginTop: 18 }}>{spinning ? "Spinning…" : "Landed on"}</Title>
        <Body className="dim" style={{ marginTop: 6 }}>
          {spinning
            ? "You don't get to choose this one — that's the point."
            : "Read it once. Then we start the clock."}
        </Body>
      </div>

      <div className="roulette-wrap">
        <div
          className={`roulette-card ${spinning ? "spinning" : "landed"}`}
          style={{ borderColor: spinning ? exerciseType.color + "40" : exerciseType.color }}
        >
          {spinning ? (
            <div className="roulette-flash">{flashLabel(entry)}</div>
          ) : entry.word ? (
            <>
              <div className="roulette-word">{entry.word}</div>
              <div className="roulette-definition">{entry.definition}</div>
              <div className="roulette-prompt">{entry.prompt}</div>
            </>
          ) : (
            <div className="roulette-prompt roulette-prompt-lg">{entry.prompt}</div>
          )}
        </div>
      </div>

      <div>
        <Button
          title="Take it — start thinking"
          icon={ArrowRight}
          onClick={proceed}
          disabled={spinning}
          style={{ background: exerciseType.color }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Button
            title="Spin again"
            icon={Dices}
            variant="ghost"
            onClick={spin}
            disabled={spinning}
            style={{ flex: 1 }}
          />
          <Button title="Change category" variant="ghost" onClick={onCancel} style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}
