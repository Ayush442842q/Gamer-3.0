from games.candy_crush import CandyCrushGame
from games.subway_surfers import SubwaySurfersGame

def get_game_instance(name: str):
    """Factory function returning the selected game instance."""
    if name == "subway_surfers":
        return SubwaySurfersGame()
    else:
        return CandyCrushGame()
