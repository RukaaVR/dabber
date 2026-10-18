// Curated emoji set for the picker. Format per category: "emoji name keywords|emoji name|…"
const RAW: [string, string, string][] = [
  [
    "people",
    "😀",
    "😀 grinning|😃 smiley|😄 smile|😁 grin|😆 laughing|😅 sweat smile|🤣 rofl|😂 joy laugh|🙂 slight smile|🙃 upside down|😉 wink|😊 blush|😇 innocent halo|🥰 love hearts|😍 heart eyes|🤩 star struck|😘 kiss|😋 yum|😛 tongue|😜 wink tongue|🤪 zany|😝 squint tongue|🤑 money|🤗 hug|🤭 oops|🤫 shh|🤔 thinking|🤐 zipper|🤨 raised eyebrow|😐 neutral|😑 expressionless|😶 no mouth|😏 smirk|😒 unamused|🙄 eye roll|😬 grimace|😮‍💨 exhale|🤥 lying|😌 relieved|😔 pensive|😪 sleepy|🤤 drool|😴 sleeping|😷 mask|🤒 sick|🤕 hurt|🤢 nauseated|🤮 vomit|🥵 hot|🥶 cold|🥴 woozy|😵 dizzy|🤯 mind blown|🤠 cowboy|🥳 party|😎 cool sunglasses|🤓 nerd|🧐 monocle|😕 confused|😟 worried|🙁 frown|😮 open mouth|😯 hushed|😲 astonished|😳 flushed|🥺 pleading|😦 frowning|😧 anguished|😨 fearful|😰 anxious|😥 sad relieved|😢 cry|😭 sob|😱 scream|😖 confounded|😣 persevere|😞 disappointed|😓 sweat|😩 weary|😫 tired|🥱 yawn|😤 triumph|😡 rage|😠 angry|🤬 cursing|😈 devil|💀 skull dead|💩 poop|🤡 clown|👻 ghost|👽 alien|🤖 robot|😺 cat smile|😹 cat joy|😻 cat heart|🙈 see no evil|🙉 hear no evil|🙊 speak no evil|👋 wave|🤚 raised back|✋ hand|🖖 vulcan|👌 ok|🤌 pinched|✌️ peace|🤞 crossed fingers|🤟 love you|🤘 rock|🤙 call me|👈 left|👉 right|👆 up|👇 down|☝️ point up|👍 thumbs up yes|👎 thumbs down no|✊ fist|👊 punch|👏 clap|🙌 raised hands|👐 open hands|🤲 palms|🤝 handshake|🙏 pray thanks|💪 muscle strong|🧠 brain|👀 eyes look|👁️ eye|👅 tongue|👄 mouth|🫶 heart hands|🧑‍💻 coder|🕺 dance|💃 dancer",
  ],
  [
    "nature",
    "🐶",
    "🐶 dog|🐱 cat|🐭 mouse|🐹 hamster|🐰 bunny|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger|🦁 lion|🐮 cow|🐷 pig|🐸 frog|🐵 monkey|🐔 chicken|🐧 penguin|🐦 bird|🐤 chick|🦆 duck|🦉 owl|🐺 wolf|🐗 boar|🐴 horse|🦄 unicorn|🐝 bee|🐛 bug|🦋 butterfly|🐌 snail|🐞 ladybug|🐢 turtle|🐍 snake|🦖 dino trex|🐙 octopus|🦑 squid|🦀 crab|🐠 fish|🐬 dolphin|🐳 whale|🦈 shark|🐊 croc|🦒 giraffe|🦔 hedgehog|🌵 cactus|🎄 tree xmas|🌲 evergreen|🌳 tree|🌴 palm|🌱 seedling|🌿 herb|🍀 clover luck|🍁 maple|🍂 leaves|🍄 mushroom|🌷 tulip|🌹 rose|🌻 sunflower|🌼 blossom|🌸 cherry blossom|💐 bouquet|🌞 sun face|🌝 moon face|🌙 moon|⭐ star|🌟 glowing star|✨ sparkles|⚡ zap lightning|🔥 fire lit|💥 boom|☄️ comet|🌈 rainbow|☀️ sun|⛅ cloud sun|☁️ cloud|🌧️ rain|⛈️ storm|❄️ snow|☃️ snowman|🌊 wave ocean|💧 droplet",
  ],
  [
    "food",
    "🍕",
    "🍏 green apple|🍎 apple|🍐 pear|🍊 orange|🍋 lemon|🍌 banana|🍉 watermelon|🍇 grapes|🍓 strawberry|🫐 blueberries|🍒 cherries|🍑 peach|🥭 mango|🍍 pineapple|🥥 coconut|🥝 kiwi|🍅 tomato|🥑 avocado|🍆 eggplant|🥔 potato|🥕 carrot|🌽 corn|🌶️ pepper hot|🥦 broccoli|🍄‍🟫 brown mushroom|🥐 croissant|🍞 bread|🥨 pretzel|🧀 cheese|🥚 egg|🍳 cooking|🥞 pancakes|🧇 waffle|🥓 bacon|🍔 burger|🍟 fries|🍕 pizza|🌭 hotdog|🥪 sandwich|🌮 taco|🌯 burrito|🥗 salad|🍝 spaghetti|🍜 ramen|🍲 stew|🍣 sushi|🍱 bento|🥟 dumpling|🍤 shrimp|🍙 rice ball|🍚 rice|🍦 ice cream|🍩 donut|🍪 cookie|🎂 birthday cake|🍰 cake|🧁 cupcake|🍫 chocolate|🍬 candy|🍭 lollipop|🍿 popcorn|☕ coffee|🍵 tea|🧋 boba|🥤 soda|🍺 beer|🍻 cheers|🥂 champagne|🍷 wine|🧃 juice",
  ],
  [
    "activity",
    "🎮",
    "⚽ soccer|🏀 basketball|🏈 football|⚾ baseball|🎾 tennis|🏐 volleyball|🏉 rugby|🎱 8ball pool|🏓 ping pong|🏸 badminton|🥅 goal|⛳ golf|🏹 bow|🎣 fishing|🥊 boxing|🥋 martial arts|⛸️ skate|🎿 ski|🛹 skateboard|🏆 trophy win|🥇 gold first|🥈 silver|🥉 bronze|🏅 medal|🎖️ military medal|🎗️ ribbon|🎫 ticket|🎪 circus|🎭 theater|🎨 art palette|🎬 clapper movie|🎤 mic karaoke|🎧 headphones|🎼 score|🎹 piano|🥁 drum|🎷 sax|🎺 trumpet|🎸 guitar|🎻 violin|🎲 dice|♟️ chess|🎯 bullseye|🎳 bowling|🎮 video game controller|🕹️ joystick|🧩 puzzle|🎰 slots|🎉 tada party|🎊 confetti|🎈 balloon|🎁 gift present|🪅 pinata|🎆 fireworks",
  ],
  [
    "travel",
    "🚀",
    "🚗 car|🚕 taxi|🚌 bus|🏎️ race car|🚓 police|🚑 ambulance|🚒 fire engine|🚚 truck|🚲 bike|🛵 scooter|🏍️ motorcycle|✈️ plane|🛫 departure|🚀 rocket launch|🛸 ufo|🚁 helicopter|⛵ sailboat|🚤 speedboat|🚢 ship|⚓ anchor|🗺️ map|🧭 compass|🏔️ mountain|🌋 volcano|🏕️ camping|🏖️ beach|🏝️ island|🏠 house home|🏡 garden house|🏢 office|🏰 castle|🗼 tower|🗽 liberty|⛲ fountain|🎡 ferris wheel|🎢 coaster|🌃 night city|🌆 dusk city|🌅 sunrise|🌄 sunrise mountains|🌌 milky way|🌍 globe earth|🌐 world",
  ],
  [
    "objects",
    "💡",
    "⌚ watch|📱 phone|💻 laptop|⌨️ keyboard|🖥️ desktop|🖨️ printer|🖱️ mouse computer|💾 floppy save|💿 disc|📷 camera|📸 flash camera|🎥 movie camera|📺 tv|📻 radio|🔋 battery|🔌 plug|💡 bulb idea|🔦 flashlight|🕯️ candle|💸 money wings|💵 dollar|💰 money bag|💳 card|💎 gem|🔧 wrench|🔨 hammer|🛠️ tools|⚙️ gear|🧲 magnet|🔫 water pistol|💣 bomb|🔪 knife|🛡️ shield|🔮 crystal ball|🧪 test tube|🔬 microscope|🔭 telescope|💊 pill|🩹 bandage|🧸 teddy|🛏️ bed|🛋️ couch|🚪 door|🔑 key|🗝️ old key|🔒 lock|🔓 unlock|📌 pin|📎 paperclip|✂️ scissors|📝 memo note|✏️ pencil|🖊️ pen|📚 books|📖 book|📅 calendar|📈 chart up|📉 chart down|📊 bar chart|📦 package|📫 mailbox|✉️ envelope|📣 megaphone|📢 loudspeaker|🔔 bell|🔕 no bell|⏰ alarm|⏳ hourglass",
  ],
  [
    "symbols",
    "❤️",
    "❤️ red heart love|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🖤 black heart|🤍 white heart|🤎 brown heart|💔 broken heart|❣️ heart exclamation|💕 two hearts|💞 revolving hearts|💓 beating heart|💗 growing heart|💖 sparkling heart|💘 cupid|💝 heart gift|💯 100 hundred|✅ check yes done|☑️ ballot check|✔️ checkmark|❌ x no|❎ cross mark|➕ plus|➖ minus|❗ exclamation|❓ question|‼️ double exclamation|⁉️ interrobang|⚠️ warning|🚫 no entry|⛔ stop|🔞 18|♻️ recycle|🔱 trident|⚜️ fleur|🔰 beginner|💤 zzz sleep|💢 anger|💬 speech|💭 thought|🗯️ right anger bubble|🆗 ok button|🆒 cool button|🆕 new|🆙 up|🆓 free|🔴 red circle|🟠 orange circle|🟡 yellow circle|🟢 green circle|🔵 blue circle|🟣 purple circle|⚫ black circle|⚪ white circle|🔺 red triangle|🔻 down triangle|♾️ infinity|🎵 music note|🎶 notes|➡️ arrow right|⬅️ arrow left|⬆️ arrow up|⬇️ arrow down|🔁 repeat|🔀 shuffle|▶️ play|⏸️ pause|⏹️ stop button|🏳️‍🌈 rainbow flag|🏁 checkered flag",
  ],
];

export interface EmojiEntry {
  e: string;
  n: string;
}

export const EMOJI_CATEGORIES = RAW.map(([key, icon, list]) => ({
  key,
  icon,
  label: { people: "Smileys & People", nature: "Nature", food: "Food & Drink", activity: "Activity", travel: "Travel & Places", objects: "Objects", symbols: "Symbols" }[key] ?? key,
  items: list.split("|").map((s): EmojiEntry => {
    const sp = s.indexOf(" ");
    return { e: s.slice(0, sp), n: s.slice(sp + 1) };
  }),
}));

export const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.items);

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "😮", "🎉"];

const RECENT_KEY = "dabber-recent-emoji";
export function recentEmoji(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 16);
  } catch {
    return [];
  }
}
export function pushRecentEmoji(e: string) {
  try {
    const list = [e, ...recentEmoji().filter((x) => x !== e)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
