# AWS EventBridge Pattern Operators

Complete reference for EventKit's type-safe AWS EventBridge pattern matching operators with zero-overhead TypeScript integration.

## 🎯 Overview

EventKit provides full TypeScript type safety for all AWS EventBridge pattern operators with:
- **🔒 Complete Type Safety** - All operators validated against your Zod schemas
- **⚡ Zero Runtime Overhead** - All type checking happens at compile time
- **🎯 100% AWS Compliance** - Every official AWS EventBridge operator is supported
- **📝 IntelliSense Support** - Full autocomplete for fields and operators
- **🔄 Universal Compatibility** - Works with AWS SDK, CDK, Terraform, SST, and any infrastructure tool

> **📖 Reference:** EventKit implements all operators from the [official AWS EventBridge content filtering documentation](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-content-based-filtering.html) with full type safety.

## 📋 Supported Operators

### String Operators

```typescript
fileName: [
  { prefix: "uploads/" },                           // Match files starting with "uploads/"
  { suffix: ".pdf" },                              // Match files ending with ".pdf"
  { wildcard: "*.jpg" },                           // Wildcard matching with *
  { "equals-ignore-case": "README" },              // Case-insensitive exact match
  { "anything-but": ["temp.txt"] },                // Exclude specific values
  { exists: true },                                // Field must exist
  { cidr: "10.0.0.0/24" },                        // IP address CIDR matching (NEW!)
]
```

### NEW! Advanced String Operators

```typescript
serviceName: [
  { prefix: { "equals-ignore-case": "API-" } },     // Case-insensitive prefix
  { suffix: { "equals-ignore-case": ".PDF" } },     // Case-insensitive suffix
  { "anything-but": { prefix: "temp-" } },          // Exclude by prefix
  { "anything-but": { suffix: [".tmp", ".log"] } }, // Exclude by suffix list
  { "anything-but": { wildcard: "*.cache" } },      // Exclude by wildcard
  { "anything-but": { cidr: "172.16.0.0/12" } },   // Exclude by CIDR
]
```

### Numeric Operators

```typescript
price: [
  { numeric: [">", 10, "<=", 100] }, // Range: 10 < price <= 100
  { numeric: [">=", 1] },            // Minimum value
  { numeric: ["=", 20] },            // Exact match
  { "anything-but": [0, -1] },       // Exclude values
  { exists: false },                 // Field must not exist
]
```

### Boolean Operators

```typescript
isActive: [
  true,                             // Exact match
  { "anything-but": false },        // Must not be false
  { exists: true },                 // Field must exist
]
```

### Array Operators

```typescript
tags: [
  { exists: true },                 // Array must exist
  { "anything-but": [["deprecated"]] }, // Exclude specific arrays
]
```

### Object Operators

```typescript
metadata: [
  { exists: true },                 // Object must exist
  { exists: false },                // Object must not exist
]
```

### NEW! Null and Empty Value Operators

```typescript
optionalField: [
  null,                             // Match null values
  "",                               // Match empty strings
  { "anything-but": null },         // Exclude null values
  { "anything-but": "" },           // Exclude empty strings
  { exists: false },                // Field must not exist
]
```

### Compound OR Operators

```typescript
// Complex OR conditions
{
  $or: [
    { status: ["completed"] },
    { status: ["failed"], isActive: [false] },
    { price: [{ numeric: [">", 1000] }] },
  ]
}
```

## 🔧 Usage Examples

### Basic Event Pattern

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { z } from "zod";

const OrderEvent = new Event({
  name: "order.created",
  source: "order-service",
  bus: () => new Bus({
    name: "order-bus",
    EventBridge: new EventBridgeClient(),
  }),
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    status: z.enum(["pending", "completed"]),
    customerEmail: z.string(),
  }),
});

// Type-safe pattern with multiple operators
const pattern = OrderEvent.pattern({
  orderId: [
    { prefix: "ORDER-" },          // ✅ String operator
    { suffix: "-PROD" },           // ✅ String operator
  ],
  amount: [
    { numeric: [">", 0, "<=", 10000] },  // ✅ Numeric range operator
  ],
  status: ["pending", "completed"],      // ✅ Exact match (enum validation)
  customerEmail: [
    { wildcard: "*@company.com" },       // ✅ Wildcard operator
    { "anything-but": "test@company.com" }, // ✅ Exclusion operator
  ],
});

