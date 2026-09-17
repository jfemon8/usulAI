import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "mongodb";

vi.mock("@/lib/db/mongoClient", () => ({ getDb: vi.fn() }));

import { getDb } from "@/lib/db/mongoClient";
import { createWidgetJob, readWidgetJob, storeWidgetJobStream } from "@/lib/chat/widgetJobs";

const id = "c09869c7-79e7-4ae3-98bb-6c9f0b011234";
const collection = {
  createIndex: vi.fn(async () => "expiresAt_1"),
  insertOne: vi.fn(async () => ({})),
  updateOne: vi.fn(async () => ({})),
  findOne: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({ collection: () => collection } as unknown as Db);
});

describe("widget job persistence", () => {
  it("stores the stream independently of the browser and marks the job complete", async () => {
    await createWidgetJob(id);
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    );
    await storeWidgetJobStream(id, response);

    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: id, status: "running", chunkCount: 0 }),
    );
    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: id, status: "running" },
      expect.objectContaining({
        $push: { chunks: { $each: [Buffer.from("data: [DONE]\n\n").toString("base64")] } },
        $inc: { chunkCount: 1 },
      }),
    );
    expect(collection.updateOne).toHaveBeenCalledWith(
      { _id: id, status: "running" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "complete" }) }),
    );
  });

  it("reports a stalled background job instead of polling forever", async () => {
    collection.findOne.mockResolvedValue({
      status: "running",
      chunks: [],
      chunkCount: 0,
      updatedAt: new Date(Date.now() - 7 * 60_000),
    });
    const snapshot = await readWidgetJob(id, 0);
    expect(snapshot?.status).toBe("error");
    expect(snapshot?.error).toMatch(/interrupted/);
  });
});
