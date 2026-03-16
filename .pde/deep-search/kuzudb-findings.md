# 🔥 SOUTH — KuzuDB Research Findings for Forgewright

> **Direction:** South (Planning & Consent — Protocol, Ethics, Relational Governance)
> **Date:** 2025-07-23
> **Purpose:** Evaluate KuzuDB as Forgewright's embedded relational graph substrate
> **Sources:** npm registry, KuzuDB official docs (kuzudb.github.io), GitHub issues, The Register, Vela Partners blog, Hacker News, multiple cross-referenced

---

## ⚠️ CRITICAL STATUS: KuzuDB ARCHIVED (October 2025)

**The original KuzuDB project was archived by Kùzu Inc. in October 2025.** The company ceased active development. The codebase remains MIT-licensed and usable, but receives no official updates.

### Active Forks (Recommended for Production)

| Fork | Maintainer | Key Feature | GitHub |
|------|-----------|-------------|--------|
| **Bighorn** | Kineviz | Direct successor, community-driven | `github.com/Kineviz/bighorn` |
| **Vela Fork** | Vela Partners | **Concurrent writes** for AI/multi-agent | `github.com/vela-engineering/kuzu` |
| **LadybugDB** | Arun Sharma | Object storage focus | Community fork |

**Forgewright Recommendation:** Use `kuzu` npm v0.11.2 now for development. Monitor **Vela fork** (concurrent writes are valuable for multi-agent ceremonies) and **Bighorn** for long-term stability. The API surface is identical across forks.

---

## 📦 npm Package

```bash
npm install kuzu
```

| Field | Value |
|-------|-------|
| **Package name** | `kuzu` |
| **Latest version** | `0.11.2` (also 0.11.3 noted in docs) |
| **License** | MIT |
| **TypeScript** | Built-in types (`Database`, `Connection`, `QueryResult`) |
| **Module support** | CommonJS + ESM |
| **Alt TS wrapper** | `@synstack/kuzu-client` (community, strongly-typed chainable API) |

---

## 🏗️ Node.js API — Core Classes

### Database Initialization

```typescript
import { Database, Connection } from "kuzu";

// Embedded mode — no server needed. Just a directory path.
const db = new Database("./forgewright-graph");
const conn = new Connection(db);
```

### Key Classes

| Class | Purpose | Key Methods |
|-------|---------|-------------|
| `Database` | Opens/creates the database directory | Constructor only |
| `Connection` | Executes queries | `query()`, `prepare()`, `execute()` |
| `QueryResult` | Holds query results | `getAll()`, iteration |
| `PreparedStatement` | Reusable parameterized statement | Created via `conn.prepare()` |

---

## 📐 Schema Definition — Forgewright's 10 Node Types

### CREATE NODE TABLE Syntax

```sql
CREATE NODE TABLE TableName (
    property1 TYPE [DEFAULT value],
    property2 TYPE,
    PRIMARY KEY (property1)
);
```

**Rules:**
- Every node table MUST have an explicit `PRIMARY KEY`
- Primary key is automatically indexed
- Supported PK types: `STRING`, `INT64`, `UUID`, `SERIAL` (auto-increment)
- `DEFAULT` values optional; defaults to `NULL`

### Forgewright Node Tables — Complete Schema

```sql
-- ============================================
-- FORGEWRIGHT NODE TABLES (10 types)
-- ============================================

CREATE NODE TABLE Spec (
    id STRING PRIMARY KEY,
    name STRING,
    version STRING,
    direction STRING,           -- east|south|west|north
    status STRING DEFAULT 'draft',
    content STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    -- OCAP metadata
    ocap_owner STRING,
    ocap_control STRING,        -- 'creator' | 'community' | 'council'
    ocap_access STRING,         -- 'public' | 'restricted' | 'ceremonial'
    ocap_possession STRING      -- 'local' | 'shared' | 'sovereign'
);

CREATE NODE TABLE Companion (
    id STRING PRIMARY KEY,
    name STRING,
    role STRING,                -- 'architect' | 'illuminator' | 'sage' | 'forger'
    embodiment STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE Ceremony (
    id STRING PRIMARY KEY,
    name STRING,
    direction STRING,
    phase STRING,               -- 'opening' | 'active' | 'closing' | 'reflection'
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE Session (
    id STRING PRIMARY KEY,
    title STRING,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    status STRING DEFAULT 'active',
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE ActionStep (
    id STRING PRIMARY KEY,
    description STRING,
    order_index INT64,
    status STRING DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE NarrativeBeat (
    id STRING PRIMARY KEY,
    content STRING,
    emotion STRING,
    intensity DOUBLE DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE Intent (
    id STRING PRIMARY KEY,
    description STRING,
    direction STRING,
    urgency STRING DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE StateMachine (
    id STRING PRIMARY KEY,
    name STRING,
    current_state STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE State (
    id STRING PRIMARY KEY,
    name STRING,
    is_initial BOOL DEFAULT false,
    is_final BOOL DEFAULT false,
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE NODE TABLE Event (
    id STRING PRIMARY KEY,
    name STRING,
    payload STRING,             -- JSON stored as string
    fired_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);
```

