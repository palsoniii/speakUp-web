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
  "Talk about an object you'd grab first if your home were on fire, and why.",
  "What does the word \"trust\" mean to you — how do you know when you've earned someone's?",
  "Talk about a time you disappointed yourself, and how you found your way back.",
  "Talk about a fear about the future that you don't talk about often.",
  "Talk about a skill or hobby you gave up on, and whether you miss it.",
  "What do you think you owe to a stranger, if anything?",
  "Talk about a moment you felt truly free, even if only briefly.",
  "Do you think luck is real, or just a story we tell after the fact?",
  "Talk about a promise you made to yourself that you're still keeping.",
  "What does \"rest\" actually feel like for you — not sleep, but rest?",
  "Talk about a time you surprised yourself with how you reacted to something hard.",
  "Is there a piece of advice you were given that took years to actually understand?",
  "Talk about a rule you followed as a kid that you now realize made no sense.",
  "What does it mean to you to belong somewhere?",
  "Talk about a routine you used to care about that quietly stopped mattering.",
  "Do you think wisdom comes from age, or can it come from anywhere?",
  "Talk about a time you chose the harder, more honest option over the easier one.",
  "What does courage look like in your everyday life, not the dramatic version?",
  "Talk about something you're still figuring out about yourself.",
  "Is there a place that feels frozen in time whenever you go back to it?",
  "Talk about your relationship with money — not the numbers, the feelings.",
  "Describe a piece of art, music, or writing that changed how you saw something.",
  "Is there a mentor or teacher who said something you still carry with you?",
  "Talk about a role you play in your family that you didn't choose.",
  "What does it mean to you to apologize well?",
  "Talk about a boundary you had to learn to set, and what it cost you to set it.",
  "Do you think comparing yourself to others is ever useful?",
  "Talk about a time your curiosity led you somewhere unexpected.",
  "What role does humor play in how you get through hard things?",
  "Talk about a season of your life that felt completely different from the one before it.",
  "Is there a word or phrase in another language that captures something English can't?",
  "Talk about how you relate to your own body, separate from how it looks.",
  "What's a risk you're glad you took, even though it didn't fully pay off?",
  "Talk about a time being generous cost you something real.",
  "What do you want people to remember about how you made them feel?",
  "Talk about a time simplicity served you better than more options would have.",
  "What have you learned from a failure that a success never could have taught you?",
  "Talk about how your sense of who you are changes depending on who you're with.",
  "Is there a piece of weather or a season that matches your mood more than others?",
  "Talk about solitude you chose, versus loneliness you didn't.",
  "What does getting older feel like to you, day to day, not as a milestone?",
  "Talk about a place you lived or visited that quietly changed you.",
  "Is there a secret you've kept that shaped you more than you expected?",
  "Talk about a promise you broke, and what you learned from breaking it.",
  "Describe what it took for you to trust someone again after being let down.",
  "Talk about a time you were angry and glad, in hindsight, that you let yourself feel it.",
  "What does patience with other people actually require from you?",
  "Talk about a time you had to listen to yourself over everyone else's advice.",
  "Is there work you do that isn't your job but still feels like part of your identity?",
  "Talk about a hobby that gives you something your job never could.",
  "What's something that reliably makes you laugh, even on a bad day?",
  "Talk about a time boredom led you somewhere good.",
  "Describe a piece of curiosity you had as a kid that you've never lost.",
  "Talk about a mistake that turned out to be a gift in disguise.",
  "Do you think each generation really misunderstands the one before it?",
  "Talk about a time you felt humble in a good way, not a small way.",
  "What does quiet confidence look like in your own life?",
  "Talk about a time you were underestimated, and what you did with it.",
  "Describe a time you were misunderstood and chose not to correct it.",
  "Talk about how your cultural background shows up in small daily habits.",
  "What does it mean to you to give love versus to receive it well?",
  "Talk about a time abundance felt like too much rather than enough.",
  "Describe a time you had to let someone down gently.",
  "Talk about a time you stood up for something small that mattered to you.",
  "What's a lesson a hard year taught you that an easy year couldn't have?",
  "Talk about a friendship that started somewhere you didn't expect.",
  "Is there a moment you actively chose joy even though it wasn't the easy choice?",
  "Talk about what it means for you to slow down, in practice, not just in theory.",
  "Describe a meal or kitchen tradition that means more than the food itself.",
  "Talk about the last handwritten letter or note you kept, and why you kept it.",
  "What does silence after a loss feel like, compared to silence any other time?",
  "Talk about laughing during a hard time, and what that laughter did for you.",
  "Describe a promise you've kept quietly, with no one else knowing.",
  "Talk about a stranger whose story stayed with you longer than the moment did.",
  "What makes you feel most alive, specifically?",
  "What makes you feel safest, specifically?",
  "Talk about something you're proud of that no one ever applauded.",
  "Describe a risk you didn't take, and how you think about that choice now.",
  "What kind of patience are you still working on?",
  "Talk about a rule you've made for yourself that no one told you to make.",
  "Talk about the pace of your life right now — is it the pace you'd choose?",
  "What does silence teach you that noise never could?",
  "Talk about being present with someone who was struggling, and what that asked of you.",
  "Describe a time you chose yourself over what was expected of you.",
  "What does integrity look like for you on an ordinary Tuesday, not just in a crisis?",
  "Talk about a moment your own pride caught you by surprise.",
  "What does home smell like to you?",
  "Talk about the last thing that made you laugh until it actually hurt.",
  "Describe an ordinary day you remember clearly for no obvious reason.",
  "Talk about what you do, or don't do, when no one's watching.",
  "What's a habit you're trying to break, and why that one?",
  "Talk about the story you tend to tell people about yourself, and whether it's still true.",
  "What would you want a stranger to understand about your family?",
  "Talk about the weight of an expectation someone placed on you.",
  "Describe what it took to trust again after being hurt.",
  "What makes an apology feel real to you, versus just procedural?",
  "Talk about the first time you felt like an adult.",
  "What has your body taught you that your mind resisted learning?",
  "Talk about something you save for special occasions, and why you wait.",
  "Describe the last time you changed your mind about something that mattered.",
  "Talk about the kind of person you become under real pressure.",
  "What's a comfort you return to again and again, no matter what else changes?",
  "Talk about something you notice in people that most others seem to miss.",
  "Describe the last thing you forgave yourself for.",
  "Talk about a decision you made mainly for someone else's sake.",
  "What does 'showing up' for someone actually mean to you, in practice?"
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
  "How WiFi works",
  "Why the ocean is salty",
  "How GPS works",
  "What cryptocurrency is",
  "How solar panels work",
  "Why we get goosebumps",
  "What a recession is",
  "How antibiotics work",
  "Why leaves change color in fall",
  "How magnets work",
  "What blockchain is",
  "How noise-cancelling headphones work",
  "Why we get hiccups",
  "How batteries work",
  "What supply and demand means",
  "How 3D printing works",
  "Why the ocean has tides",
  "How search engines work",
  "What GDP means",
  "How microwaves heat food",
  "How lasers work",
  "How x-rays work",
  "Why glass is transparent",
  "How radios work",
  "Why sound travels faster in water than in air",
  "How gyroscopes work",
  "Why objects float or sink",
  "How friction works",
  "How echoes happen",
  "How satellites stay in orbit",
  "Why stars twinkle",
  "What a supernova is",
  "How rockets escape gravity",
  "Why we always see the same side of the moon",
  "What a light-year is",
  "How telescopes see distant galaxies",
  "Why Mars looks red",
  "What a solar eclipse is",
  "How the International Space Station stays in orbit",
  "Why we yawn",
  "Why we sneeze",
  "Why onions make you cry",
  "Why we get brain freeze",
  "Why we blush",
  "What causes déjà vu",
  "Why we get muscle cramps",
  "How the immune system fights germs",
  "How allergies work",
  "Why we get pins and needles",
  "Why we forget most of our dreams",
  "How taste buds work",
  "Why fingerprints are unique",
  "How the heart pumps blood",
  "Why we get muscle soreness after exercise",
  "How Bluetooth works",
  "How touchscreens work",
  "What an algorithm is",
  "How 4K resolution works",
  "What net neutrality means",
  "How cloud computing works",
  "What machine learning is",
  "How QR codes work",
  "How fiber optic cables work",
  "What encryption is",
  "What a VPN is",
  "How autocomplete works",
  "What open source software means",
  "What a credit score is",
  "What a mortgage is",
  "What a 401k is",
  "What an IPO is",
  "What a tariff is",
  "What venture capital is",
  "What a hedge fund is",
  "What a bond is",
  "What a monopoly is",
  "What arbitrage means",
  "What insider trading is",
  "What escrow means",
  "What a patent protects",
  "What a trademark protects",
  "What copyright protects",
  "What monetary policy is",
  "What a currency peg is",
  "How glaciers move",
  "Why deserts get cold at night",
  "How wind turbines generate power",
  "Why oil and water don't mix",
  "How hydroelectric power works",
  "Why volcanoes form near tectonic plates",
  "How earthquakes happen",
  "What causes tsunamis",
  "How caves form",
  "What causes fog",
  "Why hurricanes spin",
  "How double rainbows happen",
  "How coral reefs grow",
  "How trees make oxygen",
  "What causes wind",
  "Why the sea has waves even on calm days",
  "How elevators work",
  "How air conditioning works",
  "How CPR works",
  "How pacemakers work",
  "How printers work",
  "How power grids work",
  "How submarines work",
  "How weather balloons work",
  "How escalators work",
  "How night vision goggles work",
  "How contact lenses work",
  "How fingerprint scanners work",
  "How 3D movies work",
  "How microchips are made",
  "How hearing aids work",
  "How airbags work",
  "How seatbelts protect you in a crash",
  "How traffic lights are timed",
  "How elevators know which floor to stop at",
  "How ATMs verify your card",
  "How self-checkout scanners work",
  "How dishwashers clean dishes",
  "How refrigerators keep food cold",
  "How solar eclipses are predicted years in advance",
  "How tides are predicted",
  "What a placebo effect is",
  "What antibodies are",
  "How sunscreen protects skin",
  "Why ice is slippery",
  "What causes muscle knots",
  "How night shifts affect sleep",
  "How noise gets measured in decibels",
  "What Wi-Fi 6 changed from older WiFi",
  "How password managers work",
  "What two-factor authentication does",
  "How ride-share pricing surges",
  "What a credit union is",
  "Why we get seasick",
  "Why we get freckles",
  "What a firewall is",
  "How facial recognition works",
  "How barcodes work",
  "What net worth means",
  "What deflation means",
  "What a subsidy is",
  "Why the ocean has waves",
  "How fossils form",
  "How snow forms",
  "How dialysis works",
  "What circadian rhythm is",
  "Why mountains form",
  "How anesthesia works"
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
  "Should schools replace grades with narrative feedback?",
  "Is it better to read the book or watch the movie first?",
  "Should job interviews be replaced with practical work trials?",
  "Is it better to travel to many places briefly or one place deeply?",
  "Should social media platforms be required to label AI-generated content?",
  "Is it better to live with roommates or alone, even if it costs more?",
  "Should companies be required to disclose salary ranges in job postings?",
  "Is it better to plan a trip in detail or travel spontaneously?",
  "Should everyone be required to do a year of national or community service?",
  "Is it better to have a few close friends or a large social circle?",
  "Should students be allowed to use AI tools for homework?",
  "Is it better to buy a home or rent for flexibility?",
  "Should restaurants be required to show calorie counts on menus?",
  "Is it better to give feedback in person or in writing?",
  "Should employers be allowed to monitor employees' work computers?",
  "Is it better to exercise alone or with other people?",
  "Should news outlets be required to separate opinion from factual reporting clearly?",
  "Is it better to keep a messy creative space or a tidy organized one?",
  "Should voting be mandatory for all eligible citizens?",
  "Is it better to make decisions quickly or take time to deliberate?",
  "Should college athletes be paid?",
  "Is it better to cook at home or eat out regularly?",
  "Should social media platforms verify user identities?",
  "Is it better to save for retirement early or enjoy your 20s?",
  "Should employers be allowed to require a college degree for jobs that don't need one?",
  "Is streaming better than owning physical media?",
  "Should zoos exist?",
  "Is it better to live near family or move wherever opportunity takes you?",
  "Should schools teach personal finance as a required subject?",
  "Is it better to have a strict daily routine or stay flexible?",
  "Should self-driving cars be allowed on public roads today?",
  "Is it better to be a generalist manager or a specialist individual contributor?",
  "Should companies be required to offer unlimited paid time off?",
  "Is it better to learn from a mentor or from trial and error?",
  "Should professional athletes be considered role models?",
  "Is it better to travel solo or with others?",
  "Should influencers be required to disclose paid partnerships more prominently?",
  "Is it better to rent furniture or buy it?",
  "Should public libraries expand beyond books to tool and equipment lending?",
  "Is it better to text or call for most conversations?",
  "Should schools ban smartphones during the school day?",
  "Is it better to marry young or later in life?",
  "Should businesses be required to publish their environmental impact?",
  "Is it better to negotiate salary or accept the first offer?",
  "Should companies ban internal email after work hours?",
  "Should professional sports leagues implement salary caps?",
  "Is it better to buy generic or brand-name products?",
  "Should schools group students by ability rather than age?",
  "Is it better to live minimally or surround yourself with things you enjoy?",
  "Should companies be required to hire locally before hiring remote workers abroad?",
  "Is it better to binge-watch a show or watch one episode at a time?",
  "Should there be term limits for all elected officials?",
  "Is it better to be early to everything or arrive right on time?",
  "Should AI-generated art be eligible for the same awards as human-made art?",
  "Is it better to learn a skill from a class or from online videos?",
  "Should companies disclose the environmental cost of fast shipping versus slow shipping?",
  "Is it better to have a big wedding or elope?",
  "Should health insurance be tied to employment at all?",
  "Is it better to be brutally honest or diplomatically vague?",
  "Should schools eliminate homework for younger children?",
  "Is it better to shop at small local businesses even if it costs more?",
  "Should companies be transparent about how their algorithms rank content?",
  "Is it better to plan your career or let it unfold naturally?",
  "Should professional licensing be required for more skilled trades?",
  "Is it better to keep pets indoors or let them roam?",
  "Should public transit be prioritized over highway expansion in cities?",
  "Is it better to eat the same meals often or always try something new?",
  "Should companies allow anonymous employee feedback to influence leadership decisions?",
  "Is it better to confront conflict directly or let it cool off first?",
  "Should schools replace textbooks entirely with digital devices?",
  "Is it better to live paycheck-adjacent freely or budget tightly and save?",
  "Should social media feeds be chronological instead of algorithmic?",
  "Is it better to have one big vacation a year or several small trips?",
  "Should companies be required to offer mental health days separate from sick leave?",
  "Is it better to specialize your diet strictly or eat intuitively?",
  "Should professional athletes speak publicly on political issues?",
  "Is it better to buy a new car or a reliable used one?",
  "Should city centers be car-free zones?",
  "Is it better to learn by reading instructions or by doing?",
  "Should companies cap how much more a CEO can earn compared to average workers?",
  "Is it better to keep your phone on silent all day or stay reachable?",
  "Should schools start later in the morning for teenagers?",
  "Is it better to have a messy but full schedule or an open, quiet one?",
  "Should streaming services bring back cable-style scheduled programming?",
  "Should employers be banned from asking about salary history?",
  "Should used-item marketplaces require ID verification for sellers?",
  "Is it better to commute by car or public transit, all else equal?",
  "Should companies be required to let employees see their full personnel file?",
  "Is it better to plan meals for the week or decide day by day?",
  "Should professional sports instant replay reviews have a time limit?",
  "Is it better to keep old belongings for sentimental value or declutter regularly?",
  "Should schools grade group projects with one shared grade or individual grades?",
  "Should companies be required to pay interns?",
  "Is it better to travel with a fixed itinerary or figure it out as you go?",
  "Should airlines be required to compensate passengers more for long delays?",
  "Is it better to keep work and personal social media accounts separate?",
  "Should schools offer more vocational tracks instead of a one-size-fits-all path?",
  "Is it better to buy in bulk or purchase only what you need for the week?",
  "Should companies be allowed to track employee location during work hours?",
  "Is it better to celebrate birthdays big or keep them low-key?",
  "Should news comment sections require real names instead of anonymity?",
  "Is it better to set New Year's resolutions or make changes whenever they come up?",
  "Should companies be required to disclose when customer service is AI rather than human?",
  "Is it better to have a long engagement or a short one?",
  "Should schools teach coding as a required subject for all students?",
  "Is it better to keep a strict budget spreadsheet or track spending loosely?",
  "Should restaurants list where their ingredients are sourced from?",
  "Is it better to work in silence or with background noise?",
  "Should companies eliminate performance review ratings in favor of ongoing feedback?",
  "Is it better to over-prepare for a trip or pack light and adapt?",
  "Should professional conferences move permanently online?",
  "Is it better to keep decisions private until they're final or think out loud with others?",
  "Should schools ban ranking students by class rank?",
  "Is it better to buy experiences or material things with extra money?",
  "Should companies require a notice period before layoffs regardless of size?",
  "Is it better to keep a consistent wardrobe or follow trends?"
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
  ["pillow", "avalanche"],
  ["spoon", "hurricane"],
  ["ribbon", "desert"],
  ["telescope", "puddle"],
  ["trumpet", "iceberg"],
  ["basket", "tornado"],
  ["violin", "prairie"],
  ["thermostat", "waterfall"],
  ["envelope", "blizzard"],
  ["sandal", "geyser"],
  ["necklace", "tsunami"],
  ["teapot", "orchard"],
  ["helmet", "monsoon"],
  ["bracelet", "marsh"],
  ["camera", "reef"],
  ["scarf", "tundra"],
  ["whistle", "lagoon"],
  ["mitten", "quarry"],
  ["saddle", "meteor"],
  ["drum", "meadow"],
  ["wallet", "mountain"],
  ["backpack", "valley"],
  ["bottle", "cliff"],
  ["mug", "plateau"],
  ["chair", "ridge"],
  ["table", "dune"],
  ["lamp", "oasis"],
  ["broom", "savanna"],
  ["hammer", "jungle"],
  ["wrench", "rainforest"],
  ["scissors", "wetland"],
  ["needle", "delta"],
  ["thread", "estuary"],
  ["button", "fjord"],
  ["zipper", "cove"],
  ["buckle", "bay"],
  ["hinge", "gulf"],
  ["nail", "strait"],
  ["screw", "peninsula"],
  ["bolt", "isthmus"],
  ["wire", "archipelago"],
  ["cable", "atoll"],
  ["battery", "lake"],
  ["flashlight", "pond"],
  ["matchstick", "stream"],
  ["lighter", "river"],
  ["bucket", "brook"],
  ["mop", "creek"],
  ["sponge", "spring"],
  ["towel", "cascade"],
  ["curtain", "rapids"],
  ["rug", "whirlpool"],
  ["cushion", "current"],
  ["drawer", "tide"],
  ["shelf", "wave"],
  ["stool", "surf"],
  ["bench", "foam"],
  ["cabinet", "mist"],
  ["mailbox", "fog"],
  ["doorbell", "haze"],
  ["keychain", "dew"],
  ["padlock", "frost"],
  ["chain", "hail"],
  ["rope", "sleet"],
  ["net", "snowdrift"],
  ["cage", "icicle"],
  ["jar", "permafrost"],
  ["vase", "aurora"],
  ["bowl", "rainbow"],
  ["plate", "sunbeam"],
  ["fork", "moonbeam"],
  ["knife", "starlight"],
  ["pot", "twilight"],
  ["pan", "dawn"],
  ["thermos", "dusk"],
  ["tray", "horizon"],
  ["napkin", "galaxy"],
  ["apron", "nebula"],
  ["glove", "asteroid"],
  ["sock", "meteorite"],
  ["boot", "constellation"],
  ["cap", "orbit"],
  ["goggles", "supernova"],
  ["mask", "solstice"],
  ["suitcase", "equinox"],
  ["purse", "cyclone"],
  ["briefcase", "typhoon"],
  ["watch", "drought"],
  ["ring", "wildfire"],
  ["earring", "earthquake"],
  ["brooch", "sinkhole"],
  ["comb", "landslide"],
  ["brush", "mudslide"],
  ["razor", "sandstorm"],
  ["soap", "duststorm"],
  ["toothbrush", "whirlwind"],
  ["bandage", "cloudburst"],
  ["thermometer", "downpour"],
  ["syringe", "thunderclap"],
  ["stethoscope", "lightning"],
  ["wheelchair", "crevasse"],
  ["crutch", "moraine"],
  ["microscope", "floodplain"],
  ["binoculars", "watershed"],
  ["tripod", "aquifer"],
  ["map", "sediment"],
  ["globe", "bedrock"],
  ["magnet", "boulder"],
  ["generator", "pebble"],
  ["gear", "gravel"],
  ["pulley", "sand"],
  ["lever", "clay"],
  ["wheel", "silt"],
  ["axle", "loam"],
  ["piston", "moss"],
  ["valve", "lichen"],
  ["pipe", "fungus"],
  ["hose", "mushroom"],
  ["nozzle", "fern"],
  ["sprinkler", "vine"],
  ["shovel", "thicket"],
  ["rake", "shrub"],
  ["hoe", "sapling"],
  ["plow", "grove"],
  ["tractor", "forest"],
  ["wagon", "woodland"],
  ["cart", "canopy"],
  ["sled", "undergrowth"],
  ["sleigh", "root"],
  ["scooter", "bark"],
  ["skateboard", "branch"],
  ["surfboard", "twig"],
  ["kayak", "blossom"],
  ["canoe", "petal"],
  ["raft", "pollen"],
  ["sail", "nectar"],
  ["mast", "thorn"],
  ["oar", "cactus"],
  ["paddle", "palm"],
  ["propeller", "willow"],
  ["rudder", "oak"],
  ["scaffold", "pine"],
  ["crane", "maple"],
  ["bulldozer", "birch"],
  ["forklift", "bamboo"],
  ["elevator", "reed"],
  ["escalator", "cattail"],
  ["treadmill", "seaweed"],
  ["dumbbell", "coral"],
  ["trampoline", "kelp"],
  ["kite", "plankton"],
  ["frisbee", "anemone"],
  ["yoyo", "jellyfish"],
  ["marble", "starfish"],
  ["dice", "urchin"],
  ["domino", "barnacle"],
  ["guitar", "clam"],
  ["piano", "oyster"],
  ["flute", "mussel"],
  ["harp", "snail"],
  ["cello", "slug"],
  ["saxophone", "beetle"],
  ["accordion", "cricket"],
  ["banjo", "grasshopper"],
  ["tambourine", "dragonfly"],
  ["xylophone", "firefly"],
  ["cymbal", "moth"],
  ["harmonica", "butterfly"],
  ["megaphone", "swarm"],
  ["microphone", "flock"],
  ["speaker", "herd"],
  ["headphone", "antler"],
  ["antenna", "hoof"],
  ["satellite", "mane"],
  ["rocket", "tusk"],
  ["submarine", "fang"],
  ["blimp", "claw"],
  ["glider", "talon"],
  ["parachute", "fin"],
  ["snowmobile", "gill"],
  ["windmill", "beak"]
];

