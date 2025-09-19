// Make aws-lambda types optional for environments that don't have them installed
type EventBridgeEvent<TDetailType extends string, TDetail> = {
  version: string;
  id: string;
  "detail-type": TDetailType;
  source: string;
  account: string;
  time: string;
  region: string;
  detail: TDetail;
};

type EventBridgeHandler<TDetailType extends string, TDetail, TResult> = (
  event: EventBridgeEvent<TDetailType, TDetail>,
) => Promise<TResult>;

import type { z } from "zod";
import type { Event } from "./Event";

/**
 * Type-safe EventBridge handler helper
 * Creates a handler that provides full type safety for event properties
 *
 * @example
 * ```typescript
 * import { createEventHandler } from "@divmode/eventkit/runtime";
 * import { UserCreated, OrderPlaced } from "./events";
 *
 * export const handler = createEventHandler(
 *   [UserCreated, OrderPlaced],
 *   async (event) => {
 *     switch (event.type) {
 *       case "user.created":
 *         const { userId, email } = event.properties; // Fully typed!
 *         break;
 *     }
 *   }
 * );
 * ```
 */

// Simplified event payload type that TypeScript can understand
type EventPayload<E extends Event<string, z.ZodType>> = E extends Event<
  infer N,
  infer S
>
  ? {
      type: N;
      properties: z.infer<S>;
      metadata?: unknown;
    }
  : never;

export function createEventHandler<E extends Event<string, z.ZodType>>(
  events: readonly E[],
  callback: (event: EventPayload<E>) => Promise<void>,
): EventBridgeHandler<string, any, void> {
  return async (awsEvent: EventBridgeEvent<string, any>) => {
    const eventType = awsEvent["detail-type"];

    // Find the matching event definition
    const matchingEvent = events.find((event) => event.name === eventType);

    if (!matchingEvent) {
      throw new Error(`No event definition found for type: ${eventType}`);
    }

    // Validate properties using the event's schema
    const validatedProperties = matchingEvent.schema.parse(
      awsEvent.detail.properties,
    );

    await callback({
      type: eventType,
      properties: validatedProperties,
      metadata: awsEvent.detail.metadata,
    } as EventPayload<E>);
  };
}
