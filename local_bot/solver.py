import numpy as np
from typing import Tuple, Optional, List

# Move format: (row1, col1, row2, col2)
Move = Tuple[int, int, int, int]

def find_best_move(grid: np.ndarray) -> Optional[Move]:
    """
    Evaluates all valid adjacent swaps on the 8x8 grid and returns the one
    that yields the highest score.
    Returns None if no moves produce a match of 3 or more.
    """
    rows, cols = grid.shape
    best_move = None
    best_score = 0
    
    # Iterate through all cells
    for r in range(rows):
        for c in range(cols):
            # We don't swap empty cells (ID 0)
            if grid[r][c] == 0:
                continue
                
            # Try swap Right
            if c + 1 < cols and grid[r][c+1] != 0:
                score = score_swap(grid, r, c, r, c+1)
                if score > best_score:
                    best_score = score
                    best_move = (r, c, r, c+1)
                    
            # Try swap Down
            if r + 1 < rows and grid[r+1][c] != 0:
                score = score_swap(grid, r, c, r+1, c)
                if score > best_score:
                    best_score = score
                    best_move = (r, c, r+1, c)
                    
    return best_move

def score_swap(grid: np.ndarray, r1: int, c1: int, r2: int, c2: int) -> int:
    """
    Simulates swapping candies at (r1,c1) and (r2,c2) on a copy of the grid.
    Returns a score based on the number and type of matches created.
    """
    temp_grid = grid.copy()
    
    # Perform swap
    temp_grid[r1][c1], temp_grid[r2][c2] = temp_grid[r2][c2], temp_grid[r1][c1]
    
    # Detect matches
    matched, matches_list = detect_matches(temp_grid)
    
    if not np.any(matched):
        return 0

        
    score = 0
    
    # Score details:
    # 1. Base score is number of matched candies
    matched_count = int(np.sum(matched))
    score += matched_count * 10  # 10 points per matched candy
    
    # 2. Bonus points for special combos
    # If a match has length 4, it creates a striped candy. Add bonus.
    # If a match has length 5, it creates a color bomb. Add big bonus.
    # If we swapped a special candy (ID 7-10), give it extra weight
    id1 = grid[r1][c1]
    id2 = grid[r2][c2]
    
    # Special combo triggers:
    # Color bomb swapped with anything:
    if id1 == 10 or id2 == 10:
        score += 1000  # Color bombs are high priority
        
    # Striped + Wrapped or other combos:
    if (id1 in [7, 8] and id2 == 9) or (id2 in [7, 8] and id1 == 9):
        score += 800
    elif (id1 in [7, 8] and id2 in [7, 8]):
        score += 600
    elif (id1 == 9 and id2 == 9):
        score += 700
        
    # Match size bonuses
    for match_len in matches_list:
        if match_len == 4:
            score += 150  # Created Striped candy
        elif match_len >= 5:
            score += 400  # Created Color Bomb
            
    return score

def detect_matches(grid: np.ndarray) -> Tuple[np.ndarray, List[int]]:
    """
    Identifies all matches of 3 or more same-color candies on the grid.
    Returns:
      - A boolean grid of the same shape where True indicates the cell is part of a match.
      - A list containing the lengths of each individual match found.
    """
    rows, cols = grid.shape
    matched = np.zeros_like(grid, dtype=bool)
    matches_list = []
    
    # 1. Horizontal Matches
    for r in range(rows):
        c = 0
        while c < cols - 2:
            val = grid[r][c]
            # ID 10 is color bomb, usually doesn't form standard 3-matches on its own color
            if val == 0 or val == 10:
                c += 1
                continue
                
            # Count consecutive matching values
            length = 1
            while c + length < cols and get_base_color(grid[r][c + length]) == get_base_color(val):
                length += 1
                
            if length >= 3:
                matched[r, c:c+length] = True
                matches_list.append(length)
                c += length
            else:
                c += 1
                
    # 2. Vertical Matches
    for c in range(cols):
        r = 0
        while r < rows - 2:
            val = grid[r][c]
            if val == 0 or val == 10:
                r += 1
                continue
                
            length = 1
            while r + length < rows and get_base_color(grid[r + length][c]) == get_base_color(val):
                length += 1
                
            if length >= 3:
                matched[r:r+length, c] = True
                matches_list.append(length)
                r += length
            else:
                r += 1
                
    return matched, matches_list

def get_base_color(candy_id: int) -> int:
    """
    Normalizes candy IDs to their base colors (1-6).
    Striped horizontal (7) and vertical (8) and wrapped (9) candies share base colors.
    For this version, we map special candies back to their base colors.
    Normally, in our templates:
      - IDs 1-6: standard red, orange, yellow, green, blue, purple
      - ID 7: striped_h, 8: striped_v, 9: wrapped, 10: color_bomb
    If templates are color-specific (e.g. red_striped), we would map them accordingly.
    If special templates are generic (e.g., striped_h.png), their base color can be estimated
    from color context or treated as matches.
    """
    # For a simple representation:
    # If we treat 7, 8, 9 as matches with their base colors, we assume we can classify
    # their base color. Let's assume candy_id already represents base color for 1-6.
    # If candy_id is special, we map it to standard color if template name includes color.
    # In config, templates are "striped_h", "wrapped", etc. If we match them as wildcard,
    # we treat them as matchable with any base color or just standard matching.
    return candy_id
