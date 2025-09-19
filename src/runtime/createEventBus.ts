import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Bus } from "./Bus";

/**
 * Check if AWS credentials are available via environment variables
 * Returns helpful error message if missing
 */
function validateAwsCredentials(): void {
  // Check for AWS credentials in environment
  const hasAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const hasSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const hasProfile = process.env.AWS_PROFILE;
  const hasRole = process.env.AWS_ROLE_ARN;
  const hasWebIdentityToken = process.env.AWS_WEB_IDENTITY_TOKEN_FILE;

  // If running in AWS environment (Lambda, EC2, ECS), credentials are provided automatically
  const inAwsEnvironment =
    process.env.AWS_EXECUTION_ENV || // Lambda
    process.env.AWS_REGION || // General AWS environment
    process.env.ECS_CONTAINER_METADATA_URI_V4 || // ECS
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI; // ECS

  if (inAwsEnvironment) {
    // Running in AWS - credentials should be available automatically
    return;
  }

  // Check for explicit credential configuration
  if (hasAccessKey && hasSecretKey) {
    return; // Environment variables provided
  }

  if (hasProfile) {
    return; // AWS profile configured
  }

  if (hasRole && hasWebIdentityToken) {
    return; // Web identity/OIDC token available
  }

  // No credentials found - provide helpful error
  throw new Error(
    "AWS credentials not found. For EventKit to publish events, configure credentials via:\n\n" +
      "1. Environment variables:\n" +
      "   AWS_ACCESS_KEY_ID=your-access-key\n" +
      "   AWS_SECRET_ACCESS_KEY=your-secret-key\n\n" +
      "2. AWS Profile:\n" +
      "   AWS_PROFILE=your-profile-name\n\n" +
      "3. IAM Role (in AWS environment):\n" +
      "   Automatically detected when running on AWS\n\n" +
      "4. Shared credentials file:\n" +
      "   ~/.aws/credentials\n\n" +
      "Note: Pattern generation works without credentials - only publishing requires AWS access.",
  );
}

/**
 * Universal EventBridge bus factory for EventKit
 *
 * Works in multiple contexts:
 * - SST projects: Uses Resource.Bus.name automatically
 * - Standalone: Uses EVENTKIT_BUS_NAME environment variable
 * - AWS environments: Validates credentials are available
 *
 * @throws {Error} If bus name or AWS credentials are not configured
 * @returns {Bus} Configured EventBridge bus instance
 */
export function createEventBus(): Bus {
  // Try SST context first (for monorepo usage)
  try {
    const { Resource } = require("sst");

    // In SST context, AWS credentials are typically handled by the framework
    return new Bus({
      name: Resource.Bus.name,
      EventBridge: new EventBridgeClient({}),
    });
  } catch (sstError) {
    // SST not available - fall back to environment variables
    const busName = process.env.EVENTKIT_BUS_NAME;

    if (!busName) {
      throw new Error(
        "EventKit bus configuration required. Either:\n" +
          "1. Use in SST context with Resource.Bus configured, or\n" +
          "2. Set EVENTKIT_BUS_NAME environment variable\n\n" +
          "Example: EVENTKIT_BUS_NAME='my-event-bus'\n\n" +
          "Note: Pattern generation works without configuration - only publishing requires bus setup.",
      );
    }

    // Validate AWS credentials before creating client
    validateAwsCredentials();

    const region = process.env.AWS_REGION;
    return new Bus({
      name: busName,
      EventBridge: new EventBridgeClient(region ? { region } : {}),
    });
  }
}
