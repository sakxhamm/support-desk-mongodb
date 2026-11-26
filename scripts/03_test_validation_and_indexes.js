// 03_test_validation_and_indexes.js
// Tests $jsonSchema validation (valid + failure cases) and verifies index usage via explain("executionStats")
// Usage: mongosh "mongodb://localhost:27017/support_desk" scripts/03_test_validation_and_indexes.js

const supportDb = db.getSiblingDB("support_desk");

function assert(condition, message) {
  if (!condition) {
    throw new Error("ASSERTION FAILED: " + message);
  }
}

print("--- Test 1: Verify seeded document counts ---");
const agentCount = supportDb.agents.countDocuments();
const ticketCount = supportDb.tickets.countDocuments();
assert(agentCount === 3, "Expected 3 agents, got " + agentCount);
assert(ticketCount === 6, "Expected 6 tickets, got " + ticketCount);
print("PASS: Seeded counts verified (3 agents, 6 tickets).");

print("\n--- Test 2: Failure Case - Invalid Ticket Priority & Missing SLA Fields ---");
let ticketValidationFailed = false;
try {
  supportDb.tickets.insertOne({
    _id: new ObjectId(),
    ticketNumber: "TKT-9999",
    subject: "Invalid ticket test",
    description: "Should fail $jsonSchema validation",
    requesterEmail: "bad@example.com",
    status: "open",
    priority: "critical", // INVALID: not in enum ["low", "medium", "high", "urgent"]
    priorityRank: Int32(5), // INVALID: exceeds maximum 4
    assignedAgentId: null,
    sla: {
      tier: "enterprise"
      // INVALID: missing required SLA timestamps & breached flag
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });
} catch (err) {
  ticketValidationFailed = err.code === 121;
  print("Caught expected validation error (code " + err.code + "): " + err.message);
}
assert(ticketValidationFailed, "Expected MongoDB error code 121 (Document failed validation) for invalid ticket");
print("PASS: Invalid ticket rejected with code 121.");

print("\n--- Test 3: Failure Case - Invalid Agent (maxActiveTickets <= 0) ---");
let agentValidationFailed = false;
try {
  supportDb.agents.insertOne({
    _id: new ObjectId(),
    name: "Bad Agent",
    email: "bad.agent@deskcorp.io",
    role: "agent",
    tier: "L1",
    skills: ["billing"],
    maxActiveTickets: Int32(0), // INVALID: minimum is 1
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
} catch (err) {
  agentValidationFailed = err.code === 121;
  print("Caught expected agent validation error (code " + err.code + ")");
}
assert(agentValidationFailed, "Expected MongoDB error code 121 for invalid agent");
print("PASS: Invalid agent rejected with code 121.");

print("\n--- Test 4: Index 1 (idx_triage_queue) explain('executionStats') ---");
const triageExplain = supportDb.tickets
  .find({ status: "open" })
  .sort({ priorityRank: -1, "sla.resolutionDueAt": 1 })
  .explain("executionStats");

const triagePlanStr = JSON.stringify(triageExplain.queryPlanner.winningPlan);
print("Winning Plan (Triage Queue): " + triagePlanStr);
print("nReturned: " + triageExplain.executionStats.nReturned +
      ", totalKeysExamined: " + triageExplain.executionStats.totalKeysExamined +
      ", totalDocsExamined: " + triageExplain.executionStats.totalDocsExamined);

assert(triagePlanStr.includes("idx_triage_queue"), "Expected idx_triage_queue to be used");
assert(!triagePlanStr.includes('"stage":"SORT"'), "Expected no blocking in-memory SORT stage");
assert(
  triageExplain.executionStats.nReturned === triageExplain.executionStats.totalDocsExamined,
  "Expected totalDocsExamined to equal nReturned"
);
print("PASS: idx_triage_queue used with zero in-memory sort.");

print("\n--- Test 5: Index 2 (idx_agent_active_workload) explain('executionStats') ---");
const sampleAgent = supportDb.agents.findOne({ email: "aisha.sharma@deskcorp.io" });
const workloadExplain = supportDb.tickets
  .find({ assignedAgentId: sampleAgent._id, status: "in_progress" })
  .sort({ updatedAt: -1 })
  .explain("executionStats");

const workloadPlanStr = JSON.stringify(workloadExplain.queryPlanner.winningPlan);
print("Winning Plan (Agent Workload): " + workloadPlanStr);
print("nReturned: " + workloadExplain.executionStats.nReturned +
      ", totalKeysExamined: " + workloadExplain.executionStats.totalKeysExamined +
      ", totalDocsExamined: " + workloadExplain.executionStats.totalDocsExamined);

assert(workloadPlanStr.includes("idx_agent_active_workload"), "Expected idx_agent_active_workload to be used");
assert(!workloadPlanStr.includes('"stage":"SORT"'), "Expected no blocking in-memory SORT stage");
assert(
  workloadExplain.executionStats.nReturned === workloadExplain.executionStats.totalDocsExamined,
  "Expected totalDocsExamined to equal nReturned"
);
print("PASS: idx_agent_active_workload used with zero in-memory sort.");

print("\nALL TESTS PASSED.");
