use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

// ── Schema builder ────────────────────────────────────────────────────────────

/// Ergonomic JSON-Schema / OpenAPI schema value builder.
/// Use `Schema::string()`, `Schema::object(...)`, etc. in route definitions.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Schema(pub Value);

impl Schema {
    pub fn string() -> Self {
        Schema(json!({ "type": "string" }))
    }

    pub fn string_with(opts: Value) -> Self {
        let mut v = json!({ "type": "string" });
        merge_into(&mut v, opts);
        Schema(v)
    }

    pub fn integer() -> Self {
        Schema(json!({ "type": "integer" }))
    }

    pub fn integer_with(opts: Value) -> Self {
        let mut v = json!({ "type": "integer" });
        merge_into(&mut v, opts);
        Schema(v)
    }

    pub fn number() -> Self {
        Schema(json!({ "type": "number" }))
    }

    pub fn boolean() -> Self {
        Schema(json!({ "type": "boolean" }))
    }

    pub fn array(items: Schema) -> Self {
        Schema(json!({ "type": "array", "items": items.0 }))
    }

    pub fn object(properties: Vec<(&str, Schema)>) -> Self {
        let props: Value = Value::Object(
            properties
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.0))
                .collect(),
        );
        Schema(json!({ "type": "object", "properties": props }))
    }

    pub fn object_required(properties: Vec<(&str, Schema)>, required: Vec<&str>) -> Self {
        let props: Value = Value::Object(
            properties
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.0))
                .collect(),
        );
        Schema(json!({ "type": "object", "properties": props, "required": required }))
    }

    /// Reference a named schema from components/schemas.
    pub fn object_ref(name: &str) -> Self {
        Schema(json!({ "$ref": format!("#/components/schemas/{}", name) }))
    }

    pub fn nullable(mut self) -> Self {
        if let Value::Object(ref mut m) = self.0 {
            m.insert("nullable".to_string(), Value::Bool(true));
        }
        self
    }

    pub fn optional(mut self) -> Self {
        if let Value::Object(ref mut m) = self.0 {
            m.insert("nullable".to_string(), Value::Bool(true));
        }
        self
    }

    pub fn into_value(self) -> Value {
        self.0
    }
}

fn merge_into(base: &mut Value, extra: Value) {
    if let (Value::Object(b), Value::Object(e)) = (base, extra) {
        for (k, v) in e {
            b.insert(k, v);
        }
    }
}

// ── RouteDoc ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct RouteDoc {
    pub method: String,
    pub path: String,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub deprecated: bool,
    pub parameters: Vec<ParameterDoc>,
    pub request_body: Option<RequestBodyDoc>,
    pub responses: Vec<ResponseDoc>,
}

#[derive(Debug, Clone)]
pub struct ParameterDoc {
    pub name: String,
    pub location: String, // "query" | "path" | "header"
    pub required: bool,
    pub description: Option<String>,
    pub schema: Option<Schema>,
}

#[derive(Debug, Clone)]
pub struct RequestBodyDoc {
    pub description: Option<String>,
    pub required: bool,
    pub schema: Schema,
}

#[derive(Debug, Clone)]
pub struct ResponseDoc {
    pub status: u16,
    pub description: String,
    pub schema: Option<Schema>,
}

impl RouteDoc {
    pub fn new(method: &str, path: &str) -> Self {
        RouteDoc {
            method: method.to_uppercase(),
            path: path.to_string(),
            ..Default::default()
        }
    }

    pub fn summary(mut self, s: &str) -> Self {
        self.summary = Some(s.to_string());
        self
    }

    pub fn description(mut self, d: &str) -> Self {
        self.description = Some(d.to_string());
        self
    }

    pub fn tag(mut self, t: &str) -> Self {
        self.tags.push(t.to_string());
        self
    }

    pub fn deprecated(mut self) -> Self {
        self.deprecated = true;
        self
    }

    pub fn query(mut self, name: &str, schema: Schema) -> Self {
        self.parameters.push(ParameterDoc {
            name: name.to_string(),
            location: "query".to_string(),
            required: false,
            description: None,
            schema: Some(schema),
        });
        self
    }

    pub fn query_required(mut self, name: &str, schema: Schema) -> Self {
        self.parameters.push(ParameterDoc {
            name: name.to_string(),
            location: "query".to_string(),
            required: true,
            description: None,
            schema: Some(schema),
        });
        self
    }

    pub fn path_param(mut self, name: &str, schema: Schema) -> Self {
        self.parameters.push(ParameterDoc {
            name: name.to_string(),
            location: "path".to_string(),
            required: true,
            description: None,
            schema: Some(schema),
        });
        self
    }

    pub fn body(mut self, schema: Schema) -> Self {
        self.request_body = Some(RequestBodyDoc {
            description: None,
            required: true,
            schema,
        });
        self
    }

    pub fn body_optional(mut self, schema: Schema) -> Self {
        self.request_body = Some(RequestBodyDoc {
            description: None,
            required: false,
            schema,
        });
        self
    }

    pub fn response(mut self, status: u16, description: &str, schema: Schema) -> Self {
        self.responses.push(ResponseDoc {
            status,
            description: description.to_string(),
            schema: Some(schema),
        });
        self
    }

    pub fn response_empty(mut self, status: u16, description: &str) -> Self {
        self.responses.push(ResponseDoc {
            status,
            description: description.to_string(),
            schema: None,
        });
        self
    }

