use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use sqlx::mysql::{MySqlPool, MySqlPoolOptions};
use std::{env, sync::Arc};
use tokio::sync::{mpsc, oneshot};

#[derive(Serialize, sqlx::FromRow)]
struct User {
    id: i32,
    name: String,
    email: String,
}

/* ---------- PRIME LOGIC ---------- */

fn is_prime(num: i32) -> bool {
    if num <= 1 {
        return false;
    }
    let limit = (num as f64).sqrt() as i32;
    for i in 2..=limit {
        if num % i == 0 {
            return false;
        }
    }
    true
}

fn compute_10k_prime() -> i32 {
    let mut count = 0;
    let mut num = 2;
    while count < 10_000 {
        if is_prime(num) {
            count += 1;
        }
        num += 1;
    }
    num - 1
}

/* ---------- WORKER POOL ---------- */

type Job = oneshot::Sender<i32>;

#[derive(Clone)]
struct AppState {
    pool: MySqlPool,
    job_tx: mpsc::Sender<Job>,
}

fn start_workers(rx: Arc<tokio::sync::Mutex<mpsc::Receiver<Job>>>) {
    let workers = num_cpus::get();

    for _ in 0..workers {
        let rx = rx.clone();
        std::thread::spawn(move || loop {
            let job = rx.blocking_lock().blocking_recv();
            if let Some(tx) = job {
                let result = compute_10k_prime();
                let _ = tx.send(result);
            }
        });
    }
}

/* ---------- MAIN ---------- */

#[tokio::main]
async fn main() {
    let database_url = env::var("DATABASE_URL").unwrap();

    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .unwrap();

    let (job_tx, job_rx) = mpsc::channel::<Job>(5000);
    start_workers(Arc::new(tokio::sync::Mutex::new(job_rx)));

    let state = AppState { pool, job_tx };

    let app = Router::new()
        .route("/db/:id", get(get_user))
        .route("/calc", get(calc))
        .with_state(state);

    axum::serve(
        tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap(),
        app,
    )
    .await
    .unwrap();
}

/* ---------- HANDLERS ---------- */

async fn get_user(
    Path(id): Path<i32>,
    State(state): State<AppState>,
) -> Json<User> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, name, email FROM users WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await
    .unwrap();

    Json(user)
}

async fn calc(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    let (tx, rx) = oneshot::channel();

    state
        .job_tx
        .try_send(tx)
        .map_err(|_| StatusCode::TOO_MANY_REQUESTS)?;

    let result = rx.await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({ "result": result })))
}
