import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { EventBridgeClient, PutEventsRequestEntry } from "@aws-sdk/client-eventbridge";
import { Bus } from "./Bus";

describe("Bus", () => {
  const mockEventBridge = {
    send: mock(async () => ({
      Entries: [{ EventId: "test-event-id" }],
      FailedEntryCount: 0,
    })),
  } as unknown as EventBridgeClient;

  const bus = new Bus({
    name: "test-bus",
    EventBridge: mockEventBridge,
  });

  beforeEach(() => {
    mockEventBridge.send.mockClear();
  });

  describe("basic properties", () => {
    it("should return correct name", () => {
      expect(bus.name).toBe("test-bus");
    });
  });

  describe("put", () => {
    it("should add EventBusName to entries", async () => {
      const entries: PutEventsRequestEntry[] = [
        {
          Source: "test-source",
          DetailType: "test.event",
          Detail: JSON.stringify({ test: "data" }),
        },
      ];

      await bus.put(entries);

      expect(mockEventBridge.send).toHaveBeenCalledTimes(1);
      const command = mockEventBridge.send.mock.calls[0][0];
      expect(command.input.Entries[0].EventBusName).toBe("test-bus");
    });

    it("should handle single entry", async () => {
      const entries: PutEventsRequestEntry[] = [
        {
          Source: "test-source",
          DetailType: "test.event",
          Detail: JSON.stringify({ test: "data" }),
        },
      ];

      const result = await bus.put(entries);

      expect(mockEventBridge.send).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        Entries: [{ EventId: "test-event-id" }],
        FailedEntryCount: 0,
      });
    });

    it("should handle multiple small entries in single request", async () => {
      const entries: PutEventsRequestEntry[] = [
        {
          Source: "test-source",
          DetailType: "test.event1",
          Detail: JSON.stringify({ test: "data1" }),
        },
        {
          Source: "test-source",
          DetailType: "test.event2",
          Detail: JSON.stringify({ test: "data2" }),
        },
      ];

      await bus.put(entries);

      // Should send all entries in single request since they're small
      expect(mockEventBridge.send).toHaveBeenCalledTimes(1);
      const command = mockEventBridge.send.mock.calls[0][0];
      expect(command.input.Entries).toHaveLength(2);
    });

    it("should chunk large number of entries", async () => {
      // Create 15 entries (exceeds limit of 10 per request)
      const entries: PutEventsRequestEntry[] = Array.from({ length: 15 }, (_, i) => ({
        Source: "test-source",
        DetailType: `test.event${i}`,
        Detail: JSON.stringify({ test: `data${i}` }),
      }));

      // Mock multiple responses for chunked requests
      mockEventBridge.send
        .mockResolvedValueOnce({
          Entries: Array.from({ length: 10 }, (_, i) => ({ EventId: `event-${i}` })),
          FailedEntryCount: 0,
        })
        .mockResolvedValueOnce({
          Entries: Array.from({ length: 5 }, (_, i) => ({ EventId: `event-${i + 10}` })),
          FailedEntryCount: 0,
        });

      const result = await bus.put(entries);

      // Should make 2 requests (10 + 5 entries)
      expect(mockEventBridge.send).toHaveBeenCalledTimes(2);

      // Should merge results
      expect(result.Entries).toHaveLength(15);
      expect(result.FailedEntryCount).toBe(0);
    });

    it("should handle failed entries correctly", async () => {
      mockEventBridge.send
        .mockResolvedValueOnce({
          Entries: [{ EventId: "success-1" }],
          FailedEntryCount: 1,
        })
        .mockResolvedValueOnce({
          Entries: [{ EventId: "success-2" }],
          FailedEntryCount: 2,
        });

      const entries: PutEventsRequestEntry[] = Array.from({ length: 15 }, (_, i) => ({
        Source: "test-source",
        DetailType: `test.event${i}`,
        Detail: JSON.stringify({ test: `data${i}` }),
      }));

      const result = await bus.put(entries);

      expect(result.FailedEntryCount).toBe(3); // 1 + 2 failed entries
      expect(result.Entries).toHaveLength(2);
    });
  });

  describe("chunking behavior", () => {
    it("should return empty chunk array when no entries provided", async () => {
      const result = await bus.put([]);

      expect(mockEventBridge.send).toHaveBeenCalledTimes(1);
      const command = mockEventBridge.send.mock.calls[0][0];
      expect(command.input.Entries).toHaveLength(0);
    });
  });
});