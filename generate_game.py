import os
import random
import json

player_linkage_folder = "player_linkages"
player_info_folder = "players"

def wereEverTeamates(first_player, second_player):
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

    # Check if there's any intersection (same season and team)
    return len(first_season_teams.intersection(second_season_teams)) > 0

def get_player_info(playerId):
    player = {}
    with open(f"{player_info_folder}/{playerId}.json") as player_file:
        player = json.load(player_file)

    return player

def find_all_paths(start_player, end_player, max_length=10, linkages=None, max_paths_per_length=200):
    """
    Find all possible paths between two players using iterative deepening.
    Returns a list of paths sorted by length (shortest first) with TOI percentages.

    Args:
        start_player: Starting player ID
        end_player: Ending player ID
        max_length: Maximum path length to search
        linkages: Pre-loaded linkage data (will load if None)
        max_paths_per_length: Maximum number of paths to keep per length (prevents explosion)

    Returns:
        List of (path, percentages) tuples sorted by path length
    """
    if start_player == end_player:
        return [([start_player], [])]

    # Load linkages if not provided
    if linkages is None:
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

    all_paths = []

    # Use iterative deepening: search for paths of each specific length
    # This ensures we find ALL paths without exponential explosion
    for target_length in range(2, max_length + 1):
        paths_at_length = _find_paths_of_length(
            start_player, end_player, target_length, linkages, max_paths_per_length
        )

        if paths_at_length:
            all_paths.extend(paths_at_length)
            print(f"  Found {len(paths_at_length)} paths of length {target_length}")

        # If we found paths at this length and haven't found any at previous lengths,
        # we can optionally continue to find longer paths for variety
        # (Don't break early - we want all paths for maximum variety)

    # Paths are already sorted by length due to iterative deepening
    return all_paths


def _find_paths_of_length(start_player, end_player, target_length, linkages, max_paths):
    """
    Find all paths of exactly the specified length between two players.
    Uses DFS with depth limiting to efficiently find paths of exact length.

    Args:
        start_player: Starting player ID
        end_player: Ending player ID
        target_length: Exact path length to find
        linkages: Pre-loaded linkage data
        max_paths: Maximum paths to return (prevents explosion)

    Returns:
        List of (path, percentages) tuples of exactly target_length
    """
    if target_length < 2:
        return []

    paths_found = []

    def dfs(current, path, percentages, depth):
        # Stop if we've found enough paths
        if len(paths_found) >= max_paths:
            return

        # If we've reached target depth
        if depth == target_length - 1:
            # Check if we can reach the end from here
            if current in linkages:
                for connection in linkages[current].get('connections', []):
                    if connection['playerId'] == end_player:
                        final_path = path + [end_player]
                        final_percentages = percentages + [connection.get('percentage_of_total', 0)]
                        paths_found.append((final_path, final_percentages))

                        if len(paths_found) >= max_paths:
                            return
            return

        # Continue searching (not at target depth yet)
        if current not in linkages:
            return

        for connection in linkages[current].get('connections', []):
            next_player = connection['playerId']

            # Avoid cycles
            if next_player in path:
                continue

            # Avoid the end player until we're at the right depth
            if next_player == end_player:
                continue

            new_path = path + [next_player]
            new_percentages = percentages + [connection.get('percentage_of_total', 0)]

            dfs(next_player, new_path, new_percentages, depth + 1)

            if len(paths_found) >= max_paths:
                return

    # Start DFS from the start player
    dfs(start_player, [start_player], [], 0)

    return paths_found

def calculate_uniqueness_score(percentages):
    """
    Calculate uniqueness score from TOI percentages.
    Score is 0-100 where 0 is lowest (obscure connections) and 100 is highest (obvious connections).
    
    Uses the average percentage and maps it to a 0-100 scale:
    - 4% average = score 0 (most obscure connections, barely played together)
    - 100% average = score 100 (most obvious connections, played together constantly)
    - Linear interpolation between
    """
    if not percentages:
        return 0
    
    avg_percentage = sum(percentages) / len(percentages)
    
    # Map from [5%, 100%] to [0, 100]
    # Clamp between 5 and 100
    avg_percentage = max(4, min(100, avg_percentage))
    
    # Linear mapping: 5% -> 0, 100% -> 100
    uniqueness_score = ((avg_percentage - 4) / 95) * 100
    
    return round(uniqueness_score, 1)

def get_all_solutions(player_a_id, player_b_id, max_paths=None, max_length=10, max_paths_per_length=200):
    """
    Get all possible solutions (paths) between two players with TOI percentages and uniqueness scores.
    Returns paths sorted by length (shortest to longest).

    Args:
        player_a_id: First player ID
        player_b_id: Second player ID
        max_paths: Optional limit on total paths returned (for backward compatibility)
        max_length: Maximum path length to search
        max_paths_per_length: Maximum paths to find per length (prevents explosion)
    """
    all_paths = find_all_paths(player_a_id, player_b_id, max_length=max_length,
                                max_paths_per_length=max_paths_per_length)

    if max_paths:
        all_paths = all_paths[:max_paths]
    
    # Convert player IDs to names for display
    solutions = []
    for path, percentages in all_paths:
        path_with_names = []
        for player_id in path:
            try:
                player_info = get_player_info(player_id)
                first_name = player_info.get('firstName', {}).get('default', '')
                last_name = player_info.get('lastName', {}).get('default', '')
                path_with_names.append(f"{first_name} {last_name}")
            except:
                path_with_names.append(f"Player {player_id}")
        
        uniqueness_score = calculate_uniqueness_score(percentages)
        
        solutions.append({
            'path_ids': path,
            'path_names': path_with_names,
            'length': len(path),
            'toi_percentages': percentages,
            'uniqueness_score': uniqueness_score
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
    # No longer limiting to 20 - find ALL paths for maximum variety
    solutions = get_all_solutions(player_a_id, player_b_id)
    
    if solutions:
        print(f"\nFound {len(solutions)} solution(s):")
        print()
        
        for i, solution in enumerate(solutions, 1):
            print(f"Solution {i} (Length: {solution['length']}, Uniqueness: {solution['uniqueness_score']}):")
            path_str = " → ".join(solution['path_names'])
            print(f"  {path_str}")
            
            # Show TOI percentages for each connection
            if solution['toi_percentages']:
                toi_str = " → ".join([f"{p:.1f}%" for p in solution['toi_percentages']])
                print(f"  TOI%: {toi_str}")
            print()
    else:
        print("No solutions found!")