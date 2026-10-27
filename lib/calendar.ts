import {
  HEBREW_CLUB_NAMES,
  fetchIsraeliTvListings,
  findIsraeliChannels,
  findIsraeliTvGames,
  israelDateKey,
  type IsraeliTvListing,
  type IsraeliTvMatcher,
} from "./israeliTv";

type ESPNTeamConfig = {
  type: "espn";
  sportPath: string;
  teamIdentifier: string;
  displayName: string;
  abbreviation?: string;
};

type ESPNLeagueConfig = {
  type: "espn-league";
  sportPath: string;
  leaguePath: string;
  // Keep only games involving these clubs (ESPN display names); all games if omitted
  onlyTeams?: string[];
  displayName: string;
};

type SportsDBTeamConfig = {
  type: "thesportsdb";
  teamId?: string; // Optional - required for team-based fetching, not needed for league-only fetching
  displayName: string;
  leagueId?: string; // Optional league ID for league-based fetching
};

// Games come straight from the Israeli TV guides (Sport 1-5): used for
// Israeli teams, whose fixtures the other feeds do not carry reliably
type IsraeliTvConfig = {
  type: "israeli-tv";
};

type TeamScheduleConfig = {
  teamName: string;
  sport: string;
  competition: string;
  scheduleUrl: string;
  source: ESPNTeamConfig | ESPNLeagueConfig | SportsDBTeamConfig | IsraeliTvConfig;
  // How Israeli TV guides (Sport 1-5) write this team / competition
  hebrewNames?: string[];
  hebrewCompetition?: string[];
};

export type CalendarEvent = {
  teamName: string;
  sport: string;
  competition: string;
  matchup: string;
  location?: string;
  network?: string;
  israeliTv?: string;
  startTime: Date;
  scheduleUrl: string;
};

