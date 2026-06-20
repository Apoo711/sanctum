use std::fs::File;
use std::io::Read;
use std::time::{SystemTime, UNIX_EPOCH};
use ytmapi_rs::{
    Client, YtMusicBuilder, auth::BrowserToken, auth::OAuthToken, query::GetHistoryQuery,
};

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

#[tokio::main]
async fn main() {
    load_env_file();
    println!("Testing YouTube Music Authentication...");
    let client = Client::new().unwrap();

    // 1. Try OAuth
    println!("\n--- 1. Testing OAuth ---");
    let oauth_file = find_file("oauth.json")
        .and_then(|path| {
            println!("Found oauth file at: {:?}", path);
            File::open(path).ok()
        });

    if let Some(mut file) = oauth_file {
        let mut contents = String::new();
        if let Err(e) = file.read_to_string(&mut contents) {
            println!("Failed to read oauth file: {}", e);
        } else {
            match serde_json::from_str::<serde_json::Value>(&contents) {
                Ok(oauth_val) => {
                    let expires_at = oauth_val.get("expires_at").and_then(|v| v.as_u64()).unwrap_or(0);
                    let expires_in = oauth_val.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3599);

                    let request_time_secs = if expires_at > expires_in {
                        expires_at - expires_in
                    } else {
                        SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs()
                    };

                    let oauth_token_json = serde_json::json!({
                        "token_type": oauth_val.get("token_type").and_then(|v| v.as_str()).unwrap_or("Bearer"),
                        "access_token": oauth_val.get("access_token").and_then(|v| v.as_str()).unwrap_or(""),
                        "refresh_token": oauth_val.get("refresh_token").and_then(|v| v.as_str()).unwrap_or(""),
                        "expires_in": expires_in,
                        "request_time": {
                            "secs_since_epoch": request_time_secs,
                            "nanos_since_epoch": 0
                        },
                        "client_id": std::env::var("CLIENT_ID").or_else(|_| std::env::var("OAUTH_CLIENT_ID")).unwrap_or_else(|_| "861556734302-3gqQb337Q6J7-WEYFDNX30.apps.googleusercontent.com".to_string()),
                        "client_secret": std::env::var("CLIENT_SECRET").or_else(|_| std::env::var("OAUTH_CLIENT_SECRET")).unwrap_or_default()
                    });

                    println!("Constructed oauth_token_json: {}", oauth_token_json);

                    match serde_json::from_value::<OAuthToken>(oauth_token_json) {
                        Ok(token) => {
                            let yt = YtMusicBuilder::new_with_client(client.clone())
                                .with_auth_token(token)
                                .build();
                            
                            match yt {
                                Ok(yt_client) => {
                                    match yt_client.query(GetHistoryQuery).await {
                                        Ok(history) => {
                                            println!("OAuth SUCCESS! History count: {}", history.len());
                                        }
                                        Err(e) => {
                                            println!("OAuth query failed: {:?}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    println!("Failed to build YtMusic client with OAuthToken: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            println!("Failed to parse OAuthToken from synthesized JSON: {}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("Failed to parse oauth.json as raw JSON: {}", e);
                }
            }
        }
    } else {
        println!("No oauth.json found.");
    }

    // 2. Try Browser
    println!("\n--- 2. Testing Browser Token ---");
    let browser_file = find_file("browser.json")
        .and_then(|path| {
            println!("Found browser file at: {:?}", path);
            File::open(path).ok()
        });

    if let Some(mut file) = browser_file {
        let mut contents = String::new();
        if let Err(e) = file.read_to_string(&mut contents) {
            println!("Failed to read browser file: {}", e);
        } else {
            match serde_json::from_str::<serde_json::Value>(&contents) {
                Ok(config) => {
                    if let Some(cookie) = config.get("cookie").and_then(|c| c.as_str()) {
                        println!("Found cookie in browser.json. Attempting BrowserToken::from_str...");
                        match BrowserToken::from_str(cookie, &client).await {
                            Ok(token) => {
                                let yt = YtMusicBuilder::new_with_client(client.clone())
                                    .with_auth_token(token)
                                    .build();
                                
                                match yt {
                                    Ok(yt_client) => {
                                        match yt_client.query(GetHistoryQuery).await {
                                            Ok(history) => {
                                                println!("Browser Cookie SUCCESS! History count: {}", history.len());
                                            }
                                            Err(e) => {
                                                println!("Browser query failed: {:?}", e);
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        println!("Failed to build YtMusic client with BrowserToken: {}", e);
                                    }
                                }
                            }
                            Err(e) => {
                                println!("BrowserToken::from_str failed: {:?}", e);
                            }
                        }
                    } else {
                        println!("cookie field missing or not a string in browser.json");
                    }
                }
                Err(e) => {
                    println!("Failed to parse browser.json as raw JSON: {}", e);
                }
            }
        }
    } else {
        println!("No browser.json found.");
    }
}
