/**
 * EventKit Runtime Event Publishing
 *
 * Clean, explicit event publishing with built-in type safety.
 * You control the EventBridge client configuration.
 *
 * @example
 * ```typescript
 * import { Event, Bus } from "@divmode/eventkit/runtime";
 * import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
 * import { Resource } from "sst";
 *
 * // YOU control the client configuration
 * const eventBridgeClient = new EventBridgeClient({
 *   region: "us-east-1",
 *   // any config you want
 * });
 *
 * const OrderCreated = new Event({
 *   name: "order.created",
 *   source: "order-service",
 *   bus: () => new Bus({
 *     name: Resource.Bus.name,
 *     EventBridge: eventBridgeClient
 *   }),
 *   schema: z.object({ orderId: z.string() })
 * });
 *
 * // Type-safe publishing
 * await OrderCreated.publish({ orderId: "123" });
 * ```
 */

export { Bus } from "./Bus";
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
