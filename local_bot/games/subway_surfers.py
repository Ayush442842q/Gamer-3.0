import numpy as np
import cv2
import asyncio
import logging
import subprocess
import time

from games.base_game import BaseGame
import config
import input

logger = logging.getLogger("bot")

class SubwaySurfersGame(BaseGame):
    def __init__(self):
        # 0: Left, 1: Center, 2: Right
        self.player_lane = 1 
        self.last_swipe_time = 0
        self.last_action = None
        self.consecutive_free_frames = 0
        
    def get_name(self) -> str:
        return "subway_surfers"

    def detect_state(self, frame: np.ndarray) -> str:
        # Check if there is a green "Play" / retry button template or color in bottom center
        # For simplicity, we fallback to PLAYING.
        # If user saves screens (e.g. subway_retry.png), we match them.
        return "PLAYING"

    def handle_non_playing_state(self, game_state: str, frame: np.ndarray):
        # Tap bottom center to restart the game
        # Scaling typical Play button position (approx 50% width, 75% height)
        click_x = int(config.SCREEN_WIDTH * 0.50)
        click_y = int(config.SCREEN_HEIGHT * 0.75)
        logger.info(f"[*] Subway Surfers: Tapping Play/Retry button at ({click_x}, {click_y})")
        input.human_tap(click_x, click_y)

    def execute_fast_swipe(self, direction: str):
        cmd = input.get_adb_base_cmd() + ["shell", "input", "swipe"]
        
        # Swiping coordinates centered on screen
        cx = config.SCREEN_WIDTH // 2
        cy = config.SCREEN_HEIGHT // 2
        
        if direction == "up":
            cmd.extend([str(cx), str(cy + 250), str(cx), str(cy - 250), "60"])
        elif direction == "down":
            cmd.extend([str(cx), str(cy - 250), str(cx), str(cy + 250), "60"])
        elif direction == "left":
            cmd.extend([str(cx + 300), str(cy), str(cx - 300), str(cy), "60"])
        elif direction == "right":
            cmd.extend([str(cx - 300), str(cy), str(cx + 300), str(cy), "60"])
            
        logger.info(f"[+] Executing instant swipe: {direction.upper()}")
        # Use Popen to launch ADB command in background without blocking Python thread
        subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.last_swipe_time = time.time()
        self.last_action = direction

    async def process_frame(self, frame: np.ndarray, bot_running: bool) -> dict:
        h, w, _ = frame.shape
        
        # Self-correction: if no swipes for 4 seconds, assume player is back in center lane
        if time.time() - self.last_swipe_time > 4.0 and self.player_lane != 1:
            logger.info("[*] Subway Surfers: No activity detected. Resetting tracked lane to Center.")
            self.player_lane = 1
            
        # Define Y-Zone for obstacle scanning (approx Y=40% to 65% of screen height)
        y_start = int(h * 0.40)
        y_end = int(h * 0.65)
        
        # Extract lane vertical strips
        lane_w = w // 3
        left_crop = frame[y_start:y_end, 0:lane_w]
        center_crop = frame[y_start:y_end, lane_w:2*lane_w]
        right_crop = frame[y_start:y_end, 2*lane_w:w]
        
        # Evaluate occupancy using Canny edge density in each lane
        occupied = [False, False, False]
        densities = [0.0, 0.0, 0.0]
        
        for idx, crop in enumerate([left_crop, center_crop, right_crop]):
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 40, 120)
            density = np.sum(edges > 0) / edges.size
            densities[idx] = density
            # If edge density is > 5%, there is likely a train or barrier ahead
            if density > 0.05:
                occupied[idx] = True
                
        # Format a 4x3 visual grid for dashboard:
        # Row 0: Raw densities (0-2 scale for visualization)
        # Row 1: Gap/Horizon
        # Row 2: Lane occupancy (1 if occupied, 0 if free)
        # Row 3: Player position (2 at active player lane, 0 elsewhere)
        grid_list = [
            [int(densities[0] * 100), int(densities[1] * 100), int(densities[2] * 100)],
            [0, 0, 0],
            [1 if occupied[0] else 0, 1 if occupied[1] else 0, 1 if occupied[2] else 0],
            [2 if self.player_lane == 0 else 0, 2 if self.player_lane == 1 else 0, 2 if self.player_lane == 2 else 0]
        ]
        
        suggested_move = None
        
        if bot_running and (time.time() - self.last_swipe_time > 0.35):
            # Check if there is an obstacle in our current lane
            if occupied[self.player_lane]:
                logger.warning(f"[!] Obstacle detected in player lane: {self.player_lane} (Density: {densities[self.player_lane]:.3f})")
                
                # Try to dodge to clear lanes
                dodged = False
                if self.player_lane == 1: # Center
                    if not occupied[0]: # Try left
                        self.execute_fast_swipe("left")
                        self.player_lane = 0
                        suggested_move = {"direction": "left"}
                        dodged = True
                    elif not occupied[2]: # Try right
                        self.execute_fast_swipe("right")
                        self.player_lane = 2
                        suggested_move = {"direction": "right"}
                        dodged = True
                elif self.player_lane == 0: # Left
                    if not occupied[1]: # Try center
                        self.execute_fast_swipe("right")
                        self.player_lane = 1
                        suggested_move = {"direction": "right"}
                        dodged = True
                elif self.player_lane == 2: # Right
                    if not occupied[1]: # Try center
                        self.execute_fast_swipe("left")
                        self.player_lane = 1
                        suggested_move = {"direction": "left"}
                        dodged = True
                        
                # If we cannot dodge horizontally, jump!
                if not dodged:
                    self.execute_fast_swipe("up")
                    suggested_move = {"direction": "up"}
            else:
                # Lane is free, roll occasionally if we want or just keep running
                self.consecutive_free_frames += 1
                
        # Return state dictionary
        return {
            "grid": grid_list,
            "suggested_move": suggested_move,
            "state": "PLAYING",
            "bot_running": bot_running,
            "frame": frame
        }
