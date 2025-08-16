import json
import os
from collections import defaultdict, deque
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

def find_all_paths_for_pair(start_player, end_player, linkages, max_length=8):
    """Find all paths between two players for scoring purposes"""
    if start_player == end_player:
        return [[start_player]]
    
    all_paths = []
    visited_at_length = {}
    queue = deque([(start_player, [start_player])])
    
    while queue:
        current, path = queue.popleft()
        
        if len(path) > max_length:
            continue
        
        if current in visited_at_length and visited_at_length[current] < len(path):
            continue
        visited_at_length[current] = len(path)
        
        if current not in linkages:
            continue
            
        for connection in linkages[current].get('connections', []):
            next_player = connection['playerId']
            
            if next_player in path:
                continue
            
            new_path = path + [next_player]
            
            if next_player == end_player:
                all_paths.append(new_path)
            else:
                queue.append((next_player, new_path))
    
    return all_paths

def calculate_pair_score(paths):
    """
    Calculate a score for a daily puzzle pair.
    Prioritizes pairs with a 3-hop solution + maximum total solutions for expert players.
    """
    if not paths:
        return 0
    
    path_lengths = [len(path) for path in paths]
    total_solutions = len(paths)
    min_length = min(path_lengths)
    max_length = max(path_lengths)
    
    # CRITICAL: Must have a 3-hop solution for accessibility (2-hop too rare)
    if min_length > 3:
        return 0  # Completely exclude pairs without short solutions
    
    # Base score: Total number of solutions (more = better for expert players)
    solution_count_score = total_solutions * 2
    
    # Bonus for having a good range (short to high numbers)
    range_bonus = max_length - min_length  # Bonus for range of solution lengths
    
    # Extra bonus for having many solutions at different lengths
    unique_lengths = len(set(path_lengths))
    variety_bonus = unique_lengths * 3
    
    # Big bonus for having lots of solutions (expert engagement)
    if total_solutions >= 20:
        expert_bonus = 10
    elif total_solutions >= 15:
        expert_bonus = 7
    elif total_solutions >= 10:
        expert_bonus = 5
    else:
        expert_bonus = 0
    
    # Final score
    score = solution_count_score + range_bonus + variety_bonus + expert_bonus
    
    return score

def find_interesting_pairs(max_pairs=100):
    """Find pairs of players who were never teammates but are connected"""
    
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
    
    # Find and score pairs
    candidate_pairs = []
    players = list(linkages.keys())
    
    print("Finding and scoring valid pairs...")
    attempts = 0
    max_attempts = 2000  # Fewer attempts since we're doing more work per pair
    
    while len(candidate_pairs) < max_pairs * 3 and attempts < max_attempts:  # Find more candidates to choose from
        attempts += 1
        
        if attempts % 100 == 0:
            print(f"  Evaluated {attempts} pairs, found {len(candidate_pairs)} candidates...")
        
        # Pick two random players
        if len(players) < 2:
            break
            
        player_a, player_b = random.sample(players, 2)
        
        # Check if they have team history
        if player_a not in player_teams or player_b not in player_teams:
            continue
        
        # Check if they were ever teammates during overlapping seasons
        if player_teams[player_a].intersection(player_teams[player_b]):
            continue
        
        # Find all paths between them
        all_paths = find_all_paths_for_pair(player_a, player_b, linkages)
        
        if not all_paths:
            continue
        
        # Filter paths to reasonable lengths
        good_paths = [path for path in all_paths if 2 <= len(path) <= 8]
        
        if len(good_paths) < 2:  # Need at least 2 solutions
            continue
            
        # MUST have at least one short solution for daily puzzle accessibility  
        path_lengths = [len(path) for path in good_paths]
        if min(path_lengths) > 3:  # Must have 3-hop or shorter solution
            continue
        
        # Calculate score for this pair
        score = calculate_pair_score(good_paths)
        
        candidate_pairs.append({
            'player_a': player_a,
            'player_b': player_b,
            'score': score,
            'path_count': len(good_paths),
            'shortest_path': min(len(path) for path in good_paths),
            'longest_path': max(len(path) for path in good_paths),
            'path_lengths': sorted([len(path) for path in good_paths])
        })
    
    print(f"Found {len(candidate_pairs)} candidate pairs after {attempts} attempts")
    
    # Sort by score (highest first) and take the best ones
    candidate_pairs.sort(key=lambda x: x['score'], reverse=True)
    best_pairs = candidate_pairs[:max_pairs]
    
    print(f"Selected top {len(best_pairs)} pairs")
    
    # Convert to the format expected by generate_game
    valid_pairs = []
    for pair in best_pairs:
        # Find one path for the basic format
        path = find_shortest_path(pair['player_a'], pair['player_b'], linkages)
        valid_pairs.append({
            'player_a': pair['player_a'],
            'player_b': pair['player_b'],
            'path_length': len(path) if path else 0,
            'path': path if path else [],
            'score': pair['score'],
            'solution_variety': {
                'count': pair['path_count'],
                'shortest': pair['shortest_path'],
                'longest': pair['longest_path'],
                'lengths': pair['path_lengths']
            }
        })
    
    # Save the valid pairs
    with open('valid_game_pairs.json', 'w') as f:
        json.dump(valid_pairs, f, indent=2)
    
    return valid_pairs

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
        print("\nTop daily puzzle candidates (short minimum + maximum expert solutions):")
        for i, pair in enumerate(pairs[:5], 1):
            player_a_name = get_player_name(pair['player_a'])
            player_b_name = get_player_name(pair['player_b'])
            variety = pair['solution_variety']
            
            print(f"\n{i}. {player_a_name} → {player_b_name}")
            print(f"   Score: {pair['score']:.1f}")
            print(f"   Total solutions: {variety['count']} paths")
            print(f"   Accessibility: {variety['shortest']}-hop minimum (EASY)")
            print(f"   Expert challenge: Up to {variety['longest']} hops")
            print(f"   Length distribution: {variety['lengths']}")
            
            # Show the shortest path for accessibility
            path_names = []
            for player_id in pair['path']:
                path_names.append(get_player_name(player_id))
            print(f"   Easy solution: {' → '.join(path_names)}")
    else:
        print("No valid pairs found!")