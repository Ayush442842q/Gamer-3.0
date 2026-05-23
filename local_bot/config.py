import subprocess
import re
import os

# Device configuration
DEVICE_ID = "ZD2227H2FK"  # From adb devices


def get_device_resolution():
    """Queries the connected Android device for its resolution via ADB."""
    cmd = ["adb"]
    if DEVICE_ID:
        cmd.extend(["-s", DEVICE_ID])
    cmd.extend(["shell", "wm", "size"])
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        # Expected output: "Physical size: 1080x2340" or similar
        match = re.search(r"Physical size:\s*(\d+)x(\d+)", result.stdout)
        if match:
            w, h = int(match.group(1)), int(match.group(2))
            return w, h
    except Exception as e:
        print(f"[!] Error querying device resolution: {e}")
    
    # Default fallback
    return 1080, 2340

SCREEN_WIDTH, SCREEN_HEIGHT = get_device_resolution()
print(f"[*] Detected screen size: {SCREEN_WIDTH}x{SCREEN_HEIGHT}")

# Board boundaries.
# These will be dynamically adjustable from the web dashboard.
# Defaults are calibrated for 1080x2340 (19.5:9 ratio).
if SCREEN_WIDTH == 1080:
    # Game board is typically centered horizontally.
    BOARD_X = 42
    BOARD_W = 996
    
    # vertical position varies slightly depending on exact aspect ratio
    if SCREEN_HEIGHT >= 2340:
        BOARD_Y = 882  # Typical top of board for tall screens
        BOARD_H = 996
    else:
        BOARD_Y = 882  # Typical top of board for standard screens
        BOARD_H = 996
else:
    # General scaling fallback
    BOARD_X = int(SCREEN_WIDTH * 0.04)
    BOARD_W = int(SCREEN_WIDTH * 0.92)
    BOARD_Y = int(SCREEN_HEIGHT * 0.35)
    BOARD_H = BOARD_W  # Board is square

GRID_ROWS = 8
GRID_COLS = 8

# Derived sizes
CELL_W = BOARD_W // GRID_COLS
CELL_H = BOARD_H // GRID_ROWS

# Computer Vision & Control settings
TEMPLATE_MATCH_THRESHOLD = 0.70
ANIMATION_SETTLE_MS = 800
ANIMATION_DIFF_THRESHOLD = 50

# Speed settings: "normal", "fast", "insane"
SPEED_MODE = "fast"

# ngrok Auth Token configuration (optional, can be set via env var or ngrok config file)
NGROK_AUTHTOKEN = os.environ.get("NGROK_AUTHTOKEN", "")

