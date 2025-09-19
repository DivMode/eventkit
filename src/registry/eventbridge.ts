import type {
  EventBridgeRegistryConfig,
  SchemaRecord,
  SchemaRegistration,
  SchemaRegistrationResult,
} from "./types";

/**
 * Global EventBridge Schema Registry configuration
 */
let globalRegistryConfig: EventBridgeRegistryConfig | null = null;

/**
 * Schema Registry client cache
 */
let cachedSchemaClient: any = null;

/**
 * Get EventBridge Schema Registry client instance
 */
async function getSchemaClient() {
  if (!cachedSchemaClient) {
    const config = getRegistryConfig();

    try {
      const { SchemasClient } = await import("@aws-sdk/client-schemas");

      cachedSchemaClient = new SchemasClient({
        region: config.region,
        credentials: config.credentials,
      });
    } catch (error) {
      throw new SchemaRegistryError(
        "AWS SDK not found. Install @aws-sdk/client-schemas to use EventBridge Schema Registry.",
        "MISSING_DEPENDENCY",
        error instanceof Error ? error : undefined,
      );
    }
  }
  return cachedSchemaClient;
}

/**
 * EventBridge Schema Registry namespace with direct implementation
 */
export namespace schemaRegistry {
  /**
   * Configure EventBridge Schema Registry
   */
  export function configure(config: EventBridgeRegistryConfig): void {
    globalRegistryConfig = {
      region: "us-east-1",
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  export function getConfig(): EventBridgeRegistryConfig {
    if (!globalRegistryConfig) {
      // Try to load from environment variables
      const envConfig = createRegistryConfigFromEnv();
      if (envConfig) {
        globalRegistryConfig = envConfig;
      } else {
        throw new Error(
          "Schema Registry not configured. Call schemaRegistry.configure() or set environment variables.",
        );
      }
    }
    return globalRegistryConfig;
  }

  /**
   * Check if Schema Registry is configured
   */
  export function isConfigured(): boolean {
    return globalRegistryConfig !== null || !!process.env.SCHEMA_REGISTRY_NAME;
  }

  /**
   * Register a schema with EventBridge Schema Registry
   */
  export async function registerSchema(
    schema: SchemaRegistration,
  ): Promise<SchemaRegistrationResult> {
    try {
      const client = await getSchemaClient();
      const config = getRegistryConfig();
      const {
        CreateSchemaCommand,
        UpdateSchemaCommand,
        DescribeSchemaCommand,
      } = await import("@aws-sdk/client-schemas");

      // Check if schema already exists
      let schemaExists = false;
      try {
        await client.send(
          new DescribeSchemaCommand({
            RegistryName: config.registryName,
            SchemaName: schema.type,
          }),
        );
        schemaExists = true;
      } catch (error) {
        // Schema doesn't exist, which is fine for new schemas
      }

      if (schemaExists) {
        // Update existing schema
        const command = new UpdateSchemaCommand({
          RegistryName: config.registryName,
          SchemaName: schema.type,
          Content: schema.schema,
          Description: schema.description,
          Type: "JSONSchemaDraft4",
        });

        const response = await client.send(command);

        return {
          success: true,
          schemaId: response.SchemaArn,
          version: response.SchemaVersion,
        };
      } else {
        // Create new schema
        const command = new CreateSchemaCommand({
          RegistryName: config.registryName,
          SchemaName: schema.type,
          Content: schema.schema,
          Description: schema.description,
          Type: "JSONSchemaDraft4",
          Tags: schema.tags,
        });

        const response = await client.send(command);

        return {
          success: true,
          schemaId: response.SchemaArn,
          version: response.SchemaVersion,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get a schema from EventBridge Schema Registry
   */
  export async function getSchema(
    type: string,
    version?: string,
  ): Promise<SchemaRecord | null> {
    try {
      const client = await getSchemaClient();
      const config = getRegistryConfig();
      const { DescribeSchemaCommand } = await import("@aws-sdk/client-schemas");

      const command = new DescribeSchemaCommand({
        RegistryName: config.registryName,
        SchemaName: type,
        SchemaVersion: version,
      });

      const response = await client.send(command);

      if (!response.Content) {
        return null;
      }

      return {
        type: response.SchemaName!,
        schema: response.Content,
        version: response.SchemaVersion!,
        registeredAt: response.LastModified
          ? response.LastModified.getTime()
          : Date.now(),
        description: response.Description,
        tags: response.Tags,
      };
    } catch (error) {
      // Schema not found or other error
      return null;
    }
  }

  /**
   * List all schemas in EventBridge Schema Registry
   */
  export async function listSchemas(): Promise<SchemaRecord[]> {
    try {
      const client = await getSchemaClient();
      const config = getRegistryConfig();
      const { ListSchemasCommand } = await import("@aws-sdk/client-schemas");

      const command = new ListSchemasCommand({
        RegistryName: config.registryName,
      });

      const response = await client.send(command);
      const schemas: SchemaRecord[] = [];

      if (response.Schemas) {
        for (const schema of response.Schemas) {
          if (schema.SchemaName) {
            // Get full schema details
            const fullSchema = await getSchema(schema.SchemaName);
            if (fullSchema) {
              schemas.push(fullSchema);
            }
          }
        }
      }

      return schemas;
    } catch (error) {
      throw new SchemaRegistryError(
        `Failed to list schemas: ${error instanceof Error ? error.message : String(error)}`,
        "LIST_FAILED",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Delete a schema from EventBridge Schema Registry
   */
  export async function deleteSchema(
    type: string,
    version?: string,
  ): Promise<void> {
    try {
      const client = await getSchemaClient();
      const config = getRegistryConfig();
      const { DeleteSchemaCommand } = await import("@aws-sdk/client-schemas");

      const command = new DeleteSchemaCommand({
        RegistryName: config.registryName,
        SchemaName: type,
      });

      await client.send(command);
    } catch (error) {
      throw new SchemaRegistryError(
        `Failed to delete schema: ${error instanceof Error ? error.message : String(error)}`,
        "DELETE_FAILED",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Check if Schema Registry is available
   */
  export async function isAvailable(): Promise<boolean> {
    try {
      const client = await getSchemaClient();
      const config = getRegistryConfig();
      const { DescribeRegistryCommand } = await import(
        "@aws-sdk/client-schemas"
      );

      const command = new DescribeRegistryCommand({
        RegistryName: config.registryName,
      });

      await client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Disconnect from Schema Registry (clears cached client)
   */
  export function disconnect(): void {
    cachedSchemaClient = null;
  }
}

/**
 * Custom error class for Schema Registry operations
 */
export class SchemaRegistryError extends Error {
  readonly code: string;
  readonly originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = "SchemaRegistryError";
    this.code = code;
    this.originalError = originalError;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SchemaRegistryError);
    }
  }
}

/**
 * Get registry configuration with fallback to global
 */
function getRegistryConfig(): EventBridgeRegistryConfig {
  return schemaRegistry.getConfig();
}

/**
 * Create configuration from environment variables
 */
function createRegistryConfigFromEnv(): EventBridgeRegistryConfig | null {
  const registryName = process.env.SCHEMA_REGISTRY_NAME;
  if (!registryName) {
    return null;
  }

  return {
    registryName,
    region:
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          sessionToken: process.env.AWS_SESSION_TOKEN,
        }
      : undefined,
  };
}

/**
 * Helper to configure Schema Registry from environment variables
 */
export function configureRegistryFromEnv(): void {
  const config = createRegistryConfigFromEnv();
  if (!config) {
    throw new Error("SCHEMA_REGISTRY_NAME environment variable is required");
  }
  schemaRegistry.configure(config);
}
