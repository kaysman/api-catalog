//! Users API documented with api-catalog — the Axum twin of examples/nestjs.
//!
//!   cargo run -p api-catalog-example-axum
//!   open http://localhost:3000/docs

use std::sync::{Arc, Mutex};

use api_catalog::{route, spec::Schema, Catalog};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Clone, Serialize, Deserialize)]
struct User {
    id: String,
    name: String,
    email: String,
    role: String,
}

#[derive(Deserialize)]
struct NewUser {
    name: String,
    email: String,
    role: Option<String>,
}

#[derive(Deserialize)]
struct ListQuery {
    limit: Option<usize>,
    offset: Option<usize>,
    role: Option<String>,
}

type Store = Arc<Mutex<Vec<User>>>;

async fn list_users(State(store): State<Store>, Query(q): Query<ListQuery>) -> Json<Vec<User>> {
    let users = store.lock().unwrap();
    Json(
        users
            .iter()
            .filter(|u| q.role.as_ref().is_none_or(|r| &u.role == r))
            .skip(q.offset.unwrap_or(0))
            .take(q.limit.unwrap_or(20))
            .cloned()
            .collect(),
    )
}

async fn create_user(
    State(store): State<Store>,
    Json(body): Json<NewUser>,
) -> (StatusCode, Json<User>) {
    let mut users = store.lock().unwrap();
    let user = User {
        id: (users.len() + 1).to_string(),
        name: body.name,
        email: body.email,
        role: body.role.unwrap_or_else(|| "user".into()),
    };
    users.push(user.clone());
    (StatusCode::CREATED, Json(user))
}

async fn get_user(
    State(store): State<Store>,
    Path(id): Path<String>,
) -> Result<Json<User>, StatusCode> {
    let users = store.lock().unwrap();
    users
        .iter()
        .find(|u| u.id == id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn delete_user(
    State(store): State<Store>,
    Path(id): Path<String>,
) -> Result<Json<User>, StatusCode> {
    let mut users = store.lock().unwrap();
    let idx = users
        .iter()
        .position(|u| u.id == id)
        .ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(users.remove(idx)))
}

fn catalog() -> Catalog {
    let role = Schema(json!({ "type": "string", "enum": ["admin", "user"] }));

    Catalog::builder()
        .title("Users API")
        .version("1.0.0")
        .schema(
            "User",
            Schema::object_required(
                vec![
                    ("id", Schema::string()),
                    ("name", Schema::string()),
                    ("email", Schema::string_with(json!({ "format": "email" }))),
                    ("role", role.clone()),
                ],
                vec!["id", "name", "email", "role"],
            ),
        )
        .route(
            route!(GET "/users")
                .summary("List users")
                .tag("Users")
                .query(
                    "limit",
                    Schema::integer_with(json!({ "minimum": 1, "maximum": 100 })),
                )
                .query("offset", Schema::integer_with(json!({ "minimum": 0 })))
                .query("role", role.clone())
                .response(
                    200,
                    "Paginated user list",
                    Schema::array(Schema::object_ref("User")),
                ),
        )
        .route(
            route!(POST "/users")
                .summary("Create user")
                .tag("Users")
                .body(Schema::object_required(
                    vec![
                        ("name", Schema::string()),
                        ("email", Schema::string_with(json!({ "format": "email" }))),
                        ("role", role),
                    ],
                    vec!["name", "email"],
                ))
                .response(201, "User created", Schema::object_ref("User"))
                .response_empty(422, "Validation error"),
        )
        .route(
            route!(GET "/users/:id")
                .summary("Get user by ID")
                .tag("Users")
                .path_param("id", Schema::string())
                .response(200, "User found", Schema::object_ref("User"))
                .response_empty(404, "Not found"),
        )
        .route(
            route!(DELETE "/users/:id")
                .summary("Delete user")
                .tag("Users")
                .path_param("id", Schema::string())
                .response(200, "User deleted", Schema::object_ref("User"))
                .response_empty(404, "Not found"),
        )
        .build()
}

#[tokio::main]
async fn main() {
    let store: Store = Arc::new(Mutex::new(vec![
        User {
            id: "1".into(),
            name: "Alice".into(),
            email: "alice@example.com".into(),
            role: "admin".into(),
        },
        User {
            id: "2".into(),
            name: "Bob".into(),
            email: "bob@example.com".into(),
            role: "user".into(),
        },
        User {
            id: "3".into(),
            name: "Charlie".into(),
            email: "charlie@example.com".into(),
            role: "user".into(),
        },
    ]));

    let app = Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/:id", get(get_user).delete(delete_user))
        .with_state(store)
        .nest("/docs", catalog().into_axum_router());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".into());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    println!("Server:  http://localhost:{port}");
    println!("Catalog: http://localhost:{port}/docs");
    axum::serve(listener, app).await.unwrap();
}
