import cv2
import numpy as np
import os
import config

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

# In-memory template cache
TEMPLATES = {}
TEMPLATES_LOADED = False

def load_templates():
    """Loads template images from local_bot/templates directory."""
    global TEMPLATES, TEMPLATES_LOADED
    if TEMPLATES_LOADED:
        return
    
    # Templates directory is relative to this file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(base_dir, "templates")
    
    # Ensure directory exists
    os.makedirs(templates_dir, exist_ok=True)
    
    for candy_id, name in CANDY_TYPES.items():
        if name == "empty":
            continue
        path = os.path.join(templates_dir, f"{name}.png")
        if os.path.exists(path):
            # Load in BGR color mode
            template = cv2.imread(path, cv2.IMREAD_COLOR)
            if template is not None:
                TEMPLATES[candy_id] = template
                # print(f"[+] Loaded template: {name}.png (ID: {candy_id})")
        else:
            # Create a placeholder file or log warning
            pass
            
    TEMPLATES_LOADED = True
    print(f"[*] Templates loaded: {len(TEMPLATES)} templates registered.")

def classify_cell_hsv(cell_img: np.ndarray) -> int:
    """
    Classifies a cell candy type using HSV color ranges.
    Requires no templates, serving as an immediate fallback.
    """
    h, w, _ = cell_img.shape
    # Crop the center 35% of the cell to isolate the candy and ignore background grids
    cy1, cy2 = int(h * 0.325), int(h * 0.675)
    cx1, cx2 = int(w * 0.325), int(w * 0.675)
    center = cell_img[cy1:cy2, cx1:cx2]
    
    hsv = cv2.cvtColor(center, cv2.COLOR_BGR2HSV)
    
    avg_h = np.mean(hsv[:, :, 0])
    avg_s = np.mean(hsv[:, :, 1])
    avg_v = np.mean(hsv[:, :, 2])
    
    # Low saturation or low brightness means empty background grid
    if avg_s < 50 or avg_v < 55:
        return 0
        
    # Hue ranges (0-180 in OpenCV) mapped to Candy Crush standard colors:
    # 1: Red, 2: Orange, 3: Yellow, 4: Green, 5: Blue, 6: Purple
    if avg_h < 8 or avg_h > 172:
        return 1  # Red
    elif 8 <= avg_h < 22:
        return 2  # Orange
    elif 22 <= avg_h < 38:
        return 3  # Yellow
    elif 38 <= avg_h < 85:
        return 4  # Green
    elif 85 <= avg_h < 130:
        return 5  # Blue
    elif 130 <= avg_h <= 172:
        return 6  # Purple
        
    return 0

def classify_cell(cell_img: np.ndarray) -> int:
    """
    Compares a cell image against all loaded candy templates.
    Returns the candy ID with the highest matching confidence.
    Falls back to HSV color-based classification if no templates are loaded
    or if the template match confidence is too low.
    """
    load_templates()
    
    best_id = 0
    best_score = -1.0
    
    cell_h, cell_w, _ = cell_img.shape
    cy1, cy2 = int(cell_h * 0.15), int(cell_h * 0.85)
    cx1, cx2 = int(cell_w * 0.15), int(cell_w * 0.85)
    cell_crop = cell_img[cy1:cy2, cx1:cx2]
    crop_h, crop_w, _ = cell_crop.shape
    
    if TEMPLATES:
        for candy_id, template in TEMPLATES.items():
            # Resize template to match cell crop dimensions
            t_resized = cv2.resize(template, (crop_w, crop_h))
            
            result = cv2.matchTemplate(cell_crop, t_resized, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, _ = cv2.minMaxLoc(result)
            
            if max_val > best_score:
                best_score = max_val
                best_id = candy_id
                
        if best_score >= config.TEMPLATE_MATCH_THRESHOLD:
            return best_id

    # Fallback to HSV color classification
    return classify_cell_hsv(cell_img)

def parse_board(frame: np.ndarray) -> np.ndarray:
    """
    Crops the board region and parses it into an 8x8 grid of candy IDs.
    """
    bx, by, bw, bh = config.BOARD_X, config.BOARD_Y, config.BOARD_W, config.BOARD_H
    board_region = frame[by:by+bh, bx:bx+bw]
    
    cell_h = bh // config.GRID_ROWS
    cell_w = bw // config.GRID_COLS
    
    grid = np.zeros((config.GRID_ROWS, config.GRID_COLS), dtype=int)
    
    for r in range(config.GRID_ROWS):
        for c in range(config.GRID_COLS):
            y1 = r * cell_h
            y2 = (r + 1) * cell_h
            x1 = c * cell_w
            x2 = (c + 1) * cell_w
            
            cell_img = board_region[y1:y2, x1:x2]
            grid[r][c] = classify_cell(cell_img)
            
    return grid
