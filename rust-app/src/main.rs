use axum::{
    extract::{Path, State},
    routing::get,
    Router, Json, http::StatusCode,
};
use std::{net::SocketAddr, env, time::{Instant, Duration}};
use serde::{Serialize, Deserialize};
use sqlx::mysql::{MySqlPoolOptions, MySqlPool};
use serde_json::json;

// Define a struct for shared application state
#[derive(Clone)]
struct AppState {
    pool: MySqlPool,
}

#[tokio::main]
async fn main() {
    // Database connection using SQLx
    dotenv::dotenv().ok(); // Load .env file
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        .connect(&database_url).await.expect("Failed to create SQLx pool.");

    let shared_state = AppState { pool };

    let app = Router::new()
        .route("/users/:id", get(handle_get_users))
        .route("/complex/:n", get(handle_complex))
        .with_state(shared_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!("Rust listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// Complex Fibonacci function (CPU-intensive)
fn fib(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fib(n - 1) + fib(n - 2),
    }
}

// --- 1. Original Endpoint (I/O Stress) ---
#[derive(sqlx::FromRow, Serialize)]
struct User {
    name: String,
}

async fn handle_get_users(
    State(state): State<AppState>,
    Path(id): Path<u32>,
) -> Result<Json<User>, (StatusCode, String)> {
    let user = sqlx::query_as::<_, User>("SELECT name FROM users WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB Error: {}", e)))?;

    match user {
        Some(u) => Ok(Json(u)),
        None => Err((StatusCode::NOT_FOUND, "user not found".to_string())),
    }
}

// --- 2. New Complex Endpoint (CPU + I/O Stress) ---
async fn handle_complex(
    State(state): State<AppState>,
    Path(n): Path<u32>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // 1. CPU-intensive calculation
    let start = Instant::now();
    let result = tokio::task::spawn_blocking(move || fib(n)).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Task error: {}", e)))?;
    let duration_ms = start.elapsed().as_millis() as u64;

    // 2. I/O operation (DB Query)
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("DB Count Error: {}", e)))?;
    let db_rows = count.0;

    // 3. Return results including the calculation time (for metric extraction)
    Ok(Json(json!({
        "fib_input": n,
        "fib_result": result,
        "calc_time_ms": duration_ms, // New metric
        "db_rows": db_rows,
        "language": "Rust",
    })))
}