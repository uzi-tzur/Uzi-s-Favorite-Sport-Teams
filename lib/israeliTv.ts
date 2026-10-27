// Israeli sports-channel listings (Sport 1-4 from Sport 1's guide, Sport 5
// channels from Sport 5's guide), matched against our calendar events.

export type IsraeliTvListing = {
  channel: string;
  startTime: Date;
  // "Competition: Home - Away, round" (Hebrew)
  text: string;
  live: boolean;
};

// A game built straight from the listings, for teams the other feeds do not cover
export type IsraeliTvGame = {
  matchup: string;
  competition: string;
  startTime: Date;
  channels: string;
};

export type IsraeliTvMatcher = {
  startTime: Date;
  sport: string;
  // Hebrew names to look for in the listing text (our team, or both teams of a league game)
  hebrewNames: string[];
};

const ISRAEL_TZ = "Asia/Jerusalem";
const REVALIDATE_SECONDS = 1800;

const SPORT1_DAY_URL = "https://sport1.maariv.co.il/wp-json/sport1/v1/broadcast/day";
const SPORT5_DAY_URL = "https://www.sport5.co.il/Ajax/GetBroadcastSheetData.aspx";

// data-channel-id values used on https://sport1.maariv.co.il/broadcast-schedule/
const SPORT1_CHANNELS: Record<string, string> = {
  "1": "ספורט 6",
  "2": "ספורט 1",
  "3": "ספורט 2",
  "4": "ספורט 3",
  "5": "ספורט 4",
};

// Sport 5's guide labels its main channel "ערוץ הספורט"
const SPORT5_CHANNEL_NAMES: Record<string, string> = {
  "ערוץ הספורט": "ספורט 5",
};

// Sport 5's app stream, not a TV channel
const SKIPPED_SPORT5_CHANNELS = ["ספורט מובייל"];

// A listing can start up to an hour before kickoff (pre-game studio)
const MATCH_WINDOW_BEFORE_MS = 60 * 60 * 1000;
const MATCH_WINDOW_AFTER_MS = 15 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISRAEL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function israelDateKey(date: Date): string {
  return dateFormatter.format(date);
}

function israelOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISRAEL_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

// "2026-11-02" + "19:40" in Israel time -> Date
function israelLocalToDate(dateKey: string, time: string): Date | undefined {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  if ([year, month, day, hours, minutes].some((n) => Number.isNaN(n))) return undefined;
  const guess = Date.UTC(year, month - 1, day, hours, minutes);
  return new Date(guess - israelOffsetMs(new Date(guess)));
}

// Unify Hebrew punctuation variants (״ ׳ ’ etc.) and whitespace so names compare reliably
export function normalizeHebrew(text: string): string {
  return text
    .replace(/[״“”]/g, '"')
    .replace(/[׳‘’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ");
}

async function fetchText(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`Failed to fetch Israeli TV listings: ${res.status} - ${url}`);
      return undefined;
    }
    return await res.text();
  } catch (error) {
    console.error(`Error fetching Israeli TV listings from ${url}:`, error);
    return undefined;
  }
}

async function fetchSport1Day(dateKey: string): Promise<IsraeliTvListing[]> {
  const body = await fetchText(`${SPORT1_DAY_URL}/${dateKey}/?live=1`);
  if (!body) return [];

  let html: string;
  try {
    const parsed: unknown = JSON.parse(body);
    html = typeof parsed === "string" ? parsed : "";
  } catch {
    return [];
  }

  const listings: IsraeliTvListing[] = [];
  for (const block of html.split('channel-container" id="channel-').slice(1)) {
    const channel = SPORT1_CHANNELS[block.match(/^(\d+)/)?.[1] ?? ""];
    if (!channel) continue;

    const shows = Array.from(block.matchAll(
      /show-starting-time">\s*([\d:]+)[\s\S]*?show-name">\s*([^<]*?)\s*<\/p>\s*<p class="show-description">([^<]*)/g
    ));
    for (const [, time, name, description] of shows) {
      const startTime = israelLocalToDate(dateKey, time);
      if (!startTime) continue;
      listings.push({
        channel,
        startTime,
        // Sport 1 puts the competition (with season) in the description
        text: normalizeHebrew(
          decodeEntities(`${description.replace(/\s*\d{4}\/\d{2}\s*$/, "")}: ${name}`)
        ),
        // The request asks for live broadcasts only
        live: true,
      });
    }
  }
  return listings;
}