    pub(crate) fn to_openapi_operation(&self) -> Value {
        let mut op = serde_json::Map::new();

        if let Some(ref s) = self.summary {
            op.insert("summary".to_string(), Value::String(s.clone()));
        }
        if let Some(ref d) = self.description {
            op.insert("description".to_string(), Value::String(d.clone()));
        }
        if !self.tags.is_empty() {
            op.insert("tags".to_string(), json!(self.tags));
        }
        if self.deprecated {
            op.insert("deprecated".to_string(), Value::Bool(true));
        }

        if !self.parameters.is_empty() {
            let params: Vec<Value> = self
                .parameters
                .iter()
                .map(|p| {
                    let mut pm = serde_json::Map::new();
                    pm.insert("name".to_string(), Value::String(p.name.clone()));
                    pm.insert("in".to_string(), Value::String(p.location.clone()));
                    pm.insert("required".to_string(), Value::Bool(p.required));
                    if let Some(ref d) = p.description {
                        pm.insert("description".to_string(), Value::String(d.clone()));
                    }
                    if let Some(ref s) = p.schema {
                        pm.insert("schema".to_string(), s.0.clone());
                    }
                    Value::Object(pm)
                })
                .collect();
            op.insert("parameters".to_string(), Value::Array(params));
        }

        if let Some(ref body) = self.request_body {
            op.insert(
                "requestBody".to_string(),
                json!({
                    "required": body.required,
                    "content": {
                        "application/json": { "schema": body.schema.0 }
                    }
                }),
            );
        }

        let mut responses = serde_json::Map::new();
        for r in &self.responses {
            let mut rm = serde_json::Map::new();
            rm.insert("description".to_string(), Value::String(r.description.clone()));
            if let Some(ref s) = r.schema {
                rm.insert(
                    "content".to_string(),
                    json!({ "application/json": { "schema": s.0 } }),
                );
            }
            responses.insert(r.status.to_string(), Value::Object(rm));
        }
        if !responses.is_empty() {
            op.insert("responses".to_string(), Value::Object(responses));
        }

        Value::Object(op)
    }
}

/// Convenience macro: `route!(GET "/users")` creates a `RouteDoc`.
#[macro_export]
macro_rules! route {
    ($method:ident $path:literal) => {
        $crate::spec::RouteDoc::new(stringify!($method), $path)
    };
}

// ── CatalogScope / CatalogOptions ─────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct CatalogScope {
    pub id: String,
    pub label: String,
    pub document: Value,
}

#[derive(Debug, Clone)]
pub struct CatalogOptions {
    pub title: String,
    pub server_url: Option<String>,
    pub scopes: Vec<CatalogScope>,
}

// ── SpecBuilder ───────────────────────────────────────────────────────────────

/// Fluent builder for the OpenAPI document embedded in a CatalogScope.
#[derive(Debug, Default)]
pub struct SpecBuilder {
    title: String,
    version: String,
    description: Option<String>,
    servers: Vec<Value>,
    tags: Vec<Value>,
    paths: HashMap<String, HashMap<String, Value>>,
    schemas: HashMap<String, Value>,
}

impl SpecBuilder {
    pub fn new() -> Self {
        SpecBuilder {
            version: "1.0.0".to_string(),
            ..Default::default()
        }
    }

    pub fn title(mut self, t: &str) -> Self {
        self.title = t.to_string();
        self
    }

    pub fn version(mut self, v: &str) -> Self {
        self.version = v.to_string();
        self
    }

    pub fn description(mut self, d: &str) -> Self {
        self.description = Some(d.to_string());
        self
    }

    pub fn server(mut self, url: &str) -> Self {
        self.servers.push(json!({ "url": url }));
        self
    }

    pub fn server_described(mut self, url: &str, description: &str) -> Self {
        self.servers
            .push(json!({ "url": url, "description": description }));
        self
    }

    pub fn tag(mut self, name: &str, description: &str) -> Self {
        self.tags.push(json!({ "name": name, "description": description }));
        self
    }

    pub fn schema(mut self, name: &str, schema: Schema) -> Self {
        self.schemas.insert(name.to_string(), schema.0);
        self
    }

    pub fn route(mut self, doc: RouteDoc) -> Self {
        let method = doc.method.to_lowercase();
        self.paths
            .entry(doc.path.clone())
            .or_default()
            .insert(method, doc.to_openapi_operation());
        self
    }

    pub fn build(self) -> Value {
        let mut info = json!({ "title": self.title, "version": self.version });
        if let Some(ref d) = self.description {
            info["description"] = Value::String(d.clone());
        }

        let paths: serde_json::Map<String, Value> = self
            .paths
            .into_iter()
            .map(|(path, methods)| {
                let methods_val: serde_json::Map<String, Value> =
                    methods.into_iter().collect();
                (path, Value::Object(methods_val))
            })
            .collect();

        let mut doc = json!({
            "openapi": "3.0.3",
            "info": info,
            "paths": Value::Object(paths),
        });

        if !self.servers.is_empty() {
            doc["servers"] = Value::Array(self.servers);
        }
        if !self.tags.is_empty() {
            doc["tags"] = Value::Array(self.tags);
        }
        if !self.schemas.is_empty() {
            let schemas: serde_json::Map<String, Value> =
                self.schemas.into_iter().collect();
            doc["components"] = json!({ "schemas": Value::Object(schemas) });
        }

        doc
    }
}
