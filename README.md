# Day 3 – MongoDB Schema & Indexes: Customer Support Desk

A MongoDB schema, `$jsonSchema` validation, relationship design, and indexing implementation for a **Customer Support Desk** focused on **ticket priority, agent assignment, and SLA tracking**.

## Project Structure

```text
support-desk-mongodb/
├── .gitignore
├── README.md
└── scripts/
    ├── 01_setup_schema.js               # Creates collections, $jsonSchema validators, and indexes
    ├── 02_seed_data.js                  # Seeds sample support agents and tickets
    └── 03_test_validation_and_indexes.js # Verifies validation errors and IXSCAN execution plans
```

---

## 1. Entities & Schemas

### Entity 1: `agents`
Represents support desk staff eligible to be assigned tickets.

| Field | BSON Type | Constraints | Purpose |
| :--- | :--- | :--- | :--- |
| `_id` | `objectId` | Required | Primary key |
| `name` | `string` | Required, 2–100 chars | Agent display name |
| `email` | `string` | Required, email regex, **unique index** | Corporate login / identifier |
| `role` | `string` (enum) | `"agent" \| "senior_agent" \| "team_lead"` | Operational role |
| `tier` | `string` (enum) | `"L1" \| "L2" \| "L3"` | Escalation tier |
| `skills` | `array<string>` | Required, min 1, unique items | Routing categories (`billing`, `api`, `sso`, etc.) |
| `maxActiveTickets` | `int` | Required, 1–50 | WIP / concurrency cap for assignment |
| `isActive` | `bool` | Required | Availability flag for routing |
| `createdAt` | `date` | Required | Audit timestamp |
| `updatedAt` | `date` | Required | Audit timestamp |

### Entity 2: `tickets`
Represents customer support requests with priority, assignment, and an embedded `sla` tracking subdocument.

| Field | BSON Type | Constraints | Purpose |
| :--- | :--- | :--- | :--- |
| `_id` | `objectId` | Required | Primary key |
| `ticketNumber` | `string` | Required, `^TKT-[0-9]{4,}$`, **unique index** | Human-readable ticket ID |
| `subject` | `string` | Required, 3–200 chars | Ticket summary |
| `description` | `string` | Required, 1–5000 chars | Issue details |
| `requesterEmail` | `string` | Required, email regex | Customer contact |
| `status` | `string` (enum) | `"open" \| "in_progress" \| "waiting_on_customer" \| "resolved" \| "closed"` | Lifecycle state |
| `priority` | `string` (enum) | `"low" \| "medium" \| "high" \| "urgent"` | Human-readable urgency |
| `priorityRank` | `int` | Required, 1–4 (`1=low`, `4=urgent`) | Numeric rank for deterministic index sorting |
| `assignedAgentId` | `objectId \| null` | Required (`null` when unassigned) | References `agents._id` |
| `tags` | `array<string>` | Optional | Topic tags for filtering |
| `sla` | `object` | Required (embedded subdocument) | SLA deadlines & breach tracking |
| `sla.tier` | `string` (enum) | `"standard" \| "priority" \| "enterprise"` | Customer SLA plan |
| `sla.firstResponseDueAt` | `date` | Required | First-response deadline |
| `sla.firstRespondedAt` | `date \| null` | Required | Actual first-response timestamp |
| `sla.resolutionDueAt` | `date` | Required | Resolution deadline |
| `sla.resolvedAt` | `date \| null` | Required | Actual resolution timestamp |
| `sla.breached` | `bool` | Required | Whether an SLA deadline was missed |
| `createdAt` | `date` | Required | Audit timestamp |
| `updatedAt` | `date` | Required | Audit timestamp |

---

## 2. Validation Strategy

Both collections use MongoDB native `$jsonSchema` validation configured in [`scripts/01_setup_schema.js`](scripts/01_setup_schema.js) with:
- `validationLevel: "strict"` (enforced on all inserts and updates)
- `validationAction: "error"` (rejects invalid writes immediately with error code `121`)
- `additionalProperties: false` on `agents`, `tickets`, and `tickets.sla` to prevent schema drift or typoed field names.

---

## 3. Relationship Strategy

1. **Referencing (`tickets.assignedAgentId` → `agents._id`) — One-to-Many**
   - **Why referencing instead of embedding tickets inside `agents`:** An agent handles hundreds or thousands of tickets over time. Embedding tickets inside an `agents` document would cause unbounded array growth, eventually risking the 16 MB BSON document limit and creating write contention whenever any ticket updates.
   - **Why referencing instead of embedding full `agent` inside `tickets`:** Agent attributes (`isActive`, `tier`, `maxActiveTickets`, `name`) change independently. Storing only `assignedAgentId` (or `null` during triage) avoids stale duplicated agent records across thousands of tickets.
2. **Embedding (`tickets.sla`) — One-to-One**
   - **Why embedding:** A ticket's SLA deadlines and breach state belong exclusively to that single ticket, have a fixed/bounded size, and are always read and updated together with the ticket's `status` and `priority`.

---

## 4. Indexes, Queries Improved & Trade-Offs

In addition to unique constraints on `agents.email` (`uq_agents_email`) and `tickets.ticketNumber` (`uq_tickets_number`), two compound indexes are defined on `tickets`:

