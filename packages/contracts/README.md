# aefi contracts

**Status**: Draft
**Last updated**: 2026-08-08

Language-neutral source of truth for events, graph model, disposition, and API/MCP shapes.

| Path | Contents |
| --- | --- |
| `openapi/aefi-v1.yaml` | HTTP `/v1` + shared response envelope |
| `mcp/` | MCP tool descriptors (aligned with OpenAPI) |
| `events/` | JSON Schema for canonical chain / offchain events |
| `graph/model.yaml` | Neo4j labels + relationships |
| `disposition/` | FactPayload + DispositionResult schemas |
| `enums/` | Controlled vocabularies (confidence, reason codes, …) |

Version bumps: change `schema_version` / `confidence_model_version` in enums when breaking disposition or envelope semantics.
