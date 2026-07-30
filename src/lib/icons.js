import {
  Award,
  BookOpen,
  Clock,
  Compass,
  Dices,
  Flame,
  Home as HomeIcon,
  Lightbulb,
  Link2,
  Scale,
  User,
  TrendingUp,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

// Maps exercise type id -> icon component, kept separate from content.js so
// that file can stay plain data (topics/prompts) with no UI concerns mixed in.
export const EXERCISE_ICONS = {
  wiki_roulette: Dices,
  explain_simply: Lightbulb,
  snap_opinion: Scale,
  word_of_day: BookOpen,
  word_ladder: Link2,
};

// Four tabs (Home / Progress / Badges / You) plus a fifth "Practise" action
// button rendered separately — see App.jsx's tab-bar.
export const TAB_ICONS = {
  home: HomeIcon,
  progress: TrendingUp,
  badges: Award,
  settings: User,
};

// Maps badge id (see lib/badges.js) -> icon component, same separation of
// concerns as EXERCISE_ICONS above.
export const BADGE_ICONS = {
  first_session: Sparkles,
  streak_3: Flame,
  streak_7: Flame,
  streak_30: Flame,
  sessions_10: Target,
  sessions_50: Trophy,
  sessions_100: Award,
  minutes_60: Clock,
  minutes_300: Clock,
  explorer: Compass,
  clean_speaker: Sparkles,
};
