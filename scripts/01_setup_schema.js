// 01_setup_schema.js
// Creates the `agents` and `tickets` collections with $jsonSchema validation and indexes
// Usage: mongosh "mongodb://localhost:27017/support_desk" scripts/01_setup_schema.js

const dbName = "support_desk";
const supportDb = db.getSiblingDB(dbName);

// Clean slate for reproducible setup
supportDb.tickets.drop();
supportDb.agents.drop();

// 1. Agents Collection
supportDb.createCollection("agents", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      title: "SupportAgent",
      required: [
        "_id",
        "name",
        "email",
        "role",
        "tier",
        "skills",
        "maxActiveTickets",
        "isActive",
        "createdAt",
        "updatedAt"
      ],
      additionalProperties: false,
      properties: {
        _id: { bsonType: "objectId" },
        name: {
          bsonType: "string",
          minLength: 2,
          maxLength: 100,
          description: "Full name of the support agent"
        },
        email: {
          bsonType: "string",
          pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
          description: "Unique corporate email address"
        },
        role: {
          enum: ["agent", "senior_agent", "team_lead"],
          description: "Operational role in the support desk"
        },
        tier: {
          enum: ["L1", "L2", "L3"],
          description: "Escalation tier"
        },
        skills: {
          bsonType: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            bsonType: "string",
            minLength: 2
          },
          description: "Support categories the agent can handle (e.g., billing, auth, api)"
        },
        maxActiveTickets: {
          bsonType: "int",
          minimum: 1,
          maximum: 50,
          description: "Maximum concurrent open/in_progress tickets allowed"
        },
        isActive: {
          bsonType: "bool",
          description: "Whether the agent is currently eligible for ticket assignment"
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// Unique constraint on agent email
supportDb.agents.createIndex(
  { email: 1 },
  { unique: true, name: "uq_agents_email" }
);

// 2. Tickets Collection
supportDb.createCollection("tickets", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      title: "SupportTicket",
      required: [
        "_id",
        "ticketNumber",
        "subject",
        "description",
        "requesterEmail",
        "status",
        "priority",
        "priorityRank",
        "assignedAgentId",
        "sla",
        "createdAt",
        "updatedAt"
      ],
      additionalProperties: false,
      properties: {
        _id: { bsonType: "objectId" },
        ticketNumber: {
          bsonType: "string",
          pattern: "^TKT-[0-9]{4,}$",
          description: "Human-readable ticket identifier, e.g., TKT-1001"
        },
        subject: {
          bsonType: "string",
          minLength: 3,
          maxLength: 200
        },
        description: {
          bsonType: "string",
          minLength: 1,
          maxLength: 5000
        },
        requesterEmail: {
          bsonType: "string",
          pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
        },
        status: {
          enum: ["open", "in_progress", "waiting_on_customer", "resolved", "closed"],
          description: "Current lifecycle state of the ticket"
        },
        priority: {
          enum: ["low", "medium", "high", "urgent"],
          description: "Ticket urgency label"
        },
        priorityRank: {
          bsonType: "int",
          minimum: 1,
          maximum: 4,
          description: "Numeric rank for deterministic sorting (1=low, 2=medium, 3=high, 4=urgent)"
        },
        assignedAgentId: {
          bsonType: ["objectId", "null"],
          description: "Reference to agents._id, or null if unassigned in triage"
        },
        tags: {
          bsonType: "array",
          items: { bsonType: "string", minLength: 1 }
        },
        sla: {
          bsonType: "object",
          required: [
            "tier",
            "firstResponseDueAt",
            "firstRespondedAt",
            "resolutionDueAt",
            "resolvedAt",
            "breached"
          ],
          additionalProperties: false,
          properties: {
            tier: {
              enum: ["standard", "priority", "enterprise"],
              description: "Customer SLA plan"
            },
            firstResponseDueAt: { bsonType: "date" },
            firstRespondedAt: { bsonType: ["date", "null"] },
            resolutionDueAt: { bsonType: "date" },
            resolvedAt: { bsonType: ["date", "null"] },
            breached: { bsonType: "bool" }
          }
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

// Unique constraint on ticketNumber
supportDb.tickets.createIndex(
  { ticketNumber: 1 },
  { unique: true, name: "uq_tickets_number" }
);

// Primary Index 1: Triage & SLA Escalation Queue
// Supports querying tickets by status, ordered by highest priorityRank and soonest SLA resolution deadline
supportDb.tickets.createIndex(
  { status: 1, priorityRank: -1, "sla.resolutionDueAt": 1 },
  { name: "idx_triage_queue" }
);

// Primary Index 2: Agent Active Workload & Dashboard
// Supports fetching an agent's tickets by status ordered by most recently updated, and counting active load
supportDb.tickets.createIndex(
  { assignedAgentId: 1, status: 1, updatedAt: -1 },
  { name: "idx_agent_active_workload" }
);

print("Schema validation and indexes created successfully on database: " + dbName);
