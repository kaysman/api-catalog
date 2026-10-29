import { describe, expect, it } from "vitest";
import { SpecBuilder, s, toOpenApiPath } from "../src/spec/index.js";

describe("toOpenApiPath", () => {
  it.each([
    ["/users/:id", "/users/{id}"],
    ["/users/:id?", "/users/{id}"],
    ["/users/:id(\\d+)", "/users/{id}"],
    ["/orgs/:orgId/users/:userId", "/orgs/{orgId}/users/{userId}"],
    ["/users/{id}", "/users/{id}"],
    ["/users", "/users"],
  ])("%s → %s", (input, expected) => {
    expect(toOpenApiPath(input)).toBe(expected);
  });
});

describe("s schema helpers", () => {
  it("builds primitives with options", () => {
    expect(s.string({ format: "uuid" })).toEqual({ type: "string", format: "uuid" });
    expect(s.integer({ minimum: 0 })).toEqual({ type: "integer", minimum: 0 });
  });

  it("builds objects, arrays, refs and enums", () => {
    expect(s.object({ name: s.string() }, ["name"])).toMatchObject({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    });
    expect(s.array(s.ref("User"))).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/User" },
    });
    expect(s.enum(["a", "b"])).toMatchObject({ enum: ["a", "b"] });
  });
});

describe("SpecBuilder", () => {
  it("assembles info, components, security and paths", () => {
    const doc = new SpecBuilder()
      .title("Test API")
      .version("2.0.0")
      .server("https://api.example.com")
      .schema("User", s.object({ id: s.string() }, ["id"]))
      .bearerAuth()
      .security([{ bearerAuth: [] }])
      .get("/users/:id", { summary: "Get user", responses: {} })
      .post("/users", { summary: "Create user", responses: {} })
      .build();

    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info).toMatchObject({ title: "Test API", version: "2.0.0" });
    expect(doc.servers).toEqual([{ url: "https://api.example.com" }]);
    expect(doc.components?.schemas?.User).toBeDefined();
    expect(doc.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(doc.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(doc.paths ?? {})).toEqual(["/users/{id}", "/users"]);
    expect(doc.paths?.["/users/{id}"]?.get?.summary).toBe("Get user");
  });

  it("returns an independent copy from build()", () => {
    const builder = new SpecBuilder().title("A").get("/x", { responses: {} });
    const first = builder.build();
    first.info.title = "mutated";
    delete first.paths?.["/x"];
    const second = builder.build();
    expect(second.info.title).toBe("A");
    expect(second.paths?.["/x"]).toBeDefined();
  });
});
