import os
import logging
import threading
import time
from flask import Flask, jsonify
from ytmusicapi import YTMusic

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

BROWSER_FILE = "browser.json"

ytmusic = None
cache_lock = threading.Lock()
cache = {
    "status": "error",
    "message": "Initializing cache worker thread..."
}

def get_ytmusic_client():
    global ytmusic
    if ytmusic is not None:
        return ytmusic

    if not os.path.exists(BROWSER_FILE):
        raise FileNotFoundError(f"Browser session headers file '{BROWSER_FILE}' is missing in the workspace root.")

    if os.path.getsize(BROWSER_FILE) == 0:
        raise ValueError(f"'{BROWSER_FILE}' is empty. Please follow 'ytmusicapi' setup documentation to generate it from your browser headers.")

    try:
        logger.info(f"Instantiating YTMusic with '{BROWSER_FILE}'...")
        ytmusic = YTMusic(BROWSER_FILE)
    except Exception as parse_err:
        raise ValueError(f"Failed to parse or authenticate using '{BROWSER_FILE}': {parse_err}")
    
    return ytmusic

def fetch_latest_song():
    client = get_ytmusic_client()
    logger.info("Background worker: Fetching playback history from YouTube Music...")
    history = client.get_history()
    
    if not history:
        return {
            "status": "idle",
            "message": "No playback history found"
        }
        
    latest = history[0]
    title = latest.get("title", "Unknown Title")
    
    artists_data = latest.get("artists", [])
    artists = ", ".join([a.get("name", "Unknown Artist") for a in artists_data if "name" in a])
    if not artists and artists_data:
        artists = ", ".join([str(a) for a in artists_data])
    elif not artists:
        artists = "Unknown Artist"
        
    album_data = latest.get("album", {})
    album = album_data.get("name", "Unknown Album") if album_data else "Unknown Album"
    
    thumbnails = latest.get("thumbnails", [])
    thumbnail_url = ""
    if thumbnails:
        thumbnail_url = thumbnails[-1].get("url", "")
        
    video_id = latest.get("videoId", "")
    
    return {
        "status": "playing",
        "title": title,
        "artist": artists,
        "album": album,
        "thumbnailUrl": thumbnail_url,
        "videoId": video_id
    }

def cache_worker():
    global cache
    logger.info("Background cache worker started.")
    while True:
        try:
            new_cache = fetch_latest_song()
            with cache_lock:
                cache = new_cache
                if new_cache.get("status") == "playing":
                    logger.info(f"Cache updated: {new_cache.get('title')} - {new_cache.get('artist')}")
                else:
                    logger.info(f"Cache updated: {new_cache.get('message')}")
        except Exception as e:
            logger.error("Background worker error!", exc_info=True)
            error_message = str(e)
            with cache_lock:
                if cache.get("status") not in ("playing", "idle"):
                    cache = {
                        "status": "error",
                        "message": error_message
                    }
        time.sleep(45)

@app.route('/api/recently-played', methods=['GET'])
def recently_played():
    with cache_lock:
        status_code = 500 if cache.get("status") == "error" else 200
        return jsonify(cache), status_code

worker_thread = threading.Thread(target=cache_worker, daemon=True)
worker_thread.start()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
