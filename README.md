# EventKit

**Type-safe AWS EventBridge patterns from Zod schemas**

[![npm version](https://img.shields.io/npm/v/@divmode/eventkit.svg)](https://www.npmjs.com/package/@divmode/eventkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![AWS EventBridge](https://img.shields.io/badge/AWS-EventBridge-orange.svg)](https://aws.amazon.com/eventbridge/)

Generate type-safe AWS EventBridge patterns with zero runtime overhead. Transform your existing Zod schemas into EventBridge rules with complete TypeScript safety and IntelliSense support.

## 📚 Table of Contents

- [Key Features](#-key-features)
- [Why EventKit?](#-why-eventkit)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Publishing Events](#-publishing-events)
- [Pattern Generation](#-pattern-generation)
- [Advanced Usage](#-advanced-usage)
- [Utility Functions](#-utility-functions)
- [CLI Tools](#-cli-tools)
- [API Reference](#-api-reference)
- [Examples](#-examples)
- [Contributing](#-contributing)

## ✨ Key Features

- **🔒 Complete Type Safety** - Full TypeScript IntelliSense for EventBridge operators
- **⚡ Zero Runtime Overhead** - All validation happens at compile time
- **🌍 Universal Compatibility** - Works with AWS SDK, CDK, Terraform, SST, any tool
- **🎯 100% EventBridge Compliance** - Supports all official AWS EventBridge operators
- **📋 AWS Schema Registry Integration** - Auto-discover and sync schemas with EventBridge
- **🚀 SST Infrastructure Helpers** - First-class support for SST with type-safe infrastructure utilities

## 🤔 Why EventKit?

**Problem:** EventBridge patterns are complex JSON structures that are error-prone and lack type safety.

```typescript
// ❌ Error-prone, no IntelliSense, runtime failures
const pattern = {
  detail: {
    properties: {
      amout: [{ numeric: [">", 1000] }], // Typo!
      status: ["PENDING"], // Wrong enum value!
    },
  },
};
```

**Solution:** Generate patterns from your existing Zod schemas with full type safety.

```typescript
// ✅ Type-safe, IntelliSense, compile-time validation
const pattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }], // ✅ Correct field name
  status: ["pending"], // ✅ Validated enum value
});
```

## 📦 Installation

```bash
npm install @divmode/eventkit zod
# or
yarn add @divmode/eventkit zod
# or
bun add @divmode/eventkit zod
```

## 🚀 Quick Start

### 1. Define Events

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { z } from "zod";

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: () =>
    new Bus({
      name: "my-event-bus",
      EventBridge: new EventBridgeClient(),
    }),
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
  }),
});
```

### 2. Generate Type-Safe Patterns

```typescript
const pattern = OrderCreated.pattern({
  orderId: [{ prefix: "ORDER-" }], // ✅ String operators
  amount: [{ numeric: [">", 1000] }], // ✅ Numeric operators
  customerTier: ["premium", "enterprise"], // ✅ Enum validation
});

// Use with any infrastructure tool (AWS SDK, CDK, Terraform, SST)
```

### 3. Publish Events

```typescript
// Single event
await OrderCreated.publish({
  orderId: "ORDER-123",
  amount: 1500,
  customerTier: "premium",
});

// Batch events (automatic chunking)
await OrderCreated.publish([
  { orderId: "1", amount: 100, customerTier: "basic" },
  { orderId: "2", amount: 200, customerTier: "premium" },
]);
```

### 4. Extract Types & Validate

```typescript
// Extract schema types
type OrderData = z.infer<typeof OrderCreated.schema>;

// Validate incoming events
const parsed = OrderCreated.schema.parse(event.detail.properties);
```

### ⚠️ EventBridge Rules → HTTP API Destinations

When EventBridge rules send to HTTP destinations (Cloudflare Queue, webhooks), `schema.parse()` fails with `"expected number, received string"` because HTTP serialization converts numbers to strings. Use `z.coerce.number()`:

```typescript
// ✅ CORRECT - Use z.coerce.number() for HTTP destinations
const OrderCreated = new Event({
  schema: z.object({
    amount: z.coerce.number(), // Handles "1500" → 1500
    timestamp: z.coerce.number(), // HTTP serialization safe
  }),
});

// ❌ WRONG - Will fail in consumer
const BadEvent = new Event({
  schema: z.object({
    amount: z.number(), // 💥 Gets "1500" string, expects number
  }),
});
```

## ⚙️ Configuration

EventKit gives you full control over EventBridge client configuration. Pattern generation and type safety work without any configuration - bus configuration is only needed when publishing events.

### SST Projects

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Resource } from "sst";

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: () =>
    new Bus({
      name: Resource.Bus.name, // SST Resource
      EventBridge: new EventBridgeClient(),
    }),
  schema: OrderSchema,
});
```

### Standalone Usage

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: () =>
    new Bus({
      name: "my-event-bus", // Explicit bus name
      EventBridge: new EventBridgeClient({
        region: "us-east-1",
        maxAttempts: 3,
      }),
    }),
  schema: OrderSchema,
});
```

### Multiple Buses

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

// Different clients for different services
const orderClient = new EventBridgeClient({ region: "us-east-1" });
const analyticsClient = new EventBridgeClient({ region: "eu-west-1" });

const orderBus = () => new Bus({ name: "orders", EventBridge: orderClient });
const analyticsBus = () => new Bus({ name: "analytics", EventBridge: analyticsClient });

const OrderCreated = new Event({ bus: orderBus /* ... */ });
const UserActivity = new Event({ bus: analyticsBus /* ... */ });
```

## 🚀 Publishing Events

### Type-Safe Publishing

EventKit provides complete type safety for event publishing with full IntelliSense support and compile-time validation.

```typescript
// Single event - fully typed and validated
await OrderCreated.publish({
  orderId: "ORDER-123", // ✅ TypeScript enforces string type
  amount: 1500, // ✅ TypeScript enforces number type
  customerTier: "premium", // ✅ TypeScript enforces enum values
});

// ❌ TypeScript errors - caught at compile time
await OrderCreated.publish({
  orderId: 123, // ❌ Error: Type 'number' is not assignable to type 'string'
  amount: "1500", // ❌ Error: Type 'string' is not assignable to type 'number'
  customerTier: "gold", // ❌ Error: Argument not assignable to parameter of type '"basic" | "premium" | "enterprise"'
  invalidField: "value", // ❌ Error: Object literal may only specify known properties
});

// Batch events (automatically chunked and optimized)
await OrderCreated.publish([
  { orderId: "1", amount: 100, customerTier: "basic" }, // ✅ All types validated
  { orderId: "2", amount: 200, customerTier: "premium" }, // ✅ IntelliSense autocomplete
  { orderId: "3", amount: 300, customerTier: "enterprise" }, // ✅ Enum validation
]);
```

### Advanced Publishing Patterns

**Transaction Pattern** - Only publish if database succeeds

```typescript
const events = [];
await db.transaction(async (tx) => {
  const order = await tx.insert(orders).values(orderData);
  events.push(OrderCreated.create(order));

  const payment = await tx.insert(payments).values(paymentData);
  events.push(PaymentProcessed.create(payment));
});
// Events only sent if transaction commits
await OrderCreated.publish(events);
```

**Conditional Collection**

```typescript
const events = [];
if (shouldNotifyUser) {
  events.push(UserNotified.create({ userId: "123" }));
}
if (shouldUpdateInventory) {
  events.push(InventoryUpdated.create({ sku: "ABC", quantity: 5 }));
}
if (events.length > 0) {
  await UserNotified.publish(events);
}
```

**Error Recovery**

```typescript
const failedEvents = [];
for (const order of orders) {
  try {
    await OrderCreated.publish(order);
  } catch (error) {
    failedEvents.push(OrderCreated.create(order));
  }
}
// Retry failed events later
if (failedEvents.length > 0) {
  await OrderCreated.publish(failedEvents);
}
```

### publish() vs create()

- **`publish(data)`** - Validates and immediately sends to EventBridge
- **`create(data)`** - Validates and returns event entry for deferred sending

**Automatic Chunking Features:**

- Smart batching at 10 events per request (AWS limit)
- Size management for 256KB payload limit
- Parallel processing for maximum throughput
- Zero configuration required

## 📝 Pattern Generation

Generate type-safe EventBridge patterns from your Zod schemas:

```typescript
// Single event patterns
const pattern = OrderCreated.pattern({
  orderId: [{ prefix: "ORDER-" }], // String operators
  amount: [{ numeric: [">", 1000] }], // Numeric operators
  customerTier: ["premium", "enterprise"], // Enum validation
});

// Multi-event patterns
const multiPattern = Event.computePattern([OrderCreated, OrderUpdated], {
  $or: [{ status: ["urgent"] }, { amount: [{ numeric: [">", 10000] }] }],
});
```

### Use with Any Infrastructure Tool

**AWS SDK**

```typescript
import { PutRuleCommand } from "@aws-sdk/client-eventbridge";

await client.send(
  new PutRuleCommand({
    Name: "HighValueOrders",
    EventPattern: JSON.stringify(pattern),
  }),
);
```

**AWS CDK**

```typescript
import { Rule } from "aws-cdk-lib/aws-events";

new Rule(this, "HighValueOrders", {
  eventPattern: pattern,
  targets: [new SqsQueue(myQueue)],
});
```

**Terraform**

```hcl
resource "aws_cloudwatch_event_rule" "high_value_orders" {
  name          = "HighValueOrders"
  event_pattern = jsonencode(${generated_pattern})
}
```

**📋 [Complete operator reference →](./EVENTBRIDGE-OPERATORS.md)**

## 🏗️ Advanced Usage

### Multi-Bus Architecture

EventKit supports multiple EventBridge buses for service isolation:

```typescript
const OrderCreated = new Event({
  bus: () => new Bus({ name: "order-service-bus", EventBridge: orderClient }),
  // ...
});

const PaymentProcessed = new Event({
  bus: () => new Bus({ name: "payment-service-bus", EventBridge: paymentClient }),
  // ...
});

// ✅ Same bus events can be batched together
await OrderCreated.publish([
  OrderCreated.create({ orderId: "123" }),
  OrderUpdated.create({ orderId: "123", status: "processing" }),
]);

// ❌ Different bus events cannot be mixed
// This throws an error:
await OrderCreated.publish([
  OrderCreated.create({ orderId: "123" }),
  PaymentProcessed.create({ paymentId: "456" }), // Different bus!
]);
```

### Cross-Workspace Usage

The lazy bus pattern enables Events to be imported anywhere without AWS setup:

```typescript
// packages/core/events.ts - Define once
export const OrderCreated = new Event({
  name: "order.created",
  bus: () => new Bus({ ... }), // Lazy factory
  schema: z.object({ orderId: z.string(), amount: z.number() })
});

// packages/workers/handler.ts - Validate incoming events
import { OrderCreated } from "@company/core/events";

const order = OrderCreated.schema.parse(message.body);

// infra/rules.ts - Pattern generation (no AWS needed)
const pattern = OrderCreated.pattern({ amount: [{ numeric: [">", 1000] }] });
```

### Event Handlers

Create type-safe Lambda handlers:

```typescript
import { createEventHandler } from "@divmode/eventkit/runtime";

export const handler = createEventHandler([OrderCreated, OrderUpdated], async (event) => {
  switch (event.type) {
    case "order.created":
      // event.properties is fully typed!
      const { orderId, amount } = event.properties;
      await processNewOrder({ orderId, amount });
      break;
    case "order.updated":
      await updateOrder(event.properties);
      break;
  }
});
```

### SST Integration

EventKit includes special infrastructure helpers for [SST](https://sst.dev) projects that provide seamless integration with SST's resource system and type-safe infrastructure-as-code patterns.

#### Why SST Integration?

- **🔗 Resource Wiring** - Automatically connect EventBridge rules to SST resources
- **🏗️ Infrastructure as Code** - Define event rules alongside your application code
- **🎯 Type Safety** - Full TypeScript support for event filtering and transformations
- **⚡ Zero Configuration** - Works with SST's resource discovery out of the box
- **🔄 Hot Reloading** - Infrastructure changes update during development

#### Creating Event Rules

```typescript
import { createEventRule } from "@divmode/eventkit/sst";
import { OrderCreated, OrderUpdated } from "./events";

// Single event rule with type-safe filtering
const highValueOrderRule = createEventRule(OrderCreated, {
  name: "ProcessHighValueOrders",
  bus: myEventBus, // SST Bus resource
  filter: {
    amount: [{ numeric: [">", 1000] }], // ✅ Fully typed filters
    customerTier: ["premium", "enterprise"], // ✅ Enum validation
  },
  target: {
    destination: processingQueue, // SST Queue resource
    transform: (event) => ({
      orderId: event.orderId, // ✅ Full type safety
      amount: event.amount, // ✅ IntelliSense support
      priority: "high", // ✅ Add custom fields
    }),
  },
});

// Multi-event rule
const orderProcessingRule = createEventRule([OrderCreated, OrderUpdated], {
  name: "OrderWorkflow",
  bus: myEventBus,
  filter: {
    $or: [{ status: ["pending"] }, { amount: [{ numeric: [">", 500] }] }],
  },
  target: {
    destination: workflowFunction, // SST Function resource
    // Transform is optional - sends full event by default
  },
});
```

#### Advanced SST Patterns

**Multiple Targets per Rule**

```typescript
createEventRule(OrderCreated, {
  name: "OrderCreatedFanout",
  bus: orderBus,
  filter: { customerTier: ["enterprise"] },
  targets: [
    {
      destination: analyticsQueue,
      transform: (event) => ({ customerId: event.customerId, amount: event.amount }),
    },
    {
      destination: notificationService,
      transform: (event) => ({ orderId: event.orderId, email: event.customerEmail }),
    },
    {
      destination: auditFunction,
      // Send full event without transformation
    },
  ],
});
```

**Cross-Stack Event Rules**

```typescript
// In your infrastructure stack
export const orderBus = new sst.aws.Bus("OrderBus");
export const processingQueue = new sst.aws.Queue("ProcessingQueue");

// In your application stack
createEventRule(OrderCreated, {
  name: "CrossStackRule",
  bus: orderBus, // Reference from infrastructure stack
  filter: { amount: [{ numeric: [">", 10000] }] },
  target: {
    destination: processingQueue, // Reference from infrastructure stack
  },
});
```

**Note:** SST integration requires SST v3+ and works seamlessly with EventKit's standalone usage patterns.

## 🔧 EventBridge Query String Parameters

Pass event data as URL query parameters to EventBridge API destinations.

### ⚠️ Important: AWS Sends Empty Strings for Missing Values

EventBridge sends ALL mapped query parameters, even when values don't exist. Missing JSON paths become empty strings:

```
// Event has: { params: { page: 1, limit: 10 } }
// EventBridge sends: ?query=&page=1&limit=10  (empty query param included)
```

**Your receiving endpoint MUST filter empty params:**

```python
# Python (FastAPI)
params = {k: v for k, v in request.query_params.items() if v}
```

```typescript
// JavaScript/TypeScript
const params = Object.fromEntries(Object.entries(req.query).filter(([_, v]) => v));
```

### Complete Example

**Step 1: Define Event with params schema**

```typescript
import { Event, Bus } from "@divmode/eventkit/runtime";
import { z } from "zod";

const SearchParams = z.object({
  query: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const SearchRequested = new Event({
  name: "search.requested",
  source: "my-service",
  bus: () => new Bus({ name: "my-bus", EventBridge: client }),
  schema: z.object({
    params: SearchParams,
    timestamp: z.number(),
  }),
});
```

**Step 2: Create EventBridge rule (SST)**

```typescript
import { createEventRule } from "@divmode/eventkit/sst";

createEventRule(SearchRequested, {
  name: "SearchRule",
  bus: myBus,
  target: {
    destination: apiDestination,
    roleArn: role.arn,
    httpTarget: {
      // "params" = field name in schema, auto-generates JSON path mappings
      queryStringParameters: "params",
    },
  },
});
```

**Step 3: Filter empty params in your endpoint**

```python
# Python (FastAPI)
@app.get("/search")
async def search(request: Request):
    # Filter out empty string values from EventBridge
    params = {k: v for k, v in request.query_params.items() if v}
    # Result: { "page": "1", "limit": "10" }
```

### Alternative: Put Params in Body

If you don't want to deal with empty query params, use `transform` to send params in the request body instead:

```typescript
createEventRule(MyEvent, {
  target: {
    transform: (event) => ({
      params: event.params, // Only actual values, no empty strings
    }),
  },
});
```

### schemaToJsonPaths Utility

For CDK, Terraform, or manual configurations, use `schemaToJsonPaths` to generate the mappings:

```typescript
import { schemaToJsonPaths } from "@divmode/eventkit";

const QueryParams = z.object({
  page: z.number(),
  limit: z.number(),
  search: z.string().optional(),
});

schemaToJsonPaths(QueryParams, "params");
// Result: {
//   page: "$.detail.params.page",
//   limit: "$.detail.params.limit",
//   search: "$.detail.params.search"
// }
```

**AWS CDK example:**

```typescript
new Rule(this, "MyRule", {
  targets: [
    new ApiDestination(dest, {
      httpParameters: {
        queryStringParameters: schemaToJsonPaths(MySchema, "params"),
      },
    }),
  ],
});
```

## 🔧 CLI Tools

### Schema Registry Integration

EventKit automatically discovers and syncs your events with AWS EventBridge Schema Registry:

```bash
# Discover and register all schemas
npx @divmode/eventkit register-schemas

# Sync schemas (add new, update changed, remove orphaned)
npx @divmode/eventkit sync-schemas

# Keep orphaned schemas
npx @divmode/eventkit sync-schemas --no-delete
```

Your Event definitions become the source of truth for your event contracts across teams.

## 🎯 API Reference

### Event Class

**`pattern(filter?)`** - Generate EventBridge pattern from schema
Returns EventBridge-compatible JSON for creating rules

**`publish(data)`** - Validate and send events to EventBridge

- `publish(eventData)` - Single event
- `publish([data1, data2])` - Batch of same type
- `publish([entry1, entry2])` - Mixed types from `create()` (same bus only)

**`create(properties)`** - Create event entry for deferred sending
Validates against schema, returns PutEventsRequestEntry data structure

**`Event.computePattern(events[], filter?)`** - Multi-event patterns
Generate single pattern matching multiple event types

### Type Helpers

```typescript
// Extract filter type from Event
type OrderFilter = FilterFor<typeof OrderCreated>;

// Extract schema type from Event
type OrderSchema = SchemaFor<typeof OrderCreated>;
```

## 📋 Requirements

- **Node.js** >= 18.0.0
- **TypeScript** >= 4.9.0
- **Zod** >= 4.0.0 (peer dependency)

## 🌟 Examples

### Complete E-commerce Example

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { z } from "zod";

// Define events
const OrderCreated = new Event({
  name: "order.created",
  source: "ecommerce-api",
  bus: () =>
    new Bus({
      name: "ecommerce-bus",
      EventBridge: new EventBridgeClient(),
    }),
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
    items: z.array(z.string()),
  }),
});

// Business rules as type-safe patterns
const highValuePattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }],
  customerTier: ["premium", "enterprise"],
});

const enterprisePattern = OrderCreated.pattern({
  customerTier: ["enterprise"],
  items: [{ exists: true }],
});

// Use with any infrastructure tool
await createEventBridgeRule("HighValueOrders", highValuePattern);
await createEventBridgeRule("EnterpriseOrders", enterprisePattern);
```

## 🤝 Contributing

EventKit is open source! Contributions are welcome.

- **Issues**: [github.com/divmode/eventkit/issues](https://github.com/divmode/eventkit/issues)
- **Pull Requests**: [github.com/divmode/eventkit/pulls](https://github.com/divmode/eventkit/pulls)

## 📄 License

MIT © [Divmode](https://github.com/divmode)

---

**Ready to build type-safe, scalable event-driven architectures!** 🚀
