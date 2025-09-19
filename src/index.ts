/**
 * EventKit - Universal TypeScript Event System
 *
 * Type-safe AWS EventBridge patterns from Zod schemas with zero runtime overhead.
 * Transform your existing Zod schemas into EventBridge rules with complete
 * TypeScript safety and IntelliSense support.
 *
 * @example
 * ```typescript
 * import { Event, createEventBus } from "eventkit";
 * import { z } from "zod";
 *
 * const OrderCreated = new Event({
 *   name: "order.created",
 *   source: "order-service",
 *   bus: createEventBus,
 *   schema: z.object({
 *     orderId: z.string(),
 *     amount: z.number(),
 *   }),
 * });
 *
 * // Generate type-safe patterns
 * const pattern = OrderCreated.pattern({
 *   amount: [{ numeric: [">", 1000] }]
 * });
 *
 * // Publish events
 * await OrderCreated.publish({
 *   orderId: "ORDER-123",
 *   amount: 1500
 * });
 * ```
 */

// Export type-only imports for type utilities
export type { FilterFor, SchemaFor } from "./runtime/Event";
// Re-export all runtime functionality as the main API
export * from "./runtime/index";
