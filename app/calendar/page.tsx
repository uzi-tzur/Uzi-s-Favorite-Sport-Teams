import Link from "next/link";
import Section from "@/components/ui/Section";
import {
  getAllUpcomingEvents,
  getEventsForWeek,
} from "@/lib/calendar";
import CalendarClient from "@/components/calendar/CalendarClient";

const pageQuickLinks = [
  { label: "Home", href: "/#hero" },
  { label: "Teams", href: "/#favorite-teams" },
  { label: "Players", href: "/#players" },
  { label: "Connect", href: "/#connect" },
];

function getStartOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  timeZone: "America/Chicago",
});

export const metadata = {
  title: "Weekly TV Calendar | Uzi's Favorite Sport Teams",
  description:
    "See this week's TV schedule for soccer, football, and basketball teams including Maccabi Tel Aviv, FC Barcelona, Dallas Cowboys, and more.",
};

export default async function CalendarPage() {
  const today = new Date();
  const startOfWeek = getStartOfWeek(today);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const allEvents = await getAllUpcomingEvents();
  const weekEvents = getEventsForWeek(allEvents, startOfWeek, endOfWeek);

  const nextGame = weekEvents
    .slice()
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

  return (
    <>
      <section className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
        <div className="section-container py-16 sm:py-20 text-center space-y-6">
          <p className="uppercase tracking-widest text-sm sm:text-base font-semibold text-sky-100">
            Week at a Glance
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
            Weekly TV Calendar
          </h1>
          <div className="max-w-2xl mx-auto space-y-3 text-base sm:text-lg text-sky-100">
            <p>
              Live data from the official schedule pages keeps this list up to
              date. Every matchup below comes directly from the teams&apos;
              <span className="font-semibold text-white"> “View Schedule”</span>{" "}
              links so you know exactly what&apos;s on TV this week.
            </p>
            {nextGame && (
              <p className="text-sm sm:text-base text-sky-100/90">
                Next kickoff / tip-off:{" "}
                <span className="font-semibold text-white">
                  {nextGame.matchup}
                </span>{" "}
                on {weekdayFormatter.format(nextGame.startTime)} at{" "}
                {timeFormatter.format(nextGame.startTime)} CT (
                {nextGame.network ?? (nextGame.israeliTv ? "" : "network TBA")}
                {nextGame.israeliTv && (
                  <>
                    {nextGame.network ? " · 🇮🇱 " : "🇮🇱 "}
                    <span lang="he" dir="rtl">
                      {nextGame.israeliTv}
                    </span>
                  </>
                )}
                )
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm sm:text-base">
            {pageQuickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white hover:text-sky-600"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm sm:text-base">
            <span className="bg-white/15 border border-white/30 rounded-full px-4 py-2">
              Times listed in Central Time
            </span>
            <span className="bg-white/15 border border-white/30 rounded-full px-4 py-2">
              Broadcast partners &amp; streaming info included
            </span>
            <span className="bg-white/15 border border-white/30 rounded-full px-4 py-2">
              🇮🇱 Israeli channels: Sport 1–4 &amp; Sport 5
            </span>
          </div>
        </div>
      </section>

      <Section
        id="weekly-calendar"
        title="This Week's Games on TV"
        subtitle="Plan your week around the must-watch matchups for every team on Uzi's list. Set alarms, filter by sport or day, and switch between grid and list views."
        bgColor="gray"
      >
        <CalendarClient
          initialEvents={weekEvents.map((event) => ({
            ...event,
            startTime: event.startTime.toISOString(),
          }))}
          startOfWeek={startOfWeek.toISOString()}
        />
      </Section>

      <section className="py-12 sm:py-16">
        <div className="section-container text-center space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            Want more team insights?
          </h2>
          <p className="text-base text-gray-600 max-w-xl mx-auto">
            Head back to the main dashboard to explore rosters, highlights, and
            more curated content for every favorite team.
          </p>
          <Link
            href="/#hero"
            className="inline-flex items-center justify-center rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            Return to Home
          </Link>
        </div>
      </section>
    </>
  );
}


