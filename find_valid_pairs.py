import json
import os
from collections import deque
import random

player_linkage_folder = "player_linkages"
player_info_folder = "players"

def load_all_player_teams():
    """Load all players and their team history"""
    player_teams = {}
    
    for filename in os.listdir(player_info_folder):
        if not filename.endswith('.json'):
            continue
            
        player_id = int(filename.split('.')[0])
        
        try:
            with open(f"{player_info_folder}/{filename}") as f:
                player_data = json.load(f)
                
            # Extract all (season, team) combinations for this player
            season_teams = set()
            for season in player_data.get('seasonTotals', []):
                season_year = season.get('season')
                team_name = season.get('teamName', {}).get('default', '')
                if season_year and team_name:
                    season_teams.add((season_year, team_name))
            
            if season_teams:
                player_teams[player_id] = season_teams
        except:
            continue
    
    return player_teams

def find_shortest_path(start_player, end_player, linkages):
    """Find shortest path between two players using BFS"""
    if start_player == end_player:
        return [start_player]
    
    visited = {start_player}
    queue = deque([(start_player, [start_player])])
    
    while queue:
        current, path = queue.popleft()
        
        if current not in linkages:
            continue
            
        for connection in linkages[current].get('connections', []):
            next_player = connection['playerId']
            
            if next_player == end_player:
                return path + [next_player]
            
            if next_player not in visited:
                visited.add(next_player)
                queue.append((next_player, path + [next_player]))
    
    return None

def is_relevant_player(player_id, verbose=False):
    """Check if player meets relevance criteria: 3+ NHL seasons and 40+ avg points"""
    try:
        with open(f"{player_info_folder}/{player_id}.json") as f:
            player_data = json.load(f)
        
        nhl_seasons = []
        for season in player_data.get('seasonTotals', []):
            # Only count NHL seasons
            if season.get('leagueAbbrev') == 'NHL':
                goals = season.get('goals', 0)
                assists = season.get('assists', 0)
                points = goals + assists
                nhl_seasons.append(points)
        
        # Must have at least 3 NHL seasons
        if len(nhl_seasons) < 3:
            if verbose:
                player_name = f"{player_data.get('firstName', {}).get('default', '')} {player_data.get('lastName', {}).get('default', '')}"
                print(f"  {player_name}: Only {len(nhl_seasons)} NHL seasons")
            return False
        
        # Must average at least 40 points per season
        avg_points = sum(nhl_seasons) / len(nhl_seasons)
        if avg_points < 40:
            if verbose:
                player_name = f"{player_data.get('firstName', {}).get('default', '')} {player_data.get('lastName', {}).get('default', '')}"
                print(f"  {player_name}: {len(nhl_seasons)} NHL seasons, {avg_points:.1f} avg points")
            return False
        
        # temporary measure to only get players from last 5 seasons
        if player_data.get('seasonTotals')[-1].get("season") < 20192020:
            return False
        
        if verbose:
            player_name = f"{player_data.get('firstName', {}).get('default', '')} {player_data.get('lastName', {}).get('default', '')}"
            print(f"  ✓ {player_name}: {len(nhl_seasons)} NHL seasons, {avg_points:.1f} avg points")
        
        return True
    except:
        return False

def find_interesting_pairs(max_pairs=100, difficulty="mixed"):
    """Find pairs of players who were never teammates but are connected
    
    Args:
        max_pairs: Maximum number of pairs to find
        difficulty: "easy" (path length 3), "hard" (path length 4+), or "mixed"
    """
    
    print("Loading all player team histories...")
    player_teams = load_all_player_teams()
    
    print("Loading linkage data...")
    linkages = {}
    for filename in os.listdir(player_linkage_folder):
        if not filename.endswith('.json') or filename == 'summary.json':
            continue
        
        player_id = int(filename.split('.')[0])
        with open(f"{player_linkage_folder}/{filename}") as f:
            linkages[player_id] = json.load(f)
    
    print(f"Loaded {len(linkages)} players with linkages")
    
    # Filter for relevant players only
    print("Filtering for relevant players (3+ NHL seasons, 40+ avg points)...")
    relevant_players = []
    for player_id in linkages.keys():
        if is_relevant_player(player_id):
            relevant_players.append(player_id)
    
    print(f"Found {len(relevant_players)} relevant players out of {len(linkages)} total")
    
    if len(relevant_players) < 2:
        print("Not enough relevant players found!")
        return []
    
    # Find pairs that were never teammates
    valid_pairs = []
    players = relevant_players
    
    print("Finding valid pairs...")
    attempts = 0
    max_attempts = 10000
    
    while len(valid_pairs) < max_pairs and attempts < max_attempts:
        attempts += 1
        
        # Pick two random players
        if len(players) < 2:
            break
            
        player_a, player_b = random.sample(players, 2)
        
        # Check if they have team history
        if player_a not in player_teams or player_b not in player_teams:
            continue
        
        # Check if they were ever teammates
        if player_teams[player_a].intersection(player_teams[player_b]):
            continue  # They were teammates, skip
        
        # Check if there's a path between them
        path = find_shortest_path(player_a, player_b, linkages)
        
        # Check path length based on difficulty
        valid_path = False
        if difficulty == "easy" and path and len(path) == 3:
            valid_path = True
        elif difficulty == "hard" and path and len(path) >= 4:
            valid_path = True
        elif difficulty == "mixed" and path and 2 <= len(path) <= 4:
            valid_path = True
            
        if valid_path:
            valid_pairs.append({
                'player_a': player_a,
                'player_b': player_b,
                'path_length': len(path),
                'path': path
            })
            
            if len(valid_pairs) % 10 == 0:
                print(f"  Found {len(valid_pairs)} valid pairs...")
    
    print(f"Found {len(valid_pairs)} valid pairs after {attempts} attempts")
    
    # Save the valid pairs
    with open('valid_game_pairs.json', 'w') as f:
        json.dump(valid_pairs, f, indent=2)
    
    return valid_pairs

def find_easy_pairs(max_pairs=50):
    """Find easy puzzle pairs (path length exactly 3)"""
    return find_interesting_pairs(max_pairs=max_pairs, difficulty="easy")

def find_hard_pairs(max_pairs=50):
    """Find hard puzzle pairs (path length 4 or more)"""
    return find_interesting_pairs(max_pairs=max_pairs, difficulty="hard")

def get_player_name(player_id):
    """Get player name for display"""
    try:
        with open(f"{player_info_folder}/{player_id}.json") as f:
            player = json.load(f)
        first = player.get('firstName', {}).get('default', '')
        last = player.get('lastName', {}).get('default', '')
        return f"{first} {last}"
    except:
        return f"Player {player_id}"

if __name__ == "__main__":
    pairs = find_interesting_pairs(max_pairs=50)
    
    if pairs:
        print("\nExample valid pairs:")
        for pair in pairs[:5]:
            player_a_name = get_player_name(pair['player_a'])
            player_b_name = get_player_name(pair['player_b'])
            print(f"  {player_a_name} → {player_b_name} (path length: {pair['path_length']})")
            
            # Show the path
            path_names = []
            for player_id in pair['path']:
                path_names.append(get_player_name(player_id))
            print(f"    Path: {' → '.join(path_names)}")
    else:
        print("No valid pairs found!")