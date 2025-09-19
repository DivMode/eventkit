// Import AWS types for type annotations
import type * as _aws from "@pulumi/aws";
import type { z } from "zod";
import type { FilterFor } from "../../runtime/Event";
import { Event } from "../../runtime/Event";
import {
  AWS_EVENTBRIDGE_LIMITS,
  DEFAULT_API_HTTP_TARGET,
  DEFAULT_RETRY_POLICY,
} from "./constants";
import { createTransform } from "./transform";
import type {
  EventBridgeDestination,
  EventRuleConfig,
  EventRuleResult,
  PulumiOutput,
} from "./types";

// Global aws variable available in SST infrastructure context
declare const aws: typeof _aws;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate AWS resource name follows naming conventions
 */
function validateAwsResourceName(name: string): void {
  if (!name || name.length === 0) {
    throw new Error("Resource name cannot be empty");
  }

  if (name.length > AWS_EVENTBRIDGE_LIMITS.NAME_MAX_LENGTH) {
    throw new Error(
      `Resource name "${name}" exceeds ${AWS_EVENTBRIDGE_LIMITS.NAME_MAX_LENGTH} character limit`,
    );
  }

  if (!AWS_EVENTBRIDGE_LIMITS.NAME_PATTERN.test(name)) {
    throw new Error(
      `Resource name "${name}" contains invalid characters. Only letters, numbers, periods, hyphens, and underscores are allowed`,
    );
  }
}

/**
 * Detect ARN type from EventBridge destination
 */
function getArnType(arn: PulumiOutput<string>): "sqs" | "api" | "unknown" {
  if (typeof arn === "string") {
    if (arn.includes(":sqs:") && !arn.includes(":events:")) {
      return "sqs";
    }
    if (arn.includes("apidestinations")) {
      return "api";
    }
  }
  // For Pulumi Outputs, we can't analyze at build time
  return "unknown";
}

/**
 * Normalize events to array format for consistent processing
 */
function normalizeEvents<E extends Event<string, z.ZodType>>(
  events: E | E[],
): E[] {
  const eventArray = Array.isArray(events) ? events : [events];

  if (eventArray.length === 0) {
    throw new Error("At least one event must be provided");
  }

  return eventArray;
}

/**
 * Create EventBridge pattern from events and optional filter
 */
function createEventPattern<E extends Event<string, z.ZodType>>(
  events: E[],
  filter?: FilterFor<E>,
): Record<string, unknown> {
  return events.length === 1
    ? events[0]!.pattern(filter)
    : Event.computePattern(events, filter);
}

/**
 * Create EventBridge target with smart defaults
 */
function createRuleTarget<E extends Event<string, z.ZodType>>(
  config: EventRuleConfig<E>,
  rule: _aws.cloudwatch.EventRule,
  firstEvent: E,
): _aws.cloudwatch.EventTarget {
  if (!config.target) {
    throw new Error("Target configuration is required");
  }

  const target = config.target;
  const arnType = getArnType(target.destination.arn);

  // Apply smart defaults for API destinations
  const httpTarget =
    arnType === "api"
      ? target.httpTarget || DEFAULT_API_HTTP_TARGET
      : target.httpTarget;

  return new aws.cloudwatch.EventTarget(`${config.name}Target`, {
    rule: rule.name,
    eventBusName: config.bus.name,
    arn: target.destination.arn,
    targetId: `${config.name}Target`,
    roleArn: target.roleArn,
    httpTarget,
    deadLetterConfig: target.dlq ? { arn: target.dlq.arn } : undefined,
    retryPolicy: target.retryPolicy || DEFAULT_RETRY_POLICY,
    inputTransformer: target.transform
      ? createTransform(target.transform, firstEvent)
      : undefined,
  });
}

/**
 * Create SQS queue policy for EventBridge access
 */
function createQueuePolicy(
  name: string,
  rule: _aws.cloudwatch.EventRule,
  destination: EventBridgeDestination,
): _aws.sqs.QueuePolicy | undefined {
  const arnType = getArnType(destination.arn);

  if (arnType === "sqs" && destination.url) {
    return new aws.sqs.QueuePolicy(`${name}QueuePolicy`, {
      queueUrl: destination.url,
      policy: rule.arn.apply((ruleArn: string) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "events.amazonaws.com",
              },
              Action: "sqs:SendMessage",
              Resource: destination.arn,
              Condition: {
                ArnEquals: {
                  "aws:SourceArn": ruleArn,
                },
              },
            },
          ],
        }),
      ),
    });
  }

  return undefined;
}

// =============================================================================
// MAIN EXPORTED FUNCTIONS
// =============================================================================

/**
 * Create type-safe EventBridge rule with optional target
 *
 * Infrastructure helper using Terminal pattern with explicit event parameter
 * for perfect type inference. Uses global aws from SST v3 infrastructure context.
 *
 * @param events - Event or array of events to trigger on
 * @param config - Complete event rule configuration (without events)
 * @returns Object containing rule, target, and optional queue policy
 */
export function createEventRule<E extends Event<string, z.ZodType>>(
  events: E | E[],
  config: Omit<EventRuleConfig<E>, "events">,
): EventRuleResult {
  validateAwsResourceName(config.name);

  const eventArray = normalizeEvents(events);
  const pattern = createEventPattern(eventArray, config.filter);

  const rule = new aws.cloudwatch.EventRule(config.name, {
    eventBusName: config.bus.name,
    eventPattern: JSON.stringify(pattern),
    description: config.description,
  });

  if (!config.target) {
    return { rule };
  }

  const target = createRuleTarget(
    { ...config, events: eventArray },
    rule,
    eventArray[0]!,
  );
  const queuePolicy = createQueuePolicy(
    config.name,
    rule,
    config.target.destination,
  );

  return { rule, target, queuePolicy };
}
