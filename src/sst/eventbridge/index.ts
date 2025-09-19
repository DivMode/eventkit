/**
 * EventBridge utilities for event system infrastructure
 *
 * Complete EventBridge toolkit providing:
 * - Event rule creation with type-safe filtering
 * - Input transformation for event data
 * - AWS EventBridge constants and defaults
 * - Type-safe infrastructure types
 *
 * @example
 * ```typescript
 * import { createEventRule, createTransform } from "@divmode/eventkit/sst";
 *
 * // Create EventBridge rule
 * const { rule, target } = createEventRule(DomainDetected, {
 *   name: "ProcessDomains",
 *   bus: { name: "my-event-bus" },
 *   target: {
 *     destination: { arn: "queue-arn" },
 *     transform: (event) => ({ body: event })
 *   }
 * });
 * ```
 */

// Constants
export {
  AWS_EVENTBRIDGE_LIMITS,
  DEFAULT_API_HTTP_TARGET,
  DEFAULT_RETRY_POLICY,
} from "./constants";
// Rule creation utilities
export { createEventRule } from "./rules";
// Transform utilities
export { createTransform } from "./transform";

// Types
export type {
  EventBridgeDestination,
  EventRuleConfig,
  EventRuleResult,
  HttpTargetConfig,
  InputTransformerConfig,
  PulumiOutput,
  RetryPolicyConfig,
  TransformFunction,
} from "./types";
