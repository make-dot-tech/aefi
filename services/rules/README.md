# aefi rules (Drools disposition)

**Status**: Draft
**Last updated**: 2026-08-08

JVM microservice for confidence / authorization disposition.

## Contract

- `POST /v1/disposition` — FactPayload → DispositionResult  
- Schemas: `packages/contracts/disposition/`  
- Reason codes: `packages/contracts/enums/reason-codes.yaml`

## Run

```bash
cd services/rules
./mvnw spring-boot:run
# → http://localhost:8090/health
```

```bash
curl -s -X POST localhost:8090/v1/disposition \
  -H 'content-type: application/json' \
  -d '{
    "schema_version":"0.1.0",
    "subject":{"type":"payment","id":"pay:1"},
    "facts":[{"code":"payment_only_observed","present":true,"strength":"exact","refs":["pay:1"]}],
    "evidence_types":["transaction"],
    "coverage":{"status":"minimal","known_gaps":["authorization_evidence_missing"]}
  }'
```

## Design

- Spring Boot 4 + Drools 9  
- DRL entry rule inserts `DispositionContext` and calls `DispositionPolicies.apply` (salience-ordered Java policy; easy to extend with more DRL later)  
- API calls this service; falls back to TS composer if unreachable  

## Test

```bash
./mvnw test
```