---

## 🔗 Relationship Tables — Forgewright's 11 Edge Types

### CREATE REL TABLE Syntax

```sql
CREATE REL TABLE RelName (
    FROM SourceTable TO TargetTable,
    property1 TYPE,
    property2 TYPE
);
```

**Rules:**
- Relationships are ALWAYS directed (`FROM → TO`)
- No explicit PRIMARY KEY needed (source+target key combo is identity)
- Can have properties (timestamps, weights, metadata)

### Forgewright Relationship Tables — Complete Schema

```sql
-- ============================================
-- FORGEWRIGHT REL TABLES (11 edge types)
-- ============================================

CREATE REL TABLE DEPENDS_ON (
    FROM Spec TO Spec,
    strength DOUBLE DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE BELONGS_TO (
    FROM ActionStep TO Ceremony,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE SERVES_DIRECTION (
    FROM Spec TO Ceremony,
    direction STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE AUTHORED_BY (
    FROM NarrativeBeat TO Companion,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE GOVERNED_BY (
    FROM Ceremony TO Companion,
    role STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE TRANSITIONS_TO (
    FROM State TO State,
    event_name STRING,
    guard STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE CONTAINS (
    FROM Session TO ActionStep,
    order_index INT64,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE GENERATED_FROM (
    FROM NarrativeBeat TO Session,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE NARRATES (
    FROM NarrativeBeat TO ActionStep,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE ACCOUNTABLE_TO (
    FROM Companion TO Ceremony,
    accountability_type STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);

CREATE REL TABLE KIN_OF (
    FROM Companion TO Companion,
    kinship_type STRING,
    created_at TIMESTAMP DEFAULT timestamp(),
    ocap_owner STRING,
    ocap_control STRING,
    ocap_access STRING,
    ocap_possession STRING
);
```

---

## 📝 INSERT / CREATE Patterns

### Insert Nodes

```typescript
// Single node
await conn.query(`
  CREATE (s:Spec {
    id: 'spec-auth-001',
    name: 'Authentication Ceremony',
    version: '1.0.0',
    direction: 'south',
    status: 'draft',
    content: 'OAuth2 + OCAP token flow',
    ocap_owner: 'mia',
    ocap_control: 'creator',
    ocap_access: 'restricted',
    ocap_possession: 'local'
  });
`);

// MERGE — idempotent insert (only creates if not exists)
await conn.query(`
  MERGE (c:Companion {id: 'companion-mia'})
  ON CREATE SET
    c.name = 'Mia',
    c.role = 'architect',
    c.embodiment = 'recursive-devops',
    c.ocap_owner = 'system',
    c.ocap_control = 'council',
    c.ocap_access = 'public',
    c.ocap_possession = 'sovereign';
`);
```

### Insert Relationships

```typescript
// Create edge between existing nodes
await conn.query(`
  MATCH (s:Spec {id: 'spec-auth-001'}), (c:Ceremony {id: 'ceremony-south-001'})
  CREATE (s)-[:SERVES_DIRECTION {
    direction: 'south',
    ocap_owner: 'mia',
    ocap_control: 'creator',
    ocap_access: 'restricted',
    ocap_possession: 'local'
  }]->(c);
`);

// MERGE relationship (idempotent)
await conn.query(`
  MATCH (a:Companion {id: 'companion-mia'}), (b:Companion {id: 'companion-miette'})
  MERGE (a)-[:KIN_OF {kinship_type: 'pair-programming'}]->(b);
