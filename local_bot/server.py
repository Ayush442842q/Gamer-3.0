import asyncio
import base64
import json
import logging
import os
import sys
from typing import Set, Optional
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pyngrok import ngrok

import config
import capture
import classifier
import solver
import input
import state
import auto_calibrate
import games

# Initialize FastAPI
app = FastAPI(title="Candy Crush Bot Local API")

# Configure CORS so Vercel can interact
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
active_connections: Set[WebSocket] = set()
bot_running = False
log_queue = asyncio.Queue()
active_game = None

# Custom Log Handler to stream logs to web socket
class WebSocketLogHandler(logging.Handler):
    def emit(self, record):
        log_entry = self.format(record)
        # Put log in queue to be picked up by broadcast task
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.call_soon_threadsafe(log_queue.put_nowait, log_entry)
        except Exception:
            pass

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("bot")
ws_handler = WebSocketLogHandler()
ws_handler.setFormatter(logging.Formatter("%(asctime)s: %(message)s"))
logger.addHandler(ws_handler)

# Custom print redirector to capture standard print calls
class PrintRedirector:
    def write(self, text):
        sys.__stdout__.write(text)
        cleaned = text.strip()
        if cleaned:
            logger.info(cleaned)
    def flush(self):
        sys.__stdout__.flush()

sys.stdout = PrintRedirector()

# Pydantic models for REST endpoints
class ConfigModel(BaseModel):
    board_x: int
    board_y: int
    board_w: int
    board_h: int
    threshold: float
    animation_settle: int
    speed_mode: Optional[str] = None
    active_game: Optional[str] = None

@app.get("/api/status")
async def get_status():
    return {
        "bot_running": bot_running,
        "device_id": config.DEVICE_ID,
        "resolution": f"{config.SCREEN_WIDTH}x{config.SCREEN_HEIGHT}",
        "config": {
            "board_x": config.BOARD_X,
            "board_y": config.BOARD_Y,
            "board_w": config.BOARD_W,
            "board_h": config.BOARD_H,
            "threshold": config.TEMPLATE_MATCH_THRESHOLD,
            "animation_settle": config.ANIMATION_SETTLE_MS,
            "speed_mode": config.SPEED_MODE,
            "active_game": config.ACTIVE_GAME
        }
    }

@app.post("/api/config")
async def update_config(cfg: ConfigModel):
    global active_game
    config.BOARD_X = cfg.board_x
    config.BOARD_Y = cfg.board_y
    config.BOARD_W = cfg.board_w
    config.BOARD_H = cfg.board_h
    config.TEMPLATE_MATCH_THRESHOLD = cfg.threshold
    config.ANIMATION_SETTLE_MS = cfg.animation_settle
    if cfg.speed_mode:
        config.SPEED_MODE = cfg.speed_mode
    if cfg.active_game:
        if config.ACTIVE_GAME != cfg.active_game:
            config.ACTIVE_GAME = cfg.active_game
            active_game = games.get_game_instance(cfg.active_game)
            logger.info(f"Active game updated dynamically to: {cfg.active_game}")
    
    # Recalculate cell sizes
    config.CELL_W = config.BOARD_W // config.GRID_COLS
    config.CELL_H = config.BOARD_H // config.GRID_ROWS
    
    logger.info(f"Config updated: Board rect ({config.BOARD_X}, {config.BOARD_Y}, {config.BOARD_W}, {config.BOARD_H}), Speed: {config.SPEED_MODE}, Game: {config.ACTIVE_GAME}")
    return {"status": "success", "message": "Configuration updated successfully"}

@app.post("/api/control")
async def bot_control(action: dict):
    global bot_running
    cmd = action.get("command", "")
    if cmd == "start":
        bot_running = True
        logger.info("Bot started via REST API")
    elif cmd == "pause":
        bot_running = False
        logger.info("Bot paused via REST API")
    return {"bot_running": bot_running}

