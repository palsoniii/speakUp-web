import { useEffect, useRef, useState } from "react";
import { ArrowRight, Dices, Loader2 } from "lucide-react";
import { Body, Button, Title } from "../components/UI";
import FlowHeader from "../components/FlowHeader";
import { getFreshContentBank } from "../lib/storage";

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
  // null while the fresh (already-saved-topics excluded) bank loads for
  // this exercise type — see getFreshContentBank in lib/storage.js. Spun
  // topics that were never saved stay eligible; only an actual saved
  // session (Reflect.jsx's save()) removes a topic from the pool.
  const [bank, setBank] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [resultIndex, setResultIndex] = useState(null);
  const [spinning, setSpinning] = useState(true);
  const timerRef = useRef(null);
  const bankRef = useRef(null);

  // `fromIndex` is only needed for the very first spin after a fresh bank
  // loads: at that point React hasn't re-rendered yet, so `displayIndex`
  // state still holds the *previous* render's value and can't be trusted
  // as "the index currently on screen" to exclude. Every later call (the
  // "Spin again" button) omits it and falls back to state, which by then
  // is accurate.
  const spin = (fromIndex) => {
    const list = bankRef.current;
    if (!list || list.length === 0) return;
    clearTimeout(timerRef.current);
    setSpinning(true);
    setResultIndex(null);

    const target = randomIndex(list.length, fromIndex ?? displayIndex);
    let tick = 0;

    const step = () => {
      tick += 1;
      if (tick >= SPIN_TICKS) {
        setDisplayIndex(target);
        setResultIndex(target);
        setSpinning(false);
        return;
      }
      setDisplayIndex((prev) => randomIndex(list.length, prev));
      const progress = tick / SPIN_TICKS;
      const delay = MIN_DELAY + (MAX_DELAY - MIN_DELAY) * progress ** 2;
      timerRef.current = setTimeout(step, delay);
    };

    timerRef.current = setTimeout(step, MIN_DELAY);
  };

  useEffect(() => {
    let cancelled = false;
    setBank(null);
    bankRef.current = null;
    getFreshContentBank(exerciseType.id).then(({ entries, exhausted: isExhausted }) => {
      if (cancelled) return;
      bankRef.current = entries;
      setBank(entries);
      setExhausted(isExhausted);
      const start = randomIndex(entries.length);
      setDisplayIndex(start);
      spin(start);
    });
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseType.id]);

  const entry = bank?.[displayIndex] ?? { prompt: "" };
  const loading = bank === null;

  const proceed = () => {
    if (resultIndex === null || !bank) return;
    onChosen({ ...exerciseType, ...bank[resultIndex] });
  };

  return (
    <div className="center-screen">
      <div>
        <FlowHeader step="spin" exercise={exerciseType} onClose={onCancel} />
        <Title style={{ marginTop: 18 }}>{loading ? "Loading…" : spinning ? "Spinning…" : "Landed on"}</Title>
        <Body className="dim" style={{ marginTop: 6 }}>
          {loading
            ? "Finding topics you haven't saved yet."
            : spinning
            ? "You don't get to choose this one — that's the point."
            : "Read it once. Then we start the clock."}
        </Body>
        {!loading && exhausted ? (
          <Body className="dim" style={{ marginTop: 4, fontSize: 12.5 }}>
            You've saved a session on every prompt here — recycling the full set.
          </Body>
        ) : null}
      </div>

      <div className="roulette-wrap">
        <div
          className={`roulette-card ${spinning ? "spinning" : "landed"}`}
          style={{ borderColor: spinning ? exerciseType.color + "40" : exerciseType.color }}
        >
          {loading ? (
            // The reel has nothing to flash through yet — getFreshContentBank
            // is still fetching this profile's already-saved topics from
            // Supabase (see storage.js). Rendering the flash card here (as
            // this used to) meant a pulsing card with blank text until that
            // network round-trip finished, which read as broken rather than
            // loading. A calm, explicit loading state instead — the actual
            // flashing reel only starts once there's real content to show.
            <div className="roulette-loading">
              <Loader2 size={22} className="icon-spin" style={{ color: exerciseType.color }} />
            </div>
          ) : spinning ? (
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
          disabled={loading || spinning}
          style={{ background: exerciseType.color }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Button
            title="Spin again"
            icon={Dices}
            variant="ghost"
            onClick={spin}
            disabled={loading || spinning}
            style={{ flex: 1 }}
          />
          <Button title="Change category" variant="ghost" onClick={onCancel} style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}
