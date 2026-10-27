"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { type CalendarEvent } from "@/lib/calendar";
import { getTeamLogo, getSportColor } from "@/lib/teamLogos";
import {
  addAlarm,
  removeAlarm,
  hasAlarm,
  getAllAlarms,
  requestNotificationPermission,
  checkAlarms,
  type GameAlarm,
} from "@/lib/alarms";
function getDayLabels(numDays = 7) {
  return Array.from({ length: numDays }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i); // shift forward by i days
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const day = date.toLocaleDateString("en-US", { day: "numeric" });
    return `${weekday}, ${month} ${day}`;
  });
}

type ViewMode = "grid" | "list";
type SportFilter = "all" | "Soccer" | "Football" | "Basketball";
type DayFilter = "all" | string;

interface CalendarClientProps {
  initialEvents: Array<Omit<CalendarEvent, "startTime"> & { startTime: string }>;
  startOfWeek: string;
}


// Date formatters - must have consistent timezone to avoid hydration mismatches
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: "America/Chicago", // Specify timezone to ensure consistent output between server and client
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
});

const israelTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

type DailySchedule = {
  label: string;
  date: Date;
  games: Array<CalendarEvent & { timeLabel: string; gameId: string }>;
};

function groupEventsByDay(
  events: CalendarEvent[],
  _startOfWeek: Date
): DailySchedule[] {
  const dayLabels = getDayLabels();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return dayLabels.map((label, index) => {
    const dayStart = new Date(today);
    dayStart.setDate(today.getDate() + index);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const games = events
      .filter(
        (event) =>
          event.startTime.getTime() >= dayStart.getTime() &&
          event.startTime.getTime() <= dayEnd.getTime()
      )
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .map((event) => ({
        ...event,
        timeLabel: timeFormatter.format(event.startTime),
        gameId: `${event.matchup}-${event.startTime.toISOString()}`,
      }));

    return {
      label,
      date: dayStart,
      games,
    };
  });
}

