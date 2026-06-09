use crate::{render::render_catalog_html, spec::CatalogOptions};
use axum::{
    body::Body,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde_json::Value;
use std::sync::Arc;

struct CatalogState {
    html: String,
    scopes: Vec<(String, Value)>, // (id, document)
}

/// Axum handler that serves the catalog HTML.
async fn html_handler(
    axum::extract::State(state): axum::extract::State<Arc<CatalogState>>,
) -> impl IntoResponse {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .body(Body::from(state.html.clone()))
        .unwrap()
}

/// Axum handler that serves a scope's OpenAPI JSON document.
async fn scope_json_handler(
    axum::extract::Path(scope_id): axum::extract::Path<String>,
    axum::extract::State(state): axum::extract::State<Arc<CatalogState>>,
) -> impl IntoResponse {
    match state.scopes.iter().find(|(id, _)| id == &scope_id) {
        Some((_, doc)) => axum::Json(doc.clone()).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

/// Build an Axum `Router` that serves the catalog UI and spec endpoints.
///
///   GET {base_path}              → catalog HTML
///   GET {base_path}/{id}.json    → OpenAPI spec for that scope
///
/// ```rust,ignore
/// let app = Router::new()
///     .route("/users", get(list_users))
///     .merge(catalog.into_axum_router("/docs"));
/// ```
pub fn into_axum_router(opts: CatalogOptions) -> Router {
    let html = render_catalog_html(&opts);
    let scopes: Vec<(String, Value)> = opts
        .scopes
        .iter()
        .map(|s| (s.id.clone(), s.document.clone()))
        .collect();

    let state = Arc::new(CatalogState { html, scopes });

    Router::new()
        .route("/", get(html_handler))
        .route("/:scope_id.json", get(scope_json_handler))
        .with_state(state)
}
