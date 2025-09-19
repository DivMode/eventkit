/**
 * EventKit Standalone Example
 *
 * This example shows how to use EventKit as a standalone npm package
 * without SST infrastructure. Perfect for Lambda functions, containers,
 * or any Node.js application that needs type-safe EventBridge integration.
 *
 * Prerequisites:
 * 1. Set environment variables:
 *    - EVENTKIT_BUS_NAME="your-event-bus-name"
 *    - AWS_REGION="us-east-1" (optional)
 *    - AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, or IAM role)
 *
 * 2. Install dependencies:
 *    npm install eventkit zod @aws-sdk/client-eventbridge
 */

import { z } from "zod";
import { createEventBus, Event } from "../src/runtime/index.js";

// =============================================================================
// Event Definitions
// =============================================================================

// Define your events with full type safety
export const OrderCreated = new Event({
  name: "order.created",
  source: "ecommerce-api",
  bus: createEventBus, // Lazy initialization - only created when publishing
  schema: z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
    currency: z.string().default("USD"),
    items: z.array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        price: z.number(),
      }),
    ),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
  }),
});

export const PaymentProcessed = new Event({
  name: "payment.processed",
  source: "payment-service",
  bus: createEventBus,
  schema: z.object({
    paymentId: z.string(),
    orderId: z.string(),
    amount: z.number(),
    method: z.enum(["card", "bank", "crypto"]),
    status: z.enum(["success", "failed", "pending"]),
  }),
});

// =============================================================================
// Pattern Generation (Works Without Configuration)
// =============================================================================

// Generate EventBridge patterns for infrastructure
export const highValueOrderPattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }],
  customerTier: ["premium", "enterprise"],
});

export const enterpriseOrderPattern = OrderCreated.pattern({
  customerTier: ["enterprise"],
  items: [{ exists: true }],
});

export const failedPaymentPattern = PaymentProcessed.pattern({
  status: ["failed"],
});

// Multi-event patterns (using only common fields)
export const criticalEventsPattern = Event.computePattern(
  [OrderCreated, PaymentProcessed],
  {
    amount: [{ numeric: [">", 5000] }], // Common field between both events
  },
);

// =============================================================================
// Event Publishing (Requires Configuration)
// =============================================================================

async function publishOrderExample() {
  try {
    // This will use EVENTKIT_BUS_NAME from environment
    const response = await OrderCreated.publish({
      orderId: "ORDER-123",
      customerId: "CUSTOMER-456",
      amount: 1500,
      currency: "USD",
      items: [
        {
          productId: "PRODUCT-789",
          quantity: 2,
          price: 750,
        },
      ],
      customerTier: "premium",
    });

    console.log("Order event published:", response.Entries?.[0]?.EventId);
  } catch (error) {
    console.error("Failed to publish order:", error);
  }
}

async function publishPaymentExample() {
  try {
    const response = await PaymentProcessed.publish({
      paymentId: "PAYMENT-123",
      orderId: "ORDER-123",
      amount: 1500,
      method: "card",
      status: "success",
    });

    console.log("Payment event published:", response.Entries?.[0]?.EventId);
  } catch (error) {
    console.error("Failed to publish payment:", error);
  }
}

// =============================================================================
// Type Extraction
// =============================================================================

// Extract types from events for use elsewhere
export type OrderData = z.infer<typeof OrderCreated.schema>;
export type PaymentData = z.infer<typeof PaymentProcessed.schema>;

// Filter types for pattern generation
export type OrderFilter = import("../src/runtime/index.js").FilterFor<
  typeof OrderCreated
>;
export type PaymentFilter = import("../src/runtime/index.js").FilterFor<
  typeof PaymentProcessed
>;

// =============================================================================
// Usage Examples
// =============================================================================

async function main() {
  console.log("EventKit Standalone Example");
  console.log("===========================");

  // 1. Pattern generation (works without configuration)
  console.log("\n1. Generated EventBridge Patterns:");
  console.log(
    "High-value orders:",
    JSON.stringify(highValueOrderPattern, null, 2),
  );
  console.log(
    "Failed payments:",
    JSON.stringify(failedPaymentPattern, null, 2),
  );

  // 2. Schema validation (works without configuration)
  console.log("\n2. Schema Validation:");
  try {
    const validOrder = OrderCreated.schema.parse({
      orderId: "ORDER-123",
      customerId: "CUSTOMER-456",
      amount: 1500,
      items: [],
      customerTier: "premium",
    });
    console.log("Valid order data:", validOrder);
  } catch (error) {
    console.error("Invalid order data:", error);
  }

  // 3. Event publishing (requires EVENTKIT_BUS_NAME)
  console.log("\n3. Event Publishing:");
  if (process.env.EVENTKIT_BUS_NAME) {
    await publishOrderExample();
    await publishPaymentExample();
  } else {
    console.log("Skipping - EVENTKIT_BUS_NAME not configured");
    console.log("Set EVENTKIT_BUS_NAME to enable publishing");
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
