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
 * Works in multiple contexts with version-agnostic SST support:
 * - Environment variable: EVENTKIT_BUS_NAME (fastest, most reliable)
 * - SST linkable resources: SST_RESOURCE_Bus_name (automatic in SST runtime)
 * - SST projects: Uses Resource.Bus.name dynamically (any SST v3+)
 * - Standalone: Manual configuration via environment variables
 *
 * Priority order:
 * 1. EVENTKIT_BUS_NAME environment variable
 * 2. SST_RESOURCE_Bus_name (SST linkable resource)
 * 3. Dynamic SST Resource detection (safe require-based, version-agnostic)
 *
 * @throws {Error} If bus name or AWS credentials are not configured
 * @returns {Bus} Configured EventBridge bus instance
 */
export function createEventBus(): Bus {
  // Check for explicit bus name first (fastest and most reliable path)
  // Supports both manual config and SST linkable resources via env vars
  const explicitBusName =
    process.env.EVENTKIT_BUS_NAME ||
    process.env.SST_RESOURCE_Bus_name;

  if (explicitBusName) {
    validateAwsCredentials();
    const region = process.env.AWS_REGION;
    return new Bus({
      name: explicitBusName,
      EventBridge: new EventBridgeClient(region ? { region } : {}),
    });
  }

  // Try SST context only if no explicit bus name (for monorepo usage)
  // Use safe dynamic require to avoid version conflicts
  try {
    // Safely attempt to load SST without eval()
    // This prevents bundlers from including SST while avoiding security risks
    let sstModule: any;
    try {
      // Use dynamic require via module resolution
      const moduleName = 'sst';
      sstModule = require(moduleName);
    } catch (requireError) {
      // SST not available - this is expected in non-SST environments
      throw new Error(`SST module not available: ${requireError instanceof Error ? requireError.message : String(requireError)}`);
    }

    // Handle different SST versions and structures safely
    const Resource = sstModule?.Resource;
    const busName = Resource?.Bus?.name;

    if (busName && typeof busName === 'string') {
      // In SST context, AWS credentials are typically handled by the framework
      return new Bus({
        name: busName,
        EventBridge: new EventBridgeClient({}),
      });
    } else {
      throw new Error("SST Resource.Bus.name not found or invalid");
    }
  } catch (sstError) {
    // SST not available or Resource.Bus not configured - provide helpful error
    throw new Error(
      "EventKit bus configuration required. Either:\n" +
        "1. Set EVENTKIT_BUS_NAME environment variable:\n" +
        "   export EVENTKIT_BUS_NAME='my-event-bus'\n\n" +
        "2. Use in SST context with Resource.Bus configured\n\n" +
        "3. For SST projects, ensure 'sst dev' is running or deploy first\n\n" +
        "Note: Pattern generation works without configuration - only publishing requires bus setup.\n" +
        `Debug info: ${sstError instanceof Error ? sstError.message : String(sstError)}`,
    );
  }
}
