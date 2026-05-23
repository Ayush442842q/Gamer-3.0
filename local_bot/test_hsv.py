import cv2
import numpy as np
import capture
import config

def test_hsv_classification():
    print("[*] Grabbing frame...")
    try:
        frame = capture.grab_frame()
    except Exception as e:
        print(f"[!] Grab frame failed: {e}")
        return
        
    h, w, _ = frame.shape
    print(f"[*] Frame shape: {w}x{h}")
    
    bx, by, bw, bh = config.BOARD_X, config.BOARD_Y, config.BOARD_W, config.BOARD_H
    board_region = frame[by:by+bh, bx:bx+bw]
    
    cell_h = bh // config.GRID_ROWS
    cell_w = bw // config.GRID_COLS
    
    print("\nHSV Classification Grid:\n")
    for r in range(config.GRID_ROWS):
        row_str = []
        for c in range(config.GRID_COLS):
            y1 = r * cell_h
            y2 = (r + 1) * cell_h
            x1 = c * cell_w
            x2 = (c + 1) * cell_w
            
            cell_img = board_region[y1:y2, x1:x2]
            
            # Run HSV calculation
            ch, cw, _ = cell_img.shape
            cy1, cy2 = int(ch * 0.3), int(ch * 0.7)
            cx1, cx2 = int(cw * 0.3), int(cw * 0.7)
            center = cell_img[cy1:cy2, cx1:cx2]
            
            hsv = cv2.cvtColor(center, cv2.COLOR_BGR2HSV)
            pixels = hsv.reshape(-1, 3)
            
            # Try different saturation thresholds to print debug
            avg_h = np.mean(pixels[:, 0])
            avg_s = np.mean(pixels[:, 1])
            avg_v = np.mean(pixels[:, 2])
            
            # Candy pixels filter
            candy_pixels = pixels[(pixels[:, 1] > 80) & (pixels[:, 2] > 80)]
            if len(candy_pixels) > 10:
                candy_h = np.mean(candy_pixels[:, 0])
            else:
                candy_h = -1
                
            row_str.append(f"({avg_h:.1f},{avg_s:.1f},{candy_h:.1f})")
            
        print(" ".join(row_str))

if __name__ == "__main__":
    test_hsv_classification()