const teamConfigs: TeamScheduleConfig[] = [
  {
    teamName: "Dallas Mavericks",
    hebrewNames: ["דאלאס"],
    sport: "Basketball",
    competition: "NBA",
    scheduleUrl:
      "https://www.espn.com/nba/team/schedule/_/name/dal/dallas-mavericks",
    source: {
      type: "espn",
      sportPath: "basketball/nba",
      teamIdentifier: "dal",
      displayName: "Dallas Mavericks",
      abbreviation: "DAL",
    },
  },
  {
    teamName: "Brooklyn Nets",
    hebrewNames: ["ברוקלין"],
    sport: "Basketball",
    competition: "NBA",
    scheduleUrl: "https://www.espn.com/nba/team/schedule/_/name/bkn",
    source: {
      type: "espn",
      sportPath: "basketball/nba",
      teamIdentifier: "bkn",
      displayName: "Brooklyn Nets",
      abbreviation: "BKN",
    },
  },
  {
    teamName: "Portland Trail Blazers",
    hebrewNames: ["פורטלנד"],
    sport: "Basketball",
    competition: "NBA",
    scheduleUrl:
      "https://www.espn.com/nba/team/schedule/_/name/por/portland-trail-blazers",
    source: {
      type: "espn",
      sportPath: "basketball/nba",
      teamIdentifier: "por",
      displayName: "Portland Trail Blazers",
      abbreviation: "POR",
    },
  },
  {
    teamName: "Dallas Cowboys",
    hebrewNames: ["דאלאס"],
    sport: "Football",
    competition: "NFL",
    scheduleUrl:
      "https://www.espn.com/nfl/team/schedule/_/name/dal/dallas-cowboys",
    source: {
      type: "espn",
      sportPath: "football/nfl",
      teamIdentifier: "dal",
      displayName: "Dallas Cowboys",
      abbreviation: "DAL",
    },
  },
  {
    teamName: "Texas Longhorns",
    hebrewNames: ["טקסס"],
    sport: "Football",
    competition: "NCAA",
    scheduleUrl:
      "https://www.espn.com/college-football/team/schedule/_/id/251",
    source: {
      type: "espn",
      sportPath: "football/college-football",
      teamIdentifier: "251",
      displayName: "Texas Longhorns",
      abbreviation: "TEX",
    },
  },
  {
    teamName: "FC Barcelona",
    hebrewNames: ["ברצלונה"],
    sport: "Soccer",
    competition: "La Liga",
    scheduleUrl:
      "https://www.espn.com/soccer/team/fixtures/_/id/83/league/ESP.1",
    source: {
      type: "espn",
      sportPath: "soccer/esp.1",
      teamIdentifier: "83",
      displayName: "Barcelona",
      abbreviation: "BAR",
    },
  },
  {
    teamName: "FC Infer Miami",
    hebrewNames: ["אינטר מיאמי"],
    sport: "Soccer",
    competition: "MLS",
    scheduleUrl:
      "https://www.espn.com/soccer/team/_/id/20232/inter-miami-cf",
    source: {
      type: "espn",
      sportPath: "soccer/usa.1",
      teamIdentifier: "20232",
      displayName: "Inter Miami CF",
      abbreviation: "MIA",
    },
  },
  {
    teamName: "B.C. Maccabi Tel Aviv",
    hebrewNames: ['מכבי ת"א', "מכבי תל אביב"],
    sport: "Basketball",
    competition: "EuroLeague",
    scheduleUrl:
      "https://www.365scores.com/en-us/basketball/team/maccabi-tel-aviv-631/matches#fixtures",
    source: { type: "israeli-tv" },
  },
  {
    teamName: "F.C. Maccabi Tel Aviv",
    hebrewNames: ['מכבי ת"א', "מכבי תל אביב"],
    sport: "Soccer",
    competition: "Israeli Premier League",
    scheduleUrl: "https://www.espn.com/soccer/team/fixtures/_/id/524/maccabi-tel-aviv",
    source: { type: "israeli-tv" },
  },
  {
    teamName: "Premier League England",
    hebrewCompetition: ["ליגה אנגלית", "הליגה האנגלית", "פרמייר ליג"],
    sport: "Soccer",
    competition: "Premier League",
    scheduleUrl: "https://www.espn.com/soccer/fixtures?league=eng.1",
    source: {
      type: "espn-league",
      sportPath: "soccer",
      leaguePath: "eng.1",
      displayName: "Premier League",
    },
  },
  {
    teamName: "Spanish La Liga",
    hebrewCompetition: ["ליגה ספרדית", "הליגה הספרדית"],
    sport: "Soccer",
    competition: "La Liga",
    scheduleUrl: "https://www.espn.com/soccer/schedule/_/league/esp.1",
    source: {
      type: "espn-league",
      sportPath: "soccer",
      leaguePath: "esp.1",
      displayName: "La Liga",
      onlyTeams: ["Barcelona", "Real Madrid", "Elche", "Atlético Madrid"],
    },
  },
  {
    teamName: "UEFA Champions League",
    hebrewCompetition: ["ליגת האלופות"],
    sport: "Soccer",
    competition: "UEFA Champions League",
    scheduleUrl: "https://www.espn.com/soccer/schedule/_/league/uefa.champions",
    source: {
      type: "espn-league",
      sportPath: "soccer",
      leaguePath: "uefa.champions",
      displayName: "UEFA Champions League",
    },
  },
];

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const LEAGUE_DAYS_AHEAD = 14;
const THESPORTSDB_API_BASE =
  "https://www.thesportsdb.com/api/v1/json/123/eventsnext.php";
const THESPORTSDB_LEAGUE_API_BASE =
  "https://www.thesportsdb.com/api/v1/json/123/eventsseason.php";

// ESPN API types
interface ESPNBroadcast {
  medium?: { shortName?: string };
  shortName?: string;
  names?: string[];
  market?: string;
  channel?: string;
}

interface ESPNAddress {
  city?: string;
  state?: string;
  country?: string;
}

interface ESPNVenue {
  fullName?: string;
  address?: ESPNAddress;
}

interface ESPNTeam {
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  id?: string | number;
}

