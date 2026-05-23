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
    Swipes from cell (r1, c1) to cell (r2, c2) with human-like features.
    Swipe duration and rest delays scale according to config.SPEED_MODE:
    - insane: duration 50-90ms, rest 0.05-0.12s
    - fast: duration 100-140ms, rest 0.15-0.3s
    - normal: duration 150-250ms, rest 0.5-0.9s
    """
    x1, y1 = cell_to_screen(r1, c1)
    x2, y2 = cell_to_screen(r2, c2)
    
    # Add coordinate jitter (tighter on insane/fast modes)
    jitter = 2 if config.SPEED_MODE in ["fast", "insane"] else 4
    x1 += random.randint(-jitter, jitter)
    y1 += random.randint(-jitter, jitter)
    x2 += random.randint(-jitter, jitter)
    y2 += random.randint(-jitter, jitter)
    
    # Determine speed profile
    if config.SPEED_MODE == "insane":
        duration_ms = random.randint(50, 90)
        rest_time = random.uniform(0.05, 0.12)
    elif config.SPEED_MODE == "fast":
        duration_ms = random.randint(100, 140)
        rest_time = random.uniform(0.15, 0.3)
    else:
        duration_ms = random.randint(150, 250)
        rest_time = random.uniform(0.5, 0.9)
    
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
        
    time.sleep(rest_time)

def human_tap(x: int, y: int):
    """
    Performs an ADB tap at (x, y) with coordinate jitter and speed-mode rest delay.
    """
    jitter = 2 if config.SPEED_MODE in ["fast", "insane"] else 3
    x += random.randint(-jitter, jitter)
    y += random.randint(-jitter, jitter)
    
    cmd = get_adb_base_cmd() + ["shell", "input", "tap", str(x), str(y)]
    print(f"[*] Executing tap: ({x}, {y})")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[!] ADB tap command failed: {result.stderr}")
        raise RuntimeError(f"ADB tap failed: {result.stderr}")
        
    # Scale tap rest delay
    if config.SPEED_MODE == "insane":
        rest_time = random.uniform(0.05, 0.12)
    elif config.SPEED_MODE == "fast":
        rest_time = random.uniform(0.15, 0.3)
    else:
        rest_time = random.uniform(0.3, 0.6)
        
    time.sleep(rest_time)