// Generated EventBridge pattern:
// {
//   "source": ["order-service"],
//   "detail-type": ["order.created"],
//   "detail": {
//     "properties": {
//       "orderId": [{ "prefix": "ORDER-" }, { "suffix": "-PROD" }],
//       "amount": [{ "numeric": [">", 0, "<=", 10000] }],
//       "status": ["pending", "completed"],
//       "customerEmail": [{ "wildcard": "*@company.com" }, { "anything-but": "test@company.com" }]
//     }
//   }
// }
```

### Infrastructure Usage

**AWS SDK**
```typescript
import { EventBridgeClient, PutRuleCommand } from "@aws-sdk/client-eventbridge";

const client = new EventBridgeClient({ region: "us-east-1" });

// Use the generated pattern with AWS SDK
await client.send(new PutRuleCommand({
  Name: "HighValueOrders",
  EventPattern: JSON.stringify(OrderEvent.pattern({
    amount: [{ numeric: [">", 1000] }],
    status: ["pending"],
    customerEmail: [{ wildcard: "*@enterprise.com" }],
  })),
  Targets: [{
    Id: "1",
    Arn: "arn:aws:sqs:us-east-1:123456789012:processing-queue"
  }]
}));
```

**AWS CDK**
```typescript
import { Rule } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';

new Rule(this, 'HighValueOrders', {
  eventPattern: OrderEvent.pattern({
    amount: [{ numeric: [">", 1000] }],
    status: ["pending"],
    customerEmail: [{ wildcard: "*@enterprise.com" }],
  }),
  targets: [new SqsQueue(processingQueue)]
});
```

**SST Integration**
```typescript
import { createEventRule } from "@divmode/eventkit/sst";

createEventRule(OrderEvent, {
  name: "HighValueOrders",
  bus: myEventBus,
  filter: {
    amount: [{ numeric: [">", 1000] }],
    status: ["pending"],
    customerEmail: [{ wildcard: "*@enterprise.com" }],
  },
  target: {
    destination: processingQueue,
    transform: (event) => ({
      orderId: event.orderId,    // ✅ Fully typed
      amount: event.amount,      // ✅ Fully typed
    }),
  },
});
```

### Multiple Events Pattern

```typescript
const multiPattern = Event.computePattern(
  [OrderCreated, OrderUpdated, OrderCompleted],
  {
    status: [{ "anything-but": "cancelled" }],
    amount: [{ exists: true }],
  }
);
```

## 🛡️ Type Safety

All operators are fully type-checked:

```typescript
// ✅ Valid - prefix operator on string field
fileName: [{ prefix: "upload-" }]

// ❌ TypeScript Error - numeric operator on string field
fileName: [{ numeric: [">", 5] }]

// ❌ TypeScript Error - field doesn't exist in schema
invalidField: [{ exists: true }]

// ✅ Valid - proper numeric comparison
price: [{ numeric: [">", 0, "<=", 1000] }]
```

## 📊 Operator Support Matrix

| Type | Exact | Prefix | Suffix | Wildcard | Numeric | Anything-But | Exists | Case-Insensitive |
|------|-------|--------|--------|----------|---------|--------------|--------|------------------|
| String | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Number | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Boolean | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Array | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Object | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

## 🎯 Advanced Features

### Range Comparisons

```typescript
// Multiple numeric conditions in one operator
temperature: [{ numeric: [">", 10, "<=", 30] }]  // 10 < temp <= 30
```

### Complex OR Conditions

```typescript
{
  $or: [
    {
      status: ["urgent"],
      priority: [{ numeric: [">", 8] }]
    },
    {
      customerType: ["enterprise"],
      amount: [{ numeric: [">", 10000] }]
    }
  ]
}
```

### Wildcard Patterns

```typescript
// Supports multiple wildcards (not consecutive)
fileName: [{ wildcard: "logs/*/*.json" }]

// Case-insensitive prefix
service: [{ prefix: { "equals-ignore-case": "event" } }]
```

## 🚀 Benefits

- **🔒 Type Safety** - All operators validated against Zod schema
- **📝 IntelliSense** - Full autocomplete for fields and operators
- **🎯 AWS Compliance** - Matches official EventBridge specification
- **🔄 Reusable** - Use same patterns across different infrastructure
- **🧪 Testable** - Generate patterns for testing EventBridge rules
- **📚 Self-Documenting** - TypeScript types serve as documentation

## 🌟 Real-World Examples

### E-commerce Order Processing

```typescript
import { Bus, Event } from "@divmode/eventkit/runtime";
import { z } from "zod";

const OrderCreated = new Event({
  name: "order.created",
  source: "ecommerce-api",
  bus: () => new Bus({ name: "orders", EventBridge: new EventBridgeClient() }),
  schema: z.object({
    orderId: z.string(),
    customerId: z.string(),
    amount: z.number(),
    currency: z.string(),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
    region: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    })),
  })
});

