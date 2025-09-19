/**
 * EventKit Runtime Event Publishing
 *
 * Clean, explicit event publishing with built-in type safety.
 * No runtime initialization required - just import and use.
 *
 * @example
 * ```typescript
 * import { Event, Bus } from "@divmode/eventkit/runtime";
 * import { Resource } from "sst";
 *
 * const bus = new Bus({ name: Resource.Bus.name });
 *
 * const OrderCreated = new Event({
 *   name: "order.created",
 *   source: "order-service",
 *   bus,
 *   schema: z.object({ orderId: z.string() })
 * });
 *
 * // Type-safe publishing
 * await OrderCreated.publish({ orderId: "123" });
 * ```
 */

export { Bus } from "./Bus";
export { createEventBus } from "./createEventBus";
export { createEventHandler } from "./createEventHandler";
export type {
  AnythingButOperator,
  BaseStringOperators,
  CaseInsensitiveOperators,
  EventBridgeFilterValue,
  EventFilter,
  FilterFor,
  NumericComparison,
  NumericOperators,
  SchemaFor,
  StringOperators,
  UniversalOperators,
} from "./Event";
export { Event } from "./Event";
