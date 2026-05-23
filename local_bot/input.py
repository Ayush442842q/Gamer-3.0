import subprocess
import random
import time
import config
from typing import Tuple

def cell_to_screen(row: int, col: int) -> Tuple[int, int]:
    """
    Converts 0-indexed grid cell position (row, col) to screen pixel coordinates (x, y).
    Returns the center pixel of the cell.
    """
    x = config.BOARD_X + col * config.CELL_W + config.CELL_W // 2
    y = config.BOARD_Y + row * config.CELL_H + config.CELL_H // 2
    return x, y

def get_adb_base_cmd():
    cmd = ["adb"]
    if config.DEVICE_ID:
        cmd.extend(["-s", config.DEVICE_ID])
    return cmd

def human_swipe(r1: int, c1: int, r2: int, c2: int):
    """
    Swipes from cell (r1, c1) to cell (r2, c2) with human-like features:
    - Adds random coordinate jitter of +/- 4 pixels
    - Uses a randomized swipe duration (140ms to 240ms)
    - Adds a randomized post-move sleep delay (0.5s to 0.9s)
    """
    x1, y1 = cell_to_screen(r1, c1)
    x2, y2 = cell_to_screen(r2, c2)
    
    # Add human-like coordinate jitter
    x1 += random.randint(-4, 4)
    y1 += random.randint(-4, 4)
    x2 += random.randint(-4, 4)
    y2 += random.randint(-4, 4)
    
    # Randomize swipe speed (duration in milliseconds)
    duration_ms = random.randint(140, 240)
    
    cmd = get_adb_base_cmd() + [
        "shell", "input", "swipe",
        str(x1), str(y1),
        str(x2), str(y2),
        str(duration_ms)
    ]
    
    print(f"[*] Executing swipe: ({r1},{c1}) -> ({r2},{c2}) | Pixel: ({x1},{y1}) -> ({x2},{y2}) in {duration_ms}ms")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[!] ADB swipe command failed: {result.stderr}")
        raise RuntimeError(f"ADB swipe failed: {result.stderr}")
        
    # Post-swipe rest to let cascades start and simulate human look-around
    rest_time = random.uniform(0.5, 0.9)
    time.sleep(rest_time)

def human_tap(x: int, y: int):
    """
    Performs an ADB tap at (x, y) with human-like coordinate jitter and post-tap delay.
    """
    # Jitter
    x += random.randint(-3, 3)
    y += random.randint(-3, 3)
    
    cmd = get_adb_base_cmd() + ["shell", "input", "tap", str(x), str(y)]
    print(f"[*] Executing tap: ({x}, {y})")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[!] ADB tap command failed: {result.stderr}")
        raise RuntimeError(f"ADB tap failed: {result.stderr}")
        
    time.sleep(random.uniform(0.3, 0.6))