async function fetchSport5Day(dateKey: string): Promise<IsraeliTvListing[]> {
  const html = await fetchText(`${SPORT5_DAY_URL}?Type=&Date=${dateKey}`);
  if (!html) return [];

  const listings: IsraeliTvListing[] = [];
  for (const block of html.split('class="tr-header"').slice(1)) {
    // Sport 5 channels have a logo header; other channels a text header
    const header = block.slice(0, block.indexOf("</tr>"));
    const rawChannel = decodeEntities(
      header.match(/alt="([^"]+)"/)?.[1] ?? header.match(/channel-text">([^<]+)/)?.[1] ?? ""
    ).trim();
    if (!rawChannel || SKIPPED_SPORT5_CHANNELS.includes(rawChannel)) continue;
    const channel = SPORT5_CHANNEL_NAMES[rawChannel] ?? rawChannel;

    const rows = Array.from(block.matchAll(
      /class="date">\s*<div>\s*([\d:]+)\s*<\/div>([\s\S]*?)class="text">([^<]*)/g
    ));
    for (const [, time, marker, text] of rows) {
      const startTime = israelLocalToDate(dateKey, time);
      if (!startTime) continue;
      listings.push({
        channel,
        startTime,
        text: normalizeHebrew(decodeEntities(text)),
        live: marker.includes("img-live"),
      });
    }
  }
  return listings;
}

export async function fetchIsraeliTvListings(dateKeys: string[]): Promise<IsraeliTvListing[]> {
  const days = await Promise.all(
    dateKeys.flatMap((dateKey) => [fetchSport1Day(dateKey), fetchSport5Day(dateKey)])
  );
  return days.flat();
}

const BASKETBALL_PATTERN = /כדורסל|יורוליג|יורוקאפ|ווינר סל|NBA/;
const SOCCER_PATTERN = /כדורגל|ליגת ווינר|ליגת העל|גביע הטוטו|גביע המדינה|ליגת האלופות|הליגה האירופית|קונפרנס/;
const OTHER_SPORTS_PATTERN = /כדוריד|כדורעף|טניס|פוטסל/;
// Studio shows and youth / women's games of the same club
const NOT_OUR_GAME_PATTERN = /אולפן|תקציר|סיכום|לקראת|נוער|נערים|נשים/;

// Keeps a soccer game from matching a basketball listing of the same club and vice versa
function fitsSport(text: string, sport: string): boolean {
  if (OTHER_SPORTS_PATTERN.test(text)) return false;
  const isBasketball = BASKETBALL_PATTERN.test(text);
  if (sport === "Basketball") return isBasketball || !/כדורגל/.test(text);
  if (sport === "Soccer") return !isBasketball;
  return true;
}

// Stricter than fitsSport: with no other feed to confirm the game, the
// listing itself has to say which sport it is
function isSport(text: string, sport: string): boolean {
  if (OTHER_SPORTS_PATTERN.test(text)) return false;
  const isBasketball = BASKETBALL_PATTERN.test(text);
  if (sport === "Basketball") return isBasketball;
  if (sport === "Soccer") return !isBasketball && SOCCER_PATTERN.test(text);
  return false;
}