`);
```

---

## 🔍 MATCH Query Patterns

### Basic Pattern Match

```typescript
// Find all specs in 'south' direction
const result = await conn.query(`
  MATCH (s:Spec)
  WHERE s.direction = 'south'
  RETURN s.id, s.name, s.status;
`);
const rows = await result.getAll();
```

### Relationship Traversal

```typescript
// Find all action steps in a ceremony
const result = await conn.query(`
  MATCH (a:ActionStep)-[:BELONGS_TO]->(c:Ceremony {id: 'ceremony-south-001'})
  RETURN a.id, a.description, a.status
  ORDER BY a.order_index;
`);
```

### Multi-Hop Traversal

```typescript
// Find narrative beats for a session through action steps
const result = await conn.query(`
  MATCH (nb:NarrativeBeat)-[:NARRATES]->(as:ActionStep)<-[:CONTAINS]-(s:Session {id: 'session-001'})
  RETURN nb.content, nb.emotion, as.description;
`);
```

### Variable-Length Path

```typescript
// Find all transitive dependencies of a spec (up to 5 hops)
const result = await conn.query(`
  MATCH (s:Spec {id: 'spec-auth-001'})-[:DEPENDS_ON*1..5]->(dep:Spec)
  RETURN dep.id, dep.name;
`);
```

### OCAP Filtering Pattern

```typescript
// Find all nodes accessible to a specific owner with restricted access
const result = await conn.query(`
  MATCH (s:Spec)
  WHERE s.ocap_owner = 'mia' AND s.ocap_access = 'restricted'
  RETURN s.id, s.name, s.ocap_control;
`);
```

---

## 🎯 Parameterized Queries (CRITICAL for Security)

### Using prepare() + execute()

```typescript
// Prepare once, execute many times with different params
const stmt = await conn.prepare(`
  MATCH (s:Spec)
  WHERE s.direction = $direction AND s.status = $status
  RETURN s.id, s.name, s.version;
`);

// Execute with parameters — safe from injection
const result = await conn.execute(stmt, {
  direction: "south",
  status: "active"
});
const rows = await result.getAll();
```

### Parameterized INSERT

```typescript
const insertStmt = await conn.prepare(`
  CREATE (s:Spec {
    id: $id,
    name: $name,
    direction: $direction,
    status: 'draft',
    ocap_owner: $owner,
    ocap_control: $control,
    ocap_access: $access,
    ocap_possession: $possession
  });
`);

await conn.execute(insertStmt, {
  id: "spec-west-002",
  name: "Build Pipeline",
  direction: "west",
  owner: "mia",
  control: "creator",
  access: "public",
  possession: "local"
});
```

---

## 📊 Supported Data Types

| Type | Use in Forgewright | Notes |
|------|-------------------|-------|
| `STRING` | IDs, names, content, OCAP fields | UTF-8, variable-length |
| `INT64` | Order indexes, counters | Also INT8/16/32/128, UINT variants |
| `DOUBLE` | Intensity, strength weights | Also FLOAT, DECIMAL |
| `BOOL` | is_initial, is_final flags | |
| `TIMESTAMP` | created_at, started_at, ended_at | Microsecond precision; also ms/ns/s variants |
| `DATE` | Calendar dates | Days since epoch |
| `UUID` | Could use for IDs instead of STRING | RFC 4122 compliant |
| `SERIAL` | Auto-increment primary keys | |
| `LIST` | Tags, categories | **Homogeneous only** (all same type) |
| `STRUCT` | Nested objects | `STRUCT(key STRING, val STRING)` |
| `BLOB` | Binary data | |
| `INTERVAL` | Durations | |

### ⚠️ Type Limitations
- **No MAP type** — use `LIST` of `STRUCT` as workaround
- **No spatial types** — unlike Neo4j
- **Lists must be homogeneous** — no mixed-type arrays
- **No UNION type** — planned but not implemented

---

## ⚡ Indexes & Performance

