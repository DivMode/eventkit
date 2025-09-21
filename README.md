# EventKit

**Type-safe AWS EventBridge patterns from Zod schemas**

[![npm version](https://img.shields.io/npm/v/@divmode/eventkit.svg)](https://www.npmjs.com/package/@divmode/eventkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![AWS EventBridge](https://img.shields.io/badge/AWS-EventBridge-orange.svg)](https://aws.amazon.com/eventbridge/)

Generate type-safe AWS EventBridge patterns with zero runtime overhead. Transform your existing Zod schemas into EventBridge rules with complete TypeScript safety and IntelliSense support.

## ✨ Key Features

- **🔒 Complete Type Safety** - Full TypeScript IntelliSense for EventBridge operators
- **⚡ Zero Runtime Overhead** - All validation happens at compile time
- **🌍 Universal Compatibility** - Works with AWS SDK, CDK, Terraform, SST, any tool
- **🎯 100% EventBridge Compliance** - Supports all official AWS EventBridge operators
- **📋 AWS Schema Registry Integration** - Auto-discover and sync schemas with EventBridge
- **🚀 SST Infrastructure Helpers** - First-class support for SST with type-safe infrastructure utilities

## 📦 Installation

```bash
npm install @divmode/eventkit zod
# or
yarn add @divmode/eventkit zod
# or
bun add @divmode/eventkit zod
```

## ⚙️ Configuration

EventKit gives you full control over EventBridge client configuration:

### 🏗️ SST Projects
```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Resource } from "sst";

// YOU control the client configuration
const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION || "us-east-1",
  // Add any configuration you need
});

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: () => new Bus({
    name: Resource.Bus.name, // SST Resource
    EventBridge: eventBridgeClient,
  }),
  schema: z.object({ orderId: z.string() }),
});
```

### 🌍 Standalone Usage
```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";

// YOU control the client configuration
const eventBridgeClient = new EventBridgeClient({
  region: "us-east-1",
  maxAttempts: 3,
  // Any AWS SDK config
});

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: () => new Bus({
    name: "my-event-bus", // Explicit bus name
    EventBridge: eventBridgeClient,
  }),
  schema: z.object({ orderId: z.string() }),
});
```

### 🔧 Multiple Buses
```typescript
// Different clients for different buses
const mainBusClient = new EventBridgeClient({ region: "us-east-1" });
const analyticsBusClient = new EventBridgeClient({ region: "eu-west-1" });

const OrderCreated = new Event({
  bus: () => new Bus({ name: "main-bus", EventBridge: mainBusClient }),
  // ...
});

const UserActivity = new Event({
  bus: () => new Bus({ name: "analytics-bus", EventBridge: analyticsBusClient }),
  // ...
});
```

**📋 Note**: Pattern generation and type safety work without any configuration. Bus configuration is only needed when publishing events.

## 🚀 Quick Start

### 1. Define Events

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { z } from "zod";

// YOU control the client
const eventBridgeClient = new EventBridgeClient();

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: () => new Bus({
    name: "my-event-bus",
    EventBridge: eventBridgeClient,
  }),
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
  }),
});

// Benefits of explicit configuration:

// ✅ In workers/functions - validate incoming events
const parsed = OrderCreated.schema.parse(event.detail.properties);

// ✅ In infrastructure - generate patterns without AWS connection
const pattern = OrderCreated.pattern({ amount: [{ numeric: [">", 100] }] });

// ✅ In type definitions - extract types
type OrderData = z.infer<typeof OrderCreated.schema>;

// ✅ Full control over publishing configuration
await OrderCreated.publish({
  orderId: "ORDER-123",
  amount: 1500,
  customerTier: "premium"
});
```

### 2. Generate Type-Safe Patterns

```typescript
const pattern = OrderCreated.pattern({
  orderId: [{ prefix: "ORDER-" }],         // ✅ String operators
  amount: [{ numeric: [">", 1000] }],      // ✅ Numeric operators
  customerTier: ["premium", "enterprise"], // ✅ Enum validation
});

