// Alarm management utility
//
// Alarms live in this browser's localStorage and can only fire while the
// calendar page is open. For a reminder that works with the site closed
// (e.g. on iPhone), use "Add to Calendar" instead.

export interface GameAlarm {
  gameId: string;
  matchup: string;
  startTime: string; // ISO string
  alarmTime: string; // ISO string (15 minutes before)
  sport: string;
  network?: string;
  israeliTv?: string;
  notified?: boolean;
}

export type NotificationSupport = NotificationPermission | "unsupported";

const STORAGE_KEY = "game_alarms";
const ALARM_MINUTES_BEFORE = 15;
const SERVICE_WORKER_URL = "/sw.js";

export function getAllAlarms(): GameAlarm[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveAlarms(alarms: GameAlarm[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
  } catch (error) {
    console.error("Failed to save alarms:", error);
  }
}

export function addAlarm(game: {
  gameId: string;
  matchup: string;
  startTime: Date;
  sport: string;
  network?: string;
  israeliTv?: string;
}): void {
  if (typeof window === "undefined") return;

  const alarms = getAllAlarms();

  // Check if alarm already exists
  if (alarms.some((a) => a.gameId === game.gameId)) {
    return;
  }

  const alarmTime = new Date(game.startTime);
  alarmTime.setMinutes(alarmTime.getMinutes() - ALARM_MINUTES_BEFORE);

  alarms.push({
    gameId: game.gameId,
    matchup: game.matchup,
    startTime: game.startTime.toISOString(),
    alarmTime: alarmTime.toISOString(),
    sport: game.sport,
    network: game.network,
    israeliTv: game.israeliTv,
  });
  saveAlarms(alarms);
}

export function removeAlarm(gameId: string): void {
  if (typeof window === "undefined") return;
  saveAlarms(getAllAlarms().filter((a) => a.gameId !== gameId));
}

export function hasAlarm(gameId: string): boolean {
  const alarms = getAllAlarms();
  return alarms.some((a) => a.gameId === gameId);
}

export function getAlarmChannels(alarm: Pick<GameAlarm, "network" | "israeliTv">): string | undefined {
  return [alarm.network, alarm.israeliTv].filter(Boolean).join(" / ") || undefined;
}

export function getAlarmMessage(alarm: GameAlarm): string {
  const channels = getAlarmChannels(alarm);
  return `${alarm.matchup} starts in ${ALARM_MINUTES_BEFORE} minutes${channels ? ` on ${channels}` : ""}`;
}

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

// Must be called from a click: browsers ignore or auto-deny permission
// prompts that are not triggered by the user
export async function requestNotificationPermission(): Promise<NotificationSupport> {
  const support = getNotificationSupport();
  if (support !== "default") return support;

  try {
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}

async function getServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  try {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    return await navigator.serviceWorker.ready;
  } catch {
    return undefined;
  }
}

// Phones only allow notifications through a service worker; desktop
// browsers also accept the plain constructor
async function showGameNotification(alarm: GameAlarm): Promise<void> {
  if (getNotificationSupport() !== "granted") return;

  const title = "Game Starting Soon!";
  const options: NotificationOptions = {
    body: getAlarmMessage(alarm),
    icon: "/logo.jpg",
    tag: alarm.gameId,
  };

  const registration = await getServiceWorker();
  if (registration) {
    await registration.showNotification(title, options);
    return;
  }

  try {
    new Notification(title, options);
  } catch (error) {
    console.error("Failed to show notification:", error);
  }
}

// Fires each due alarm once and drops alarms for games that already
// started. Returns the alarms that just fired so the page can show them
// on screen too.
export function checkAlarms(): GameAlarm[] {
  if (typeof window === "undefined") return [];

  const now = Date.now();
  const due: GameAlarm[] = [];

  const remaining = getAllAlarms()
    .filter((alarm) => new Date(alarm.startTime).getTime() > now)
    .map((alarm) => {
      if (alarm.notified || new Date(alarm.alarmTime).getTime() > now) {
        return alarm;
      }
      due.push(alarm);
      return { ...alarm, notified: true };
    });

  saveAlarms(remaining);
  due.forEach((alarm) => void showGameNotification(alarm));
  return due;
}
