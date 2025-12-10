import type * as aws from "@pulumi/aws";
import type { Output } from "@pulumi/pulumi";
import type { z } from "zod";
import type { Event, FilterFor, SchemaFor } from "../../runtime/Event";

// =============================================================================
// TYPE DEFINITIONS FOR EVENTBRIDGE INFRASTRUCTURE
// =============================================================================

/**
 * Pulumi Output wrapper for async values in infrastructure
 */
export type PulumiOutput<T> = Output<T> | T;

/**
 * EventBridge destination types
 */
export interface EventBridgeDestination {
  arn: PulumiOutput<string>;
  url?: PulumiOutput<string>; // For SQS queues
}

/**
 * HTTP target configuration for API destinations
 *
 * queryStringParameters accepts either:
 * - string: Field name in event schema (auto-generates JSON path mappings)
 * - Record<string, string>: Explicit JSON path mappings { key: "$.detail.path" }
 *
 * ⚠️ NOTE: EventBridge sends ALL mapped query params, even when values don't exist.
 * AWS returns empty string for missing JSON paths: `?foo=&bar=&actualParam=value`
 *
 * Solutions:
 * 1. Filter empty params on receiving end: `{k: v for k, v in params.items() if v}`
 * 2. Use `transform` to put params in body instead
 *
 * @example
 * ```typescript
 * httpTarget: {
 *   queryStringParameters: "params",  // Auto-resolved from schema
 * }
 *
 * // Or explicit mappings
 * httpTarget: {
 *   queryStringParameters: {
 *     id: "$.detail.id",
 *     status: "$.detail.status",
 *   },
 * }
 *
 * // Or use transform to put params in body
 * transform: (event) => ({ params: event.params }),
 * ```
 */
export interface HttpTargetConfig {
  headerParameters?: Record<string, string>;
  pathParameterValues?: string[];
  queryStringParameters?: string | Record<string, string>;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicyConfig {
  maximumRetryAttempts?: number;
  maximumEventAgeInSeconds?: number;
}

/**
 * Transform function type for event processing
 */
export type TransformFunction<E extends Event<string, z.ZodType>> = (
  event: SchemaFor<E>,
  system: { time: string; source: string },
) => Record<string, unknown>;

/**
 * Input transformer configuration for EventBridge
 */
export interface InputTransformerConfig {
  inputPaths: Record<string, string>;
  inputTemplate: string;
}

/**
 * Event rule configuration using Terminal pattern (single config object)
 * Supports both single and multiple events with type-safe filtering
 */
export interface EventRuleConfig<E extends Event<string, z.ZodType>> {
  name: string;
  bus: { name: PulumiOutput<string> };

  // Support single or multiple events
  events: E | E[];

  // Type-safe filter using Event's built-in types
  filter?: FilterFor<E>;
  description?: string;
  target?: {
    destination: EventBridgeDestination;
    roleArn?: PulumiOutput<string>;
    httpTarget?: HttpTargetConfig;
    dlq?: EventBridgeDestination;
    retryPolicy?: RetryPolicyConfig;
    transform?: TransformFunction<E>;
  };
}

/**
 * EventBridge return type for better clarity
 */
export interface EventRuleResult {
  rule: aws.cloudwatch.EventRule;
  target?: aws.cloudwatch.EventTarget;
  queuePolicy?: aws.sqs.QueuePolicy;
}
