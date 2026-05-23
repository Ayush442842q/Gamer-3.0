import cv2
import numpy as np
import os
import capture
import config

def auto_calibrate_grid():
    print("[*] Grabbing frame for auto-calibration...")
    try:
        frame = capture.grab_frame()
    except Exception as e:
        print(f"[!] FAILED to grab frame: {e}")
        return
        
    h, w, _ = frame.shape
    
    # Convert to HSV color space
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # We examine a vertical strip in the middle of the screen (columns 400 to 680)
    # to find the transition from the cloud background to the candy grid.
    strip = hsv[500:2200, 400:680]
    
    # Calculate average saturation per row in the strip
    # Saturation is channel 1
    row_saturations = np.mean(strip[:, :, 1], axis=1)
    
    # The candy grid starts where saturation consistently rises above 80
    grid_start_y = None
    for y_idx, sat in enumerate(row_saturations):
        # We look for a region of at least 80 pixels wide that has high saturation
        if sat > 85:
            # Verify it remains high for the next 150 pixels (indicating candy grid, not a popup text)
            if y_idx + 150 < len(row_saturations) and np.mean(row_saturations[y_idx:y_idx+150]) > 80:
                grid_start_y = 500 + y_idx
                break
                
    if grid_start_y is None:
        print("[!] Auto-calibration could not find high-saturation candy boundaries. Falling back to default Y=1360.")
        grid_start_y = 1360
    else:
        print(f"[+] AUTO-CALIBRATION SUCCESS: Detected candy grid starting at Y = {grid_start_y}px")
        
    # Standard values for 1080x2400 screen
    BOARD_X = 42
    BOARD_W = 996
    BOARD_H = 996
    BOARD_Y = grid_start_y
    
    # Update config.py file in place
    base_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(base_dir, "config.py")
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as file:
            content = file.read()
            
        # Replace the coordinates block
        import re
        content = re.sub(r"BOARD_X = \d+", f"BOARD_X = {BOARD_X}", content)
        content = re.sub(r"BOARD_Y = \d+", f"BOARD_Y = {BOARD_Y}", content)
        content = re.sub(r"BOARD_W = \d+", f"BOARD_W = {BOARD_W}", content)
        content = re.sub(r"BOARD_H = \d+", f"BOARD_H = {BOARD_H}", content)
        
        with open(config_path, 'w') as file:
            file.write(content)
            
        print(f"[*] Updated config.py: X={BOARD_X}, Y={BOARD_Y}, W={BOARD_W}, H={BOARD_H}")
        
        # Apply in memory
        config.BOARD_X = BOARD_X
        config.BOARD_Y = BOARD_Y
        config.BOARD_W = BOARD_W
        config.BOARD_H = BOARD_H
        config.CELL_W = BOARD_W // config.GRID_COLS
        config.CELL_H = BOARD_H // config.GRID_ROWS
        
    else:
        print("[!] config.py not found to update.")

if __name__ == "__main__":
    auto_calibrate_grid()