console.log(JSON.stringify(pattern, null, 2));
// {
//   "source": ["order-service"],
//   "detail-type": ["order.created"],
//   "detail": {
//     "properties": {
//       "orderId": [{ "prefix": "ORDER-" }],
//       "amount": [{ "numeric": [">", 1000] }],
//       "customerTier": ["premium", "enterprise"]
//     }
//   }
// }
```

### 3. Batch Publishing & Performance

EventKit automatically handles batching and chunking for high-performance event publishing:

```typescript
// ❌ Inefficient - Multiple API calls
await OrderCreated.publish({ orderId: "1", amount: 100 });
await OrderCreated.publish({ orderId: "2", amount: 200 });
await OrderCreated.publish({ orderId: "3", amount: 300 });
// 3 separate API calls to EventBridge

// ✅ Efficient - Single batched API call
await OrderCreated.publish([
  { orderId: "1", amount: 100 },
  { orderId: "2", amount: 200 },
  { orderId: "3", amount: 300 },
]);  // 1 API call with automatic chunking!

// ✅ Transaction Pattern - Only publish if DB succeeds
const events = [];
await db.transaction(async (tx) => {
  const order = await tx.insert(orders).values(orderData);
  events.push(OrderCreated.create(order));

  const payment = await tx.insert(payments).values(paymentData);
  events.push(PaymentProcessed.create(payment));
});
// Events only sent if transaction commits
await OrderCreated.publish(events);

// ✅ Mixed Event Types - Different events in one batch
await OrderCreated.publish([
  OrderCreated.create({ orderId: "123", amount: 100 }),
  UserRegistered.create({ userId: "456", email: "test@example.com" }),
  InventoryUpdated.create({ sku: "PROD-789", quantity: 50 })
]);  // All sent together efficiently

// ✅ High Volume - Automatic chunking handles AWS limits
await DomainDetected.publish(
  domains.map(domain => ({
    domain: domain.name,
    status: domain.status,
    price: domain.price
  }))
);
// 1000 events automatically split into 100 parallel requests (10 events each)
```

**🚀 Automatic Chunking Features:**
- **Smart Batching**: Automatically splits at 10 events per request (AWS limit)
- **Size Management**: Splits if total payload > 256KB (AWS limit)
- **Parallel Processing**: Sends chunks in parallel for maximum throughput
- **Result Merging**: Combines all responses into single result
- **Zero Configuration**: Works transparently with `publish()`

### 4. When to use create() vs publish()

Understanding when to use each method is key to effective event publishing:

#### Use `publish()` for immediate sending
```typescript
// ✅ Fire and forget - just send it
await OrderCreated.publish({ orderId: "123", amount: 100 });

// ✅ Direct batching - multiple of same type
await OrderCreated.publish([
  { orderId: "1", amount: 100 },
  { orderId: "2", amount: 200 }
]);
```

#### Use `create()` for deferred/conditional sending
```typescript
// ✅ Conditional collection - decide later
const events = [];
if (shouldNotifyUser) {
  events.push(UserNotified.create({ userId: "123" }));
}
if (shouldUpdateInventory) {
  events.push(InventoryUpdated.create({ sku: "ABC", quantity: 5 }));
}
// Only send if we have events
if (events.length > 0) {
  await UserNotified.publish(events);
}

// ✅ Transaction pattern - only send if DB succeeds
const events = [];
try {
  await db.transaction(async (tx) => {
    const order = await tx.insert(orders).values(orderData);
    events.push(OrderCreated.create(order));

    await tx.insert(inventory).values(inventoryUpdate);
    events.push(InventoryUpdated.create(inventoryUpdate));
  });

  // Transaction succeeded - now publish events
  await OrderCreated.publish(events);
} catch (error) {
  // Transaction failed - no events sent
  console.log("Transaction failed, no events published");
}

// ✅ Error recovery - retry individual events
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

// ✅ Testing - validate without sending
const entry = OrderCreated.create({ orderId: "123", amount: 100 });
expect(entry.Source).toBe("order-service");
expect(entry.DetailType).toBe("order.created");
// No AWS calls made
```

**Key difference:** `create()` returns a data structure you can store, pass around, and send later. `publish()` immediately sends to EventBridge.

### 5. Multi-Bus Architecture

EventKit supports multiple EventBridge buses - common in enterprise applications for isolation:

```typescript
// Different services with different buses
const orderBus = new Bus({ name: "order-service-bus", EventBridge: orderClient });
const paymentBus = new Bus({ name: "payment-service-bus", EventBridge: paymentClient });

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: orderBus,  // Order events go to order bus
  schema: OrderSchema,
});

