import { NextResponse, type NextRequest } from "next/server";
import { buildGameCalendarFile } from "@/lib/ics";

const MAX_TEXT_LENGTH = 300;

function readText(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name)?.trim();
  return value ? value.slice(0, MAX_TEXT_LENGTH) : undefined;
}

// Only links to schedule pages, never other URL schemes
function readUrl(params: URLSearchParams): string | undefined {
  const value = params.get("url");
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

// GET /api/calendar/ics?title=...&start=ISO&sport=...&tv=...&location=...&url=...
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = readText(params, "title");
  const startTime = new Date(params.get("start") ?? "");

  if (!title || Number.isNaN(startTime.getTime())) {
    return NextResponse.json({ error: "title and start are required" }, { status: 400 });
  }

  const body = buildGameCalendarFile({
    title,
    startTime,
    sport: readText(params, "sport"),
    tv: readText(params, "tv"),
    location: readText(params, "location"),
    url: readUrl(params),
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="game.ics"',
      "Cache-Control": "no-store",
    },
  });
}
