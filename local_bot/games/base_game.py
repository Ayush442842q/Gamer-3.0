import numpy as np

class BaseGame:
    def get_name(self) -> str:
        """Returns the game name key (e.g. 'candy_crush', 'subway_surfers')."""
        raise NotImplementedError
        
    def detect_state(self, frame: np.ndarray) -> str:
        """Detects the current game state (e.g. 'PLAYING', 'POPUP', 'LEVEL_COMPLETE', 'LOADING')."""
        raise NotImplementedError
        
    async def process_frame(self, frame: np.ndarray, bot_running: bool) -> dict:
        """
        Processes a single frame and returns a dict with:
          - 'grid': visualization grid/lanes lists
          - 'suggested_move': dict of suggested action coordinates/swipes
          - 'state': current game state
          - 'bot_running': running status
        Also executes inputs if bot_running is True.
        """
        raise NotImplementedError
        
    def handle_non_playing_state(self, state: str, frame: np.ndarray):
        """Resolves non-gameplay states (e.g., closing popups, retry button clicks)."""
        raise NotImplementedError