interface ESPNCompetitor {
  team?: ESPNTeam;
  homeAway?: "home" | "away";
}

interface ESPNCompetition {
  broadcasts?: ESPNBroadcast[];
  venue?: ESPNVenue;
  competitors?: ESPNCompetitor[];
}

interface ESPNEvent {
  date?: string;
  competitions?: ESPNCompetition[];
}

interface ESPNResponse {
  events?: ESPNEvent[];
}

// TheSportsDB API types
interface SportsDBEvent {
  dateEvent?: string;
  strTimestamp?: string;
  dateEventLocal?: string;
  strTime?: string;
  strTimeLocal?: string;
  strEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strVenue?: string;
  strStadium?: string;
  strLocation?: string;
  strTVStation?: string;
  strChannel?: string;
  strLeague?: string;
  strSport?: string;
}

interface SportsDBResponse {
  events?: SportsDBEvent[];
  results?: SportsDBEvent[];
  eventsnext?: SportsDBEvent[];
}

function extractEspnBroadcasts(competition: ESPNCompetition | undefined): string | undefined {
  const broadcasts: ESPNBroadcast[] = competition?.broadcasts ?? [];
  if (!broadcasts.length) return undefined;

  const uniqueNames = new Set<string>();
  broadcasts.forEach((broadcast) => {
    const name =
      broadcast.medium?.shortName ||
      broadcast.shortName ||
      broadcast.names?.[0] ||
      broadcast.market ||
      broadcast.channel;
    if (name) uniqueNames.add(name);
  });

  if (!uniqueNames.size) return undefined;
  return Array.from(uniqueNames).join(" / ");
}

function extractEspnLocation(competition: ESPNCompetition | undefined): string | undefined {
  const venueName = competition?.venue?.fullName;
  const city = competition?.venue?.address?.city;
  const state = competition?.venue?.address?.state;

  if (venueName && city && state) {
    return `${venueName}, ${city}, ${state}`;
  }

  if (venueName && city) {
    return `${venueName}, ${city}`;
  }

  return venueName ?? competition?.venue?.address?.country;
}

function buildMatchup(
  teamDisplayName: string,
  competitors: ESPNCompetitor[]
): string | undefined {
  if (!competitors?.length) return undefined;

  const thisTeam = competitors.find(
    (competitor) => competitor.team?.displayName === teamDisplayName
  );

  const opponent = competitors.find(
    (competitor) => competitor !== thisTeam
  );

  const opponentName =
    opponent?.team?.displayName || opponent?.team?.shortDisplayName;

  if (!thisTeam && opponentName) {
    return opponent?.homeAway === "home"
      ? `${opponentName} at ${teamDisplayName}`
      : `${teamDisplayName} at ${opponentName}`;
  }

  if (!thisTeam) {
    return competitors.map((c) => c.team?.displayName).join(" vs ");
  }

  if (!opponentName) {
    return competitors.map((c) => c.team?.displayName).join(" vs ");
  }

  return thisTeam.homeAway === "home"
    ? `${teamDisplayName} vs. ${opponentName}`
    : `${teamDisplayName} at ${opponentName}`;
}

