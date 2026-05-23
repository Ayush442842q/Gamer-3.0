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
    - insane: duration 150-220ms, rest 0.35-0.45s
    - fast: duration 220-280ms, rest 0.50-0.65s
    - normal: duration 300-400ms, rest 0.80-1.20s
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
        duration_ms = random.randint(150, 220)
        rest_time = random.uniform(0.35, 0.45)
    elif config.SPEED_MODE == "fast":
        duration_ms = random.randint(220, 280)
        rest_time = random.uniform(0.50, 0.65)
    else:
        duration_ms = random.randint(300, 400)
        rest_time = random.uniform(0.80, 1.20)
    
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
    Uses input swipe with duration to ensure reliability on Motorola/fast devices.
    """
    jitter = 2 if config.SPEED_MODE in ["fast", "insane"] else 3
    x += random.randint(-jitter, jitter)
    y += random.randint(-jitter, jitter)
    
    # Determine tap duration and rest delay
    if config.SPEED_MODE == "insane":
        tap_duration = 100
        rest_time = random.uniform(0.20, 0.35)
    elif config.SPEED_MODE == "fast":
        tap_duration = 150
        rest_time = random.uniform(0.35, 0.50)
    else:
        tap_duration = 200
        rest_time = random.uniform(0.60, 0.90)
        
    cmd = get_adb_base_cmd() + [
        "shell", "input", "swipe",
        str(x), str(y),
        str(x), str(y),
        str(tap_duration)
    ]
    print(f"[*] Executing tap (via swipe hold): ({x}, {y}) for {tap_duration}ms")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[!] ADB tap command failed: {result.stderr}")
        raise RuntimeError(f"ADB tap failed: {result.stderr}")
        
    time.sleep(rest_time)

