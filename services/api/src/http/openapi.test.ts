import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOpenApiDocument, X_GUIDANCE, X_PAYMENT_INFO, INFO_DESCRIPTION } from "./openapi.js";

const PAID_PATHS = [
  { path: "/v1/payments/verify", method: "post" },
  { path: "/v1/transactions/{hash}", method: "get" },
  { path: "/v1/jobs/{job_id}", method: "get" },
  { path: "/v1/agents/{id}/activity", method: "get" },
  { path: "/v1/authority/check", method: "post" },
  { path: "/v1/tasks/{task_execution_id}", method: "get" },
  { path: "/v1/providers/search", method: "post" },
  { path: "/v1/providers/{id}", method: "get" },
] as const;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert.equal(typeof value, "object", label);
  assert.ok(value, label);
  return value as Record<string, unknown>;
}

function assertDescribedSchema(schema: Record<string, unknown>, path: string): void {
  if (schema.$ref) return;
  const properties = schema.properties;
  if (!properties || typeof properties !== "object") return;
  for (const [name, raw] of Object.entries(properties as Record<string, unknown>)) {
    const field = asRecord(raw, `${path}.${name}`);
    assert.ok(
      typeof field.description === "string" || typeof field.$ref === "string",
      `${path}.${name} needs description`,
    );
    assertDescribedSchema(field, `${path}.${name}`);
  }
  const items = schema.items;
  if (items && typeof items === "object") {
    assertDescribedSchema(items as Record<string, unknown>, `${path}[]`);
  }
}

describe("OpenAPI 3.1 agent catalog", () => {
  const spec = getOpenApiDocument();

  it("is OpenAPI 3.1 with agent discovery metadata", () => {
    assert.equal(spec.openapi, "3.1.0");
    const info = asRecord(spec.info, "info");
    assert.equal(asRecord(info.contact, "contact").email, "hello@aefi.io");
    assert.equal(info.description, INFO_DESCRIPTION);
    assert.equal(info["x-guidance"], X_GUIDANCE);
    assert.ok(String(info["x-guidance"]).length < 4000);
    assert.equal(
      asRecord(spec.externalDocs, "externalDocs").url,
      "https://aefi.io/docs/api.html",
    );
  });

  it("declares x-payment-info, schemas, and 402 on every paid operation", () => {
    const paths = asRecord(spec.paths, "paths");
    for (const op of PAID_PATHS) {
      const item = asRecord(paths[op.path], op.path);
      const operation = asRecord(item[op.method], `${op.path} ${op.method}`);
      assert.deepEqual(operation["x-payment-info"], X_PAYMENT_INFO);
      const price = asRecord(
        asRecord(operation["x-payment-info"], "x-payment-info").price,
        "price",
      );
      assert.equal(price.amount, "0.010000");
      assert.equal(price.currency, "USDC");
      const paymentInfo = operation["x-payment-info"] as unknown as {
        protocols: Array<Record<string, unknown>>;
      };
      assert.ok(paymentInfo.protocols.some((p) => p && "x402" in p));
      assert.ok(paymentInfo.protocols.some((p) => p && "mpp" in p));

      const responses = asRecord(operation.responses, `${op.path} responses`);
      assert.ok(responses["402"], `${op.path} missing 402`);

      if (op.method === "post") {
        const body = asRecord(operation.requestBody, `${op.path} requestBody`);
        const content = asRecord(body.content, "content");
        const json = asRecord(content["application/json"], "application/json");
        assert.ok(json.schema, `${op.path} missing JSON schema`);
      } else {
        const params = operation.parameters;
        assert.ok(Array.isArray(params) && params.length > 0, `${op.path} missing parameters`);
        for (const param of params) {
          const p = asRecord(param, "param");
          assert.equal(typeof p.description, "string", `${op.path} param missing description`);
          const schema = asRecord(p.schema, "param.schema");
          assert.ok(schema.type, `${op.path} param untyped`);
        }
      }
    }
  });

  it("describes every component schema field", () => {
    const components = asRecord(spec.components, "components");
    const schemas = asRecord(components.schemas, "schemas");
    for (const [name, raw] of Object.entries(schemas)) {
      assertDescribedSchema(asRecord(raw, name), name);
    }
  });
});
