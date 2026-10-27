// Builds a one-game .ics calendar file with a reminder before kickoff.
// iPhone Calendar (and Google / Outlook) show the reminder even when the
// site is closed, which browser notifications on iPhone cannot do.

export const REMINDER_MINUTES = 15;

export type CalendarFileGame = {
  title: string;
  startTime: Date;
  sport?: string;
  tv?: string;
  location?: string;
  url?: string;
};

// American football runs long; everything else fits in two hours
function durationMinutes(sport?: string): number {
  return sport === "Football" ? 210 : 120;
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545: lines longer than 75 bytes continue on the next line after a
// space. Hebrew is multi-byte, so count bytes, not characters.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += charBytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function stableId(text: string): string {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return hash.toString(36);
}

export function buildGameCalendarFile(game: CalendarFileGame): string {
  const end = new Date(game.startTime.getTime() + durationMinutes(game.sport) * 60 * 1000);
  const description = [game.tv ? `TV: ${game.tv}` : "", game.url ?? ""]
    .filter(Boolean)
    .join("\n");
  const reminderText = game.tv
    ? `${game.title} starts in ${REMINDER_MINUTES} minutes on ${game.tv}`
    : `${game.title} starts in ${REMINDER_MINUTES} minutes`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uzi's Favorite Sport Teams//TV Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${stableId(`${game.title}-${game.startTime.toISOString()}`)}@uzis-favorite-sport-teams`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(game.startTime)}`,
    `DTEND:${formatUtc(end)}`,
    `SUMMARY:${escapeText(game.tv ? `${game.title} (${game.tv})` : game.title)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : "",
    game.location ? `LOCATION:${escapeText(game.location)}` : "",
    game.url ? `URL:${game.url}` : "",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(reminderText)}`,
    `TRIGGER:-PT${REMINDER_MINUTES}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
