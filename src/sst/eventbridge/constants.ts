/**
 * AWS EventBridge Constants and Defaults
 *
 * Centralized configuration for EventBridge infrastructure utilities.
 * These constants ensure consistent behavior across all EventBridge operations.
 */

/**
 * AWS EventBridge naming and validation constraints
 */
export const AWS_EVENTBRIDGE_LIMITS = {
  NAME_MAX_LENGTH: 64,
  NAME_PATTERN: /^[a-zA-Z0-9._-]+$/,
} as const;

/**
 * Default retry policy for EventBridge targets
 */
export const DEFAULT_RETRY_POLICY = {
  maximumRetryAttempts: 2,
  maximumEventAgeInSeconds: 3600, // 1 hour
} as const;

/**
 * Default HTTP headers for API destinations
 */
export const DEFAULT_API_HTTP_TARGET = {
  headerParameters: {
    "Content-Type": "application/json",
  },
} as const;