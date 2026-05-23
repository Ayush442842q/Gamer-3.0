import subprocess
import numpy as np
from PIL import Image
import io
import time
import config

def get_adb_base_cmd():
    cmd = ["adb"]
    if config.DEVICE_ID:
        cmd.extend(["-s", config.DEVICE_ID])
    return cmd

def grab_frame() -> np.ndarray:
    """
    Captures the phone screen using ADB and returns a BGR NumPy array (OpenCV format).
    """
    cmd = get_adb_base_cmd() + ["exec-out", "screencap", "-p"]
    
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(f"ADB screencap failed: {result.stderr.decode('utf-8', errors='ignore')}")
        
    try:
        # Load screen as RGB image, then convert to numpy BGR for OpenCV
        img = Image.open(io.BytesIO(result.stdout)).convert("RGB")
        return np.array(img)[:, :, ::-1]
    except Exception as e:
        raise RuntimeError(f"Failed to decode image from ADB stdout: {e}")

def wait_for_board_settle(prev_frame=None, threshold=None, wait_ms=150, max_attempts=15) -> np.ndarray:
    """
    Continually grabs screenshots of the board region and compares consecutive frames.
    Settle intervals dynamically adapt according to config.SPEED_MODE.
    """
    if threshold is None:
        threshold = config.ANIMATION_DIFF_THRESHOLD
        
    # Scale checking speed based on performance profiles
    if config.SPEED_MODE == "insane":
        wait_ms = 40
        max_attempts = 20
    elif config.SPEED_MODE == "fast":
        wait_ms = 80
        max_attempts = 15
        
    if prev_frame is None:
        prev_frame = grab_frame()

    
    bx, by, bw, bh = config.BOARD_X, config.BOARD_Y, config.BOARD_W, config.BOARD_H
    # Safety checks for frame bounds
    h, w, _ = prev_frame.shape
    if by + bh > h or bx + bw > w:
        print(f"[!] Warning: Board coords ({bx}, {by}, {bw}, {bh}) exceed screen dimensions ({w}x{h}). Scaling down comparison region.")
        by = min(by, h - 100)
        bh = min(bh, h - by)
        bx = min(bx, w - 100)
        bw = min(bw, w - bx)
        
    prev_board = prev_frame[by:by+bh, bx:bx+bw]
    
    for attempt in range(max_attempts):
        time.sleep(wait_ms / 1000.0)
        curr_frame = grab_frame()
        
        # Check bounds
        h_c, w_c, _ = curr_frame.shape
        if by + bh > h_c or bx + bw > w_c:
            curr_board = curr_frame[by:min(by+bh, h_c), bx:min(bx+bw, w_c)]
        else:
            curr_board = curr_frame[by:by+bh, bx:bx+bw]
            
        # Calculate mean absolute difference per pixel to handle scaling gracefully
        # Resize to match shapes if they differ slightly
        if curr_board.shape != prev_board.shape:
            # Resize
            import cv2
            curr_board = cv2.resize(curr_board, (prev_board.shape[1], prev_board.shape[0]))
            
        diff = np.mean(np.abs(curr_board.astype(float) - prev_board.astype(float)))
        
        if diff < threshold:
            # Settle detected!
            return curr_frame
            
        prev_board = curr_board
        prev_frame = curr_frame
        
    print(f"[!] Settle timeout reached. Diff: {diff:.2f} (threshold: {threshold})")
    return prev_frame