// Vocabulary bank: word + definition + a short speaking prompt to force real usage,
// not just a definition recite.
export const vocabWords = [{
  word: "Ephemeral",
  definition: "Lasting for a very short time.",
  prompt: "Talk about something ephemeral in your own life — use the word naturally at least twice.",
}, {
  word: "Ubiquitous",
  definition: "Present, appearing, or found everywhere.",
  prompt: "Describe something you think is ubiquitous in modern life, and whether that's a good thing.",
}, {
  word: "Pragmatic",
  definition: "Dealing with things sensibly and realistically.",
  prompt: "Describe a time you had to be pragmatic instead of idealistic.",
}, {
  word: "Ambivalent",
  definition: "Having mixed feelings or contradictory ideas about something.",
  prompt: "Talk about something you feel genuinely ambivalent about.",
}, {
  word: "Candid",
  definition: "Truthful and straightforward; frank.",
  prompt: "Give a candid opinion on a topic most people are diplomatic about.",
}, {
  word: "Meticulous",
  definition: "Showing great attention to detail; very careful and precise.",
  prompt: "Describe a task that requires being meticulous, and one that doesn't.",
}, {
  word: "Resilient",
  definition: "Able to recover quickly from difficulties.",
  prompt: "Talk about a time you or someone you know had to be resilient.",
}, {
  word: "Nuanced",
  definition: "Characterized by subtle shades of meaning or expression.",
  prompt: "Take a topic people usually oversimplify and give a nuanced take on it.",
}, {
  word: "Skeptical",
  definition: "Not easily convinced; having doubts or reservations.",
  prompt: "Talk about a claim or trend you're skeptical of, and why.",
}, {
  word: "Eloquent",
  definition: "Fluent and persuasive in speaking or writing.",
  prompt: "Describe someone you find eloquent and what makes their speaking effective.",
}, {
  word: "Arbitrary",
  definition: "Based on random choice rather than any reason or system.",
  prompt: "Talk about a rule or decision you think is arbitrary.",
}, {
  word: "Cognizant",
  definition: "Having knowledge or being aware of something.",
  prompt: "Talk about something you've become more cognizant of as you've gotten older.",
}, {
  word: "Tenacious",
  definition: "Persistent in maintaining or achieving something; determined.",
  prompt: "Describe a goal that required you to be tenacious.",
}, {
  word: "Superfluous",
  definition: "Unnecessary, especially through being more than enough.",
  prompt: "Talk about something in modern life you think is superfluous.",
}, {
  word: "Astute",
  definition: "Having an ability to accurately assess situations; shrewd.",
  prompt: "Describe an astute observation someone has made about you or your work.",
}, {
  word: "Serendipitous",
  definition: "Happening by a lucky chance, in a way that turns out well.",
  prompt: "Talk about a serendipitous moment in your life — use the word naturally at least twice.",
}, {
  word: "Innate",
  definition: "Existing in a person from birth, rather than learned.",
  prompt: "Talk about a trait or skill you consider innate in yourself or someone you know — use the word naturally at least twice.",
}, {
  word: "Ambiguous",
  definition: "Open to more than one interpretation; not clear or definite.",
  prompt: "Talk about a situation in your life that felt ambiguous — use the word naturally at least twice.",
}, {
  word: "Volatile",
  definition: "Likely to change suddenly and unpredictably.",
  prompt: "Talk about a time something in your life felt volatile — use the word naturally at least twice.",
}, {
  word: "Prudent",
  definition: "Acting with care and good judgment, especially about the future.",
  prompt: "Talk about a prudent decision you made — use the word naturally at least twice.",
}, {
  word: "Empathetic",
  definition: "Able to understand and share the feelings of another person.",
  prompt: "Talk about a time someone was empathetic toward you, or a time you tried to be — use the word naturally at least twice.",
}, {
  word: "Insidious",
  definition: "Spreading gradually and causing harm without being obvious at first.",
  prompt: "Talk about something insidious you noticed creeping into your life or routine — use the word naturally at least twice.",
}, {
  word: "Vivid",
  definition: "Producing a very clear, sharp, or intense impression in the mind.",
  prompt: "Talk about a vivid memory from your childhood — use the word naturally at least twice.",
}, {
  word: "Frivolous",
  definition: "Not serious or sensible; carelessly silly.",
  prompt: "Talk about something frivolous you enjoy that other people might not understand — use the word naturally at least twice.",
}, {
  word: "Diligent",
  definition: "Showing careful and steady effort in your work.",
  prompt: "Talk about a time being diligent paid off for you — use the word naturally at least twice.",
}, {
  word: "Elusive",
  definition: "Difficult to find, catch, or achieve.",
  prompt: "Talk about something elusive you've been chasing in your life — use the word naturally at least twice.",
}, {
  word: "Whimsical",
  definition: "Playfully unusual or fanciful in a lighthearted way.",
  prompt: "Talk about a whimsical idea or habit of yours — use the word naturally at least twice.",
}, {
  word: "Pervasive",
  definition: "Spreading widely throughout a place or group of people.",
  prompt: "Talk about something pervasive in the culture you grew up in — use the word naturally at least twice.",
}, {
  word: "Discerning",
  definition: "Having or showing good judgment, especially about quality.",
  prompt: "Talk about an area of life where you consider yourself discerning — use the word naturally at least twice.",
}, {
  word: "Impartial",
  definition: "Treating all sides or people equally, without favoring one.",
  prompt: "Talk about a time you had to stay impartial in a disagreement — use the word naturally at least twice.",
}, {
  word: "Lucid",
  definition: "Clear and easy to understand; thinking with mental clarity.",
  prompt: "Talk about a moment when your thinking felt especially lucid — use the word naturally at least twice.",
}, {
  word: "Audacious",
  definition: "Willing to take bold risks, sometimes to a surprising degree.",
  prompt: "Talk about an audacious goal you have or once had — use the word naturally at least twice.",
}, {
  word: "Plausible",
  definition: "Seeming reasonable or probable, even if not proven.",
  prompt: "Talk about a plausible explanation you once gave for something that went wrong — use the word naturally at least twice.",
}, {
  word: "Altruistic",
  definition: "Showing a selfless concern for the wellbeing of others.",
  prompt: "Talk about the most altruistic thing you've seen someone do — use the word naturally at least twice.",
}, {
  word: "Complacent",
  definition: "Feeling so satisfied that you stop trying to improve.",
  prompt: "Talk about a time you caught yourself becoming complacent — use the word naturally at least twice.",
}, {
  word: "Enigmatic",
  definition: "Mysterious and difficult to fully understand or explain.",
  prompt: "Talk about someone in your life who is enigmatic — use the word naturally at least twice."
}, {
  word: "Vindictive",
  definition: "Having or showing a strong desire for revenge.",
  prompt: "Talk about a time you had to resist being vindictive — use the word naturally at least twice."
}, {
  word: "Precarious",
  definition: "Not securely held or in a dangerously uncertain position.",
  prompt: "Talk about a time your plans felt precarious — use the word naturally at least twice."
}, {
  word: "Gregarious",
  definition: "Fond of company; sociable.",
  prompt: "Talk about the most gregarious person you know — use the word naturally at least twice."
}, {
  word: "Taciturn",
  definition: "Reserved or reluctant to speak much.",
  prompt: "Talk about a taciturn person in your life and what it's like to talk with them — use the word naturally at least twice."
}, {
  word: "Austere",
  definition: "Plain, simple, and without luxury or decoration.",
  prompt: "Talk about a time you chose an austere approach over an indulgent one — use the word naturally at least twice."
}, {
  word: "Benevolent",
  definition: "Kind, generous, and caring about others' wellbeing.",
  prompt: "Talk about the most benevolent act you've witnessed — use the word naturally at least twice."
}, {
  word: "Malicious",
  definition: "Intended to cause harm or upset someone.",
  prompt: "Talk about a time you dealt with a malicious comment or rumor — use the word naturally at least twice."
}, {
  word: "Cathartic",
  definition: "Providing relief from strong or repressed emotions.",
  prompt: "Talk about something you find cathartic — use the word naturally at least twice."
}, {
  word: "Conscientious",
  definition: "Careful to do what is right and fulfill your duties thoroughly.",
  prompt: "Talk about an area of life where you're especially conscientious — use the word naturally at least twice."
}, {
  word: "Impetuous",
  definition: "Acting quickly without thinking things through.",
  prompt: "Talk about a time you made an impetuous decision — use the word naturally at least twice."
}, {
  word: "Nostalgic",
  definition: "Feeling a sentimental longing for the past.",
  prompt: "Talk about what makes you feel nostalgic — use the word naturally at least twice."
}, {
  word: "Pensive",
  definition: "Deeply thoughtful, often with a hint of sadness.",
  prompt: "Talk about what puts you in a pensive mood — use the word naturally at least twice."
}, {
  word: "Melancholic",
  definition: "Having a persistent, thoughtful sadness.",
  prompt: "Talk about a piece of music or art that feels melancholic to you — use the word naturally at least twice."
}, {
  word: "Exuberant",
  definition: "Full of energy, excitement, and enthusiasm.",
  prompt: "Talk about the most exuberant celebration you've been part of — use the word naturally at least twice."
}, {
  word: "Indifferent",
  definition: "Having no particular interest or concern either way.",
  prompt: "Talk about something most people care about that you feel indifferent toward — use the word naturally at least twice."
}, {
  word: "Resourceful",
  definition: "Able to find quick, clever ways to overcome difficulties.",
  prompt: "Talk about a time you had to be resourceful — use the word naturally at least twice."
}, {
  word: "Tenuous",
  definition: "Weak, flimsy, or barely holding together.",
  prompt: "Talk about a plan or connection in your life that felt tenuous — use the word naturally at least twice."
}, {
  word: "Formidable",
  definition: "Inspiring fear or respect through being impressively powerful or capable.",
  prompt: "Talk about the most formidable challenge you've faced — use the word naturally at least twice."
}, {
  word: "Inevitable",
  definition: "Certain to happen; unavoidable.",
  prompt: "Talk about a change in your life that felt inevitable — use the word naturally at least twice."
}, {
  word: "Fickle",
  definition: "Changing frequently, especially in loyalties or opinions.",
  prompt: "Talk about something in your life that feels fickle — use the word naturally at least twice."
}, {
  word: "Obstinate",
  definition: "Stubbornly refusing to change an opinion or approach.",
  prompt: "Talk about a time you or someone you know was obstinate about something small — use the word naturally at least twice."
}, {
  word: "Adaptable",
  definition: "Able to adjust easily to new conditions.",
  prompt: "Talk about a time you had to be adaptable on short notice — use the word naturally at least twice."
}, {
  word: "Coherent",
  definition: "Logical and consistent; easy to follow.",
  prompt: "Talk about a time you had to make a coherent case for something under pressure — use the word naturally at least twice."
}, {
  word: "Redundant",
  definition: "No longer needed; unnecessary because it's already covered elsewhere.",
  prompt: "Talk about something in your routine that's become redundant — use the word naturally at least twice."
}, {
  word: "Sporadic",
  definition: "Occurring at irregular intervals; not constant.",
  prompt: "Talk about a habit of yours that's sporadic rather than consistent — use the word naturally at least twice."
}, {
  word: "Vicarious",
  definition: "Experienced through the feelings or actions of another person.",
  prompt: "Talk about a vicarious thrill you've gotten from someone else's experience — use the word naturally at least twice."
}, {
  word: "Zealous",
  definition: "Showing great energy and enthusiasm for a cause or goal.",
  prompt: "Talk about something you're zealous about — use the word naturally at least twice."
}, {
  word: "Vigilant",
  definition: "Keeping careful watch for possible danger or difficulty.",
  prompt: "Talk about an area of your life where you have to stay vigilant — use the word naturally at least twice."
}, {
  word: "Stoic",
  definition: "Enduring hardship without showing feelings or complaint.",
  prompt: "Talk about a time you tried to stay stoic through something difficult — use the word naturally at least twice."
}, {
  word: "Belligerent",
  definition: "Hostile and aggressive; ready to fight or argue.",
  prompt: "Talk about how you handle a belligerent person in a disagreement — use the word naturally at least twice."
}, {
  word: "Cordial",
  definition: "Warm and friendly, though often somewhat formal.",
  prompt: "Talk about a relationship in your life that's cordial rather than close — use the word naturally at least twice."
}, {
  word: "Docile",
  definition: "Easy to manage or teach; submissive.",
  prompt: "Talk about a time being docile helped or hurt you — use the word naturally at least twice."
}, {
  word: "Erratic",
  definition: "Not consistent or predictable in behavior.",
  prompt: "Talk about something in your life that behaves erratically — use the word naturally at least twice."
}, {
  word: "Flamboyant",
  definition: "Strikingly bold, colorful, or attention-grabbing in style.",
  prompt: "Talk about the most flamboyant person or outfit you've ever seen — use the word naturally at least twice."
}, {
  word: "Frugal",
  definition: "Careful and economical with money or resources.",
  prompt: "Talk about an area of your life where you're deliberately frugal — use the word naturally at least twice."
}, {
  word: "Gullible",
  definition: "Easily persuaded to believe something untrue.",
  prompt: "Talk about a time you were gullible about something — use the word naturally at least twice."
}, {
  word: "Hypothetical",
  definition: "Based on a suggested idea rather than something that has actually happened.",
  prompt: "Talk through a hypothetical situation you like to imagine — use the word naturally at least twice."
}, {
  word: "Judicious",
  definition: "Showing good sense and careful judgment.",
  prompt: "Talk about a time being judicious paid off for you — use the word naturally at least twice."
}, {
  word: "Lethargic",
  definition: "Lacking energy or enthusiasm; sluggish.",
  prompt: "Talk about what makes you feel lethargic — use the word naturally at least twice."
}, {
  word: "Meager",
  definition: "Small in amount and lacking in quality.",
  prompt: "Talk about a time you made do with meager resources — use the word naturally at least twice."
}, {
  word: "Notorious",
  definition: "Famous or well known for something considered bad.",
  prompt: "Talk about something you're notorious for among your friends or family — use the word naturally at least twice."
}, {
  word: "Obsolete",
  definition: "No longer used or needed because something newer exists.",
  prompt: "Talk about something in your life that's become obsolete — use the word naturally at least twice."
}, {
  word: "Perpetual",
  definition: "Never ending or changing; continuous.",
  prompt: "Talk about something that feels like a perpetual task in your life — use the word naturally at least twice."
}, {
  word: "Quaint",
  definition: "Attractively unusual or old-fashioned.",
  prompt: "Talk about the most quaint place you've visited — use the word naturally at least twice."
}, {
  word: "Reclusive",
  definition: "Avoiding the company of other people; solitary.",
  prompt: "Talk about a time you felt reclusive rather than social — use the word naturally at least twice."
}, {
  word: "Sardonic",
  definition: "Mocking or cynical in a dry, humorous way.",
  prompt: "Talk about someone in your life with a sardonic sense of humor — use the word naturally at least twice."
}, {
  word: "Tedious",
  definition: "Long, slow, and dull; tiresome.",
  prompt: "Talk about the most tedious task you regularly have to do — use the word naturally at least twice."
}, {
  word: "Unassuming",
  definition: "Not pretentious or arrogant; modest.",
  prompt: "Talk about someone impressive you know who is unassuming about it — use the word naturally at least twice."
}, {
  word: "Yielding",
  definition: "Willing to give way or comply under pressure.",
  prompt: "Talk about a time being yielding was the right call, or the wrong one — use the word naturally at least twice."
}, {
  word: "Ambitious",
  definition: "Having a strong desire to achieve success or a particular goal.",
  prompt: "Talk about the most ambitious goal you've set for yourself — use the word naturally at least twice."
}, {
  word: "Boisterous",
  definition: "Noisy, energetic, and full of high spirits.",
  prompt: "Talk about the most boisterous gathering you've been part of — use the word naturally at least twice."
}, {
  word: "Chronic",
  definition: "Persisting for a long time or constantly recurring.",
  prompt: "Talk about a chronic habit you're trying to change — use the word naturally at least twice."
}, {
  word: "Eccentric",
  definition: "Unconventional and slightly strange in behavior.",
  prompt: "Talk about the most eccentric person you know — use the word naturally at least twice."
}, {
  word: "Fastidious",
  definition: "Very attentive to detail and hard to please.",
  prompt: "Talk about something you're fastidious about — use the word naturally at least twice."
}, {
  word: "Garrulous",
  definition: "Excessively talkative, especially about trivial things.",
  prompt: "Talk about the most garrulous person you know — use the word naturally at least twice."
}, {
  word: "Haughty",
  definition: "Arrogantly superior or disdainful toward others.",
  prompt: "Talk about a time you encountered someone haughty — use the word naturally at least twice."
}, {
  word: "Impeccable",
  definition: "Flawless; without any faults or errors.",
  prompt: "Talk about someone whose taste or work you find impeccable — use the word naturally at least twice."
}, {
  word: "Jaded",
  definition: "Tired, bored, or cynical from having too much of something.",
  prompt: "Talk about something you've become a little jaded about — use the word naturally at least twice."
}, {
  word: "Keen",
  definition: "Having a strong interest, enthusiasm, or sharpness of perception.",
  prompt: "Talk about something you're keen on right now — use the word naturally at least twice."
}, {
  word: "Lavish",
  definition: "Extravagant and generous in amount or style.",
  prompt: "Talk about the most lavish gift you've given or received — use the word naturally at least twice."
}, {
  word: "Mundane",
  definition: "Ordinary, everyday, and lacking excitement.",
  prompt: "Talk about a mundane part of your day that you secretly enjoy — use the word naturally at least twice."
}, {
  word: "Nonchalant",
  definition: "Calmly casual, showing no worry or excitement.",
  prompt: "Talk about a time you tried to seem nonchalant even though you weren't — use the word naturally at least twice."
}, {
  word: "Obscure",
  definition: "Not well known or hard to understand.",
  prompt: "Talk about an obscure fact or interest of yours — use the word naturally at least twice."
}, {
  word: "Placid",
  definition: "Calm and peaceful, without disturbance.",
  prompt: "Talk about the most placid place you've ever been — use the word naturally at least twice."
}, {
  word: "Rigorous",
  definition: "Extremely thorough, exacting, and demanding.",
  prompt: "Talk about the most rigorous routine or process you've stuck to — use the word naturally at least twice."
}, {
  word: "Scrupulous",
  definition: "Very careful to do what is morally right and precise.",
  prompt: "Talk about an area where you're scrupulous about doing things correctly — use the word naturally at least twice."
}, {
  word: "Turbulent",
  definition: "Marked by conflict, disorder, or instability.",
  prompt: "Talk about the most turbulent period of your life so far — use the word naturally at least twice."
}, {
  word: "Unwavering",
  definition: "Steady and not weakening or changing.",
  prompt: "Talk about something you feel unwavering support for — use the word naturally at least twice."
}, {
  word: "Wistful",
  definition: "Having a vague sense of longing tinged with sadness.",
  prompt: "Talk about something that makes you feel wistful — use the word naturally at least twice."
}, {
  word: "Amicable",
  definition: "Friendly and without serious disagreement.",
  prompt: "Talk about a disagreement you managed to keep amicable — use the word naturally at least twice."
}, {
  word: "Brazen",
  definition: "Bold and without shame.",
  prompt: "Talk about the most brazen thing you've ever done — use the word naturally at least twice."
}, {
  word: "Contentious",
  definition: "Likely to cause disagreement or argument.",
  prompt: "Talk about a contentious topic in your friend group or family — use the word naturally at least twice."
}, {
  word: "Deft",
  definition: "Skillful and quick in a physical or mental way.",
  prompt: "Talk about a time you or someone else handled a situation with a deft touch — use the word naturally at least twice."
}, {
  word: "Exemplary",
  definition: "So excellent it serves as a model for others.",
  prompt: "Talk about someone whose behavior you consider exemplary — use the word naturally at least twice."
}, {
  word: "Fervent",
  definition: "Showing intense and passionate feeling.",
  prompt: "Talk about something you feel fervent about — use the word naturally at least twice."
}, {
  word: "Gracious",
  definition: "Courteous, kind, and warm in manner.",
  prompt: "Talk about the most gracious host or guest you've encountered — use the word naturally at least twice."
}, {
  word: "Incisive",
  definition: "Sharp, direct, and clear in expression or thought.",
  prompt: "Talk about someone whose feedback or comments you'd call incisive — use the word naturally at least twice."
}, {
  word: "Jovial",
  definition: "Cheerful and full of good humor.",
  prompt: "Talk about the most jovial person you know — use the word naturally at least twice."
}, {
  word: "Lucrative",
  definition: "Producing a lot of profit.",
  prompt: "Talk about the most lucrative idea you've ever had, even if you didn't act on it — use the word naturally at least twice."
}, {
  word: "Opulent",
  definition: "Lavishly rich, luxurious, or wealthy in appearance.",
  prompt: "Talk about the most opulent place you've ever seen — use the word naturally at least twice."
}, {
  word: "Prolific",
  definition: "Producing a large quantity of work or output.",
  prompt: "Talk about the most prolific period of your life so far — use the word naturally at least twice."
}, {
  word: "Quixotic",
  definition: "Pursuing unrealistic goals with idealistic enthusiasm.",
  prompt: "Talk about a quixotic idea you've had or admired in someone else — use the word naturally at least twice."
}, {
  word: "Rampant",
  definition: "Spreading or growing uncontrollably.",
  prompt: "Talk about something that feels rampant in your industry or community — use the word naturally at least twice."
}, {
  word: "Solemn",
  definition: "Formal, serious, and dignified.",
  prompt: "Talk about the most solemn occasion you've attended — use the word naturally at least twice."
}, {
  word: "Tumultuous",
  definition: "Loud, chaotic, and full of upheaval.",
  prompt: "Talk about the most tumultuous year of your life — use the word naturally at least twice."
}, {
  word: "Unorthodox",
  definition: "Not following usual or traditional methods.",
  prompt: "Talk about the most unorthodox approach you've ever taken to solve a problem — use the word naturally at least twice."
}, {
  word: "Vibrant",
  definition: "Full of energy, life, and bright color.",
  prompt: "Talk about the most vibrant place you've ever visited — use the word naturally at least twice."
}];

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
    // +120s (2 min) over the standard 60s think time — this exercise is the
    // one place looking something up mid-prep actually makes sense (getting
    // the underlying fact right before simplifying it), so it gets extra
    // room to research/read before the speak timer starts.
    prepSeconds: 180,
    speakSeconds: 90,
    color: "#4CD9B0",
  },
  {
    id: "snap_opinion",
    title: "Snap Opinion",
    tagline: "Pick a side. Make your case.",
    prepSeconds: 60,
    speakSeconds: 120,
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
    prepSeconds: 45,
    speakSeconds: 75,
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
// getPromptFor entries use ({ prompt, word?, definition?, pair? }).
//
// This used to be THE content source the Roulette screen spun across
// directly. It no longer is: storage.js's getFreshContentBank now reads
// from the content_bank Supabase table first (shared, growing over time via
// the generate-content Edge Function — see supabase/schema.sql) and only
// falls back to this function if that table is empty or unreachable. These
// arrays are the SEED that table was populated from, and the offline
// fallback, not the primary source anymore — kept here (rather than deleted
// once seeded) because a static, dependency-free fallback is exactly what
// you want when the thing it's a fallback FOR fails.
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
