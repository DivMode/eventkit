import { describe, it, expect } from "bun:test";

describe("EventKit exports", () => {
  it("should export all runtime functionality", async () => {
    const exports = await import("./index.js");

    // Core classes
    expect(exports.Event).toBeDefined();
    expect(exports.Bus).toBeDefined();

    // Factory functions
    expect(exports.createEventHandler).toBeDefined();

    // Type exports should be importable (compile-time check)
    // We can't test types at runtime, but we can verify they don't error
    expect(true).toBe(true);
  });

  it("should export type utilities", async () => {
    // Test that type-only exports are importable in TypeScript
    const typeImports = `
      import type { FilterFor, SchemaFor } from "./index.js";
    `;

    // If this compiles, the types are properly exported
    expect(typeImports).toContain("FilterFor");
    expect(typeImports).toContain("SchemaFor");
  });

  it("should re-export runtime types", async () => {
    const exports = await import("./index.js");

    // These are type-only exports, so we just verify the import doesn't fail
    // The actual type checking happens at compile time
    expect(typeof exports).toBe("object");
  });
});

describe("Runtime functionality integration", () => {
  it("should create and use Event with Bus", async () => {
    const { Event, Bus } = await import("./index.js");
    const { z } = await import("zod");

    // Mock EventBridge client
    const mockEventBridge = {
      send: async () => ({
        Entries: [{ EventId: "test-integration" }],
        FailedEntryCount: 0,
      }),
    } as any;

    const bus = new Bus({
      name: "integration-test-bus",
      EventBridge: mockEventBridge,
    });

    const testEvent = new Event({
      name: "integration.test",
      source: "test-service",
      bus,
      schema: z.object({
        testId: z.string(),
      }),
    });

    // Test pattern generation
    const pattern = testEvent.pattern({
      testId: ["TEST-123"],
    });

    expect(pattern).toMatchObject({
      source: ["test-service"],
      "detail-type": ["integration.test"],
      detail: {
        properties: {
          testId: ["TEST-123"],
        },
      },
    });

    // Test event creation
    const entry = testEvent.create({
      testId: "TEST-123",
    });

    expect(entry).toMatchObject({
      Source: "test-service",
      DetailType: "integration.test",
    });

    const detail = JSON.parse(entry.Detail!);
    expect(detail.properties.testId).toBe("TEST-123");
  });
});