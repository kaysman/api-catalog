#![cfg(feature = "axum")]

mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use tower::ServiceExt;

fn app() -> Router {
    Router::new().nest("/docs", common::catalog().into_axum_router())
}

async fn get(uri: &str) -> (StatusCode, String, String) {
    let res = app()
        .oneshot(Request::get(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = res.status();
    let content_type = res
        .headers()
        .get("content-type")
        .map(|v| v.to_str().unwrap().to_string())
        .unwrap_or_default();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        content_type,
        String::from_utf8(body.to_vec()).unwrap(),
    )
}

#[tokio::test]
async fn serves_the_catalog_ui() {
    let (status, content_type, body) = get("/docs").await;
    assert_eq!(status, StatusCode::OK);
    assert!(content_type.starts_with("text/html"));
    assert!(body.contains("<title>Users API</title>"));
}

#[tokio::test]
async fn serves_the_openapi_document() {
    let (status, content_type, body) = get("/docs/default.json").await;
    assert_eq!(status, StatusCode::OK);
    assert!(content_type.starts_with("application/json"));
    let doc: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(doc["paths"]["/users/{id}"]["get"]["summary"], "Get user");
}

#[tokio::test]
async fn unknown_scopes_are_not_found() {
    assert_eq!(get("/docs/other.json").await.0, StatusCode::NOT_FOUND);
    assert_eq!(get("/docs/default").await.0, StatusCode::NOT_FOUND);
}