const PaymentProcessed = new Event({
  name: "payment.processed",
  source: "payment-service",
  bus: paymentBus,  // Payment events go to payment bus
  schema: PaymentSchema,
});

// ✅ Each service publishes to its own bus
await OrderCreated.publish([
  OrderCreated.create({ orderId: "123" }),
  OrderUpdated.create({ orderId: "123", status: "processing" }), // Same bus ✅
]);

await PaymentProcessed.publish([
  PaymentProcessed.create({ paymentId: "PAY-456" }),
  PaymentCompleted.create({ paymentId: "PAY-456" }), // Same bus ✅
]);

// ❌ This throws an error - different buses
await OrderCreated.publish([
  OrderCreated.create({ orderId: "123" }),
  PaymentProcessed.create({ paymentId: "456" }), // Different bus - ERROR!
]);
```

**Why separate buses?**
- **Microservices** - Each service owns its bus for isolation
- **Security** - PII on secure bus, analytics on regular bus
- **Compliance** - HIPAA data separated from general events
- **Team boundaries** - Different teams manage their own buses

**Design philosophy:** Events from different buses should never be mixed in a single call. This enforces clean service boundaries and prevents accidental cross-service coupling.

### 6. Cross-Workspace Event Usage

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

export default {
  async queue(batch) {
    for (const message of batch.messages) {
      // Use schema for validation
      const order = OrderCreated.schema.parse(message.body);
      console.log(`Processing order ${order.orderId}`);
    }
  }
}

// packages/functions/processor.ts - Type safety
import { OrderCreated } from "@company/core/events";

type Order = z.infer<typeof OrderCreated.schema>; // Extract type

function processOrder(order: Order) {
  // Full type safety without AWS connection
}

// infra/rules.ts - Pattern generation
import { OrderCreated } from "@company/core/events";

const pattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }]
}); // No AWS needed for patterns
```

### 4. Use with Any Infrastructure Tool

#### AWS SDK
```typescript
import { EventBridgeClient, PutRuleCommand } from "@aws-sdk/client-eventbridge";

const client = new EventBridgeClient({});
await client.send(new PutRuleCommand({
  Name: "HighValueOrders",
  EventPattern: JSON.stringify(pattern),
  Targets: [{ Id: "1", Arn: "arn:aws:sqs:region:account:queue" }]
}));
```

#### AWS CDK
```typescript
import { Rule } from 'aws-cdk-lib/aws-events';

new Rule(this, 'HighValueOrders', {
  eventPattern: pattern,
  targets: [new SqsQueue(myQueue)]
});
```

#### Terraform
```hcl
resource "aws_cloudwatch_event_rule" "high_value_orders" {
  name          = "HighValueOrders"
  event_pattern = jsonencode(${generated_pattern})
}
```

## 📋 Schema Registry Integration

EventKit automatically discovers and syncs your events with AWS EventBridge Schema Registry:

```bash
# Discover and register all schemas
npx @divmode/eventkit register-schemas

# Sync schemas (add new, update changed, remove orphaned)
npx @divmode/eventkit sync-schemas
```

Your Event definitions become the source of truth for your event contracts across teams.

## 🤔 Why EventKit?

**Problem:** EventBridge patterns are complex JSON structures that are error-prone and lack type safety.

```typescript
// ❌ Error-prone, no IntelliSense, runtime failures
const pattern = {
  "detail": {
    "properties": {
      "amout": [{ "numeric": [">", 1000] }], // Typo!
      "status": ["PENDING"] // Wrong enum value!
    }
  }
};
```

**Solution:** Generate patterns from your existing Zod schemas with full type safety.

```typescript
// ✅ Type-safe, IntelliSense, compile-time validation
const pattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }],    // ✅ Correct field name
  status: ["pending"]                    // ✅ Validated enum value
});
```

## 📚 Core Concepts

### Event Definition
```typescript
const UserRegistered = new Event({
  name: "user.registered",     // Event name (detail-type)
  source: "auth-service",      // Event source
  bus: createBus,             // Bus factory function
  schema: UserSchema          // Zod validation schema
});
```

