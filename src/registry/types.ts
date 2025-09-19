/**
 * Schema registry types and interfaces
 */

export interface SchemaRegistration {
  type: string;
  schema: string; // JSON Schema as string
  version?: string;
  description?: string;
  tags?: Record<string, string>;
}

export interface SchemaRegistrationResult {
  success: boolean;
  schemaId?: string;
  version?: string;
  error?: string;
}

export interface SchemaRecord {
  type: string;
  schema: string;
  version: string;
  registeredAt: number;
  description?: string;
  tags?: Record<string, string>;
  checksum?: string;
}

export interface EventBridgeRegistryConfig {
  registryName: string;
  region?: string;
  autoRegister?: boolean;
  enableVersioning?: boolean;
  tagPrefix?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}