### Index 1: `idx_triage_queue`
```js
{ status: 1, priorityRank: -1, "sla.resolutionDueAt": 1 }
```
- **Query improved:** Support desk triage and SLA escalation queue — fetching active tickets for a given `status` (e.g., `"open"`), sorted by highest `priorityRank` first and soonest `sla.resolutionDueAt` deadline:
  ```js
  db.tickets.find({ status: "open" }).sort({ priorityRank: -1, "sla.resolutionDueAt": 1 })
  ```
  Because the index follows the Equality-Sort-Range (ESR) pattern (`status` equality, followed by the exact sort keys `priorityRank: -1, "sla.resolutionDueAt": 1`), MongoDB satisfies both filtering and ordering with an `IXSCAN` and **no in-memory `SORT` stage**.
- **Trade-off:**
  - **Write amplification & RAM footprint:** Every ticket insert and any update to `status`, `priorityRank`, or `sla.resolutionDueAt` must update this B-tree index. Because historical `"closed"` and `"resolved"` tickets remain in the index, its memory footprint grows with total ticket volume (a partial index filtering `status: { $in: ["open", "in_progress", "waiting_on_customer"] }` can be used later if closed tickets dominate).

### Index 2: `idx_agent_active_workload`
```js
{ assignedAgentId: 1, status: 1, updatedAt: -1 }
```
- **Query improved:** Agent's "My Active Tickets" dashboard and capacity check — fetching or counting tickets assigned to a specific agent in a given `status`, ordered by most recently updated:
  ```js
  db.tickets.find({ assignedAgentId: agentId, status: "in_progress" }).sort({ updatedAt: -1 })
  ```
- **Trade-off:**
  - **Frequent key updates:** `updatedAt` changes on nearly every ticket edit (reassignment, status transition, reply), causing frequent index key repositioning.
  - **Key skew on `null`:** Unassigned tickets all share `assignedAgentId: null`, though the compound `status` and `updatedAt` fields still partition them cleanly.

---

## 5. Assumptions

1. **Application-synced `priorityRank`:** Because alphabetical sorting of `"low"`, `"medium"`, `"high"`, `"urgent"` does not match business urgency, the application layer maintains `priorityRank` (`1`–`4`) in sync with `priority`.
2. **Single-agent assignment:** Each ticket has at most one `assignedAgentId` (`null` while awaiting triage).
3. **App-computed SLA deadlines:** `sla.firstResponseDueAt` and `sla.resolutionDueAt` are calculated by the backend at ticket creation using the customer's `sla.tier` and business-hours rules.
4. **Application-enforced referential integrity:** MongoDB does not enforce foreign keys; the assignment service verifies that `assignedAgentId` exists in `agents`, `isActive === true`, and active ticket count `< maxActiveTickets` before writing.

---

## 6. Failure Case

**Case: Invalid Ticket Priority & Incomplete SLA Subdocument**
- **Scenario:** A client submits a ticket with `priority: "critical"` (outside the allowed enum `["low", "medium", "high", "urgent"]`), `priorityRank: 5` (exceeds `maximum: 4`), and an `sla` object missing `firstResponseDueAt`, `resolutionDueAt`, `firstRespondedAt`, `resolvedAt`, and `breached`.
- **Observed Result:** MongoDB rejects the write at the database layer with **`MongoServerError: Document failed validation` (error code `121`)**, preventing corrupt priority/SLA state from entering the triage queue.
- **Note on Referential Integrity Failure:** `$jsonSchema` validates that `assignedAgentId` is an `objectId` or `null`, *not* that the ID exists in `agents`. If the app layer skips checking `agents`, a ticket could reference a non-existent or inactive agent—which is why assignment must be guarded in the service layer.

---

## 7. How We Tested the Result

All scripts were executed against a local **MongoDB Server 8.0** (`mongod` + `mongosh`):

1. **Schema & Index Creation:** Ran `scripts/01_setup_schema.js` — created `agents` and `tickets` with strict `$jsonSchema` validation and all indexes.
2. **Seeding:** Ran `scripts/02_seed_data.js` — inserted 3 agents (`L1`, `L2`, `L3`, including active/inactive) and 6 tickets spanning `open`, `in_progress`, and `resolved` across `enterprise`, `priority`, and `standard` SLA tiers.
3. **Automated Assertions (`scripts/03_test_validation_and_indexes.js`):**
   - **Validation Failure Tests:** Confirmed invalid ticket insert and invalid agent (`maxActiveTickets: 0`) both fail with MongoDB error code `121`.
   - **Index 1 (`idx_triage_queue`) `explain("executionStats")`:** Verified `IXSCAN` on `idx_triage_queue` with `nReturned: 3, totalKeysExamined: 3, totalDocsExamined: 3` and **no `SORT` stage**.
   - **Index 2 (`idx_agent_active_workload`) `explain("executionStats")`:** Verified `IXSCAN` on `idx_agent_active_workload` with `nReturned: 2, totalKeysExamined: 2, totalDocsExamined: 2` and **no `SORT` stage**.

### Running Locally

Start a local MongoDB instance on `localhost:27017` and run:

```bash
mongosh "mongodb://localhost:27017/support_desk" scripts/01_setup_schema.js
mongosh "mongodb://localhost:27017/support_desk" scripts/02_seed_data.js
mongosh "mongodb://localhost:27017/support_desk" scripts/03_test_validation_and_indexes.js
```