| Feature | Status | Notes |
|---------|--------|-------|
| **Primary key index** | ✅ Automatic | Every NODE TABLE PK is indexed |
| **Secondary indexes** | ❌ Not supported | Only PK index; no arbitrary property indexes |
| **Full-text search** | ✅ Extension `fts` | Built-in as of v0.11.x |
| **Vector search** | ✅ Extension `vector` | Built-in as of v0.11.x |
| **Multi-core parallelism** | ✅ | Queries parallelized across cores |
| **ACID transactions** | ✅ | Full transactional support |
| **Columnar storage** | ✅ | Optimized for analytical queries |
| **Concurrent reads** | ✅ | Multi-threaded reads supported |
| **Concurrent writes** | ⚠️ Limited | Original KuzuDB: limited. Vela fork: improved |

### Workaround for Missing Secondary Indexes
Since KuzuDB only indexes the primary key, filter performance on non-PK properties depends on columnar scan speed. For Forgewright's OCAP queries:
- **Option A:** Make frequently-queried fields part of composite IDs (e.g., `direction:south:spec-001`)
- **Option B:** Use the columnar engine's inherent scan efficiency (fast for analytical workloads)
- **Option C:** Create auxiliary node tables that act as index lookup tables

---

## 🔄 Cypher Deviations from Neo4j

### Must-Know Differences

| Feature | Neo4j | KuzuDB | Impact on Forgewright |
|---------|-------|--------|----------------------|
| **Schema** | Optional | **Required** | ✅ Good — enforces structure |
| **FOREACH** | Supported | ❌ Use `UNWIND` | Minor syntax change |
| **REMOVE** | Supported | ❌ Use `SET prop = NULL` | Minor syntax change |
| **SET +=** | Map update | ❌ Individual props only | Verbose but workable |
| **WHERE in pattern** | `(n:P WHERE n.x=1)` | ❌ Must filter after | `MATCH (n:P) WHERE n.x=1` |
| **Label filter** | `WHERE n:Person` | ❌ | Use `label(n) = 'Person'` |
| **Path semantics** | Trail (no repeat edges) | **Walk** (allows repeats) | Use `is_trail()` if needed |
| **Var-length bound** | Unbounded OK | **Upper bound required** | Default 30 if omitted |
| **FINISH** | Supported (GQL) | ❌ | Use `RETURN COUNT(*)` |
| **USE clause** | Multi-graph | ❌ | One DB = one graph |

### Safe Patterns (Same in Both)

```cypher
-- These work identically in KuzuDB and Neo4j:
MATCH (a:Node)-[:REL]->(b:Node) WHERE a.prop = 'val' RETURN b;
MATCH (a)-[:REL*1..5]->(b) RETURN a, b;
CREATE (n:Label {key: 'val'});
MERGE (n:Label {key: 'val'}) ON CREATE SET n.other = 'x';
MATCH (a), (b) WHERE a.id = 'x' AND b.id = 'y' CREATE (a)-[:REL]->(b);
WITH ... AS alias MATCH ... RETURN ...;
UNWIND $list AS item CREATE (n:Label {id: item});
ORDER BY, LIMIT, SKIP, DISTINCT, COUNT, SUM, AVG, COLLECT;
```

---

## 🧪 Complete Forgewright Bootstrap Example

