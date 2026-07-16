use std::{fs::File, io::Read, sync::Arc};

use axum::{
    extract::{Json, State},
    http::{header, HeaderValue, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use ytmapi_rs::{
    auth::{AuthToken, BrowserToken, LoggedIn},
    common::YoutubeID,
    parse::HistoryItem,
    query::GetHistoryQuery,
    Client, YtMusicBuilder,
};

#[cfg(target_os = "linux")]
#[global_allocator]
static GLOBAL: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;

#[cfg(target_os = "windows")]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

// 1. SongState Struct
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SongState {
    pub status: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail: Option<String>,
    pub video_id: Option<String>,
    pub message: Option<String>,
}

// 2. AppState Struct
pub struct AppState {
    pub current_song: Arc<RwLock<SongState>>,
}

// 3. PasswordRequest Struct
#[derive(Deserialize, Debug)]
pub struct PasswordRequest {
    pub password: String,
}

// 4. Poem Struct
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Poem {
    pub title: String,
    pub content: String,
    pub date: String,
}

// 5. Quote Struct
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Quote {
    pub text: String,
    pub author: String,
}

// 6. QuoteState Struct
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct QuoteState {
    pub current_index: usize,
    pub last_update_date: String,
}

// Helper to load environment variables from .env
// Helper to dynamically locate a file checking CWD, its parent/child folders,
// and walking up the executable path directory tree.
fn find_file(filename: &str) -> Option<std::path::PathBuf> {
    // 1. Check relative to CWD
    let cwd_paths = [
        std::path::PathBuf::from(filename),
        std::path::PathBuf::from("backend").join(filename),
        std::path::PathBuf::from("..").join(filename),
    ];
    for path in &cwd_paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    // 2. Check relative to executable directory and its parents
    if let Ok(exe_path) = std::env::current_exe() {
        let mut dir = exe_path.parent();
        while let Some(parent) = dir {
            let path = parent.join(filename);
            if path.exists() {
                return Some(path);
            }
            let backend_path = parent.join("backend").join(filename);
            if backend_path.exists() {
                return Some(backend_path);
            }
            dir = parent.parent();
        }
    }

    None
}

// Helper to load environment variables from all found .env files
fn load_env_file() {
    let mut loaded_any = false;
    let mut env_paths = vec![
        std::path::PathBuf::from(".env"),
        std::path::PathBuf::from("backend/.env"),
        std::path::PathBuf::from("../.env"),
    ];

    if let Ok(exe_path) = std::env::current_exe() {
        let mut dir = exe_path.parent();
        while let Some(parent) = dir {
            env_paths.push(parent.join(".env"));
            env_paths.push(parent.join("backend/.env"));
            dir = parent.parent();
        }
    }

    // De-duplicate paths while preserving order
    let mut unique_paths = Vec::new();
    for p in env_paths {
        if !unique_paths.contains(&p) {
            unique_paths.push(p);
        }
    }

    for path in unique_paths {
        if let Ok(content) = std::fs::read_to_string(&path) {
            println!("Loading environment variables from: {:?}", path);
            for line in content.lines() {
                let line = line.trim();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                if let Some((key, val)) = line.split_once('=') {
                    let key = key.trim();
                    let val = val.trim().trim_matches('"').trim_matches('\'').trim();
                    std::env::set_var(key, val);
                }
            }
            loaded_any = true;
        }
    }

    if !loaded_any {
        println!("Warning: No .env file could be loaded.");
    }
}

// Helper to query history from YtMusic client
async fn query_yt_history<A: AuthToken + LoggedIn>(
    yt: ytmapi_rs::YtMusic<A>,
) -> Result<SongState, Box<dyn std::error::Error + Send + Sync>> {
    let history = yt.query(GetHistoryQuery).await?;
    if history.is_empty() || history[0].items.is_empty() {
        return Ok(SongState {
            status: "idle".to_string(),
            title: None,
            artist: None,
            album: None,
            thumbnail: None,
            video_id: None,
            message: Some("No playback history found".to_string()),
        });
    }

    // Extract latest track
    let latest_item = &history[0].items[0];
    match latest_item {
        HistoryItem::Song(x) => {
            let title = x.title.clone();
            let artist = x
                .artists
                .iter()
                .map(|a| a.name.clone())
                .collect::<Vec<String>>()
                .join(", ");
            let album = x.album.name.clone();
            let thumbnail = x.thumbnails.last().map(|t| t.url.clone());
            let video_id = x.video_id.get_raw().to_string();

            Ok(SongState {
                status: "playing".to_string(),
                title: Some(title),
                artist: Some(artist),
                album: Some(album),
                thumbnail,
                video_id: Some(video_id),
                message: None,
            })
        }
        _ => Ok(SongState {
            status: "idle".to_string(),
            title: None,
            artist: None,
            album: None,
            thumbnail: None,
            video_id: None,
            message: Some("Latest history item is not a song".to_string()),
        }),
    }
}

// Helper to fetch the latest song from YouTube Music using ytmapi-rs
// (supporting browser.json)
async fn fetch_real_song() -> Result<SongState, Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new()?;

    println!("Attempting authentication using browser.json...");
    let resolved_browser_path =
        find_file("browser.json").ok_or("browser.json authentication session file not found")?;
    let mut file = File::open(resolved_browser_path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;

    let config: serde_json::Value = serde_json::from_str(&contents)?;
    let cookie = config
        .get("cookie")
        .and_then(|c| c.as_str())
        .ok_or("cookie field missing or not a string in browser.json")?;

    let token = BrowserToken::from_str(cookie, &client).await?;
    let yt = YtMusicBuilder::new_with_client(client)
        .with_auth_token(token)
        .build()?;

    query_yt_history(yt).await
}

// Background caching loop
async fn update_song_cache(state: Arc<AppState>) {
    println!("Background cache worker loop engaged.");
    let mut mock_counter = 0;

    loop {
        // Sleep for 45 seconds
        tokio::time::sleep(tokio::time::Duration::from_secs(45)).await;

        println!("Background worker: Querying YouTube Music history...");

        // Try to fetch the real song first
        match fetch_real_song().await {
            Ok(real_song) => {
                let mut current_song = state.current_song.write().await;
                *current_song = real_song;
                println!(
                    "Cache updated successfully with live track: {:?}",
                    current_song.title
                );
            }
            Err(err) => {
                eprintln!(
                    "Real fetch failed: {}. Falling back to mock rotation...",
                    err
                );

                let mock_song = if mock_counter % 2 == 0 {
                    SongState {
                        status: "playing".to_string(),
                        title: Some("Weightless".to_string()),
                        artist: Some("Marconi Union".to_string()),
                        album: Some("Ambient 1".to_string()),
                        thumbnail: Some(
                            "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17"
                                .to_string(),
                        ),
                        video_id: Some("UfcAVejsvU4".to_string()),
                        message: None,
                    }
                } else {
                    SongState {
                        status: "playing".to_string(),
                        title: Some("Spiegel im Spiegel".to_string()),
                        artist: Some("Arvo Pärt".to_string()),
                        album: Some("Alina".to_string()),
                        thumbnail: Some(
                            "https://images.unsplash.com/photo-1511379938547-c1f69419868d"
                                .to_string(),
                        ),
                        video_id: Some("FZhOF13yWzE".to_string()),
                        message: None,
                    }
                };

                mock_counter += 1;

                let mut current_song = state.current_song.write().await;
                *current_song = mock_song;
                println!(
                    "Cache updated with mock data: {} - {}",
                    current_song.title.as_deref().unwrap_or(""),
                    current_song.artist.as_deref().unwrap_or("")
                );
            }
        }
    }
}

// 1. GET /api/recently-played
async fn get_recently_played(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let current_song = state.current_song.read().await;

    let status_code = if current_song.status == "error" {
        StatusCode::INTERNAL_SERVER_ERROR
    } else {
        StatusCode::OK
    };

    (status_code, Json(current_song.clone()))
}

// 2. POST /api/poems
async fn get_poems(Json(payload): Json<PasswordRequest>) -> Result<Json<Vec<Poem>>, StatusCode> {
    let expected_password = match std::env::var("POEM_PASSWORD") {
        Ok(pass) => pass,
        Err(_) => return Err(StatusCode::UNAUTHORIZED),
    };

    if payload.password == expected_password {
        let mut file = match find_file("poems.json") {
            Some(path) => match File::open(path) {
                Ok(f) => f,
                Err(e) => {
                    eprintln!("Failed to open poems.json: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            },
            None => {
                eprintln!("poems.json not found in any of the expected paths.");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        };

        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_err() {
            eprintln!("Failed to read poems.json content.");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }

        match serde_json::from_str::<Vec<Poem>>(&contents) {
            Ok(poems) => Ok(Json(poems)),
            Err(e) => {
                eprintln!("Failed to parse poems.json: {}", e);
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

// 3. GET /api/quote
async fn get_daily_quote() -> Result<Json<Quote>, StatusCode> {
    use chrono::Local;

    // 1. Load quotes list
    let mut file = match find_file("quotes.json") {
        Some(path) => match File::open(path) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("Failed to open quotes.json: {}", e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        },
        None => {
            eprintln!("quotes.json not found in any of the expected paths.");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    let mut contents = String::new();
    if file.read_to_string(&mut contents).is_err() {
        eprintln!("Failed to read quotes.json content.");
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
    let quotes: Vec<Quote> = match serde_json::from_str(&contents) {
        Ok(q) => q,
        Err(e) => {
            eprintln!("Failed to parse quotes.json: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    if quotes.is_empty() {
        eprintln!("quotes.json is empty.");
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 2. Load/Update Quote State
    let resolved_state_path = find_file("quote-state.json")
        .unwrap_or_else(|| std::path::PathBuf::from("quote-state.json"));

    let mut current_state = QuoteState {
        current_index: 0,
        last_update_date: "".to_string(),
    };

    if let Ok(mut f) = File::open(&resolved_state_path) {
        let mut s_contents = String::new();
        if f.read_to_string(&mut s_contents).is_ok() {
            if let Ok(parsed_state) = serde_json::from_str::<QuoteState>(&s_contents) {
                current_state = parsed_state;
            }
        }
    }

    // Get today's date string: "YYYY-MM-DD"
    let today = Local::now().format("%Y-%m-%d").to_string();

    if current_state.last_update_date != today {
        // Increment index and update date
        if !current_state.last_update_date.is_empty() {
            current_state.current_index = (current_state.current_index + 1) % quotes.len();
        }
        current_state.last_update_date = today;

        // Write back to state file
        if let Ok(serialized) = serde_json::to_string_pretty(&current_state) {
            let _ = std::fs::write(&resolved_state_path, serialized);
        }
    }

    let selected_quote = quotes
        .get(current_state.current_index)
        .unwrap_or(&quotes[0]);
    Ok(Json(selected_quote.clone()))
}

#[tokio::main]
async fn main() {
    // 0. Load env file
    load_env_file();

    // 1. Initialize the AppState with a default "offline" song state
    let initial_song = SongState {
        status: "idle".to_string(),
        title: None,
        artist: None,
        album: None,
        thumbnail: None,
        video_id: None,
        message: Some("Offline - Caching process starting...".to_string()),
    };

    let shared_state = Arc::new(AppState {
        current_song: Arc::new(RwLock::new(initial_song)),
    });

    // 2. Spawn the background caching task loop
    tokio::spawn(update_song_cache(Arc::clone(&shared_state)));

    // 3. Set up the Axum Router with CORS rules
    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:3000".parse::<HeaderValue>().unwrap(),
            "http://127.0.0.1:3000".parse::<HeaderValue>().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    let app = Router::new()
        .route("/api/recently-played", get(get_recently_played))
        .route("/api/poems", post(get_poems))
        .route("/api/quote", get(get_daily_quote))
        .layer(cors)
        .with_state(shared_state);

    // 4. Bind the Router to 127.0.0.1:8000
    let addr = "127.0.0.1:8000";
    println!("Server starting on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    // 5. Start the Axum hyper server using Axum 0.7 serve syntax
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempRenameGuard {
        renamed: Vec<(String, String)>,
    }

    impl TempRenameGuard {
        fn new(paths: &[&str]) -> Self {
            let mut renamed = Vec::new();
            for path in paths {
                if std::path::Path::new(path).exists() {
                    let temp_path = format!("{}.bak", path);
                    if std::fs::rename(path, &temp_path).is_ok() {
                        renamed.push((path.to_string(), temp_path));
                    }
                }
            }
            Self { renamed }
        }
    }

    impl Drop for TempRenameGuard {
        fn drop(&mut self) {
            for (original, temp) in &self.renamed {
                let _ = std::fs::rename(temp, original);
            }
        }
    }

    #[tokio::test]
    async fn test_get_daily_quote_missing_file() {
        // Temporarily rename all possible paths of quotes.json
        let _guard =
            TempRenameGuard::new(&["quotes.json", "backend/quotes.json", "../quotes.json"]);

        // Request the handler
        let result = get_daily_quote().await;

        // Verify it returned Internal Server Error (500)
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[tokio::test]
    async fn test_get_poems_no_env_var() {
        std::env::remove_var("POEM_PASSWORD");
        let payload = PasswordRequest {
            password: "any_password".to_string(),
        };
        let result = get_poems(axum::Json(payload)).await;
        assert_eq!(result.unwrap_err(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_get_poems_wrong_password() {
        std::env::set_var("POEM_PASSWORD", "correct_password");
        let payload = PasswordRequest {
            password: "wrong_password".to_string(),
        };
        let result = get_poems(axum::Json(payload)).await;
        assert_eq!(result.unwrap_err(), StatusCode::UNAUTHORIZED);
        std::env::remove_var("POEM_PASSWORD");
    }
}
