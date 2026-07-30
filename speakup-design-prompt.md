# Design brief: SpeakUp

Design the complete website for **SpeakUp**, a daily spoken-fluency practice app. This is the whole product — there's no separate app vs. marketing site; the site itself is where people sign up, log in, and practice. Design all of it: the public-facing entry point and every screen someone uses once signed in.

## What SpeakUp does

SpeakUp is for anyone who wants to get better at speaking off the cuff — thinking on your feet, structuring an answer on the spot, sounding confident without notes. Think of it as a gym for spontaneous speaking. A user shows up, gets a short prompt, has a few seconds to think, then speaks out loud into their microphone for a timed interval. Afterward they get feedback on how they did, and their practice builds into a visible streak over time.

**Target audience:** students, job seekers prepping for interviews, non-native English speakers building fluency, professionals who want to think faster on their feet — self-motivated people practicing alone, on their own time, usually in short daily sessions (a couple minutes), often on a phone.

## The core practice loop

1. **Choose a category.** Five exercise types, each with its own color accent and tagline:
   - **Reflection Roulette** (blue, `#6C8CFF`) — "A personal or philosophical prompt. Think, then speak."
   - **Explain It Simply** (teal, `#4CD9B0`) — "Explain it like they're five."
   - **Snap Opinion** (amber, `#F2B84B`) — "Pick a side. Make your case."
   - **Word of the Day** (red/coral, `#F26C6C`) — "A new word. Use it out loud."
   - **Word Ladder** (purple, `#B98CFF`) — "Connect two random words. Quick riff."
2. **Spin for a topic.** Within a category, the user gets a "roulette" — a spinning/landing animation that picks their specific prompt at random, adding a bit of playful anticipation before the real task starts.
3. **Prep.** A short countdown to gather their thoughts before recording starts.
4. **Record.** A timed recording window (browser microphone) with a visible countdown, while they speak the prompt out loud.
5. **Reflect.** Immediately after, they see a full feedback breakdown of that session (see below), plus a personal self-rating and optional note.

## The feedback system (the heart of the product)

After every recording, feedback is generated automatically — not gated behind a button, it just appears. It combines transparent, rule-based analysis with one layer of AI judgment, and the product's stance is explicit about which is which (nothing is a mysterious black-box score):

- **Structure analysis** — how the speech broke down into opening / body / closing, measured against an ideal 20% / 60% / 20% split, shown as a segmented bar (three colored zones) plus a plain-language note.
- **Power words & weak words** — words that strengthened the speech vs. words that weakened it (hedging, filler, vague language), shown side by side so feedback isn't just criticism — it also names what worked.
- **Strongest line & "tighten this"** — one specific line called out as the strongest moment, and one specific line flagged to cut or tighten, both genuine judgment calls grounded in the actual transcript, not random picks.
- **Vocal delivery over time** — a words-per-minute line graph across the session, so pacing changes (rushing, slowing down, pausing) are visible as a shape, not just a single average number.
- **Articulation score** — a 0–100 score with a visual bar/breakdown, built from pace, filler rate, pauses, and vocabulary variety — again, computed transparently, not an opaque AI number.
- **Syllable/vocabulary feedback** — flags simple words that could be upgraded to something stronger, with concrete suggested replacements.
- **Personal layer** — a self-rating (mood/feeling scale) and optional freeform note the user adds themselves, kept alongside the automated feedback rather than replaced by it.
- **Trend indicator** — once someone has enough history, new sessions show how this one compares to their recent average pace and filler rate.

## Progress & identity

- **Streak** — consecutive days of practice, shown prominently on the home/dashboard view, plus a week-at-a-glance strip of seven dots running **Sunday through Saturday** (fixed order, not a rolling window) marking which days this week had a completed session.
- **Stats** — total minutes spoken and total sessions completed, shown as simple stat blocks alongside the streak.
- **Badges** — a dedicated section (not cluttering the main dashboard) listing achievements, each earned or locked, with an icon, name, and plain description of what it takes. Current badges: First Step (first session ever), 3-Day Streak, Week Strong (7-day streak), Month Strong (30-day streak), Getting Started (10 sessions), Dedicated (50 sessions), Centurion (100 sessions), Hour of Power (60 minutes total), Marathoner (300 minutes total), Explorer (try all 5 exercise categories), Clean Speaker (finish a session with zero filler words). Locked badges are visible too, so the next goal is always clear — dimmed/grayscale rather than hidden.
- **History** — a chronological log of every past session, each one expandable to play back the recording, see its transcript, and review its full feedback again.

## Account & settings

- Real accounts (email/password), with sessions, streak, and badges following the person across devices rather than being tied to one browser.
- A simple profile: name and age.
- Settings for: daily reminder toggle, live-captions-while-recording toggle, and status indicators for the optional local AI/transcription backends the app can use (these read as "connected/not connected" status, not something the average user configures deeply).

## Tone & visual direction

Keep the design in the same spirit as the current build — warm, calm, a little playful, but professional enough to feel trustworthy for something people use daily and take seriously (interview prep, fluency building). Not corporate-cold, not gamified-childish. Think: a well-made personal-growth or wellness app, not an enterprise SaaS dashboard.

Current visual language to carry forward (adapt and elevate, don't discard):
- **Palette:** warm cream/off-white background (`#f2ede4` family), near-black warm text (`#1c1a17`), soft muted secondary text — accented with a confident violet/indigo primary (`#6e5ef2`) and a fresh green accent (`#2fae83`) for "done/success" states. The five exercise categories each carry their own distinct accent color (blue, teal, amber, coral, purple) used consistently as identity colors, not randomly.
- **Shape language:** soft, rounded cards with gentle shadows, translucent/frosted card surfaces over soft radial gradient blooms in the background (subtle, not loud) — calm rather than flat/sterile.
- **Typography:** clean geometric sans-serif (Inter or similar), fairly tight letter-spacing, confident bold headlines, restrained body text.
- **Structure:** currently a mobile-first single-column "app shell" (~480px max width) with a bottom tab bar (Home / History / Badges / Settings). For the redesigned website, feel free to open this up into a proper responsive layout for larger screens while preserving that this is fundamentally a focused, single-task-at-a-time tool — not a busy dashboard.

Deliverable: a cohesive design (pages/screens, not just a style guide) covering at minimum — a landing/welcome view for signed-out visitors, sign in/sign up, the home/dashboard view with today's exercise + streak + week strip, the practice flow (category → roulette pick → prep countdown → recording → reflect/feedback), history, the dedicated badges view, and settings/profile. Clean, professional, proper — but still warm enough that someone wants to come back and practice daily.