```typescript
// forgewright-graph.ts — Full bootstrap for Forgewright's KuzuDB substrate

import { Database, Connection } from "kuzu";
import { join } from "path";

export class ForgewrightGraph {
  private db: Database;
  private conn: Connection;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.conn = new Connection(this.db);
  }

  async initSchema(): Promise<void> {
    // Node tables
    const nodeSchemas = [
      `CREATE NODE TABLE IF NOT EXISTS Spec (
        id STRING PRIMARY KEY, name STRING, version STRING,
        direction STRING, status STRING DEFAULT 'draft', content STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS Companion (
        id STRING PRIMARY KEY, name STRING, role STRING, embodiment STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS Ceremony (
        id STRING PRIMARY KEY, name STRING, direction STRING, phase STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS Session (
        id STRING PRIMARY KEY, title STRING,
        started_at TIMESTAMP, ended_at TIMESTAMP,
        status STRING DEFAULT 'active',
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS ActionStep (
        id STRING PRIMARY KEY, description STRING,
        order_index INT64, status STRING DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS NarrativeBeat (
        id STRING PRIMARY KEY, content STRING,
        emotion STRING, intensity DOUBLE DEFAULT 0.5,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS Intent (
        id STRING PRIMARY KEY, description STRING,
        direction STRING, urgency STRING DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS StateMachine (
        id STRING PRIMARY KEY, name STRING, current_state STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS State (
        id STRING PRIMARY KEY, name STRING,
        is_initial BOOL DEFAULT false, is_final BOOL DEFAULT false,
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE NODE TABLE IF NOT EXISTS Event (
        id STRING PRIMARY KEY, name STRING, payload STRING,
        fired_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING,
        ocap_access STRING, ocap_possession STRING
      )`,
    ];

    // Relationship tables
    const relSchemas = [
      `CREATE REL TABLE IF NOT EXISTS DEPENDS_ON (
        FROM Spec TO Spec, strength DOUBLE DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS BELONGS_TO (
        FROM ActionStep TO Ceremony,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS SERVES_DIRECTION (
        FROM Spec TO Ceremony, direction STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS AUTHORED_BY (
        FROM NarrativeBeat TO Companion,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS GOVERNED_BY (
        FROM Ceremony TO Companion, role STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS TRANSITIONS_TO (
        FROM State TO State, event_name STRING, guard STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS CONTAINS (
        FROM Session TO ActionStep, order_index INT64,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS GENERATED_FROM (
        FROM NarrativeBeat TO Session,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS NARRATES (
        FROM NarrativeBeat TO ActionStep,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS ACCOUNTABLE_TO (
        FROM Companion TO Ceremony, accountability_type STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
      `CREATE REL TABLE IF NOT EXISTS KIN_OF (
        FROM Companion TO Companion, kinship_type STRING,
        created_at TIMESTAMP DEFAULT timestamp(),
        ocap_owner STRING, ocap_control STRING, ocap_access STRING, ocap_possession STRING
      )`,
    ];

    for (const schema of [...nodeSchemas, ...relSchemas]) {
      await this.conn.query(schema);
    }
  }

  // Parameterized OCAP-aware insert
  async createSpec(params: {
    id: string; name: string; version: string;
    direction: string; content: string;
    ocap: { owner: string; control: string; access: string; possession: string };
  }): Promise<void> {
    const stmt = await this.conn.prepare(`
      CREATE (s:Spec {
        id: $id, name: $name, version: $version,
        direction: $direction, status: 'draft', content: $content,
        ocap_owner: $owner, ocap_control: $control,
        ocap_access: $access, ocap_possession: $possession
      });
    `);
    await this.conn.execute(stmt, {
      id: params.id,
      name: params.name,
      version: params.version,
      direction: params.direction,
      content: params.content,
      owner: params.ocap.owner,
      control: params.ocap.control,
      access: params.ocap.access,
      possession: params.ocap.possession,
    });
  }

  // Query with OCAP filtering
  async queryByDirection(direction: string, accessLevel: string): Promise<any[]> {
    const stmt = await this.conn.prepare(`
      MATCH (s:Spec)
      WHERE s.direction = $direction
        AND (s.ocap_access = $access OR s.ocap_access = 'public')
      RETURN s.id, s.name, s.status, s.ocap_owner
      ORDER BY s.created_at DESC;
    `);
    const result = await conn.execute(stmt, { direction, access: accessLevel });
    return result.getAll();
  }

  // Traverse ceremony → action steps → narrative beats
  async getCeremonyNarrative(ceremonyId: string): Promise<any[]> {
    const stmt = await this.conn.prepare(`
      MATCH (nb:NarrativeBeat)-[:NARRATES]->(as:ActionStep)-[:BELONGS_TO]->(c:Ceremony {id: $cid})
      RETURN nb.content, nb.emotion, nb.intensity, as.description, as.order_index
      ORDER BY as.order_index;
    `);
    const result = await this.conn.execute(stmt, { cid: ceremonyId });
    return result.getAll();
  }

  // State machine transitions
  async getTransitions(machineId: string): Promise<any[]> {
    const result = await this.conn.query(`
      MATCH (sm:StateMachine {id: '${machineId}'}),
            (from:State)-[t:TRANSITIONS_TO]->(to:State)
      RETURN from.name AS from_state, t.event_name AS event,
             t.guard AS guard, to.name AS to_state;
    `);
    return result.getAll();
  }
}
```

---

## ✅ Viability Assessment for Forgewright

### What KuzuDB Handles Well

| Requirement | Support | Notes |
|-------------|---------|-------|
| 10 node types | ✅ | CREATE NODE TABLE with strong typing |
| 11 edge types | ✅ | CREATE REL TABLE with FROM/TO + properties |
| OCAP on every node/edge | ✅ | STRING properties on all tables |
| Cypher queries | ✅ | openCypher with minor deviations |
| Parameterized queries | ✅ | `prepare()` + `execute()` with `$params` |
| Embedded (no server) | ✅ | Core value proposition |
| TypeScript types | ✅ | Built-in with the npm package |
| ACID transactions | ✅ | Full support |
| Path traversal | ✅ | Variable-length with upper bound |
| MERGE (idempotent) | ✅ | ON CREATE SET / ON MATCH SET |

### Limitations to Watch

| Limitation | Severity | Workaround |
|-----------|----------|------------|
| No secondary indexes | Medium | Columnar engine handles scans well; use PK lookups |
| No MAP type | Low | Use STRUCT or JSON-in-STRING |
| Homogeneous lists only | Low | Rarely needed for Forgewright |
| Walk semantics (not trail) | Low | Use `is_trail()` filter when needed |
| No WHERE in pattern | Low | Filter after MATCH (standard practice) |
| Project archived | **HIGH** | Use Vela fork or Bighorn for production |
| Limited concurrent writes | Medium | Vela fork addresses this |

### Verdict: ✅ VIABLE — with fork awareness

KuzuDB is **the right substrate for Forgewright**. Its enforced schema matches Forgewright's structured node/edge types. Cypher provides the relational query language the Medicine Wheel framework needs. Embedded mode means zero infrastructure overhead.

**Production path:** Start with `kuzu@0.11.2` npm for development. Track the **Vela Partners fork** (concurrent writes for multi-agent ceremonies) and **Bighorn** (community continuity). The API surface is identical — switching forks is a package swap, not a rewrite.

---

## 🔄 Fallback Options (If KuzuDB Proves Non-Viable)

### Tier 1 — Drop-in Alternatives

| Option | Embedded | Cypher | npm | Notes |
|--------|----------|--------|-----|-------|
| **Bighorn** (Kuzu fork) | ✅ | ✅ | Pending | Direct KuzuDB successor |
| **Vela fork** | ✅ | ✅ | Pending | + concurrent writes |

### Tier 2 — Different Engine, Similar Capability

| Option | Embedded | Query Language | npm | Notes |
|--------|----------|---------------|-----|-------|
| **DuckDB + DuckPGQ** | ✅ | SQL/PGQ | `duckdb` | Graph extension for DuckDB; SQL:2023 graph queries |
| **FalkorDB** | ❌ (server) | Cypher | `falkordb` | Migration guide from KuzuDB exists |
| **Memgraph** | ❌ (server) | Cypher | `neo4j-driver` compatible | Full openCypher |

### Tier 3 — Pure JS (No Native Bindings)

| Option | Notes |
|--------|-------|
| **graphology** + custom Cypher parser | In-memory JS graph library; no persistence built-in |
| **gun.js** | Decentralized graph DB; different paradigm |
| **Custom SQLite + graph layer** | Use `better-sqlite3` with adjacency tables |

---

## 📚 Source References

1. **npm registry:** https://www.npmjs.com/package/kuzu (v0.11.2)
2. **KuzuDB Docs — Create Table:** https://kuzudb.github.io/docs/cypher/data-definition/create-table/
3. **KuzuDB Docs — Cypher Differences:** https://kuzudb.github.io/docs/cypher/difference/
4. **KuzuDB Docs — Prepared Statements:** https://kuzudb.github.io/docs/get-started/prepared-statements/
5. **KuzuDB Docs — Data Types:** https://kuzudb.github.io/docs/cypher/data-types/
6. **KuzuDB Node.js API:** https://kuzudb.github.io/api-docs/nodejs/
7. **KuzuDB Archived — The Register:** https://www.theregister.com/2025/10/14/kuzudb_abandoned/
8. **Vela Partners Fork:** https://www.vela.partners/blog/kuzudb-ai-agent-memory-graph-database
9. **Bighorn Fork:** https://github.com/Kineviz/bighorn
10. **openCypher Parity Issue:** https://github.com/kuzudb/kuzu/issues/1644
11. **KuzuDB Concurrency:** https://kuzudb.github.io/docs/concurrency/
