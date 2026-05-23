# 🍬 Candy Crush Bot — Project Bible
> **Version:** 1.0  
> **Purpose:** Complete reference document for any AI model or developer to understand, continue, or extend this project without prior context.  
> **Stack:** Python 3.10+ · OpenCV · Pillow · NumPy · ADB · scrcpy

---

## Table of Contents
1. [Project Summary](#1-project-summary)
2. [How It Works — Big Picture](#2-how-it-works--big-picture)
3. [Tech Stack & Why](#3-tech-stack--why)
4. [Project File Structure](#4-project-file-structure)
5. [Module Reference](#5-module-reference)
6. [Core Pipeline Flow](#6-core-pipeline-flow)
7. [State Machine](#7-state-machine)
8. [Board Representation](#8-board-representation)
9. [Candy Types Reference](#9-candy-types-reference)
10. [ADB Command Reference](#10-adb-command-reference)
11. [Configuration & Calibration](#11-configuration--calibration)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Human-Like Behavior Rules](#13-human-like-behavior-rules)
14. [Build Order & Milestones](#14-build-order--milestones)
15. [Known Pitfalls & Solutions](#15-known-pitfalls--solutions)
16. [Glossary](#16-glossary)

---

## 1. Project Summary

**Goal:** Build a Python bot that plays the mobile game Candy Crush Saga autonomously on an Android phone, in real time, by:
1. Capturing the phone screen programmatically via ADB
2. Parsing the game board using computer vision (OpenCV template matching)
3. Calculating the best possible candy swap using a solver algorithm
4. Sending human-like touch/swipe commands back to the phone via ADB

**What this is NOT:**
- Not a game hack or memory modification
- Not a server-side cheat
- It interacts with the game exactly as a human finger would, just automated

**Physical setup:**
- Android phone connected to laptop via USB cable
- `scrcpy` running on laptop to visually mirror the phone screen (for monitoring only)
- Python bot running on laptop, communicating with phone via ADB over USB

---

## 2. How It Works — Big Picture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LAPTOP (Python Bot)                      │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐  │
│  │ capture  │──▶│  board   │──▶│  solver  │──▶│   input    │  │
│  │  .py     │   │  .py     │   │  .py     │   │   .py      │  │
│  │          │   │          │   │          │   │            │  │
│  │ ADB grab │   │ Parse    │   │ Find     │   │ ADB swipe  │  │
│  │ frame    │   │ 8x8 grid │   │ best     │   │ with jitter│  │
│  └──────────┘   └──────────┘   │ move     │   └────────────┘  │
│                                └──────────┘                    │
│                                                                 │
│  ┌──────────┐   ┌──────────┐                                   │
│  │  state   │   │  config  │                                   │
│  │  .py     │   │  .py     │                                   │
│  │          │   │          │                                   │
│  │ FSM for  │   │ Device   │                                   │
│  │ popups   │   │ settings │                                   │
│  └──────────┘   └──────────┘                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │  USB / ADB
          ┌────────────▼────────────┐
          │    Android Phone        │
          │  (Candy Crush running)  │
          └─────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │  scrcpy window          │
          │  (visual mirror, laptop)│
          │  for human monitoring   │
          └─────────────────────────┘
```

**One loop cycle:**
1. `capture.py` grabs a screenshot from the phone via ADB → returns a PIL Image
2. `board.py` crops the board region → splits into cells → classifies each candy
3. `solver.py` receives the 8×8 grid → tries every swap → scores matches → returns best move
4. `input.py` sends an ADB swipe command with human-like randomization
5. `state.py` watches for non-gameplay screens (popups, ads, level end) and handles them
6. Loop repeats after a short wait for animations to settle

---

## 3. Tech Stack & Why

| Tool | Version | Role | Why this tool |
|---|---|---|---|
| Python | 3.10+ | Main language | Easy subprocess, cv2, PIL integration |
| OpenCV (cv2) | 4.x | Image processing & template matching | Best-in-class for real-time vision tasks |
| Pillow (PIL) | 10.x | Image loading from ADB pipe | Easiest way to decode raw screencap bytes |
| NumPy | 1.x | Board grid representation & math | Fast 2D array ops for the solver |
| ADB (Android Debug Bridge) | latest | Screen capture + touch input | Official Android tool, works over USB/WiFi |
| scrcpy | 2.x | Visual phone mirror on laptop | Lets developer watch the bot play live |
| subprocess | stdlib | Run ADB shell commands from Python | No extra dependencies needed |

**Important distinction — scrcpy vs ADB:**
- `scrcpy` = display tool only. It shows the phone screen on your laptop monitor. The bot does NOT read frames from scrcpy.
- `ADB` = the bot's actual interface. All screen capture and all touch commands go through ADB.
- You can close scrcpy and the bot still works perfectly. scrcpy is just for your eyes.

---

## 4. Project File Structure

```
candy_crush_bot/
│
├── main.py               # Entry point. Runs the main loop.
├── config.py             # All device-specific settings (resolution, board coords, etc.)
│
├── capture.py            # Screen capture via ADB → PIL Image
├── board.py              # Crop board, split cells, call classifier
├── classifier.py         # Template matching to identify candy types
├── solver.py             # Find best swap on the 8×8 grid
├── input.py              # Send human-like ADB swipe/tap commands
├── state.py              # Finite state machine (gameplay vs popup vs level end)
│
├── templates/            # Candy sprite images for template matching
│   ├── red.png
│   ├── orange.png
│   ├── yellow.png
│   ├── green.png
│   ├── blue.png
│   ├── purple.png
│   ├── striped_h.png     # Horizontal striped candy
│   ├── striped_v.png     # Vertical striped candy
│   ├── wrapped.png       # Wrapped (bomb) candy
│   ├── color_bomb.png    # Color bomb (dark ball)
│   └── empty.png         # Empty/blank cell (after gravity)
│
├── screens/              # Reference screenshots for state detection
│   ├── popup_close.png   # Generic popup close button region
│   ├── level_complete.png
│   ├── out_of_moves.png
│   └── loading.png
│
├── utils/
│   ├── adb.py            # ADB helper: connect, capture, swipe, tap
│   ├── vision.py         # Reusable cv2 helpers (match, diff, crop)
│   └── logger.py         # Logging setup
│
└── tests/
    ├── test_board.py     # Unit tests for board parser
    ├── test_solver.py    # Unit tests for solver with mock grids
    └── test_classifier.py
```

---

## 5. Module Reference

### `config.py` — Device Configuration
Stores all values that change per device. Edit this once when setting up a new phone.

```python
# config.py
DEVICE_ID = "emulator-5554"        # From: adb devices
SCREEN_WIDTH = 1080                 # Phone screen resolution
SCREEN_HEIGHT = 2340

# Board region on screen (pixels) — calibrate once per device
BOARD_X = 42       # Left edge of game board
BOARD_Y = 380      # Top edge of game board
BOARD_W = 996      # Width of game board
BOARD_H = 996      # Height of game board

GRID_ROWS = 8
GRID_COLS = 8

# Derived cell size
CELL_W = BOARD_W // GRID_COLS      # = 124px
CELL_H = BOARD_H // GRID_ROWS      # = 124px

TEMPLATE_MATCH_THRESHOLD = 0.75    # cv2.matchTemplate confidence threshold
ANIMATION_SETTLE_MS = 800          # Wait time after a move before re-capturing
ANIMATION_DIFF_THRESHOLD = 50      # Max pixel-sum diff to consider board "settled"
```

---

### `capture.py` — Screen Capture
Grabs a screenshot from the phone and returns it as a PIL Image (then NumPy array for cv2).

```python
# capture.py
import subprocess
import numpy as np
from PIL import Image
import io

def grab_frame() -> np.ndarray:
    """
    Captures phone screen via ADB.
    Returns BGR numpy array (OpenCV format).
    """
    result = subprocess.run(
        ["adb", "exec-out", "screencap", "-p"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    if result.returncode != 0:
        raise RuntimeError(f"ADB screencap failed: {result.stderr}")
    
    img = Image.open(io.BytesIO(result.stdout)).convert("RGB")
    return np.array(img)[:, :, ::-1]  # RGB → BGR for OpenCV

def wait_for_board_settle(threshold=50, wait_ms=200, max_attempts=15) -> np.ndarray:
    """
    Keeps capturing until two consecutive frames are nearly identical.
    Prevents reading the board mid-animation.
    Returns the stable frame.
    """
    import time
    prev = grab_frame()
    for _ in range(max_attempts):
        time.sleep(wait_ms / 1000)
        curr = grab_frame()
        diff = np.sum(np.abs(curr.astype(int) - prev.astype(int)))
        if diff < threshold * 1000:  # scale for full frame
            return curr
        prev = curr
    return curr  # return best effort after timeout
```

---

### `board.py` — Board Parser
Crops the board region, splits it into 8×8 cells, calls the classifier on each cell.

```python
# board.py
import numpy as np
from config import BOARD_X, BOARD_Y, BOARD_W, BOARD_H, GRID_ROWS, GRID_COLS
from classifier import classify_cell

def parse_board(frame: np.ndarray) -> np.ndarray:
    """
    Extracts the 8x8 grid from a full screen frame.
    Returns a 2D numpy array of candy type IDs (integers 0–10).
    """
    board_region = frame[BOARD_Y:BOARD_Y+BOARD_H, BOARD_X:BOARD_X+BOARD_W]
    cell_h = BOARD_H // GRID_ROWS
    cell_w = BOARD_W // GRID_COLS
    
    grid = np.zeros((GRID_ROWS, GRID_COLS), dtype=int)
    
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            y1 = row * cell_h
            y2 = y1 + cell_h
            x1 = col * cell_w
            x2 = x1 + cell_w
            cell_img = board_region[y1:y2, x1:x2]
            grid[row][col] = classify_cell(cell_img)
    
    return grid
```

---

### `classifier.py` — Candy Classifier
Uses OpenCV template matching to identify what candy type is in each cell.

```python
# classifier.py
import cv2
import numpy as np
import os
from config import TEMPLATE_MATCH_THRESHOLD

CANDY_TYPES = {
    0:  "empty",
    1:  "red",
    2:  "orange",
    3:  "yellow",
    4:  "green",
    5:  "blue",
    6:  "purple",
    7:  "striped_h",
    8:  "striped_v",
    9:  "wrapped",
    10: "color_bomb"
}

# Load templates once at import time
TEMPLATES = {}
for candy_id, name in CANDY_TYPES.items():
    path = f"templates/{name}.png"
    if os.path.exists(path):
        TEMPLATES[candy_id] = cv2.imread(path, cv2.IMREAD_COLOR)

def classify_cell(cell_img: np.ndarray) -> int:
    """
    Matches a cell image against all candy templates.
    Returns the candy type ID with the highest match score.
    Falls back to 0 (empty) if no match exceeds threshold.
    """
    best_id = 0
    best_score = 0.0
    
    for candy_id, template in TEMPLATES.items():
        # Resize template to cell size if needed
        t_resized = cv2.resize(template, (cell_img.shape[1], cell_img.shape[0]))
        result = cv2.matchTemplate(cell_img, t_resized, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(result)
        
        if max_val > best_score:
            best_score = max_val
            best_id = candy_id
    
    return best_id if best_score >= TEMPLATE_MATCH_THRESHOLD else 0
```

---

### `solver.py` — Move Solver
Receives the 8×8 grid and finds the best possible swap by simulating all candidates.

```python
# solver.py
import numpy as np
from typing import Tuple, Optional

Move = Tuple[int, int, int, int]  # (row1, col1, row2, col2)

def find_best_move(grid: np.ndarray) -> Optional[Move]:
    """
    Tries every valid adjacent swap, scores by matches created.
    Returns the move (r1,c1,r2,c2) with the highest score.
    Returns None if no valid moves found.
    """
    rows, cols = grid.shape
    best_move = None
    best_score = 0
    
    for r in range(rows):
        for c in range(cols):
            # Try swap right
            if c + 1 < cols:
                score = score_swap(grid, r, c, r, c+1)
                if score > best_score:
                    best_score = score
                    best_move = (r, c, r, c+1)
            # Try swap down
            if r + 1 < rows:
                score = score_swap(grid, r, c, r+1, c)
                if score > best_score:
                    best_score = score
                    best_move = (r, c, r+1, c)
    
    return best_move

def score_swap(grid: np.ndarray, r1, c1, r2, c2) -> int:
    """
    Simulates a swap on a copy of the grid and counts matches created.
    Handles horizontal and vertical matches of 3+.
    """
    test = grid.copy()
    test[r1][c1], test[r2][c2] = test[r2][c2], test[r1][c1]
    return count_matches(test)

def count_matches(grid: np.ndarray) -> int:
    """Counts total candies involved in matches of 3 or more."""
    rows, cols = grid.shape
    matched = np.zeros_like(grid, dtype=bool)
    
    # Horizontal
    for r in range(rows):
        for c in range(cols - 2):
            if grid[r][c] != 0 and grid[r][c] == grid[r][c+1] == grid[r][c+2]:
                matched[r][c:c+3] = True
    
    # Vertical
    for r in range(rows - 2):
        for c in range(cols):
            if grid[r][c] != 0 and grid[r][c] == grid[r+1][c] == grid[r+2][c]:
                matched[r:r+3][c] = True
    
    return int(np.sum(matched))
```

---

### `input.py` — Human-Like Touch Input
Sends swipe commands to the phone via ADB with realistic randomization.

```python
# input.py
import subprocess
import random
import time
from config import BOARD_X, BOARD_Y, CELL_W, CELL_H

def cell_to_screen(row: int, col: int) -> Tuple[int, int]:
    """Converts grid position to screen pixel coordinates (cell center)."""
    x = BOARD_X + col * CELL_W + CELL_W // 2
    y = BOARD_Y + row * CELL_H + CELL_H // 2
    return x, y

def human_swipe(r1: int, c1: int, r2: int, c2: int):
    """
    Swipes from cell (r1,c1) to cell (r2,c2) with human-like properties:
    - Random ±3px jitter on coordinates
    - Random swipe duration 120–250ms
    - Random post-move pause 0.4–0.9s
    """
    x1, y1 = cell_to_screen(r1, c1)
    x2, y2 = cell_to_screen(r2, c2)
    
    # Add human jitter
    x1 += random.randint(-3, 3)
    y1 += random.randint(-3, 3)
    x2 += random.randint(-3, 3)
    y2 += random.randint(-3, 3)
    
    duration_ms = random.randint(120, 250)
    
    subprocess.run([
        "adb", "shell", "input", "swipe",
        str(x1), str(y1), str(x2), str(y2), str(duration_ms)
    ], check=True)
    
    # Human pause after move
    time.sleep(random.uniform(0.4, 0.9))

def human_tap(x: int, y: int):
    """Taps a screen coordinate (used for popups, menus)."""
    x += random.randint(-2, 2)
    y += random.randint(-2, 2)
    subprocess.run(["adb", "shell", "input", "tap", str(x), str(y)], check=True)
    time.sleep(random.uniform(0.2, 0.5))
```

---

### `state.py` — Game State Machine
Detects what screen is currently showing and routes to the correct handler.

```python
# state.py — Finite State Machine
# States:
#   PLAYING       - Normal gameplay, board is visible
#   POPUP         - Ad or dialog blocking the screen
#   LEVEL_COMPLETE - Stars/score screen after winning
#   OUT_OF_MOVES  - No moves left dialog
#   LOADING       - Transition/loading screen
#   DISCONNECTED  - ADB connection lost

# Detection method: template matching on known screen regions
# Each non-PLAYING state has a handler that resolves it and returns to PLAYING
```

**State transition diagram:**
```
                    ┌─────────────────┐
              ┌────▶│    PLAYING      │◀────┐
              │     └────────┬────────┘     │
              │              │ board detected│
              │     ┌────────▼────────┐     │
              │     │  Capture frame  │     │
              │     │  Parse board    │     │
              │     │  Solve move     │     │
              │     │  Execute swipe  │     │
              │     └────────┬────────┘     │
              │              │              │
        ┌─────┴──────┐  ┌────▼────────┐    │
        │  LOADING   │  │   POPUP     │    │
        │ wait 2s    │  │ tap close   │    │
        └────────────┘  └────────────┘    │
                                          │
        ┌─────────────┐  ┌───────────────┐│
        │LEVEL_COMPLETE│ │ OUT_OF_MOVES  ││
        │ tap "Next"  │ │ tap "OK"/exit │││
        └─────────────┘  └───────────────┘│
                                          │
        ┌─────────────┐                   │
        │DISCONNECTED │                   │
        │ reconnect   ├───────────────────┘
        └─────────────┘
```

---

### `main.py` — Entry Point

```python
# main.py
from capture import wait_for_board_settle
from board import parse_board
from solver import find_best_move
from input import human_swipe
from state import detect_state, handle_non_playing_state
import time

def run():
    print("[*] Candy Crush Bot starting...")
    print("[*] Make sure phone is connected via USB and Candy Crush is open.")
    
    while True:
        try:
            frame = wait_for_board_settle()
            game_state = detect_state(frame)
            
            if game_state != "PLAYING":
                handle_non_playing_state(game_state, frame)
                continue
            
            grid = parse_board(frame)
            move = find_best_move(grid)
            
            if move is None:
                print("[!] No valid moves found. Waiting...")
                time.sleep(2)
                continue
            
            r1, c1, r2, c2 = move
            print(f"[+] Swapping ({r1},{c1}) ↔ ({r2},{c2})")
            human_swipe(r1, c1, r2, c2)
            
        except RuntimeError as e:
            print(f"[!] ADB error: {e}")
            print("[*] Attempting reconnect in 5s...")
            time.sleep(5)

if __name__ == "__main__":
    run()
```

---

## 6. Core Pipeline Flow

```
Every ~1.5 seconds (one loop iteration):

  1. CAPTURE
     └── adb exec-out screencap -p  →  PIL Image  →  NumPy BGR array
     └── Compare with previous frame (pixel diff < threshold = settled)

  2. STATE CHECK
     └── Template match known non-gameplay screens
     └── If not PLAYING: run handler, skip to next iteration

  3. BOARD PARSE
     └── Crop [BOARD_Y:BOARD_Y+BOARD_H, BOARD_X:BOARD_X+BOARD_W]
     └── Split into 8×8 cells (each ~124×124px at 1080p)
     └── For each cell: cv2.matchTemplate against all 11 candy templates
     └── Assign candy type ID (0–10) to each cell

  4. SOLVE
     └── Try every horizontal swap (8×7 = 56 moves)
     └── Try every vertical swap (7×8 = 56 moves)
     └── Total: 112 candidate moves evaluated per frame
     └── Score = number of candies in resulting matches of 3+
     └── Return highest-scoring move

  5. EXECUTE
     └── Convert (row,col) → (pixel_x, pixel_y)
     └── Add jitter ±3px
     └── adb shell input swipe x1 y1 x2 y2 {120-250ms}
     └── Sleep 0.4–0.9s (human pause)

  6. WAIT
     └── wait_for_board_settle() handles cascade/gravity animations
     └── Compares frames until diff drops below threshold
```

---

## 7. State Machine

### States

| State | Trigger | Handler |
|---|---|---|
| `PLAYING` | Board grid visible | Normal loop |
| `POPUP` | Unknown overlay detected | Tap close-button region |
| `LEVEL_COMPLETE` | Stars screen detected | Tap "Next level" |
| `OUT_OF_MOVES` | "No more moves" dialog | Tap "OK" or reshuffle |
| `LOADING` | Transition/spinner detected | Sleep 2s, retry |
| `DISCONNECTED` | ADB command fails | Reconnect with backoff |

### Detection method
Each non-playing state is detected by template matching a known screenshot crop against the current frame. Keep reference screenshots in `screens/` folder.

```python
def detect_state(frame: np.ndarray) -> str:
    for state_name, template in STATE_TEMPLATES.items():
        result = cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(result)
        if max_val > 0.7:
            return state_name
    return "PLAYING"
```

---

## 8. Board Representation

The game board is always represented as a **2D NumPy array of shape (8, 8)** containing integer candy type IDs.

```
Example board (printed):
  [[ 1  3  5  2  4  6  1  3 ]   ← row 0 (top)
   [ 2  4  1  5  3  2  4  6 ]
   [ 5  1  3  6  1  4  2  3 ]
   [ 3  6  2  4  5  1  6  2 ]
   [ 4  2  6  1  2  3  5  4 ]
   [ 1  5  4  3  6  5  3  1 ]
   [ 6  3  1  5  4  2  1  5 ]
   [ 2  4  5  6  3  1  4  2 ]]  ← row 7 (bottom)

Index convention: grid[row][col]
  row 0 = top of board
  col 0 = left of board
  
Coordinate origin: top-left corner of board
```

**Adjacency:** Only horizontal and vertical swaps are valid. No diagonal swaps.

```
Valid swaps from cell (r, c):
  Right:  (r, c) ↔ (r, c+1)   if c+1 < 8
  Down:   (r, c) ↔ (r+1, c)   if r+1 < 8
  Left:   (r, c) ↔ (r, c-1)   if c-1 >= 0
  Up:     (r, c) ↔ (r-1, c)   if r-1 >= 0
```

---

## 9. Candy Types Reference

| ID | Name | Description | Special behavior |
|---|---|---|---|
| 0 | `empty` | No candy (hole or cleared cell) | Gravity fills from above |
| 1 | `red` | Standard red candy | Normal |
| 2 | `orange` | Standard orange candy | Normal |
| 3 | `yellow` | Standard yellow candy | Normal |
| 4 | `green` | Standard green candy | Normal |
| 5 | `blue` | Standard blue candy | Normal |
| 6 | `purple` | Standard purple candy | Normal |
| 7 | `striped_h` | Horizontal striped candy | Clears entire row when matched |
| 8 | `striped_v` | Vertical striped candy | Clears entire column when matched |
| 9 | `wrapped` | Wrapped/bomb candy | 3×3 explosion when matched |
| 10 | `color_bomb` | Color bomb (dark swirl) | Clears all candies of swapped color |

**Note for the solver:** In v1, treat special candies (7–10) the same as normal candies for matching purposes. They will still clear normally. Advanced scoring for special combos is a v2 feature.

---

## 10. ADB Command Reference

All ADB commands are run via Python `subprocess.run()`.

```bash
# Check connection
adb devices

# Connect over WiFi (after USB pairing)
adb connect 192.168.1.X:5555

# Take screenshot and pipe directly to Python (fastest method)
adb exec-out screencap -p

# Swipe (for candy swap)
# adb shell input swipe <x1> <y1> <x2> <y2> <duration_ms>
adb shell input swipe 200 500 200 620 150

# Tap (for menus, popups)
# adb shell input tap <x> <y>
adb shell input tap 540 1200

# Get screen resolution
adb shell wm size

# Check if device is connected
adb get-state
```

**ADB screencap speed note:**
- `adb exec-out screencap -p` (direct pipe to stdout) → ~300–500ms per frame
- `adb shell screencap -p /sdcard/screen.png && adb pull` (save to file) → ~800ms+ (slower, avoid)

---

## 11. Configuration & Calibration

### One-time device calibration (do this first)

1. Connect phone, open Candy Crush to a live level
2. Run `adb exec-out screencap -p > screen.png` to get a screenshot
3. Open `screen.png` in any image editor (e.g. Paint, GIMP, Preview)
4. Manually find the pixel coordinates of:
   - Top-left corner of the game board grid
   - Bottom-right corner of the game board grid
5. Calculate: `BOARD_W = right_x - left_x`, `BOARD_H = bottom_y - top_y`
6. Update `config.py` with these values

### Template collection (do this once per device resolution)

1. Calibrate board coordinates (above)
2. Run the board parser on a screenshot and save each cell as a PNG
3. For each candy type, manually label one good clean example
4. Save to `templates/{candy_name}.png`
5. The classifier will use these for all future matching

### Threshold tuning
- Start with `TEMPLATE_MATCH_THRESHOLD = 0.75`
- If too many misclassifications → raise to 0.80–0.85
- If too many `empty` (0) results → lower to 0.70
- `ANIMATION_DIFF_THRESHOLD` may need tuning based on screen brightness/content

---

## 12. Error Handling Strategy

Every failure point has a defined recovery strategy:

| Failure | Detection | Recovery |
|---|---|---|
| ADB screencap fails | `subprocess.returncode != 0` | Retry 3x, then reconnect |
| ADB device disconnected | `adb get-state` returns error | `adb connect` with 5s backoff, up to 5 attempts |
| Board animation still playing | Frame diff above threshold | Re-capture up to 15 times (3s total) |
| No valid moves found | `find_best_move` returns None | Wait 2s (game may auto-shuffle) |
| Unknown screen state | No template matches | Tap center screen, wait 1s, retry |
| Popup detected | State machine → POPUP | Tap known close region from `screens/` |
| Template match confidence all low | All scores < threshold | Log warning, mark cell as `empty` |
| Level complete | State machine → LEVEL_COMPLETE | Tap "Next" button region |
| Out of moves | State machine → OUT_OF_MOVES | Tap OK (let game shuffle or use boosters) |

```python
# Error handling pattern used throughout the project
import time

def with_retry(fn, retries=3, delay=1.0):
    for attempt in range(retries):
        try:
            return fn()
        except Exception as e:
            print(f"[!] Attempt {attempt+1}/{retries} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay)
    raise RuntimeError(f"All {retries} attempts failed")
```

---

## 13. Human-Like Behavior Rules

These rules make the bot harder to detect as automated:

| Property | Human-like value | Bot-naive value (avoid) |
|---|---|---|
| Swipe duration | 120–250ms (random) | Always exactly 100ms |
| Post-move pause | 0.4–0.9s (random) | Immediate next move |
| Coordinate jitter | ±3px random offset | Always exact pixel center |
| Move timing | Varies with "thinking" | Constant loop speed |
| Session length | Not implemented yet | Plays forever |

**Optional enhancements (v2):**
- Add a "thinking delay" of 0.5–2s before executing a move (simulate human deliberation)
- Occasionally make a suboptimal move (simulate human error)
- Add session time limits (e.g. 20–40 minute play sessions with breaks)

---

## 14. Build Order & Milestones

Build strictly in this order. Do not skip phases. Each phase depends on the previous.

### Phase 1 — ADB Bridge ✅ (prerequisite for everything)
- [ ] Install ADB on laptop, connect phone via USB
- [ ] Enable Developer Options + USB Debugging on phone
- [ ] `adb devices` shows the phone
- [ ] Python script captures a screenshot and saves it as PNG
- [ ] Measure latency of screencap (should be < 600ms)

### Phase 2 — Board Calibration ✅
- [ ] Take a screenshot with Candy Crush open on a level
- [ ] Manually measure board pixel coordinates
- [ ] Update `config.py` with BOARD_X, BOARD_Y, BOARD_W, BOARD_H
- [ ] Write a debug script that draws a red grid overlay to verify alignment

### Phase 3 — Candy Classifier ✅
- [ ] Screenshot several game states, extract clean cell images
- [ ] Save as templates in `templates/`
- [ ] `classify_cell()` correctly identifies all 6 standard candy types
- [ ] Unit test: parse a known screenshot, verify grid output manually

### Phase 4 — Move Solver ✅
- [ ] Build `solver.py` with mock hardcoded grids first
- [ ] Unit test all edge cases (no match, 3-match, 4-match, 5-match, T-shape)
- [ ] Solver returns correct move on at least 90% of test cases

### Phase 5 — Input Execution ✅
- [ ] `human_swipe()` correctly maps grid coordinates to screen pixels
- [ ] Test with a dummy swap — candy actually moves on screen
- [ ] Verify jitter and timing feel natural

### Phase 6 — State Machine + Full Loop ✅
- [ ] Build state detection using reference screenshots
- [ ] Full loop runs for 5 minutes without crashing
- [ ] Handles at least: popup, level complete, ADB disconnect

---

## 15. Known Pitfalls & Solutions

| Pitfall | Why it happens | Solution |
|---|---|---|
| Bot reads board during animation | Cascade/gravity still playing | Use `wait_for_board_settle()` — compare two frames |
| Template matching fails | Candy is partially obscured or has effects overlay | Crop the center 60% of each cell (ignore edges) |
| Wrong board coordinates | Different phone resolution or Candy Crush UI version | Recalibrate by drawing grid overlay on screenshot |
| ADB screencap is too slow | USB 2.0 or busy bus | Use USB 3.0 port; or try WiFi ADB on same local network |
| scrcpy blocks ADB | Running scrcpy and ADB simultaneously can conflict | scrcpy has its own ADB connection — use `-s {device_id}` to target both |
| Color bomb / special combos missed | Solver only counts basic 3-matches | Extend `score_swap()` to detect 4/5-match patterns (v2) |
| Popup template doesn't match | Different popup style on this phone | Screenshot the popup, add to `screens/`, retrain state detection |
| Game crashes mid-session | App memory leak or network issue | Detect black/white screen → force-restart Candy Crush via ADB |

---

## 16. Glossary

| Term | Meaning |
|---|---|
| **ADB** | Android Debug Bridge. Command-line tool that lets your laptop talk to an Android phone. |
| **scrcpy** | Open-source Android screen mirroring tool. Used for visual monitoring only — not for frame capture in code. |
| **screencap** | ADB command that takes a screenshot of the phone screen and outputs it as PNG bytes. |
| **Template matching** | OpenCV technique (`cv2.matchTemplate`) that slides a small image over a larger one and finds where it best fits. Used to identify candy types. |
| **Board calibration** | One-time process of measuring the exact pixel rectangle of the game board on your specific phone and resolution. |
| **Candy type ID** | Integer 0–10 representing the candy at a grid position. 0 = empty, 1–6 = standard colors, 7–10 = special candies. |
| **Grid / Board** | The 8×8 NumPy array representing the current state of the game board. |
| **Swap** | Exchanging two adjacent candies. Only horizontal and vertical swaps are valid in Candy Crush. |
| **Greedy solver** | A solver that evaluates all possible moves and picks the one with the highest immediate score, without looking ahead. Good enough for Candy Crush. |
| **State machine (FSM)** | A system that tracks what "state" the game is in (playing, popup, level complete, etc.) and routes to the correct handler. |
| **Animation settle** | The period after a move when candies are falling, exploding, and cascading. The bot must wait until this is fully complete before reading the board again. |
| **Jitter** | Small random offsets added to touch coordinates (±3px) to make inputs look human rather than pixel-perfect. |
| **Match** | Three or more identical candies in a horizontal or vertical line. |
| **Cascade** | Chain reaction of matches that occurs automatically after a move, as new candies fall into place. |

---

## Quick Start for a New AI Session

If you are an AI model reading this to continue development, here is the context summary:

**What is built:** A Python bot that plays Candy Crush on Android via ADB.  
**How it works:** Screencap → OpenCV board parse → greedy move solver → ADB swipe.  
**Key constraint:** scrcpy is display-only; ADB handles all code interaction.  
**Current status:** Architecture and module specs are complete. Actual implementation may be partial — check which Phase milestones are marked complete.  
**Most important files:** `config.py` (device settings), `capture.py` (ADB screencap), `classifier.py` (candy detection), `solver.py` (move logic), `state.py` (FSM).  
**Never skip:** `wait_for_board_settle()` — without it the board will be misread during animations.  
**Ask the user:** What phase are they on, and what is the target phone's screen resolution?

---

*End of Project Bible — v1.0*
