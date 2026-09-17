import { describe, expect, it } from "vitest";
import {
  WIDGET_MESSAGE_SOURCE,
  isWidgetMessage,
  shouldContinueVisit,
} from "../../widget-src/session";

describe("widget visit continuity", () => {
  const current = "https://host.example/second";

  it("continues on same-site navigation, reload, and an internal link without referrer", () => {
    expect(shouldContinueVisit("https://host.example/first", current, "navigate", null)).toBe(true);
    expect(shouldContinueVisit("", current, "reload", null)).toBe(true);
    expect(shouldContinueVisit("", current, "navigate", current)).toBe(true);
  });

  it("starts a new visit after entering from another site or opening a fresh tab", () => {
    expect(shouldContinueVisit("https://another.example/", current, "navigate", null)).toBe(false);
    expect(shouldContinueVisit("", current, "navigate", null)).toBe(false);
    expect(shouldContinueVisit("", current, "navigate", "https://host.example/other-page")).toBe(
      false,
    );
  });
});

describe("widget message protocol", () => {
  it("rejects malformed chat payloads", () => {
    expect(
      isWidgetMessage({
        source: WIDGET_MESSAGE_SOURCE,
        type: "save",
        visitId: "visit-1",
        chat: { id: "chat-1", messages: [{ role: "system", id: "m-1", parts: [] }] },
      }),
    ).toBe(false);
    expect(
      isWidgetMessage({
        source: WIDGET_MESSAGE_SOURCE,
        type: "save",
        visitId: "visit-1",
        chat: { id: "chat-1", messages: [{ role: "user", id: "m-1", parts: [] }] },
      }),
    ).toBe(true);
    expect(
      isWidgetMessage({
        source: WIDGET_MESSAGE_SOURCE,
        type: "pending",
        visitId: "visit-1",
        chatId: "chat-1",
        jobId: "job-1",
      }),
    ).toBe(false);
  });
});