export default function CalendarClient({
  initialEvents,
  startOfWeek: startOfWeekStr,
}: CalendarClientProps) {
  // Convert ISO strings back to Date objects
  const [events, setEvents] = useState<CalendarEvent[]>(
    initialEvents.map((event) => ({
      ...event,
      startTime: new Date(event.startTime),
    }))
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [alarms, setAlarms] = useState<GameAlarm[]>([]);
  const [showAlarmsList, setShowAlarmsList] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoize startOfWeek to avoid recreating on every render
  const startOfWeek = useMemo(() => new Date(startOfWeekStr), [startOfWeekStr]);

  // Load alarms on mount
  useEffect(() => {
    setAlarms(getAllAlarms());
    
    // Request notification permission
    requestNotificationPermission();
    
    // Check alarms every minute
    const interval = setInterval(() => {
      checkAlarms();
      setAlarms(getAllAlarms());
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Filter events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Filter by sport
    if (sportFilter !== "all") {
      filtered = filtered.filter((event) => event.sport === sportFilter);
    }

    // Filter by day
    if (dayFilter !== "all") {
      const filterDate = new Date(dayFilter);
      filtered = filtered.filter((event) => {
        const eventDate = new Date(event.startTime);
        return (
          eventDate.getDate() === filterDate.getDate() &&
          eventDate.getMonth() === filterDate.getMonth() &&
          eventDate.getFullYear() === filterDate.getFullYear()
        );
      });
    }

    return filtered;
  }, [events, sportFilter, dayFilter]);

  const scheduleByDay = useMemo(
    () => groupEventsByDay(filteredEvents, startOfWeek),
    [filteredEvents, startOfWeek]
  );

  const allGamesList = useMemo(() => {
    return filteredEvents
      .map((event) => ({
        ...event,
        timeLabel: timeFormatter.format(event.startTime),
        gameId: `${event.matchup}-${event.startTime.toISOString()}`,
      }))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [filteredEvents]);

  const handleToggleAlarm = (game: CalendarEvent & { gameId: string }) => {
    if (hasAlarm(game.gameId)) {
      removeAlarm(game.gameId);
    } else {
      addAlarm({
        gameId: game.gameId,
        matchup: game.matchup,
        startTime: game.startTime,
        sport: game.sport,
        network: game.network,
      });
    }
    setAlarms(getAllAlarms());
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/calendar/refresh");
      if (response.ok) {
        const data = await response.json();
        // Convert ISO strings back to Date objects
        const eventsWithDates = data.events.map((event: Omit<CalendarEvent, "startTime"> & { startTime: string }) => ({
          ...event,
          startTime: new Date(event.startTime),
        }));
        setEvents(eventsWithDates);
      }
    } catch (error) {
      console.error("Failed to refresh:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getDayOptions = () => {
    const options: { value: string; label: string }[] = [
      { value: "all", label: "All Days" },
    ];
    
    scheduleByDay.forEach((day) => {
      if (day.games.length > 0) {
        options.push({
          value: day.date.toISOString(),
          label: `${day.label}, ${dateFormatter.format(day.date)}`,
        });
      }
    });
    
    return options;
  };

  return (
    <>
      {/* Controls */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === "grid"
                    ? "bg-sky-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Grid View
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === "list"
                    ? "bg-sky-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                List View
              </button>
            </div>

            {/* Sport Filter */}
            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value as SportFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">All Sports</option>
              <option value="Soccer">Soccer</option>
              <option value="Football">Football</option>
              <option value="Basketball">Basketball</option>
            </select>

            {/* Day Filter */}
            <select
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {getDayOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* Alarms List Button */}
            <button
              onClick={() => setShowAlarmsList(!showAlarmsList)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              Alarms ({alarms.length})
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Alarms List */}
        {showAlarmsList && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Game Alarms ({alarms.length})
              </h3>
              <button
                onClick={() => setShowAlarmsList(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {alarms.length === 0 ? (
              <p className="text-sm text-gray-500">No alarms set.</p>
            ) : (
              <ul className="space-y-2">
                {alarms.map((alarm) => {
                  const alarmDate = new Date(alarm.alarmTime);
                  const gameDate = new Date(alarm.startTime);
                  return (
                    <li
                      key={alarm.gameId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {alarm.matchup}
                        </p>
                        <p className="text-sm text-gray-600">
                          Alarm: {timeFormatter.format(alarmDate)} CT • Game:{" "}
                          {timeFormatter.format(gameDate)} CT
                        </p>
                        {alarm.network && (
                          <p className="text-xs text-gray-500">
                            {alarm.network}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          removeAlarm(alarm.gameId);
                          setAlarms(getAllAlarms());
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {scheduleByDay.map((day) => (
            <article
              key={day.label}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <header className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {day.label}
                  </h2>
                  <span className="text-sm text-gray-500">
                    {dateFormatter.format(day.date)}
                  </span>
                </div>
              </header>
              <ul className="divide-y divide-gray-100">
                {day.games.length === 0 ? (
                  <li className="px-6 py-6 text-sm text-gray-500">
                    No games scheduled.
                  </li>
                ) : (
                  day.games.map((game) => {
                    const sportColor = getSportColor(game.sport);
                    const logo = getTeamLogo(game.teamName);
                    // Use alarms state instead of hasAlarm() to avoid hydration mismatch
                    const alarmSet = alarms.some((a) => a.gameId === game.gameId);
                    
                    return (
                      <li
                        key={game.gameId}
                        className="px-6 py-5 space-y-3"
                        style={{
                          borderLeft: `4px solid ${
                            sportColor === "blue"
                              ? "#3b82f6"
                              : sportColor === "green"
                              ? "#22c55e"
                              : sportColor === "yellow"
                              ? "#eab308"
                              : "#6b7280"
                          }`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {logo && (
                              <div className="relative w-12 h-12">
                                <Image
                                  src={logo}
                                  alt={`${game.teamName} logo`}
                                  fill
                                  className="object-contain"
                                  sizes="48px"
                                />
                              </div>
                            )}
                            <p className="text-base font-semibold text-gray-900">
                              {game.matchup}
                            </p>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  sportColor === "blue"
                                    ? "bg-blue-100 text-blue-800"
                                    : sportColor === "green"
                                    ? "bg-green-100 text-green-800"
                                    : sportColor === "yellow"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {game.sport}
                              </span>
                              <span className="text-sm text-gray-600">
                                {game.competition}
                              </span>
                            </div>
                            {game.location && (
                              <p className="text-sm text-gray-500">
                                {game.location}
                              </p>
                            )}
                            <div className="flex items-center gap-3">
                              <Link
                                href={game.scheduleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
                              >
                                View schedule ↗
                              </Link>
                              <button
                                onClick={() => handleToggleAlarm(game)}
                                className={`inline-flex items-center gap-1 text-sm font-medium ${
                                  alarmSet
                                    ? "text-yellow-600 hover:text-yellow-700"
                                    : "text-gray-600 hover:text-gray-700"
                                }`}
                              >
                                {alarmSet ? (
                                  <>
                                    <svg
                                      className="w-4 h-4"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    Alarm Set
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                      />
                                    </svg>
                                    Set Alarm
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="text-sm font-semibold text-sky-600">
                              {game.timeLabel} CT
                            </p>
                            {(game.network || !game.israeliTv) && (
                              <p className="text-xs uppercase tracking-wide text-gray-500">
                                {game.network ?? "Network TBA"}
                              </p>
                            )}
                            {game.israeliTv && (
                              <p className="text-xs font-semibold text-blue-700">
                                🇮🇱{" "}
                                <span lang="he" dir="rtl">
                                  {game.israeliTv}
                                </span>{" "}
                                · {israelTimeFormatter.format(game.startTime)} IL
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </article>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {allGamesList.length === 0 ? (
              <li className="px-6 py-12 text-center text-sm text-gray-500">
                No games found matching your filters.
              </li>
            ) : (
              allGamesList.map((game) => {
                const sportColor = getSportColor(game.sport);
                const logo = getTeamLogo(game.teamName);
                // Use alarms state instead of hasAlarm() to avoid hydration mismatch
                const alarmSet = alarms.some((a) => a.gameId === game.gameId);
                
                return (
                  <li
                    key={game.gameId}
                    className="px-6 py-5"
                    style={{
                      borderLeft: `4px solid ${
                        sportColor === "blue"
                          ? "#3b82f6"
                          : sportColor === "green"
                          ? "#22c55e"
                          : sportColor === "yellow"
                          ? "#eab308"
                          : "#6b7280"
                      }`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {logo && (
                          <div className="relative w-16 h-16 flex-shrink-0">
                            <Image
                              src={logo}
                              alt={`${game.teamName} logo`}
                              fill
                              className="object-contain"
                              sizes="64px"
                            />
                          </div>
                        )}
                        <div className="flex-1 space-y-2">
                          <p className="text-lg font-semibold text-gray-900">
                            {game.matchup}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                sportColor === "blue"
                                  ? "bg-blue-100 text-blue-800"
                                  : sportColor === "green"
                                  ? "bg-green-100 text-green-800"
                                  : sportColor === "yellow"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {game.sport}
                            </span>
                            <span className="text-sm text-gray-600">
                              {game.competition}
                            </span>
                            <span className="text-sm text-gray-500">
                              {dateFormatter.format(game.startTime)}
                            </span>
                          </div>
                          {game.location && (
                            <p className="text-sm text-gray-500">
                              {game.location}
                            </p>
                          )}
                          {game.network && (
                            <p className="text-sm text-gray-600">
                              📺 {game.network}
                            </p>
                          )}
                          {game.israeliTv && (
                            <p className="text-sm font-semibold text-blue-700">
                              🇮🇱{" "}
                              <span lang="he" dir="rtl">
                                {game.israeliTv}
                              </span>{" "}
                              · {israelTimeFormatter.format(game.startTime)} Israel time
                            </p>
                          )}
                          <div className="flex items-center gap-3">
                            <Link
                              href={game.scheduleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
                            >
                              View schedule ↗
                            </Link>
                            <button
                              onClick={() => handleToggleAlarm(game)}
                              className={`inline-flex items-center gap-1 text-sm font-medium ${
                                alarmSet
                                  ? "text-yellow-600 hover:text-yellow-700"
                                  : "text-gray-600 hover:text-gray-700"
                              }`}
                            >
                              {alarmSet ? (
                                <>
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  Alarm Set
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                    />
                                  </svg>
                                  Set Alarm (15 min before)
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1 flex-shrink-0">
                        <p className="text-base font-semibold text-sky-600">
                          {game.timeLabel} CT
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </>
  );
}

