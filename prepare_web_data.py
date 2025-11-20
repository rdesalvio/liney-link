import json
import os
import random

def load_player_names():
    """Load simplified player data with just names and IDs"""
    players = []
    players_dir = 'players'
    
    for filename in os.listdir(players_dir):
        if filename.endswith('.json'):
            try:
                with open(f"{players_dir}/{filename}") as f:
                    player_data = json.load(f)
                
                player_id = player_data.get('playerId')
                first_name = player_data.get('firstName', {}).get('default', '')
                last_name = player_data.get('lastName', {}).get('default', '')
                
                if player_id and first_name and last_name:
                    players.append({
                        'id': player_id,
                        'name': f"{first_name} {last_name}"
                    })
            except:
                continue
    
    return players

def load_player_connections():
    """Load only the connection info needed for validation"""
    connections = {}
    linkages_dir = 'player_linkages'
    
    for filename in os.listdir(linkages_dir):
        if filename.endswith('.json') and filename != 'summary.json':
            try:
                player_id = int(filename.split('.')[0])
                with open(f"{linkages_dir}/{filename}") as f:
                    linkage_data = json.load(f)
                
                # Only store the connected player IDs (not minutes/seasons)
                connected_ids = [conn['playerId'] for conn in linkage_data.get('connections', [])]
                if connected_ids:
                    connections[player_id] = connected_ids
            except:
                continue
    
    return connections

def get_random_game_pair():
    """Get a random valid game pair"""
    try:
        with open('valid_game_pairs.json') as f:
            valid_pairs = json.load(f)
        
        if valid_pairs:
            pair = random.choice(valid_pairs)
            return pair['player_a'], pair['player_b']
    except:
        pass
    
    # Fallback: return None if no valid pairs available
    return None, None

def create_web_data():
    """Create optimized data files for the web app"""
    print("Loading player data...")
    players = load_player_names()
    
    print("Loading connection data...")
    connections = load_player_connections()
    
    print("Selecting game pair...")
    player_a, player_b = get_random_game_pair()
    
    if not player_a or not player_b:
        print("Error: No valid game pairs available. Run find_valid_pairs.py first.")
        return
    
    # Create web data directory
    os.makedirs('web_data', exist_ok=True)
    
    # Save player names for search
    with open('web_data/players.json', 'w') as f:
        json.dump(players, f)
    
    # Save connections (only IDs, no metadata)
    with open('web_data/connections.json', 'w') as f:
        json.dump(connections, f)
    
    # Save today's game
    game_data = {
        'playerA': player_a,
        'playerB': player_b
    }
    
    with open('web_data/current_game.json', 'w') as f:
        json.dump(game_data, f)
    
    # Get player names for display
    player_names = {p['id']: p['name'] for p in players}
    player_a_name = player_names.get(player_a, f"Player {player_a}")
    player_b_name = player_names.get(player_b, f"Player {player_b}")
    
    # Find and display all solutions for development
    print(f"Game data prepared successfully!")
    print(f"Today's puzzle: {player_a_name} → {player_b_name}")
    print(f"Total players available: {len(players)}")
    print(f"Players with connections: {len(connections)}")
    
    # Show solutions for development
    print(f"\n🔍 DEVELOPMENT - All Solutions:")
    print("=" * 60)
    
    try:
        from generate_game import get_all_solutions
        solutions = get_all_solutions(player_a, player_b)
        
        if solutions:
            for i, solution in enumerate(solutions, 1):
                path_str = " → ".join(solution['path_names'])
                print(f"Solution {i} ({solution['length']} players): {path_str}")
        else:
            print("No solutions found!")
    except Exception as e:
        print(f"Could not generate solutions: {e}")
    
    print("=" * 60)

if __name__ == "__main__":
    create_web_data()