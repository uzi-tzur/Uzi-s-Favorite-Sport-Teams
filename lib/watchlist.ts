// Games the viewer picked to watch ("My Games"), kept in this browser's
// localStorage. Each entry is a full copy of the game, so the plan survives
// schedule refreshes and games outside the week on screen.

import { type CalendarEvent } from "@/lib/calendar";

export type WatchedGame = Omit<CalendarEvent, "startTime"> & {
  gameId: string;
  startTime: string; // ISO string
};

const STORAGE_KEY = "watchlist_games";
// Keep a game in the plan until it should be over
const KEEP_AFTER_START_MS = 4 * 60 * 60 * 1000;

function save(games: WatchedGame[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch (error) {
    console.error("Failed to save watchlist:", error);
  }
}

// Sorted by start time, finished games dropped
export function getWatchlist(): WatchedGame[] {
  if (typeof window === "undefined") return [];

  let games: WatchedGame[];
  try {
    games = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }

  const cutoff = Date.now() - KEEP_AFTER_START_MS;
  const current = games
    .filter((game) => new Date(game.startTime).getTime() > cutoff)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (current.length !== games.length) save(current);
  return current;
}

export function toggleWatched(game: CalendarEvent & { gameId: string }): WatchedGame[] {
  const games = getWatchlist();
  if (games.some((watched) => watched.gameId === game.gameId)) {
    save(games.filter((watched) => watched.gameId !== game.gameId));
  } else {
    // Copy only the game's data, not extra fields added for display
    const watched: WatchedGame = {
      gameId: game.gameId,
      teamName: game.teamName,
      sport: game.sport,
      competition: game.competition,
      matchup: game.matchup,
      location: game.location,
      network: game.network,
      israeliTv: game.israeliTv,
      scheduleUrl: game.scheduleUrl,
      startTime: game.startTime.toISOString(),
    };
    save([...games, watched]);
  }
  return getWatchlist();
}

export function removeWatched(gameId: string): WatchedGame[] {
  save(getWatchlist().filter((watched) => watched.gameId !== gameId));
  return getWatchlist();
}

// Rough game lengths, used to warn about games that overlap
export function gameDurationMs(sport: string): number {
  return (sport === "Football" ? 210 : 120) * 60 * 1000;
}

// gameIds of watched games that overlap another watched game
export function findOverlaps(games: WatchedGame[]): Map<string, string[]> {
  const overlaps = new Map<string, string[]>();
  games.forEach((game, index) => {
    const start = new Date(game.startTime).getTime();
    const end = start + gameDurationMs(game.sport);
    games.slice(index + 1).forEach((other) => {
      const otherStart = new Date(other.startTime).getTime();
      const otherEnd = otherStart + gameDurationMs(other.sport);
      if (otherStart < end && start < otherEnd) {
        overlaps.set(game.gameId, [...(overlaps.get(game.gameId) ?? []), other.matchup]);
        overlaps.set(other.gameId, [...(overlaps.get(other.gameId) ?? []), game.matchup]);
      }
    });
  });
  return overlaps;
}
