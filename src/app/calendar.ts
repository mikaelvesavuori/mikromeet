export interface CalendarEventDetails {
  title: string;
  startsAt: number;
  endsAt: number;
  url: string;
  description?: string;
}

export function calculateEndTime(startsAt: number, durationMinutes: number): number {
  const safeDuration =
    Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30;
  return startsAt + safeDuration * 60 * 1000;
}

export function createCalendarFile(details: CalendarEventDetails): string {
  const title = details.title.trim() || "MikroMeet meeting";
  const description = details.description?.trim() || `Join the MikroMeet meeting: ${details.url}`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MikroMeet//Meeting Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${createEventUid(details)}`,
    `DTSTAMP:${formatIcsDate(Date.now())}`,
    `DTSTART:${formatIcsDate(details.startsAt)}`,
    `DTEND:${formatIcsDate(details.endsAt)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${details.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadCalendarFile(details: CalendarEventDetails): void {
  const content = createCalendarFile(details);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(details.title || "mikromeet-meeting")}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function createEventUid(details: CalendarEventDetails): string {
  const urlSafe = details.url.replace(/[^A-Za-z0-9]/g, "").slice(-24) || "meeting";
  return `${details.startsAt}-${urlSafe}@mikromeet`;
}

function formatIcsDate(timestamp: number): string {
  return new Date(timestamp)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "mikromeet-meeting";
}
