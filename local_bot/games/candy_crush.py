import numpy as np
import asyncio
import logging

from games.base_game import BaseGame
import state
import capture
import classifier
import solver
import input

logger = logging.getLogger("bot")

class CandyCrushGame(BaseGame):
    def __init__(self):
        self.blacklisted_moves = set()
        self.last_grid = None
        self.last_move = None

    def get_name(self) -> str:
        return "candy_crush"

    def detect_state(self, frame: np.ndarray) -> str:
        return state.detect_state(frame)

    def handle_non_playing_state(self, game_state: str, frame: np.ndarray):
        state.handle_non_playing_state(game_state, frame)

    async def process_frame(self, frame: np.ndarray, bot_running: bool) -> dict:
        game_state = self.detect_state(frame)
        grid_list = []
        suggested_move = None
        
        # Reset memory if bot is paused
        if not bot_running:
            self.blacklisted_moves.clear()
            self.last_grid = None
            self.last_move = None

        if game_state == "PLAYING":
            if bot_running:
                # Let the board settle first, reusing the initial frame to save time
                settled_frame = capture.wait_for_board_settle(prev_frame=frame)
                frame = settled_frame
                grid = classifier.parse_board(frame)
                grid_list = grid.tolist()
                
                # Consciousness check: Did the last move fail to change the board?
                if self.last_grid is not None and self.last_move is not None:
                    if np.array_equal(grid, self.last_grid):
                        self.blacklisted_moves.add(self.last_move)
                        logger.warning(f"[!] Move {self.last_move} failed to update the board state. Blacklisting it and attempting the next best swap.")
                    else:
                        # Successful move! Clear the blacklist
                        self.blacklisted_moves.clear()
                
                # Find best move excluding blacklisted moves
                move = solver.find_best_move(grid, blacklist=self.blacklisted_moves)
                if move:
                    suggested_move = {
                        "r1": move[0], "c1": move[1],
                        "r2": move[2], "c2": move[3]
                    }
                    
                    logger.info(f"Optimal Move Found: ({move[0]}, {move[1]}) <-> ({move[2]}, {move[3]})")
                    
                    # Store current state for post-move comparison
                    self.last_grid = grid.copy()
                    self.last_move = move
                    
                    input.human_swipe(move[0], move[1], move[2], move[3])
                else:
                    logger.warning("No moves found. Waiting for board to shuffle/settle.")
                    if self.blacklisted_moves:
                        self.blacklisted_moves.clear()
                        logger.info("[*] Cleared blacklist since no other valid moves exist.")
                    await asyncio.sleep(1.0)
            else:
                # Bot is paused, just parse the initial frame for streaming
                grid = classifier.parse_board(frame)
                grid_list = grid.tolist()
                
        elif bot_running:
            # Handle non-playing states (popups, next levels, out of moves)
            self.handle_non_playing_state(game_state, frame)
            await asyncio.sleep(1.0)

        # Return updated board visualization data
        return {
            "grid": grid_list,
            "suggested_move": suggested_move,
            "state": game_state,
            "bot_running": bot_running,
            "frame": frame
        }
