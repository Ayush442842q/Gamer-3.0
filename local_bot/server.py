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
        }
    }

@app.post("/api/config")
async def update_config(cfg: ConfigModel):
    config.BOARD_X = cfg.board_x
    config.BOARD_Y = cfg.board_y
    config.BOARD_W = cfg.board_w
    config.BOARD_H = cfg.board_h
    config.TEMPLATE_MATCH_THRESHOLD = cfg.threshold
    config.ANIMATION_SETTLE_MS = cfg.animation_settle
    if cfg.speed_mode:
        config.SPEED_MODE = cfg.speed_mode
    
    # Recalculate cell sizes
    config.CELL_W = config.BOARD_W // config.GRID_COLS
    config.CELL_H = config.BOARD_H // config.GRID_ROWS
    
    logger.info(f"Config updated: Board rect ({config.BOARD_X}, {config.BOARD_Y}, {config.BOARD_W}, {config.BOARD_H}), Speed: {config.SPEED_MODE}")
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
    global bot_running
    logger.info("Bot execution background loop started.")
    
    blacklisted_moves = set()
    last_grid = None
    last_move = None
    
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
            
            # Get current game state
            game_state = state.detect_state(frame)
            
            # Reset memory if bot is paused
            if not bot_running:
                blacklisted_moves.clear()
                last_grid = None
                last_move = None
            
            # Parse grid if playing
            grid_list = []
            suggested_move = None
            
            if game_state == "PLAYING":
                if bot_running:
                    # Let the board settle first, reusing the initial frame to save time
                    settled_frame = capture.wait_for_board_settle(prev_frame=frame)
                    frame = settled_frame
                    grid = classifier.parse_board(frame)
                    grid_list = grid.tolist()
                    
                    # Consciousness check: Did the last move fail to change the board?
                    if last_grid is not None and last_move is not None:
                        if np.array_equal(grid, last_grid):
                            blacklisted_moves.add(last_move)
                            logger.warning(f"[!] Move {last_move} failed to update the board state. Blacklisting it and attempting the next best swap.")
                        else:
                            # Successful move! Clear the blacklist
                            blacklisted_moves.clear()
                    
                    # Find best move excluding blacklisted moves
                    move = solver.find_best_move(grid, blacklist=blacklisted_moves)
                    if move:
                        suggested_move = {
                            "r1": move[0], "c1": move[1],
                            "r2": move[2], "c2": move[3]
                        }
                        
                        await broadcast_message({
                            "type": "status",
                            "state": game_state,
                            "bot_running": bot_running,
                            "suggested_move": suggested_move,
                            "grid": grid_list
                        })
                        
                        logger.info(f"Optimal Move Found: ({move[0]}, {move[1]}) <-> ({move[2]}, {move[3]})")
                        
                        # Store current state for post-move comparison
                        last_grid = grid.copy()
                        last_move = move
                        
                        input.human_swipe(move[0], move[1], move[2], move[3])
                    else:
                        logger.warning("No moves found. Waiting for board to shuffle/settle.")
                        if blacklisted_moves:
                            blacklisted_moves.clear()
                            logger.info("[*] Cleared blacklist since no other valid moves exist.")
                        await asyncio.sleep(1.0)
                else:
                    # Bot is paused, just parse the initial frame for streaming
                    grid = classifier.parse_board(frame)
                    grid_list = grid.tolist()
            elif bot_running:
                # Handle non-playing states (popups, next levels, out of moves)
                state.handle_non_playing_state(game_state, frame)
                await asyncio.sleep(1.0)

            # Encode frame to stream it (low resolution for streaming performance)
            # Downscale frame for quick transmission
            h, w, _ = frame.shape
            scale_percent = 40  # Percent of original size
            sw = int(w * scale_percent / 100)
            sh = int(h * scale_percent / 100)
            small_frame = cv2.resize(frame, (sw, sh), interpolation=cv2.INTER_AREA)
            
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
    
    # Run auto-calibration on connection to match the game grid dynamically
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
                "speed_mode": config.SPEED_MODE
            }
        }))
        
        while True:
            # Listen to incoming web commands (Start / Pause / Custom Tap / Calibrate)
            data = await websocket.receive_text()
            payload = json.loads(data)
            cmd = payload.get("command", "")
            
            global bot_running
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
                                "speed_mode": config.SPEED_MODE
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
