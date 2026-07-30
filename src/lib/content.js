// Content banks for all exercise types.
// Kept as flat arrays so daily selection can just index by a date-derived seed.

// Reflection Roulette (formerly "Wiki Roulette" — this used to pull random
// live Wikipedia articles, but that's inherently the wrong content for this
// exercise: Wikipedia doesn't have an article on "your neighbor's dog" or
// "what home means to you". Personal, spiritual, and philosophical prompts
// have to come from a curated bank instead — this is that bank. No network
// call, no live source, just picked by day (see getDailyPromptPair below).
export const reflectivePrompts = [
  "Talk about a pet — yours, a friend's, or even a neighbor's — that means something to you.",
  "What does the word \"home\" actually mean to you, beyond the building?",
  "Describe a small, ordinary moment from this week that you'd want to remember.",
  "Is there something you believe in that you can't fully explain or prove?",
  "Talk about a time silence said more than words could have.",
  "What's a fear you've slowly made peace with?",
  "Describe a place that feels sacred to you, even if it's not religious.",
  "Talk about someone who changed how you see the world, without meaning to.",
  "What does it mean to forgive someone — do you think it's always possible?",
  "Talk about a habit or ritual that grounds you.",
  "Is there a version of yourself from years ago you'd like to talk to? What would you say?",
  "What do you think happens to the things we love after we're gone?",
  "Talk about a moment you felt completely present, with no other thoughts intruding.",
  "What's something ordinary that you find quietly beautiful?",
  "Talk about a time you were wrong about someone, and what changed your mind.",
  "Do you think people can really change, or just reveal who they already were?",
  "Talk about a memory tied to a smell, a sound, or a taste.",
  "What does \"enough\" mean to you — when do you feel like you have enough?",
  "Talk about a kindness a stranger showed you, or one you showed a stranger.",
  "Is there a question about life you've stopped trying to answer, and made peace with?",
  "Talk about the last time you lost track of time doing something you loved.",
  "What's a belief you held strongly as a child that you no longer hold?",
  "Talk about someone who is no longer in your life but still shapes how you act.",
  "What does it mean to you to be truly listened to?",
  "Talk about a place you've never been but feel drawn to, and why.",
  "Is there something in nature that always calms you down?",
  "Talk about a decision that scared you but that you're glad you made.",
  "What do you think you'll care about, looking back, that you don't think about enough now?",
  "Talk about a moment someone showed up for you when you didn't expect it.",
  "What's the difference, to you, between being alone and being lonely?",
  "Talk about a tradition — yours or someone else's — that you find meaningful.",
  "Is there something you do out of love that no one else notices?",
  "Talk about a time you had to let go of something you weren't ready to let go of.",
  "What does gratitude actually feel like to you, physically, not just as an idea?",
  "Talk about a conversation that stayed with you longer than you expected.",
  "Do you think there's a difference between happiness and contentment?",
  "Talk about something you inherited — not necessarily an object — from your family.",
  "What's a small act of care you do for someone without them asking?",
  "Talk about a time nature made you feel very small, in a good way.",
  "What do you think it means to live a good life — not a successful one, a good one?",
];

export const simplifyPrompts = [
  "How the internet works",
  "Why the sky is blue",
  "How vaccines work",
  "What inflation means",
  "How airplanes fly",
  "What a black hole is",
  "How electricity gets to your house",
  "Why we have seasons",
  "How your phone knows your location",
  "What compound interest is",
  "How memory works in the brain",
  "Why ice floats on water",
  "What artificial intelligence is",
  "How rainbows form",
  "Why we dream",
  "How the stock market works",
  "What DNA is",
  "How a car engine works",
  "Why the moon changes shape",
  "What climate change is",
];

export const opinionPrompts = [
  "Is remote work better than working in an office?",
  "Should social media have a minimum age requirement?",
  "Is it better to live in a big city or a small town?",
  "Should university education be free?",
  "Is reading fiction more valuable than reading non-fiction?",
  "Should people be required to learn a second language?",
  "Is a four-day work week a good idea?",
  "Should there be a screen-time limit for adults, not just kids?",
  "Is it better to specialize deeply or know a little of everything?",
  "Should tipping culture be replaced with fair fixed wages?",
  "Is competition or collaboration a better driver of progress?",
  "Should everyone learn to code?",
  "Is it better to save aggressively or enjoy money now?",
  "Should companies allow employees to work from anywhere permanently?",
  "Is traditional handwriting still worth teaching in schools?",
];