### Pattern Generation
```typescript
// Single event patterns
const pattern = UserRegistered.pattern({
  email: [{ suffix: "@company.com" }],
  role: ["admin", "manager"]
});

// Multi-event patterns
const multiPattern = Event.computePattern([UserCreated, UserUpdated], {
  $or: [
    { role: ["admin"] },
    { permissions: [{ exists: true }] }
  ]
});
```

### EventBridge Operators

EventKit supports all AWS EventBridge operators with full type safety:

```typescript
const pattern = MyEvent.pattern({
  // String operators
  fileName: [
    { prefix: "uploads/" },
    { suffix: ".pdf" },
    { wildcard: "*.jpg" },
    { "equals-ignore-case": "README" },
    { "anything-but": ["temp.txt"] }
  ],

  // Numeric operators
  price: [
    { numeric: [">", 10, "<=", 100] }, // Range: 10 < price <= 100
    { numeric: [">=", 1] }             // Minimum value
  ],

  // Advanced operators
  ipAddress: [{ cidr: "10.0.0.0/24" }],
  tags: [{ exists: true }],

  // Complex conditions
  $or: [
    { status: ["urgent"] },
    { priority: [{ numeric: [">", 8] }] }
  ]
});
```

**📋 [Complete operator reference →](./EVENTBRIDGE-OPERATORS.md)**

## 🧪 Event Handlers

Create type-safe Lambda handlers for EventBridge events:

```typescript
import { createEventHandler } from "@divmode/eventkit/runtime";

export const handler = createEventHandler(
  [OrderCreated, OrderUpdated],
  async (event) => {
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
  }
);
```

## 🔧 CLI Tools

### Auto-register Schemas
Scan your codebase and register Event schemas with AWS EventBridge Schema Registry:

```bash
npx @divmode/eventkit register-schemas
```

### Auto-sync Schemas
Sync schemas with EventBridge (creates, updates, removes orphaned):

```bash
npx @divmode/eventkit sync-schemas

# Keep orphaned schemas
npx @divmode/eventkit sync-schemas --no-delete
```

## 🎯 API Reference

### Event Class

**`pattern(filter?)`** - Generate EventBridge pattern from your schema
Returns EventBridge-compatible JSON pattern for creating rules

**`publish(data)`** - Universal publishing method (immediate sending)
- `publish(eventData)` - Single event
- `publish([data1, data2])` - Batch of same type
- `publish([entry1, entry2])` - Mixed types from `create()` (must use same bus)
Validates, sends to EventBridge immediately, returns AWS response

**`create(properties)`** - Create event entry for deferred sending
Validates against schema, returns PutEventsRequestEntry data structure
Use for: conditional sending, transactions, error recovery, testing
Does NOT send to EventBridge - use `publish()` to actually send

**`Event.computePattern(events[], filter?)`** - Multi-event patterns
Generate single pattern matching multiple event types

### Type Helpers

```typescript
// Extract filter type from Event
type OrderFilter = FilterFor<typeof OrderCreated>;

// Extract schema type from Event
type OrderSchema = SchemaFor<typeof OrderCreated>;
```

## ⚙️ Requirements

- **Node.js** >= 18.0.0
- **TypeScript** >= 4.9.0
- **Zod** >= 4.0.0 (peer dependency)

## 🏗️ Advanced: SST Integration

EventKit includes special helpers for [SST](https://sst.dev) projects:

```typescript
import { createEventRule } from "@divmode/eventkit/sst";

// Automatic resource wiring with SST
createEventRule(OrderCreated, {
  name: "ProcessHighValueOrders",
  bus: myEventBus,
  filter: { amount: [{ numeric: [">", 1000] }] },
  target: {
    destination: processingQueue,
    transform: (event) => ({
      orderId: event.orderId, // ✅ Fully typed
      amount: event.amount,
    }),
  },
});
```

**Note:** SST integration requires the SST runtime context.

## 🌟 Real-World Example

```typescript
// Define events
const OrderCreated = new Event({
  name: "order.created",
  source: "ecommerce-api",
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
    items: z.array(z.string()),
  })
});

// Business rules as type-safe patterns
const highValuePattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }],
  customerTier: ["premium", "enterprise"]
});

const enterprisePattern = OrderCreated.pattern({
  customerTier: ["enterprise"],
  items: [{ exists: true }]
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