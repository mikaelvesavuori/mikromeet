import { describe, expect, it } from "vitest";

import { calculateEndTime, createCalendarFile } from "../../src/app/calendar.js";

describe("calendar helpers", () => {
  it("calculates an end time from a duration", () => {
    const startsAt = Date.UTC(2026, 3, 30, 12, 0, 0);

    expect(calculateEndTime(startsAt, 45)).toBe(Date.UTC(2026, 3, 30, 12, 45, 0));
  });

  it("creates an escaped ICS file", () => {
    const ics = createCalendarFile({
      title: "Roadmap, sync",
      startsAt: Date.UTC(2026, 3, 30, 12, 0, 0),
      endsAt: Date.UTC(2026, 3, 30, 12, 30, 0),
      url: "https://mikromeet.example/?join=ABC123",
      description: "Line one\nLine two; bring notes",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20260430T120000Z");
    expect(ics).toContain("DTEND:20260430T123000Z");
    expect(ics).toContain("SUMMARY:Roadmap\\, sync");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\; bring notes");
  });
});
