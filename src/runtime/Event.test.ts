import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { Event } from "./Event";
import { Bus } from "./Bus";

// Mock EventBridge client for testing
const mockEventBridgeClient = {
  send: async () => ({
    Entries: [{ EventId: "test-event-id" }],
    FailedEntryCount: 0,
  }),
} as any;

// Mock Bus for testing
const mockBus = new Bus({
  name: "test-bus",
  EventBridge: mockEventBridgeClient,
});

describe("Event", () => {
  const testSchema = z.object({
    orderId: z.string(),
    amount: z.number(),
    status: z.enum(["pending", "completed"]),
  });

  const testEvent = new Event({
    name: "order.created",
    source: "order-service",
    bus: mockBus,
    schema: testSchema,
  });

  describe("basic properties", () => {
    it("should return correct name", () => {
      expect(testEvent.name).toBe("order.created");
    });

    it("should return correct source", () => {
      expect(testEvent.source).toBe("order-service");
    });

    it("should return correct type", () => {
      expect(testEvent.type).toBe("order.created");
    });

    it("should return schema", () => {
      expect(testEvent.schema).toBe(testSchema);
    });

    it("should return bus", () => {
      expect(testEvent.bus).toBe(mockBus);
    });
  });

  describe("create", () => {
    it("should create valid PutEventsRequestEntry", () => {
      const entry = testEvent.create({
        orderId: "ORDER-123",
        amount: 100,
        status: "pending",
      });

      expect(entry).toMatchObject({
        Source: "order-service",
        DetailType: "order.created",
      });

      expect(entry.Detail).toBeDefined();
      const detail = JSON.parse(entry.Detail!);
      expect(detail.properties).toMatchObject({
        orderId: "ORDER-123",
        amount: 100,
        status: "pending",
      });
    });

    it("should validate schema and throw on invalid data", () => {
      expect(() => {
        testEvent.create({
          orderId: "ORDER-123",
          amount: "invalid", // Should be number
          status: "pending",
        } as any);
      }).toThrow();
    });
  });

  describe("pattern generation", () => {
    it("should generate base pattern without filter", () => {
      const pattern = testEvent.pattern();

      expect(pattern).toMatchObject({
        source: ["order-service"],
        "detail-type": ["order.created"],
      });
    });

    it("should generate pattern with simple filter", () => {
      const pattern = testEvent.pattern({
        amount: [100, 200],
        status: ["completed"],
      });

      expect(pattern).toMatchObject({
        source: ["order-service"],
        "detail-type": ["order.created"],
        detail: {
          properties: {
            amount: [100, 200],
            status: ["completed"],
          },
        },
      });
    });

    it("should generate pattern with numeric operators", () => {
      const pattern = testEvent.pattern({
        amount: [{ numeric: [">", 100] }],
      });

      expect(pattern).toMatchObject({
        source: ["order-service"],
        "detail-type": ["order.created"],
        detail: {
          properties: {
            amount: [{ numeric: [">", 100] }],
          },
        },
      });
    });
  });

  describe("computePattern (static method)", () => {
    const secondEvent = new Event({
      name: "order.updated",
      source: "order-service",
      bus: mockBus,
      schema: testSchema,
    });

    it("should generate pattern for multiple events", () => {
      const pattern = Event.computePattern([testEvent, secondEvent]);

      expect(pattern).toMatchObject({
        source: ["order-service"],
        "detail-type": ["order.created", "order.updated"],
      });
    });

    it("should generate pattern for multiple events with filter", () => {
      const pattern = Event.computePattern([testEvent, secondEvent], {
        amount: [{ numeric: [">", 100] }],
      });

      expect(pattern).toMatchObject({
        source: ["order-service"],
        "detail-type": ["order.created", "order.updated"],
        detail: {
          properties: {
            amount: [{ numeric: [">", 100] }],
          },
        },
      });
    });

    it("should handle events from different sources", () => {
      const paymentEvent = new Event({
        name: "payment.processed",
        source: "payment-service",
        bus: mockBus,
        schema: z.object({ paymentId: z.string() }),
      });

      const pattern = Event.computePattern([testEvent, paymentEvent]);

      expect(pattern).toMatchObject({
        source: ["order-service", "payment-service"],
        "detail-type": ["order.created", "payment.processed"],
      });
    });

    it("should throw error for empty events array", () => {
      expect(() => {
        Event.computePattern([]);
      }).toThrow("Cannot compute pattern for empty events array");
    });
  });

  describe("lazy bus resolution", () => {
    it("should resolve bus function when accessed", () => {
      const lazyBus = () => mockBus;
      const eventWithLazyBus = new Event({
        name: "test.event",
        source: "test-service",
        bus: lazyBus,
        schema: z.object({ id: z.string() }),
      });

      expect(eventWithLazyBus.bus).toBe(mockBus);
    });
  });
});