async function fetchFromEspn(
  config: TeamScheduleConfig & { source: ESPNTeamConfig }
): Promise<CalendarEvent[]> {
  // Soccer team schedules only list past results unless fixture=true
  const fixtureQuery = config.source.sportPath.startsWith("soccer/") ? "?fixture=true" : "";
  const url = `${ESPN_API_BASE}/${config.source.sportPath}/teams/${config.source.teamIdentifier}/schedule${fixtureQuery}`;

  try {
    console.log(`[${config.teamName}] Fetching schedule from: ${url}`);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `Failed to fetch ESPN schedule for ${config.teamName}: ${res.status} - ${url}`
      );
      return [];
    }

    const data = (await res.json()) as ESPNResponse;
    const events: ESPNEvent[] = data.events ?? [];
    console.log(`[${config.teamName}] Fetched ${events.length} total events from ESPN API`);
    const now = new Date();

    const processedEvents = events
      .map((event) => {
        const competition = event.competitions?.[0];
        if (!competition) {
          console.log(`[${config.teamName}] Event skipped: no competition data`);
          return null;
        }

        const startTime = event.date ? new Date(event.date) : undefined;
        if (!startTime || Number.isNaN(startTime.getTime())) {
          console.log(`[${config.teamName}] Event skipped: invalid start time`);
          return null;
        }

        // Only include upcoming events
        if (startTime.getTime() < now.getTime()) {
          console.log(`[${config.teamName}] Event skipped: past event (${startTime.toISOString()})`);
          return null;
        }

        // Validate that this event actually involves our team
        // Since we're fetching from a team-specific schedule endpoint, all events should involve our team
        // But we still validate to ensure data integrity
        const competitors = competition.competitors ?? [];
        const teamDisplayName = config.source.displayName.toLowerCase();
        const teamAbbreviation = config.source.abbreviation?.toLowerCase();
        const teamNameLower = config.teamName.toLowerCase();
        const expectedTeamId = config.source.teamIdentifier?.toString();
        
        // Check if any competitor matches our team
        const involvesTeam = competitors.some((c: ESPNCompetitor) => {
          const competitorName = (c.team?.displayName || c.team?.shortDisplayName || "").toLowerCase();
          const competitorAbbr = (c.team?.abbreviation || "").toLowerCase();
          const competitorId = c.team?.id?.toString();
          
          // Check multiple ways to identify the team
          return (
            competitorName.includes(teamDisplayName) ||
            teamDisplayName.includes(competitorName) ||
            competitorName.includes("maccabi tel aviv") ||
            competitorName.includes("inter miami") || // Handle Inter Miami CF variations
            competitorName.includes("barcelona") || // Handle Barcelona variations
            (teamAbbreviation && competitorAbbr === teamAbbreviation) ||
            competitorName.includes(teamNameLower) ||
            teamNameLower.includes(competitorName) ||
            (expectedTeamId && competitorId === expectedTeamId)
          );
        });

        // For team-specific schedule endpoints, all events should involve our team
        // Trust ESPN's team schedule endpoint and only exclude if we have no competitors
        if (competitors.length === 0) {
          return null;
        }
        
        // Log for debugging if team matching fails (but still include the event)
        if (!involvesTeam && competitors.length > 0) {
          console.log(
            `[${config.teamName}] Team matching check failed but including event. ` +
            `Expected: ${teamDisplayName} (ID: ${expectedTeamId}), ` +
            `Competitors: ${competitors.map((c: ESPNCompetitor) => 
              `${c.team?.displayName} (ID: ${c.team?.id})`
            ).join(", ")}`
          );
        }

        const matchup = buildMatchup(
          config.source.displayName,
          competitors
        );

        return {
          teamName: config.teamName,
          sport: config.sport,
          competition: config.competition,
          matchup:
            matchup ??
            `${config.teamName} vs. ${competitors
              ?.map((c: ESPNCompetitor) => c.team?.displayName)
              .join(" & ")}`,
          location: extractEspnLocation(competition),
          network: extractEspnBroadcasts(competition),
          startTime,
          scheduleUrl: config.scheduleUrl,
        } satisfies CalendarEvent;
      })
      .filter(Boolean) as CalendarEvent[];
    
    console.log(`[${config.teamName}] Returning ${processedEvents.length} upcoming events`);
    return processedEvents;
  } catch (error) {
    console.error(
      `Error fetching ESPN schedule for ${config.teamName}:`,
      error
    );
    return [];
  }
}