# WebSocket connection manager
async def broadcast_message(message: dict):
    if not active_connections:
        return
    
    payload = json.dumps(message)
    disconnected = set()
    for connection in active_connections:
        try:
            await connection.send_text(payload)
        except Exception:
            disconnected.add(connection)
            
    for conn in disconnected:
        active_connections.remove(conn)

async def ws_log_broadcaster():
    """Listens to logs in queue and broadcasts to all WebSocket clients."""
    while True:
        try:
            log_msg = await log_queue.get()
            await broadcast_message({
                "type": "log",
                "data": log_msg
            })
            log_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[!] Log broadcast error: {e}")
            await asyncio.sleep(0.5)

# Background Bot Loop
async def bot_loop():
    global bot_running, active_game
    logger.info("Bot execution background loop started.")
    
    # Initialize game instance based on config
    active_game = games.get_game_instance(config.ACTIVE_GAME)
    
    while True:
        try:
            # Grab initial frame with error handling for device disconnection
            try:
                frame = capture.grab_frame()
            except Exception as adb_err:
                logger.error(f"ADB Connection Error: {adb_err}")
                await broadcast_message({
                    "type": "update",
                    "frame": None,
                    "grid": [],
                    "state": "DISCONNECTED",
                    "bot_running": False,
                    "suggested_move": None
                })
                bot_running = False
                await asyncio.sleep(2.0)
                continue
            
            # Delegate state analysis and actions to the active game class
            result = await active_game.process_frame(frame, bot_running)
            
            grid_list = result.get("grid", [])
            suggested_move = result.get("suggested_move", None)
            game_state = result.get("state", "PLAYING")
            bot_running = result.get("bot_running", bot_running)
            
            # Use post-processed/post-settle frame if returned
            final_frame = result.get("frame", frame)

            # Encode frame to stream it (low resolution for streaming performance)
            # Downscale frame for quick transmission
            h, w, _ = final_frame.shape
            scale_percent = 40  # Percent of original size
            sw = int(w * scale_percent / 100)
            sh = int(h * scale_percent / 100)
            small_frame = cv2.resize(final_frame, (sw, sh), interpolation=cv2.INTER_AREA)
            
            # Encode to JPEG
            _, buffer = cv2.imencode(".jpg", small_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
            frame_b64 = base64.b64encode(buffer).decode("utf-8")
            
            # Broadcast frame and grid update to websocket clients
            await broadcast_message({
                "type": "update",
                "frame": f"data:image/jpeg;base64,{frame_b64}",
                "grid": grid_list,
                "state": game_state,
                "bot_running": bot_running,
                "suggested_move": suggested_move
            })
            
            # Control loop frequency (if bot is paused, stream at ~2 FPS; if running, fast)
            await asyncio.sleep(0.5 if not bot_running else 0.05)
            
        except Exception as e:
            logger.error(f"Error in main bot loop: {e}")
            await asyncio.sleep(2.0)

# Websocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    logger.info(f"Client connected. Active websockets: {len(active_connections)}")
    
    # Run auto-calibration on connection only for Candy Crush
    if config.ACTIVE_GAME == "candy_crush":
        try:
            calibrated = auto_calibrate.auto_calibrate_grid()
            if calibrated:
                logger.info(f"[+] Dynamic calibration successful: BOARD_Y set to {config.BOARD_Y}")
            else:
                logger.warning(f"[-] Dynamic calibration failed. Using existing coordinate configuration.")
        except Exception as e:
            logger.error(f"[-] Error running dynamic calibration on connection: {e}")
        
    # Send initial config and connection success
    try:
        await websocket.send_text(json.dumps({
            "type": "init",
            "message": "Connected to local Candy Crush runner",
            "device_id": config.DEVICE_ID,
            "resolution": f"{config.SCREEN_WIDTH}x{config.SCREEN_HEIGHT}",
            "config": {
                "board_x": config.BOARD_X,
                "board_y": config.BOARD_Y,
                "board_w": config.BOARD_W,
                "board_h": config.BOARD_H,
                "speed_mode": config.SPEED_MODE,
                "active_game": config.ACTIVE_GAME
            }
        }))
        
        while True:
            # Listen to incoming web commands (Start / Pause / Custom Tap / Calibrate / Select Game)
            data = await websocket.receive_text()
            payload = json.loads(data)
            cmd = payload.get("command", "")
            
            global bot_running, active_game
            if cmd == "start":
                bot_running = True
                logger.info("Bot started from Web Dashboard")
            elif cmd == "pause":
                bot_running = False
                logger.info("Bot paused from Web Dashboard")
            elif cmd == "tap":
                x = payload.get("x", 0)
                y = payload.get("y", 0)
                logger.info(f"Remote tap requested at ({x}, {y})")
                input.human_tap(x, y)
            elif cmd == "select_game":
                game_name = payload.get("game", "candy_crush")
                logger.info(f"Switching active game to: {game_name}")
                if config.ACTIVE_GAME != game_name:
                    config.ACTIVE_GAME = game_name
                    active_game = games.get_game_instance(game_name)
                # Send confirmation init back
                await websocket.send_text(json.dumps({
                    "type": "init",
                    "message": f"Switched game to {game_name}",
                    "device_id": config.DEVICE_ID,
                    "resolution": f"{config.SCREEN_WIDTH}x{config.SCREEN_HEIGHT}",
                    "config": {
                        "board_x": config.BOARD_X,
                        "board_y": config.BOARD_Y,
                        "board_w": config.BOARD_W,
                        "board_h": config.BOARD_H,
                        "speed_mode": config.SPEED_MODE,
                        "active_game": config.ACTIVE_GAME
                    }
                }))
            elif cmd == "calibrate":
                logger.info("Auto-calibration requested from Web Dashboard")
                try:
                    calibrated = auto_calibrate.auto_calibrate_grid()
                    if calibrated:
                        logger.info(f"[+] Auto-calibration successful: BOARD_Y set to {config.BOARD_Y}")
                        await websocket.send_text(json.dumps({
                            "type": "init",
                            "message": "Auto-calibration successful",
                            "device_id": config.DEVICE_ID,
                            "resolution": f"{config.SCREEN_WIDTH}x{config.SCREEN_HEIGHT}",
                            "config": {
                                "board_x": config.BOARD_X,
                                "board_y": config.BOARD_Y,
                                "board_w": config.BOARD_W,
                                "board_h": config.BOARD_H,
                                "speed_mode": config.SPEED_MODE,
                                "active_game": config.ACTIVE_GAME
                            }
                        }))
                    else:
                        logger.warning("[-] Auto-calibration failed. Keeping existing coordinates.")
                except Exception as e:
                    logger.error(f"[-] Error running auto-calibration: {e}")
                
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info(f"Client disconnected. Active websockets: {len(active_connections)}")
    except Exception as e:
        logger.error(f"WebSocket communication error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)

# Start tasks on startup
@app.on_event("startup")
async def startup_event():
    # Load ngrok
    if config.NGROK_AUTHTOKEN:

        ngrok.set_auth_token(config.NGROK_AUTHTOKEN)
        
    try:
        # Bind TLS means HTTPS/WSS
        public_url = ngrok.connect(8000, bind_tls=True).public_url
        wss_url = public_url.replace("https://", "wss://")
        logger.info("\n" + "="*50 + f"\n[+] SECURE NGROK TUNNEL ESTABLISHED!\n[+] Dashboard URL: {public_url}\n[+] Web Socket URL: {wss_url}/ws\n" + "="*50)
    except Exception as e:
        logger.error(f"Could not establish ngrok tunnel: {e}. Check if authtoken is configured or if port is blocked.")
        logger.info("Connecting locally can still be done using http://localhost:8000/ws in development.")

    # Start loop tasks
    asyncio.create_task(bot_loop())
    asyncio.create_task(ws_log_broadcaster())
