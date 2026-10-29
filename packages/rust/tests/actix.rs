#![cfg(feature = "actix")]

mod common;

use actix_web::{http::StatusCode, test, App};

#[actix_web::test]
async fn serves_the_catalog_ui_and_document() {
    let app = test::init_service(App::new().configure(common::catalog().configure("/docs"))).await;

    let res = test::call_service(&app, test::TestRequest::get().uri("/docs").to_request()).await;
    assert_eq!(res.status(), StatusCode::OK);
    let body = String::from_utf8(test::read_body(res).await.to_vec()).unwrap();
    assert!(body.contains("<title>Users API</title>"));

    let doc: serde_json::Value = test::call_and_read_body_json(
        &app,
        test::TestRequest::get()
            .uri("/docs/default.json")
            .to_request(),
    )
    .await;
    assert_eq!(doc["paths"]["/users/{id}"]["get"]["summary"], "Get user");

    let res = test::call_service(
        &app,
        test::TestRequest::get()
            .uri("/docs/other.json")
            .to_request(),
    )
    .await;
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
