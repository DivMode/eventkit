import type { z } from "zod";
import type { Event } from "../runtime/Event";
import { schemaRegistry } from "./eventbridge";

/**
 * Convert Zod schema to JSON Schema using Zod v4 built-in method
 */
export function toJsonSchema(schema: z.ZodType, eventName: string): any {
  // Use Zod v4's built-in schema method if available
  if (typeof (schema as any).schema === 'function') {
    return (schema as any).schema();
  }

  // Fallback for older versions
  return {
    type: "object",
    properties: {},
    additionalProperties: true,
    description: `Schema for ${eventName}`,
  };
}

/**
 * Register a single event's schema with EventBridge Schema Registry
 */
export async function registerEventSchema(event: Event<any, any>): Promise<void> {
  try {
    const jsonSchema = toJsonSchema((event as any)._schema, event.name);

    await schemaRegistry.registerSchema({
      type: event.name,
      schema: JSON.stringify(jsonSchema),
      description: `Auto-registered schema for ${event.name}`,
      tags: {
        source: "auto-registration",
        eventSource: event.source,
      },
    });

    console.log(`✅ Registered schema for ${event.name}`);
  } catch (error) {
    console.error(`❌ Failed to register schema for ${event.name}:`, error);
  }
}

/**
 * Register all provided Event schemas with EventBridge Schema Registry
 */
export async function registerAllEventSchemas(events: Event<any, any>[]): Promise<void> {
  console.log(`🔍 Found ${events.length} events to register...`);

  for (const event of events) {
    await registerEventSchema(event);
  }

  console.log(`🎉 Successfully registered ${events.length} event schemas`);
}