import cv2
import numpy as np
import os
import config
from input import human_tap

# States:
# - "PLAYING"
# - "POPUP"
# - "LEVEL_COMPLETE"
# - "OUT_OF_MOVES"
# - "LOADING"
# - "DISCONNECTED"

STATE_TEMPLATES = {}
TEMPLATES_LOADED = False

def load_state_templates():
    """Loads state identification templates from screens/ directory."""
    global STATE_TEMPLATES, TEMPLATES_LOADED
    if TEMPLATES_LOADED:
        return
        
    base_dir = os.path.dirname(os.path.abspath(__file__))
    screens_dir = os.path.join(base_dir, "screens")
    os.makedirs(screens_dir, exist_ok=True)
    
    # Expected templates
    states = ["popup_close", "level_complete", "out_of_moves", "loading"]
    
    for state in states:
        path = os.path.join(screens_dir, f"{state}.png")
        if os.path.exists(path):
            img = cv2.imread(path, cv2.IMREAD_COLOR)
            if img is not None:
                STATE_TEMPLATES[state] = img
                
    TEMPLATES_LOADED = True
    print(f"[*] State templates loaded: {len(STATE_TEMPLATES)} registered.")

def detect_state(frame: np.ndarray) -> str:
    """
    Detects the current game state by template matching screen regions.
    Defaults to PLAYING if no screens match.
    """
    load_state_templates()
    
    if not STATE_TEMPLATES:
        # If no templates exist, assume PLAYING (fallback to manual play/solve)
        return "PLAYING"
        
    for state_name, template in STATE_TEMPLATES.items():
        # Match template on full frame
        # If screen coordinates are known, we crop the search region for speed
        result = cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(result)
        
        # If confidence is > 0.75, state detected
        if max_val >= 0.75:
            if state_name == "popup_close":
                return "POPUP"
            elif state_name == "level_complete":
                return "LEVEL_COMPLETE"
            elif state_name == "out_of_moves":
                return "OUT_OF_MOVES"
            elif state_name == "loading":
                return "LOADING"
                
    return "PLAYING"

def handle_non_playing_state(state: str, frame: np.ndarray):
    """
    Resolves non-gameplay states by clicking close buttons, next buttons,
    or waiting out loading screens.
    """
    load_state_templates()
    print(f"[*] Handling non-playing state: {state}")
    
    if state == "POPUP":
        # 1. Look for custom popup close template to tap
        if "popup_close" in STATE_TEMPLATES:
            template = STATE_TEMPLATES["popup_close"]
            result = cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)
            if max_val >= 0.75:
                th, tw, _ = template.shape
                click_x = max_loc[0] + tw // 2
                click_y = max_loc[1] + th // 2
                human_tap(click_x, click_y)
                return
                
        # 2. Fallback to generic close coordinates (top-right close regions)
        print("[*] No popup_close template matched. Trying typical popup close locations...")
        # Candy Crush popups usually have a close 'X' at top-right (approx 88% width, 19% height)
        click_x = int(config.SCREEN_WIDTH * 0.88)
        click_y = int(config.SCREEN_HEIGHT * 0.19)
        human_tap(click_x, click_y)
        
    elif state == "LEVEL_COMPLETE":
        if "level_complete" in STATE_TEMPLATES:
            template = STATE_TEMPLATES["level_complete"]
            result = cv2.matchTemplate(frame, template, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)
            if max_val >= 0.75:
                th, tw, _ = template.shape
                # Click center of next button
                human_tap(max_loc[0] + tw // 2, max_loc[1] + th // 2)
                return
                
        # Fallback typical Next button location at bottom center (approx 50% width, 81% height)
        print("[*] Level complete fallback. Tapping Next Level button region...")
        click_x = int(config.SCREEN_WIDTH * 0.50)
        click_y = int(config.SCREEN_HEIGHT * 0.81)
        human_tap(click_x, click_y)
        
    elif state == "OUT_OF_MOVES":
        # Fallback to tap exit/retry button (usually middle-bottom, approx 50% width, 65% height)
        print("[!] Out of moves screen. Tapping exit/retry...")
        click_x = int(config.SCREEN_WIDTH * 0.50)
        click_y = int(config.SCREEN_HEIGHT * 0.65)
        human_tap(click_x, click_y)
        
    elif state == "LOADING":
        print("[*] Screen loading. Sleeping 2 seconds...")
        import time
        time.sleep(2.0)
