# DSDS MCP — Component Builder Wizard Tool

A design + architecture plan for adding a wizard-style tool to **dsds-mcp**
(`github.com/somerandomdude/dsds-mcp`, private) that steps an agent through
building a [DSDS](https://designsystemdocspec.org)-compliant component document
by presenting a finite set of options at each step.

> Status: planning. The dsds-mcp repo is private and was not accessible during
> planning, so the structure below maps to a generic TypeScript
> `@modelcontextprotocol/sdk` server and will need minor naming adjustments to
> match the existing codebase.

---

## 1. Background — can an MCP present a wizard to agents?

Yes. There are four viable patterns for stepping an agent through finite options:

| Pattern | How it works | State | Verdict |
|---|---|---|---|
| **1. Guided tool responses** | Each response tells the agent which tool to call next and what the valid options are | None | Simple, but agent can go off-script |
| **2. Enum-constrained params** | Zod `z.enum(...)` forces a pick from a fixed set per call | None | Most reliable option-constraint in MCP today |
| **3. Stateful session wizard** | Server stores wizard state; one `wizard_step` tool advances it | Server-side (Redis/DB) | Strongest enforcement; needs session infra |
| **4. Tool visibility gating** | Only the next tool is registered at each stage | Registration-time | Not viable — MCP can't update tool list mid-session without reconnect |

**Chosen approach:** a hybrid of Patterns 1 + 2 — a single tool with a `step`
enum, enum-constrained options surfaced at each step, and a **stateless**
data-carry design (the agent echoes accumulated data back on each call).

### Decisions captured

- **Repo:** already exists, private.
- **Stack:** TypeScript / Node.js.
- **State model:** stateless tool chain (agent carries data forward).

---

## 2. The DSDS data model (relevant subset)

A DSDS **component** document looks like:

```json
{
  "kind": "component",
  "identifier": "button",
  "name": "Button",
  "summary": "One-line description",
  "metadata": {
    "status": { "value": "stable" },
    "category": "action",
    "tags": ["interactive", "form"]
  },
  "documentBlocks": [
    { "kind": "anatomy", "entries": [] },
    { "kind": "api", "properties": [] },
    { "kind": "variants", "variants": [] },
    { "kind": "states", "states": [] },
    { "kind": "guidelines", "items": [] },
    { "kind": "accessibility", "wcagLevel": "AA" }
  ]
}
```

DSDS more broadly defines eight entity types (components, tokens, token groups,
themes, foundations, patterns, guides, chunks) and a unified **document block**
system where each block is a typed object with a `kind`. This wizard targets
**components** only.

### Finite option sets (DSDS spec constants)

| Field | Allowed values |
|---|---|
| `status` | `draft` · `alpha` · `beta` · `stable` · `deprecated` |
| `category` | `action` · `communication` · `containment` · `layout` · `navigation` · `selection` · `text` |
| block `kind` | `anatomy` · `api` · `variants` · `states` · `guidelines` · `accessibility` · `content` · `design-specs` |
| variant `kind` | `flag` (boolean) · `enum` (one of N) |
| prop `type` | `string` · `number` · `boolean` · `enum` · `object` · `array` · `function` · `node` · `ref` |
| state `name` | `default` · `hover` · `focus` · `active` · `disabled` · `loading` · `error` · `success` · `empty` · `readonly` |
| WCAG level | `A` · `AA` · `AAA` |
| guideline level | `must` · `must-not` · `should` |

---

## 3. Architecture

### 3.1 Directory structure

```
src/tools/dsds/
  constants.ts           # All DSDS spec enums — single source of truth
  types.ts               # WizardData, StepResponse, per-block shapes
  schema.ts              # Zod input schema (step enum + loose data record)
  stepRouter.ts          # Dispatch table: WizardStep → handler function
  assembler.ts           # Pure fn: WizardData → DSDS component JSON
  register.ts            # Exports registerDsdsTools(server)
  steps/
    start.ts
    metadata.ts
    selectBlocks.ts      # Builds the blockQueue
    configureAnatomy.ts
    configureApi.ts
    configureVariants.ts
    configureStates.ts
    configureGuidelines.ts
    configureAccessibility.ts
    finalize.ts
```

### 3.2 Step flow

```
start → metadata → select_blocks → [configure_anatomy?]
      → [configure_api?] → [configure_variants?] → [configure_states?]
      → [configure_guidelines?] → [configure_accessibility?] → finalize
```

Optional steps only execute if the agent selected that block type in
`select_blocks`. `content` and `design-specs` are selectable but have no
configure step — they produce stub entries in the final document.

### 3.3 Input schema (`schema.ts`)

```typescript
export const WizardBuildComponentParams = z.object({
  step: z.enum([
    'start', 'metadata', 'select_blocks',
    'configure_anatomy', 'configure_api', 'configure_variants',
    'configure_states', 'configure_guidelines', 'configure_accessibility',
    'finalize',
  ]).describe('Always start with "start". Use nextStepId from each response to advance.'),

  data: z
    .record(z.unknown())
    .optional()
    .default({})
    .describe('Full data object returned by the previous step. Omit on first call.'),
})
```

`data` is a **loose record**, not a discriminated union — each handler validates
only its own required slice. A strict union would reject valid partial states
and grow O(N) in complexity per step.

### 3.4 Step response shape (`types.ts`)

Every step returns the same structure, so the agent has one consistent contract:

```typescript
interface StepResponse {
  validated: string             // confirmation of what was accepted
  nextStep: string              // human-readable instruction
  nextStepId: string            // exact step enum value to call next
  nextStepFields: FieldOption[] // schema for what data is needed next (empty = done)
  data: WizardData              // full accumulated data — agent echoes back verbatim
  result?: ComponentDocument    // only present on finalize
}

interface FieldOption {
  name: string
  type: string
  description: string
  required: boolean
  allowedValues?: string[]      // present for all enum fields — the DSDS constants
}
```

Completion is detected when `nextStepFields` is empty and
`nextStepId === 'finalize'`.

### 3.5 Spec constants (`constants.ts`)

```typescript
export const COMPONENT_STATUSES   = ['draft','alpha','beta','stable','deprecated'] as const
export const COMPONENT_CATEGORIES = ['action','communication','containment','layout','navigation','selection','text'] as const
export const BLOCK_KINDS          = ['anatomy','api','variants','states','guidelines','accessibility','content','design-specs'] as const
export const PROP_TYPES           = ['string','number','boolean','enum','object','array','function','node','ref'] as const
export const VARIANT_KINDS        = ['flag','enum'] as const
export const STATE_NAMES          = ['default','hover','focus','active','disabled','loading','error','success','empty','readonly'] as const
export const WCAG_LEVELS          = ['A','AA','AAA'] as const
export const GUIDELINE_LEVELS     = ['must','must-not','should'] as const

// Only these block kinds have a configure_* step
export const CONFIGURABLE_BLOCKS: BlockKind[] = [
  'anatomy','api','variants','states','guidelines','accessibility',
]
```

### 3.6 Step handler pattern

All handlers share the signature `(data: WizardData) => StepResponse` and a
common internal flow:

```typescript
export function handleStart(data: WizardData): StepResponse {
  const parsed = StartInputSchema.safeParse(data)

  // Self-bootstrapping: if required fields are absent, return guidance, not an error.
  // The agent can call a step cold to discover what it needs, then call again with data.
  if (!parsed.success) {
    return guidanceResponse({ nextStepId: 'start', nextStepFields: START_FIELDS, data })
  }

  return {
    validated: `Accepted: identifier="${parsed.data.identifier}"`,
    nextStep: 'Provide component metadata.',
    nextStepId: 'metadata',
    nextStepFields: METADATA_FIELDS,   // includes allowedValues from constants.ts
    data: { ...data, ...parsed.data },
  }
}
```

The **self-bootstrapping** behaviour means any step can be probed cold to return
its schema — no separate "describe" step required.

### 3.7 Block queue advancement

`select_blocks` builds an ordered `blockQueue` and stores it in `data`. Each
`configure_*` handler pops the next item:

```typescript
function advanceQueue(data: WizardData) {
  const queue = data.blockQueue ?? []
  return {
    nextStepId: queue.length > 0 ? queue[0] : 'finalize',
    remainingQueue: queue.slice(1),
  }
}
```

The queue is **agent-carried**, so the agent can skip or reorder steps mid-run
without a dedicated skip mechanism.

### 3.8 Assembler (`assembler.ts`)

Pure function, no I/O. Iterates `data.selectedBlocks` (preserving agent-chosen
order) and maps each to its DSDS block shape:

```typescript
export function assembleComponent(data: WizardData): ComponentDocument {
  // validate required top-level fields; throw on missing
  const documentBlocks = (data.selectedBlocks ?? []).map(kind => {
    switch (kind) {
      case 'api':       return { kind, properties: data.api ?? [] }
      case 'variants':  return { kind, variants: data.variants ?? [] }
      case 'states':    return { kind, states: data.states ?? [] }
      // ...etc
    }
  })

  return { kind: 'component', identifier, name, summary, metadata, documentBlocks }
}
```

### 3.9 Step router (`stepRouter.ts`)

Pure dispatch table — adding a step later means one handler file + one entry:

```typescript
const STEP_HANDLERS: Record<WizardStep, StepHandler> = {
  start:                    handleStart,
  metadata:                 handleMetadata,
  select_blocks:            handleSelectBlocks,
  configure_anatomy:        handleConfigureAnatomy,
  configure_api:            handleConfigureApi,
  configure_variants:       handleConfigureVariants,
  configure_states:         handleConfigureStates,
  configure_guidelines:     handleConfigureGuidelines,
  configure_accessibility:  handleConfigureAccessibility,
  finalize:                 handleFinalize,
}
```

### 3.10 Registration

```typescript
export function registerDsdsTools(server: McpServer) {
  server.registerTool('wizard_build_component', {
    title: 'Build component document',
    description:
      'Interactive wizard that guides an agent step-by-step through building a ' +
      'DSDS-compliant component document. Always start with step: "start". On each ' +
      'call, pass back the full data object from the previous step. The response says ' +
      'which step to call next and which fields to populate.',
    inputSchema: WizardBuildComponentParams.shape,
    annotations: {
      readOnlyHint: true,      // never writes to any external system
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  }, wizardBuildComponentTool)
}
```

The response surfaces as `content: [{ type: 'text', text: JSON.stringify(stepResponse) }]`
— raw JSON, not XML, so the agent can parse `nextStepId` and `data` back out
programmatically.

---

## 4. Key design decisions & trade-offs

| Decision | Rationale |
|---|---|
| Single tool, `step` enum | Multiple tools bloat the tool list; free-text action loses the enum hint that guides LLMs |
| Stateless, agent-carried `data` | No server session state; handlers are pure functions, trivially testable; works with any MCP host |
| Loose `z.record` for `data` | Strict union would reject valid partial states and need O(N) branches per step |
| Self-bootstrapping on empty input | Reduces retry cycles; agent can probe any step for its schema |
| `blockQueue` is agent-carried | Agent can skip/reorder blocks mid-run without a separate skip step |
| `content`/`design-specs` pass-through | No configure step today; adding one later only needs a handler + `CONFIGURABLE_BLOCKS` entry |
| Raw JSON response (not XML) | Agent parses `nextStepId`/`data` programmatically; XML round-trips lose type fidelity |

---

## 5. Token-expenditure impact

### Core cost driver — double-echoing `data`

Each round trip sends the accumulated `data` blob twice: once as the tool's
output, once as the agent's next input. Every token of accumulated data costs
**2× per remaining step**.

### Rough per-run estimate

Typical component (10 props, 5 variants, 7 states):

| Step | Input | Output |
|---|---|---|
| start × 2 | 150 | 500 |
| metadata | 200 | 400 |
| select_blocks | 250 | 350 |
| configure_anatomy | 300 | 400 |
| configure_api | 400 | 600 |
| configure_variants | 550 | 550 |
| configure_states | 700 | 500 |
| configure_guidelines | 800 | 450 |
| configure_accessibility | 850 | 400 |
| finalize | 900 | 1,200 |
| **Total** | **~5,100** | **~5,350** |

**≈ 10,500 tokens** for the tool calls alone (agent reasoning + conversation
context add on top).

### What makes it worse

- Deep `api` blocks — per-field schemas listing all 9 prop types.
- Large components — a 20-prop/10-variant `data` blob (~1,500–2,000 tokens)
  echoed 10× = 30,000–40,000 tokens of echo overhead alone.
- Long `allowedValues` arrays in responses (output-only, so no echo, but not free).

### Comparison

| Approach | ~Tokens | Trade-off |
|---|---|---|
| Agent knows DSDS, 1 call | ~1,500 | Needs spec knowledge; hallucination risk |
| Agent reads schema resource, 1 call | ~4,000 | Large resource; still may hallucinate enums |
| **This wizard (stateless)** | **~10,500** | No spec knowledge needed; guaranteed-valid enums |
| Stateful wizard (server session) | ~5,000 | Half the cost; no echo; needs session storage |

### Main cost levers

1. **Return deltas, not full `data`** — agent merges client-side. Cuts echo
   ~60% but breaks the "pass data back verbatim" simplicity.
2. **Switch to a stateful session** (Pattern 3) — halves cost by eliminating the
   echo entirely; worth it if the wizard sees high traffic.

---

## 6. Open items before implementation

- Obtain access to the private dsds-mcp repo (or paste: the server entry file,
  one existing tool as a pattern reference, and `package.json` for the MCP SDK
  version).
- Confirm the exact DSDS block field names against the live schema
  (`spec/schema/entities/component.json` + `document-blocks/*`) — the constants
  above are from spec summaries and should be validated against source.
- Decide whether to add eval coverage for the wizard flow.

---

## References

- [Design System Documentation Spec 0.11.0](https://designsystemdocspec.org/)
- [DSDS schema repo](https://github.com/somerandomdude/design-system-documentation-schema)
- [Model Context Protocol](https://modelcontextprotocol.io)
