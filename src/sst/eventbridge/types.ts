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
 */
export interface HttpTargetConfig {
  headerParameters?: Record<string, string>;
  pathParameterValues?: string[];
  queryStringParameters?: Record<string, string>;
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