// Live broadcasts of a team's games, merged across channels
export function findIsraeliTvGames(
  hebrewNames: string[],
  sport: string,
  listings: IsraeliTvListing[]
): IsraeliTvGame[] {
  const names = hebrewNames.map(normalizeHebrew);
  const games: IsraeliTvGame[] = [];

  listings
    .filter(
      (listing) =>
        listing.live &&
        listing.startTime.getTime() >= Date.now() - 2 * 60 * 60 * 1000 &&
        !NOT_OUR_GAME_PATTERN.test(listing.text) &&
        names.some((name) => listing.text.includes(name)) &&
        isSport(listing.text, sport)
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    .forEach((listing) => {
      const separator = listing.text.indexOf(":");
      const competition = separator > 0 ? listing.text.slice(0, separator).trim() : "";
      const matchup = (separator > 0 ? listing.text.slice(separator + 1) : listing.text)
        .split(",")[0]
        .trim();
      // The two guides write the opponent differently, so the same game is
      // recognized by our team + start time
      const existing = games.find(
        (game) =>
          Math.abs(game.startTime.getTime() - listing.startTime.getTime()) <= 30 * 60 * 1000
      );
      if (existing) {
        if (!existing.channels.split(" / ").includes(listing.channel)) {
          existing.channels += ` / ${listing.channel}`;
        }
        return;
      }
      games.push({ matchup, competition, startTime: listing.startTime, channels: listing.channel });
    });

  return games;
}

export function findIsraeliChannels(
  matcher: IsraeliTvMatcher,
  listings: IsraeliTvListing[]
): string | undefined {
  const kickoff = matcher.startTime.getTime();
  const candidates = listings.filter((listing) => {
    const start = listing.startTime.getTime();
    return (
      start >= kickoff - MATCH_WINDOW_BEFORE_MS &&
      start <= kickoff + MATCH_WINDOW_AFTER_MS &&
      fitsSport(listing.text, matcher.sport)
    );
  });

  const names = matcher.hebrewNames.map(normalizeHebrew);
  // Only a listing that names one of the clubs counts: guessing by
  // competition and time slot can attach another game's channel
  const matches = candidates.filter((listing) =>
    names.some((name) => listing.text.includes(name))
  );

  if (!matches.length) return undefined;
  return Array.from(new Set(matches.map((listing) => listing.channel))).join(" / ");
}

// Hebrew names of clubs that show up in the league feeds, keyed by ESPN display name
export const HEBREW_CLUB_NAMES: Record<string, string[]> = {
  // Premier League
  Arsenal: ["ארסנל"],
  "Aston Villa": ["אסטון וילה"],
  Bournemouth: ["בורנמות'"],
  "AFC Bournemouth": ["בורנמות'"],
  Brentford: ["ברנטפורד"],
  "Brighton & Hove Albion": ["ברייטון"],
  "Coventry City": ["קובנטרי"],
  Burnley: ["ברנלי"],
  Chelsea: ["צ'לסי"],
  "Crystal Palace": ["קריסטל פאלאס"],
  Everton: ["אברטון"],
  Fulham: ["פולהאם"],
  "Hull City": ["האל סיטי"],
  "Ipswich Town": ["איפסוויץ'"],
  "Leeds United": ["לידס"],
  Liverpool: ["ליברפול"],
  "Manchester City": ["מנצ'סטר סיטי", "מן סיטי"],
  "Manchester United": ["מנצ'סטר יונייטד", "מן יונייטד"],
  "Newcastle United": ["ניוקאסל"],
  "Nottingham Forest": ["נוטינגהאם"],
  Southampton: ["סאות'המפטון", "סאותהמפטון", "סאוטהמפטון"],
  Sunderland: ["סנדרלנד"],
  "Tottenham Hotspur": ["טוטנהאם"],
  "West Ham United": ["ווסטהאם", "וסטהאם", "ווסט האם", "וסט האם"],
  "Wolverhampton Wanderers": ["וולבס", "וולברהמפטון"],
  // La Liga
  Alavés: ["אלאבס"],
  "Athletic Club": ["אתלטיק בילבאו", "בילבאו"],
  "Atlético Madrid": ["אתלטיקו מדריד"],
  Barcelona: ["ברצלונה"],
  "Celta Vigo": ["סלטה ויגו", "סלטה"],
  Elche: ["אלצ'ה"],
  Espanyol: ["אספניול"],
  Getafe: ["חטאפה"],
  Girona: ["חירונה"],
  Levante: ["לבאנטה"],
  Mallorca: ["מיורקה"],
  Osasuna: ["אוססונה"],
  "Rayo Vallecano": ["ראיו ואייקאנו", "ראיו"],
  "Real Betis": ["בטיס"],
  "Real Madrid": ["ריאל מדריד"],
  "Real Oviedo": ["אוביידו"],
  "Real Sociedad": ["ריאל סוסיאדד", "סוסיאדד"],
  Sevilla: ["סביליה"],
  Valencia: ["ולנסיה"],
  Villarreal: ["ויאריאל"],
  // Champions League regulars
  Ajax: ["אייאקס"],
  Atalanta: ["אטאלנטה"],
  "Bayer Leverkusen": ["לברקוזן"],
  "Bayern Munich": ["באיירן"],
  Benfica: ["בנפיקה"],
  "Borussia Dortmund": ["דורטמונד"],
  "Club Brugge": ["ברוז'"],
  "Eintracht Frankfurt": ["פרנקפורט"],
  Galatasaray: ["גלאטסראיי"],
  "Internazionale": ["אינטר"],
  Juventus: ["יובנטוס"],
  "AC Milan": ["מילאן"],
  Marseille: ["מרסיי"],
  Monaco: ["מונאקו"],
  Napoli: ["נאפולי"],
  Olympiacos: ["אולימפיאקוס"],
  "Paris Saint-Germain": ["פ.ס.ז'", "פריז סן ז'רמן", "פ.ס.ז"],
  "PSV Eindhoven": ["פ.ס.וו", "איינדהובן"],
  Porto: ["פורטו"],
  "Sporting CP": ["ספורטינג ליסבון", "ספורטינג"],
};
