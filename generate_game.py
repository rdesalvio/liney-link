import os
import random
import json
from collections import deque

player_linkage_folder = "player_linkages"
player_info_folder = "players"

def wereEverTeamates(first_player, second_player):
    """
    Check if two players were ever teammates during overlapping seasons.
    Returns True only if they played for the same team in the same season.
    """
    first_player_season_totals = first_player.get("seasonTotals", [])
    second_player_season_totals = second_player.get("seasonTotals", [])

    # Create sets of (season, team) tuples for each player
    first_season_teams = set()
    for season in first_player_season_totals:
        season_year = season.get("season")
        team_name = season.get("teamName", {}).get("default", "")
        if season_year and team_name:
            first_season_teams.add((season_year, team_name))

    second_season_teams = set()
    for season in second_player_season_totals:
        season_year = season.get("season")
        team_name = season.get("teamName", {}).get("default", "")
        if season_year and team_name:
            second_season_teams.add((season_year, team_name))

    # Check if there's any intersection (same season AND same team)
    return len(first_season_teams.intersection(second_season_teams)) > 0

def get_player_info(playerId):
    player = {}
    with open(f"{player_info_folder}/{playerId}.json") as player_file:
        player = json.load(player_file)

    return player

def find_all_paths(start_player, end_player, max_length=10):
    """
    Find all possible paths between two players.
    Returns a list of paths sorted by length (longest first).
    """
    if start_player == end_player:
        return [[start_player]]
    
    # Load linkages
    linkages = {}
    for filename in os.listdir(player_linkage_folder):
        if not filename.endswith('.json') or filename == 'summary.json':
            continue
        
        player_id = int(filename.split('.')[0])
        try:
            with open(f"{player_linkage_folder}/{filename}") as f:
                linkages[player_id] = json.load(f)
        except:
            continue
    
    # Find all paths using BFS with path tracking
    all_paths = []
    visited_at_length = {}  # Track at what path length we first visited each node
    queue = deque([(start_player, [start_player])])
    
    while queue:
        current, path = queue.popleft()
        
        # Skip if path is too long
        if len(path) > max_length:
            continue
        
        # Skip if we've seen this player at a shorter path length
        if current in visited_at_length and visited_at_length[current] < len(path):
            continue
        visited_at_length[current] = len(path)
        
        if current not in linkages:
            continue
            
        for connection in linkages[current].get('connections', []):
            next_player = connection['playerId']
            
            # Avoid cycles within the current path
            if next_player in path:
                continue
            
            new_path = path + [next_player]
            
            if next_player == end_player:
                all_paths.append(new_path)
            else:
                queue.append((next_player, new_path))
    
    # Sort paths by length (shortest first for daily puzzle accessibility)
    all_paths.sort(key=len, reverse=False)
    
    return all_paths

def get_all_solutions(player_a_id, player_b_id, max_paths=None):
    """
    Get all possible solutions (paths) between two players.
    Returns paths sorted by length (longest to shortest).
    """
    all_paths = find_all_paths(player_a_id, player_b_id)
    
    if max_paths:
        all_paths = all_paths[:max_paths]
    
    # Convert player IDs to names for display
    solutions = []
    for path in all_paths:
        path_with_names = []
        for player_id in path:
            try:
                player_info = get_player_info(player_id)
                first_name = player_info.get('firstName', {}).get('default', '')
                last_name = player_info.get('lastName', {}).get('default', '')
                path_with_names.append(f"{first_name} {last_name}")
            except:
                path_with_names.append(f"Player {player_id}")
        
        solutions.append({
            'path_ids': path,
            'path_names': path_with_names,
            'length': len(path)
        })
    
    return solutions

def generate_game():
    """
    Generate a game by selecting a random pre-computed valid pair.
    Falls back to computing on-the-fly if no pre-computed pairs exist.
    """
    
    # First, try to use pre-computed valid pairs
    if os.path.exists('valid_game_pairs.json'):
        try:
            with open('valid_game_pairs.json') as f:
                valid_pairs = json.load(f)
            
            if valid_pairs:
                # Select a random pair
                pair = random.choice(valid_pairs)
                return pair['player_a'], pair['player_b']
        except:
            pass
    
    # Fallback: compute valid pairs on the fly
    print("No pre-computed pairs found. Generating...")
    
    # This will generate and save valid pairs
    import find_valid_pairs
    pairs = find_valid_pairs.find_interesting_pairs(max_pairs=50)
    
    if pairs:
        pair = random.choice(pairs)
        return pair['player_a'], pair['player_b']
    else:
        raise ValueError("Could not find any valid player pairs")

if __name__ == "__main__":
    player_a_id, player_b_id = generate_game()

    player_a_info = get_player_info(player_a_id)
    player_b_info = get_player_info(player_b_id)
    
    player_a_name = f"{player_a_info.get('firstName', {}).get('default', '')} {player_a_info.get('lastName', {}).get('default', '')}"
    player_b_name = f"{player_b_info.get('firstName', {}).get('default', '')} {player_b_info.get('lastName', {}).get('default', '')}"

    print(f"Game: Connect {player_a_name} to {player_b_name}")
    print("=" * 60)
    
    # Find all solutions
    print("Finding all possible solutions...")
    solutions = get_all_solutions(player_a_id, player_b_id, max_paths=20)  # Limit to 20 solutions
    
    if solutions:
        print(f"\nFound {len(solutions)} solution(s):")
        print()
        
        for i, solution in enumerate(solutions, 1):
            print(f"Solution {i} (Length: {solution['length']}):")
            path_str = " → ".join(solution['path_names'])
            print(f"  {path_str}")
            print()
    else:
        print("No solutions found!")