export const wordLadderPairs = [
  ["umbrella", "volcano"],
  ["clock", "ocean"],
  ["ladder", "whisper"],
  ["mirror", "thunder"],
  ["candle", "highway"],
  ["compass", "lullaby"],
  ["anchor", "balloon"],
  ["lantern", "glacier"],
  ["bicycle", "eclipse"],
  ["feather", "engine"],
  ["blanket", "comet"],
  ["kettle", "canyon"],
];

// Vocabulary bank: word + definition + a short speaking prompt to force real usage,
// not just a definition recite.
export const vocabWords = [
  {
    word: "Ephemeral",
    definition: "Lasting for a very short time.",
    prompt: "Talk about something ephemeral in your own life — use the word naturally at least twice.",
  },
  {
    word: "Ubiquitous",
    definition: "Present, appearing, or found everywhere.",
    prompt: "Describe something you think is ubiquitous in modern life, and whether that's a good thing.",
  },
  {
    word: "Pragmatic",
    definition: "Dealing with things sensibly and realistically.",
    prompt: "Describe a time you had to be pragmatic instead of idealistic.",
  },
  {
    word: "Ambivalent",
    definition: "Having mixed feelings or contradictory ideas about something.",
    prompt: "Talk about something you feel genuinely ambivalent about.",
  },
  {
    word: "Candid",
    definition: "Truthful and straightforward; frank.",
    prompt: "Give a candid opinion on a topic most people are diplomatic about.",
  },
  {
    word: "Meticulous",
    definition: "Showing great attention to detail; very careful and precise.",
    prompt: "Describe a task that requires being meticulous, and one that doesn't.",
  },
  {
    word: "Resilient",
    definition: "Able to recover quickly from difficulties.",
    prompt: "Talk about a time you or someone you know had to be resilient.",
  },
  {
    word: "Nuanced",
    definition: "Characterized by subtle shades of meaning or expression.",
    prompt: "Take a topic people usually oversimplify and give a nuanced take on it.",
  },
  {
    word: "Skeptical",
    definition: "Not easily convinced; having doubts or reservations.",
    prompt: "Talk about a claim or trend you're skeptical of, and why.",
  },
  {
    word: "Eloquent",
    definition: "Fluent and persuasive in speaking or writing.",
    prompt: "Describe someone you find eloquent and what makes their speaking effective.",
  },
  {
    word: "Arbitrary",
    definition: "Based on random choice rather than any reason or system.",
    prompt: "Talk about a rule or decision you think is arbitrary.",
  },
  {
    word: "Cognizant",
    definition: "Having knowledge or being aware of something.",
    prompt: "Talk about something you've become more cognizant of as you've gotten older.",
  },
  {
    word: "Tenacious",
    definition: "Persistent in maintaining or achieving something; determined.",
    prompt: "Describe a goal that required you to be tenacious.",
  },
  {
    word: "Superfluous",
    definition: "Unnecessary, especially through being more than enough.",
    prompt: "Talk about something in modern life you think is superfluous.",
  },
  {
    word: "Astute",
    definition: "Having an ability to accurately assess situations; shrewd.",
    prompt: "Describe an astute observation someone has made about you or your work.",
  },
];

export const EXERCISE_TYPES = [
  {
    // id kept as "wiki_roulette" for backward compatibility with sessions
    // already saved in localStorage under this typeId — only the content
    // source and display name changed, not the identity of the exercise.
    id: "wiki_roulette",
    title: "Reflection Roulette",
    tagline: "A personal or philosophical prompt. Think, then speak.",
    prepSeconds: 60,
    speakSeconds: 120,
    color: "#6C8CFF",
  },
  {
    id: "explain_simply",
    title: "Explain It Simply",
    tagline: "Explain it like they're five.",
    prepSeconds: 60,
    speakSeconds: 90,
    color: "#4CD9B0",
  },
  {
    id: "snap_opinion",
    title: "Snap Opinion",
    tagline: "Pick a side. Make your case.",
    prepSeconds: 45,
    speakSeconds: 90,
    color: "#F2B84B",
  },
  {
    id: "word_of_day",
    title: "Word of the Day",
    tagline: "A new word. Use it out loud.",
    prepSeconds: 45,
    speakSeconds: 75,
    color: "#F26C6C",
  },
  {
    id: "word_ladder",
    title: "Word Ladder",
    tagline: "Connect two random words. Quick riff.",
    prepSeconds: 20,
    speakSeconds: 30,
    color: "#B98CFF",
  },
];

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

