// 02_seed_data.js
// Inserts sample agents and tickets into `support_desk`
// Usage: mongosh "mongodb://localhost:27017/support_desk" scripts/02_seed_data.js

const supportDb = db.getSiblingDB("support_desk");
const now = new Date("2026-11-26T06:30:00Z");
const hourMs = 60 * 60 * 1000;

const agent1Id = new ObjectId();
const agent2Id = new ObjectId();
const agent3Id = new ObjectId();

supportDb.agents.insertMany([
  {
    _id: agent1Id,
    name: "Aisha Sharma",
    email: "aisha.sharma@deskcorp.io",
    role: "senior_agent",
    tier: "L2",
    skills: ["billing", "api", "sso"],
    maxActiveTickets: Int32(10),
    isActive: true,
    createdAt: new Date(now.getTime() - 90 * 24 * hourMs),
    updatedAt: now
  },
  {
    _id: agent2Id,
    name: "Liam Chen",
    email: "liam.chen@deskcorp.io",
    role: "agent",
    tier: "L1",
    skills: ["onboarding", "account", "billing"],
    maxActiveTickets: Int32(15),
    isActive: true,
    createdAt: new Date(now.getTime() - 45 * 24 * hourMs),
    updatedAt: now
  },
  {
    _id: agent3Id,
    name: "Maya Patel",
    email: "maya.patel@deskcorp.io",
    role: "team_lead",
    tier: "L3",
    skills: ["api", "security", "outage"],
    maxActiveTickets: Int32(5),
    isActive: false,
    createdAt: new Date(now.getTime() - 180 * 24 * hourMs),
    updatedAt: now
  }
]);

supportDb.tickets.insertMany([
  {
    _id: new ObjectId(),
    ticketNumber: "TKT-1001",
    subject: "Production SSO login returning 502",
    description: "Enterprise workspace users cannot authenticate via SAML SSO since 05:45 UTC.",
    requesterEmail: "ops@acme-enterprise.com",
    status: "open",
    priority: "urgent",
    priorityRank: Int32(4),
    assignedAgentId: null,
    tags: ["sso", "enterprise"],
    sla: {
      tier: "enterprise",
      firstResponseDueAt: new Date(now.getTime() + 0.5 * hourMs),
      firstRespondedAt: null,
      resolutionDueAt: new Date(now.getTime() + 4 * hourMs),
      resolvedAt: null,
      breached: false
    },
    createdAt: new Date(now.getTime() - 0.25 * hourMs),
    updatedAt: now
  },
  {
    _id: new ObjectId(),
    ticketNumber: "TKT-1002",
    subject: "Webhook retries duplicating invoice events",
    description: "Receiving duplicate invoice.paid webhooks within 200ms.",
    requesterEmail: "dev@fintechco.io",
    status: "in_progress",
    priority: "high",
    priorityRank: Int32(3),
    assignedAgentId: agent1Id,
    tags: ["api", "billing"],
    sla: {
      tier: "priority",
      firstResponseDueAt: new Date(now.getTime() - 1 * hourMs),
      firstRespondedAt: new Date(now.getTime() - 1.5 * hourMs),
      resolutionDueAt: new Date(now.getTime() + 6 * hourMs),
      resolvedAt: null,
      breached: false
    },
    createdAt: new Date(now.getTime() - 3 * hourMs),
    updatedAt: new Date(now.getTime() - 0.5 * hourMs)
  },
  {
    _id: new ObjectId(),
    ticketNumber: "TKT-1003",
    subject: "Seat count mismatch on monthly invoice",
    description: "Billed for 28 seats instead of 24 active members.",
    requesterEmail: "finance@brightstudio.co",
    status: "open",
    priority: "high",
    priorityRank: Int32(3),
    assignedAgentId: null,
    tags: ["billing"],
    sla: {
      tier: "priority",
      firstResponseDueAt: new Date(now.getTime() + 1 * hourMs),
      firstRespondedAt: null,
      resolutionDueAt: new Date(now.getTime() + 8 * hourMs),
      resolvedAt: null,
      breached: false
    },
    createdAt: new Date(now.getTime() - 1 * hourMs),
    updatedAt: new Date(now.getTime() - 1 * hourMs)
  },
  {
    _id: new ObjectId(),
    ticketNumber: "TKT-1004",
    subject: "How to export CSV audit logs",
    description: "Looking for the date-range filter in the audit log export modal.",
    requesterEmail: "admin@northstar.org",
    status: "open",
    priority: "low",
    priorityRank: Int32(1),
    assignedAgentId: agent2Id,
    tags: ["onboarding"],
    sla: {
      tier: "standard",
      firstResponseDueAt: new Date(now.getTime() + 8 * hourMs),
      firstRespondedAt: null,
      resolutionDueAt: new Date(now.getTime() + 48 * hourMs),
      resolvedAt: null,
      breached: false
    },
    createdAt: new Date(now.getTime() - 2 * hourMs),
    updatedAt: new Date(now.getTime() - 2 * hourMs)
  },
  {
    _id: new ObjectId(),
    ticketNumber: "TKT-1005",
    subject: "API rate limit 429 during nightly sync",
    description: "Batch sync job hits 429 around 02:00 UTC.",
    requesterEmail: "platform@retailhub.com",
    status: "in_progress",
    priority: "medium",
    priorityRank: Int32(2),
    assignedAgentId: agent1Id,
    tags: ["api"],
    sla: {
      tier: "standard",
      firstResponseDueAt: new Date(now.getTime() - 4 * hourMs),
      firstRespondedAt: new Date(now.getTime() - 5 * hourMs),
      resolutionDueAt: new Date(now.getTime() + 18 * hourMs),
      resolvedAt: null,
      breached: false
    },
    createdAt: new Date(now.getTime() - 6 * hourMs),
    updatedAt: new Date(now.getTime() - 0.1 * hourMs)
  },
  {
    _id: new ObjectId(),
    ticketNumber: "TKT-1006",
    subject: "Password reset email delayed by 15 minutes",
    description: "Resolved after SPF/DKIM alignment check.",
    requesterEmail: "it@greenleaf.io",
    status: "resolved",
    priority: "medium",
    priorityRank: Int32(2),
    assignedAgentId: agent2Id,
    tags: ["account"],
    sla: {
      tier: "standard",
      firstResponseDueAt: new Date(now.getTime() - 20 * hourMs),
      firstRespondedAt: new Date(now.getTime() - 21 * hourMs),
      resolutionDueAt: new Date(now.getTime() - 2 * hourMs),
      resolvedAt: new Date(now.getTime() - 4 * hourMs),
      breached: false
    },
    createdAt: new Date(now.getTime() - 24 * hourMs),
    updatedAt: new Date(now.getTime() - 4 * hourMs)
  }
]);

print("Seeded " + supportDb.agents.countDocuments() + " agents and " + supportDb.tickets.countDocuments() + " tickets.");
