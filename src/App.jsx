import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import Home from "./screens/Home";
import Progress from "./screens/Progress";
import Badges from "./screens/Badges";
import Settings from "./screens/Settings";
import Login from "./screens/Login";
import Landing from "./screens/Landing";
import Pick from "./screens/Pick";
import Prep from "./screens/Prep";
import Record from "./screens/Record";
import Reflect from "./screens/Reflect";
import Roulette from "./screens/Roulette";
import Celebrate from "./screens/Celebrate";
import { TAB_ICONS } from "./lib/icons";
import { useTheme } from "./lib/theme";
import { getSession, onAuthStateChange, signOut } from "./lib/auth";
import { supabaseConfigured } from "./lib/supabaseClient";

const TABS = [
  { id: "home", label: "Home" },
  { id: "progress", label: "Progress" },
  { id: "badges", label: "Badges" },
  { id: "settings", label: "You" },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Real accounts via Supabase Auth. `session` is Supabase's session object
  // once signed in, or null once we know for sure the visitor is signed out
  // (undefined = still checking, so we don't flash the landing page at
  // someone who's actually already signed in).
  const [session, setSession] = useState(undefined);
  const [authView, setAuthView] = useState("landing"); // 'landing' | 'auth' — only used while signed out
  const [authMode, setAuthMode] = useState("signin"); // seeds Login's initial tab

  const [tab, setTab] = useState("home");
  // null | 'pick' | 'spin' | 'prep' | 'record' | 'reflect' | 'celebrate'
  const [flowStep, setFlowStep] = useState(null);
  const [activeType, setActiveType] = useState(null); // category, before a topic is chosen
  const [activeExercise, setActiveExercise] = useState(null); // category + chosen topic
  const [recording, setRecording] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) return;
    getSession().then(setSession);
    return onAuthStateChange((nextSession) => setSession(nextSession));
  }, []);

  // Launched either with a category already picked (a card on Home) or with
  // none (the nav's Practise button), in which case the flow's first screen
  // is Pick — "what are we working on?"
  const startExercise = (exerciseType) => {
    if (exerciseType) {
      setActiveType(exerciseType);
      setFlowStep("spin");
    } else {
      setFlowStep("pick");
    }
  };

  const exitFlow = () => {
    setFlowStep(null);
    setActiveType(null);
    setActiveExercise(null);
    setRecording(null);
    setCelebration(null);
  };

  const handleSaved = (celebrationData) => {
    setCelebration(celebrationData);
    setFlowStep("celebrate");
    setRefreshKey((k) => k + 1);
  };

  const finishCelebrate = () => {
    exitFlow();
    setTab("home");
  };

  const celebrateAgain = () => {
    setActiveExercise(null);
    setRecording(null);
    setCelebration(null);
    setFlowStep("spin");
  };

  const handleSignOut = async () => {
    await signOut();
    setTab("home");
    setAuthView("landing");
    setRefreshKey((k) => k + 1);
  };

  const goToAuth = (mode) => {
    setAuthMode(mode);
    setAuthView("auth");
  };

  if (!supabaseConfigured) {
    return (
      <div className="app-shell">
        <SupabaseSetupNeeded />
      </div>
    );
  }

  if (session === undefined) {
    // Still resolving the initial session.
    return <div className="app-shell" />;
  }

  if (!session) {
    if (authView === "auth") {
      return (
        <div className="app-shell">
          <Login initialMode={authMode} onBack={() => setAuthView("landing")} />
        </div>
      );
    }
    return (
      <div className="app-shell">
        <Landing theme={theme} onToggleTheme={toggleTheme} onSignIn={() => goToAuth("signin")} onStartFree={() => goToAuth("signup")} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {flowStep === "pick" && (
        <Pick onChoose={(ex) => startExercise(ex)} onCancel={exitFlow} />
      )}

      {flowStep === "spin" && activeType && (
        <Roulette
          exerciseType={activeType}
          onChosen={(exercise) => {
            setActiveExercise(exercise);
            setFlowStep("prep");
          }}
          onCancel={exitFlow}
        />
      )}

      {flowStep === "prep" && activeExercise && (
        <Prep exercise={activeExercise} onProceed={() => setFlowStep("record")} onCancel={exitFlow} />
      )}

      {flowStep === "record" && activeExercise && (
        <Record
          exercise={activeExercise}
          onDone={(result) => {
            setRecording(result);
            setFlowStep("reflect");
          }}
          onCancel={exitFlow}
        />
      )}

      {flowStep === "reflect" && activeExercise && recording && (
        <Reflect exercise={activeExercise} recording={recording} onSaved={handleSaved} />
      )}

      {flowStep === "celebrate" && celebration && (
        <Celebrate
          streak={celebration.streak}
          isFirstSession={celebration.isFirstSession}
          note={celebration.note}
          color={activeType?.color}
          onHome={finishCelebrate}
          onAgain={celebrateAgain}
        />
      )}

      {!flowStep && (
        <>
          {tab === "home" && (
            <Home onStartExercise={startExercise} refreshKey={refreshKey} user={session.user} theme={theme} onToggleTheme={toggleTheme} />
          )}
          {tab === "progress" && <Progress refreshKey={refreshKey} onStartExercise={startExercise} />}
          {tab === "badges" && <Badges refreshKey={refreshKey} user={session.user} />}
          {tab === "settings" && <Settings user={session.user} onSignOut={handleSignOut} theme={theme} onToggleTheme={toggleTheme} />}

          <div className="nav-wrap">
            <nav className="tab-bar">
              {TABS.map((t) => {
                const Icon = TAB_ICONS[t.id];
                const isActive = tab === t.id;
                return (
                  <button key={t.id} className={`tab-item ${isActive ? "active" : ""}`} onClick={() => setTab(t.id)}>
                    <span className="tab-icon">
                      <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    <span className="tab-label">{t.label}</span>
                  </button>
                );
              })}
              <button className="tab-practice" onClick={() => startExercise(null)}>
                <Mic size={16} strokeWidth={2.4} />
                Practise
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

// Shown instead of crashing when someone clones this repo and runs it
// before setting up their own Supabase project — see .env.example and
// supabase/schema.sql for the two things this is waiting on.
function SupabaseSetupNeeded() {
  return (
    <div className="screen">
      <div className="label">SETUP NEEDED</div>
      <h1 className="title">Connect Supabase</h1>
      <p className="body-text dim" style={{ marginTop: 10 }}>
        This app needs a Supabase project for accounts, sessions, and recordings. Copy{" "}
        <code>.env.example</code> to <code>.env</code>, fill in your project's URL and anon key
        (Project Settings → API in the Supabase dashboard), then run <code>supabase/schema.sql</code>{" "}
        in the SQL Editor there. Restart <code>npm run dev</code> after saving <code>.env</code>.
      </p>
    </div>
  );
}