// "Atlético Madrid" and "Atletico Madrid" compare equal
function normalizeClubName(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

async function fetchFromEspnLeague(
  config: TeamScheduleConfig & { source: ESPNLeagueConfig }
): Promise<CalendarEvent[]> {
  // ESPN has no league schedule endpoint for soccer and its scoreboard
  // ignores date ranges, so read the scoreboard one day at a time
  const baseUrl = `${ESPN_API_BASE}/${config.source.sportPath}/${config.source.leaguePath}/scoreboard`;
  let allEvents: ESPNEvent[] = [];

  try {
    const days = Array.from({ length: LEAGUE_DAYS_AHEAD }, (_, index) => {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() + index);
      return day.toISOString().slice(0, 10).replace(/-/g, "");
    });

    const responses = await Promise.all(
      days.map(async (day) => {
        const url = `${baseUrl}?dates=${day}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          cache: "no-store",
        });
        if (!res.ok) {
          console.error(
            `Failed to fetch ESPN league schedule for ${config.teamName}: ${res.status} - ${url}`
          );
          return [];
        }
        const data = (await res.json()) as ESPNResponse;
        return data.events ?? [];
      })
    );
    allEvents = responses.flat();

    const now = new Date();
    const onlyTeams = config.source.onlyTeams?.map(normalizeClubName);

    return allEvents
      .map((event: ESPNEvent) => {
        const competition = event.competitions?.[0];
        if (!competition) return null;

        const startTime = event.date ? new Date(event.date) : undefined;
        if (!startTime || Number.isNaN(startTime.getTime())) return null;

        // Only include upcoming events
        if (startTime.getTime() < now.getTime()) {
          return null;
        }

        // Build matchup from competitors
        const competitors = competition.competitors ?? [];
        const matchup = competitors
          .map((c: ESPNCompetitor) => c.team?.displayName || c.team?.shortDisplayName)
          .filter(Boolean)
          .join(" vs. ");

        if (!matchup) return null;

        if (onlyTeams && !competitors.some((c: ESPNCompetitor) =>
          onlyTeams.includes(normalizeClubName(c.team?.displayName ?? ""))
        )) {
          return null;
        }

        return {
          teamName: config.teamName,
          sport: config.sport,
          competition: config.competition,
          matchup,
          location: extractEspnLocation(competition),
          network: extractEspnBroadcasts(competition),
          startTime,
          scheduleUrl: config.scheduleUrl,
        } satisfies CalendarEvent;
      })
      .filter(Boolean) as CalendarEvent[];
  } catch (error) {
    console.error(
      `Error fetching ESPN league schedule for ${config.teamName}:`,
      error
    );
    return [];
  }
}

async function fetchFromSportsDB(
  config: TeamScheduleConfig & { source: SportsDBTeamConfig }
): Promise<CalendarEvent[]> {
  // Use league-based endpoint if leagueId is provided (for EuroLeague basketball or Premier League)
  // Otherwise use team-based endpoint (requires teamId)
  let url: string;
  if (config.source.leagueId) {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11, where 0 is January
    
    // For soccer leagues, seasons typically run from August to May
    // If we're in the second half of the year (Aug-Dec), use current year for season start
    // If we're in the first half (Jan-Jul), use previous year for season start
    let seasonYear = currentYear;
    if (currentMonth < 7) { // January to July
      seasonYear = currentYear - 1;
    }
    
    // Try season format: "2025-2026" or just the year
    // TheSportsDB accepts both formats, but "YYYY-YYYY+1" is more accurate for soccer
    const season = `${seasonYear}-${seasonYear + 1}`;
    url = `${THESPORTSDB_LEAGUE_API_BASE}?id=${config.source.leagueId}&s=${season}`;
  } else {
    if (!config.source.teamId) {
      console.error(`TheSportsDB config requires either leagueId or teamId for ${config.teamName}`);
      return [];
    }
    url = `${THESPORTSDB_API_BASE}?id=${config.source.teamId}`;
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `Failed to fetch TheSportsDB schedule for ${config.teamName}: ${res.status} - ${url}`
      );
      return [];
    }

    const data = (await res.json()) as SportsDBResponse;
    
    // TheSportsDB API returns events in different formats
    // Check for events array or results array
    let events: SportsDBEvent[] = [];
    if (Array.isArray(data.events)) {
      events = data.events;
    } else if (Array.isArray(data.results)) {
      events = data.results;
    } else if (data.eventsnext && Array.isArray(data.eventsnext)) {
      events = data.eventsnext;
    }
    
    const now = new Date();
    const teamDisplayName = config.source.displayName;

    return events
      .map((event) => {
        // Skip if event is null or undefined
        if (!event) return null;
        
        // Filter by sport type to ensure we only get the correct sport
        const eventSport = event.strSport?.toLowerCase();
        const configSport = config.sport.toLowerCase();
        if (eventSport && eventSport !== configSport) {
          return null;
        }
        
        // Additional validation: ensure we have at least a date or timestamp
        if (!event.dateEvent && !event.strTimestamp && !event.dateEventLocal) {
          return null;
        }

        // If using league-based endpoint AND teamId is provided, filter for events involving this team
        // If only leagueId is provided (no teamId), include all league games
        if (config.source.leagueId && config.source.teamId) {
          const homeTeam = event.strHomeTeam || "";
          const awayTeam = event.strAwayTeam || "";
          const isHomeMatch = homeTeam.toLowerCase().includes(teamDisplayName.toLowerCase());
          const isAwayMatch = awayTeam.toLowerCase().includes(teamDisplayName.toLowerCase());
          
          if (!isHomeMatch && !isAwayMatch) {
            return null;
          }
        }

        // Parse date and time from TheSportsDB
        // TheSportsDB provides: dateEvent (YYYY-MM-DD), strTime (HH:mm:ss or HH:mm)
        const date = event.dateEvent || event.strTimestamp || event.dateEventLocal;
        const time = event.strTime || event.strTimeLocal;
        
        let startTime: Date | undefined;
        if (date) {
          try {
            if (time) {
              // Handle time format - could be "HH:mm:ss" or "HH:mm" or "HH:mm:00"
              const timeParts = time.split(':');
              const hours = timeParts[0]?.padStart(2, '0') || '00';
              const minutes = timeParts[1]?.padStart(2, '0') || '00';
              const timeFormatted = `${hours}:${minutes}`;
              
              // Combine date and time - assume UTC and convert to local
              // TheSportsDB times are typically in local timezone of the venue
              startTime = new Date(`${date}T${timeFormatted}:00`);
              
              // If the date string doesn't include timezone, it's treated as local
              // We need to ensure proper timezone handling
              if (isNaN(startTime.getTime())) {
                // Fallback: try parsing as ISO string if available
                if (event.strTimestamp) {
                  startTime = new Date(event.strTimestamp);
                }
              }
            } else {
              // No time provided, use date only (set to noon to avoid timezone issues)
              startTime = new Date(`${date}T12:00:00`);
            }
          } catch (e) {
            console.error(`Error parsing date/time for ${config.teamName}:`, date, time, e);
            return null;
          }
        }
        
        if (!startTime || Number.isNaN(startTime.getTime())) {
          return null;
        }

        // Only include upcoming events
        if (startTime.getTime() < now.getTime()) {
          return null;
        }

        // Build matchup from event data
        // TheSportsDB provides: strEvent (full event name), strHomeTeam, strAwayTeam
        let matchup = event.strEvent;
        if (!matchup || matchup.trim() === '') {
          const homeTeam = (event.strHomeTeam || "").trim();
          const awayTeam = (event.strAwayTeam || "").trim();
          if (homeTeam && awayTeam) {
            // For league-only fetching (no teamId), use standard format
            // For team-based fetching, prioritize our team's perspective
            if (config.source.teamId) {
              const isHome = homeTeam.toLowerCase().includes(teamDisplayName.toLowerCase());
              if (isHome) {
                matchup = `${homeTeam} vs. ${awayTeam}`;
              } else {
                matchup = `${awayTeam} vs. ${homeTeam}`;
              }
            } else {
              // League-only: use standard home vs away format
              matchup = `${homeTeam} vs. ${awayTeam}`;
            }
          } else if (homeTeam || awayTeam) {
            // Only one team found, use display name if we have teamId, otherwise use the team name
            const otherTeam = homeTeam || awayTeam;
            if (config.source.teamId) {
              matchup = `${config.source.displayName} vs. ${otherTeam}`;
            } else {
              matchup = otherTeam;
            }
          } else {
            // No team info available
            return null;
          }
        }

        return {
          teamName: config.teamName,
          sport: config.sport,
          competition: event.strLeague || config.competition,
          matchup,
          location: event.strVenue ?? event.strStadium ?? event.strLocation,
          network: event.strTVStation || event.strChannel,
          startTime,
          scheduleUrl: config.scheduleUrl,
        } satisfies CalendarEvent;
      })
      .filter(Boolean) as CalendarEvent[];
  } catch (error) {
    console.error(
      `Error fetching TheSportsDB schedule for ${config.teamName}:`,
      error
    );
    return [];
  }
}

// Israeli guides only publish about ten days ahead
const ISRAELI_TV_DAYS_AHEAD = 10;

function buildIsraeliTvMatcher(
  config: TeamScheduleConfig,
  event: CalendarEvent
): IsraeliTvMatcher {
  if (config.source.type === "espn-league") {
    // League games: look up both clubs from "Home vs. Away"
    const hebrewNames = event.matchup
      .split(" vs. ")
      .flatMap((club) => HEBREW_CLUB_NAMES[club.trim()] ?? []);
    return {
      startTime: event.startTime,
      sport: config.sport,
      hebrewNames,
      competitionKeywords: config.hebrewCompetition,
    };
  }

  return {
    startTime: event.startTime,
    sport: config.sport,
    hebrewNames: config.hebrewNames ?? [],
  };
}

function getIsraeliTvDateKeys(): string[] {
  const dateKeys = new Set<string>();
  for (let index = 0; index < ISRAELI_TV_DAYS_AHEAD; index++) {
    dateKeys.add(israelDateKey(new Date(Date.now() + index * 24 * 60 * 60 * 1000)));
  }
  return Array.from(dateKeys);
}

function eventsFromIsraeliTv(
  config: TeamScheduleConfig,
  listings: IsraeliTvListing[]
): CalendarEvent[] {
  return findIsraeliTvGames(config.hebrewNames ?? [], config.sport, listings).map(
    (game) => ({
      teamName: config.teamName,
      sport: config.sport,
      competition: game.competition || config.competition,
      matchup: game.matchup,
      israeliTv: game.channels,
      startTime: game.startTime,
      scheduleUrl: config.scheduleUrl,
    })
  );
}

export async function getAllUpcomingEvents(): Promise<CalendarEvent[]> {
  const listingsPromise = fetchIsraeliTvListings(getIsraeliTvDateKeys());

  const eventsByConfig = await Promise.all(
    teamConfigs.map(async (config) => {
      let events: CalendarEvent[];
      if (config.source.type === "israeli-tv") {
        events = eventsFromIsraeliTv(config, await listingsPromise);
      } else if (config.source.type === "espn") {
        events = await fetchFromEspn(
          config as TeamScheduleConfig & { source: ESPNTeamConfig }
        );
      } else if (config.source.type === "espn-league") {
        events = await fetchFromEspnLeague(
          config as TeamScheduleConfig & { source: ESPNLeagueConfig }
        );
      } else {
        events = await fetchFromSportsDB(
          config as TeamScheduleConfig & { source: SportsDBTeamConfig }
        );
      }
      return { config, events };
    })
  );

  const listings = await listingsPromise;
  return eventsByConfig.flatMap(({ config, events }) =>
    events.map((event) => {
      if (event.israeliTv) return event;
      const israeliTv = findIsraeliChannels(
        buildIsraeliTvMatcher(config, event),
        listings
      );
      return israeliTv ? { ...event, israeliTv } : event;
    })
  );
}

export function getEventsForWeek(
  events: CalendarEvent[],
  startOfWeek: Date,
  endOfWeek: Date
): CalendarEvent[] {
  return events.filter((event) => {
    const time = event.startTime.getTime();
    return time >= startOfWeek.getTime() && time <= endOfWeek.getTime();
  });
}