// The category featured on the Home screen's "Today" card — rotates daily.
// It no longer carries a pre-picked prompt: topic selection now happens in
// the flip-card Choose screen, the same way for every category (including
// this one), so there's nothing to precompute here.
export function getDailyExercise(date = new Date()) {
  const doy = dayOfYear(date);
  return EXERCISE_TYPES[doy % EXERCISE_TYPES.length];
}

export function getPromptFor(typeId, seed = dayOfYear(new Date())) {
  switch (typeId) {
    case "wiki_roulette":
      return { prompt: reflectivePrompts[seed % reflectivePrompts.length] };
    case "explain_simply":
      return { prompt: simplifyPrompts[seed % simplifyPrompts.length] };
    case "snap_opinion":
      return { prompt: opinionPrompts[seed % opinionPrompts.length] };
    case "word_ladder": {
      const pair = wordLadderPairs[seed % wordLadderPairs.length];
      return { prompt: `Connect "${pair[0]}" and "${pair[1]}" in one continuous riff.`, pair };
    }
    case "word_of_day": {
      const entry = vocabWords[seed % vocabWords.length];
      return {
        prompt: entry.prompt,
        word: entry.word,
        definition: entry.definition,
      };
    }
    default:
      return { prompt: "" };
  }
}

export function getExerciseType(id) {
  return EXERCISE_TYPES.find((e) => e.id === id);
}

// Two deterministic-per-day seeds for a category's content bank, far enough
// apart (and nudged on collision) to almost always land on two different
// entries even in the shorter banks like wordLadderPairs.
function twoSeeds(doy) {
  return [doy, doy + 137];
}

// Retained for the day-locked pair of options this used to produce for the
// old pick-a-card flip UI (Choose.jsx, since replaced by the Roulette
// screen, which spins across getContentBank instead). Kept + still tested
// because it's a handy deterministic-per-day helper in its own right.
export function getDailyPromptPair(typeId, date = new Date()) {
  const doy = dayOfYear(date);
  const [seedA, seedB] = twoSeeds(doy);
  const a = getPromptFor(typeId, seedA);
  let b = getPromptFor(typeId, seedB);
  if (b.prompt === a.prompt) b = getPromptFor(typeId, seedB + 1);
  return [a, b];
}

// Single entry point the (now-retired) Choose screen used for any category:
// resolves to exactly two { prompt, word?, pair?, ... } options for the day.
// Kept async (even though it's synchronous now) in case a category ever
// needs to fetch something live again later.
export async function getDailyTopicPair(typeId, date = new Date()) {
  return getDailyPromptPair(typeId, date);
}

// Full content bank for a category, normalized to the same shape
// getPromptFor entries use ({ prompt, word?, definition?, pair? }). Used by
// the Roulette screen to spin across every option in the bank, not just a
// day-locked pair — every category is a genuine random spin now.
export function getContentBank(typeId) {
  switch (typeId) {
    case "wiki_roulette":
      return reflectivePrompts.map((prompt) => ({ prompt }));
    case "explain_simply":
      return simplifyPrompts.map((prompt) => ({ prompt }));
    case "snap_opinion":
      return opinionPrompts.map((prompt) => ({ prompt }));
    case "word_ladder":
      return wordLadderPairs.map(([a, b]) => ({
        prompt: `Connect "${a}" and "${b}" in one continuous riff.`,
        pair: [a, b],
      }));
    case "word_of_day":
      return vocabWords.map((entry) => ({ ...entry }));
    default:
      return [];
  }
}