// High-value enterprise orders
const enterpriseHighValuePattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 10000] }],
  customerTier: ["enterprise"],
  currency: ["USD", "EUR"],
  region: [{ "anything-but": ["test-region"] }],
});

// Bulk orders (multiple items)
const bulkOrderPattern = OrderCreated.pattern({
  items: [{ exists: true }],
  $or: [
    { amount: [{ numeric: [">", 5000] }] },
    { "items.length": [{ numeric: [">", 10] }] }
  ]
});

// Regional processing rules
const northAmericaPattern = OrderCreated.pattern({
  region: [{ prefix: "US-" }, { prefix: "CA-" }],
  currency: ["USD", "CAD"],
  amount: [{ numeric: [">", 0] }],
});
```

### IoT Device Monitoring

```typescript
const DeviceEvent = new Event({
  name: "device.telemetry",
  source: "iot-platform",
  schema: z.object({
    deviceId: z.string(),
    temperature: z.number(),
    humidity: z.number(),
    batteryLevel: z.number(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    status: z.enum(["online", "offline", "warning", "critical"]),
    firmware: z.string(),
  })
});

// Critical alerts
const criticalAlertsPattern = DeviceEvent.pattern({
  $or: [
    { temperature: [{ numeric: [">", 80] }] },
    { batteryLevel: [{ numeric: ["<", 10] }] },
    { status: ["critical"] }
  ],
  deviceId: [{ "anything-but": { prefix: "test-" } }],
});

// Firmware update targeting
const firmwareUpdatePattern = DeviceEvent.pattern({
  firmware: [{ "anything-but": { prefix: "v2." } }],
  status: ["online"],
  batteryLevel: [{ numeric: [">", 20] }],
});

// Geographic monitoring
const warehouseMonitoringPattern = DeviceEvent.pattern({
  "location.lat": [{ numeric: [">", 40.7, "<", 40.8] }],
  "location.lng": [{ numeric: [">", -74.1, "<", -74.0] }],
  status: [{ "anything-but": "offline" }],
});
```

## 🔗 Integration Examples

### Terraform Integration

```hcl
# variables.tf
variable "order_pattern" {
  description = "EventBridge pattern for order processing"
  type        = string
}

# main.tf
resource "aws_cloudwatch_event_rule" "high_value_orders" {
  name          = "HighValueOrders"
  event_pattern = var.order_pattern

  tags = {
    Environment = "production"
    Service     = "order-processing"
  }
}

resource "aws_cloudwatch_event_target" "processing_queue" {
  rule      = aws_cloudwatch_event_rule.high_value_orders.name
  target_id = "ProcessingQueue"
  arn       = aws_sqs_queue.processing.arn
}
```

```typescript
// generate-terraform-vars.ts
import { OrderCreated } from "./events";

const pattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }],
  customerTier: ["premium", "enterprise"]
});

// Output for Terraform
console.log(`order_pattern = '${JSON.stringify(pattern)}'`);
```

### CDK Stack Integration

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { SqsQueue } from 'aws-cdk-lib/aws-events-targets';
import { OrderCreated, UserRegistered, PaymentProcessed } from '../events';

export class EventProcessingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Multi-event processing rule
    const orderWorkflowRule = new Rule(this, 'OrderWorkflow', {
      eventPattern: Event.computePattern([OrderCreated, PaymentProcessed], {
        $or: [
          { status: ["pending", "processing"] },
          { amount: [{ numeric: [">", 500] }] }
        ]
      }),
      targets: [new SqsQueue(this.workflowQueue)]
    });

    // Customer lifecycle rule
    const customerRule = new Rule(this, 'CustomerLifecycle', {
      eventPattern: UserRegistered.pattern({
        email: [{ wildcard: "*@enterprise.com" }],
        plan: ["premium", "enterprise"]
      }),
      targets: [new SqsQueue(this.onboardingQueue)]
    });
  }
}
```

## 🌟 Next Steps

1. **📖 [Read the main EventKit documentation](./README.md)** - Complete setup and usage guide
2. **🔧 Use with your infrastructure tool** - AWS SDK, CDK, Terraform, SST, or Pulumi
3. **🧪 Test your patterns** - Validate EventBridge routing with generated patterns
4. **📦 Create pattern libraries** - Share reusable patterns across teams
5. **🔄 Integrate with CI/CD** - Generate patterns as part of your deployment pipeline

This provides the most comprehensive and type-safe EventBridge pattern system available for TypeScript! 🎉

---

**[← Back to EventKit README](./README.md)**