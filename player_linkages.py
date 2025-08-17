import json
import os
from collections import defaultdict
from datetime import datetime

def load_player_positions():
    """Load all player positions from player files"""
    player_positions = {}
    players_dir = 'players'
    
    if not os.path.exists(players_dir):
        print(f"Warning: {players_dir} directory not found")
        return player_positions
    
    player_files = [f for f in os.listdir(players_dir) if f.endswith('.json')]
    print(f"Loading positions for {len(player_files)} players...")
    
    for player_file in player_files:
        filepath = os.path.join(players_dir, player_file)
        try:
            with open(filepath, 'r') as f:
                player_data = json.load(f)
                player_id = player_data.get('playerId')
                position = player_data.get('position', '')
                
                if player_id and position:
                    # Normalize position: C, L, R -> F (Forward), D -> D (Defense), G -> G (Goalie)
                    if position in ['C', 'L', 'R']:
                        normalized_position = 'F'
                    else:
                        normalized_position = position
                    
                    player_positions[player_id] = normalized_position
        except Exception as e:
            print(f"  Error loading player {player_file}: {e}")
    
    position_counts = defaultdict(int)
    for pos in player_positions.values():
        position_counts[pos] += 1
    
    print(f"Loaded positions: F={position_counts['F']}, D={position_counts['D']}, G={position_counts['G']}")
    return player_positions

def are_positions_compatible(pos1, pos2):
    """Check if two positions are compatible for linkage"""
    # Goalies are not linked with anyone
    if 'G' in [pos1, pos2]:
        return False
    # Forwards link with forwards, defensemen with defensemen
    return pos1 == pos2

def parse_time_to_seconds(time_str):
    """Convert MM:SS to seconds"""
    try:
        minutes, seconds = time_str.split(':')
        return int(minutes) * 60 + int(seconds)
    except:
        return 0

def process_shift_file(filepath, season, player_positions):
    """Process a single shift file and extract player overlap data"""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    if 'data' not in data or not data['data']:
        return {}
    
    shifts = data['data']
    
    # Group shifts by team and period
    team_periods = defaultdict(lambda: defaultdict(list))
    
    for shift in shifts:
        team_id = shift.get('teamId')
        period = shift.get('period')
        player_id = shift.get('playerId')
        start_time = shift.get('startTime')
        end_time = shift.get('endTime')
        
        if all([team_id, period, player_id, start_time, end_time]):
            start_seconds = parse_time_to_seconds(start_time)
            end_seconds = parse_time_to_seconds(end_time)
            
            team_periods[team_id][period].append({
                'player_id': player_id,
                'start': start_seconds,
                'end': end_seconds
            })
    
    # Calculate overlap times between players on same team with compatible positions
    overlaps = defaultdict(lambda: defaultdict(lambda: {'minutes': 0, 'seasons': set()}))
    
    for team_id, periods in team_periods.items():
        for period, shifts in periods.items():
            # Compare all pairs of shifts in the same period
            for i in range(len(shifts)):
                for j in range(i + 1, len(shifts)):
                    shift1 = shifts[i]
                    shift2 = shifts[j]
                    
                    player1 = shift1['player_id']
                    player2 = shift2['player_id']
                    
                    # Check if positions are compatible
                    pos1 = player_positions.get(player1)
                    pos2 = player_positions.get(player2)
                    
                    if not pos1 or not pos2:
                        continue  # Skip if we don't have position data
                    
                    if not are_positions_compatible(pos1, pos2):
                        continue  # Skip if positions aren't compatible
                    
                    # Calculate overlap
                    overlap_start = max(shift1['start'], shift2['start'])
                    overlap_end = min(shift1['end'], shift2['end'])
                    
                    if overlap_start < overlap_end:
                        overlap_seconds = overlap_end - overlap_start
                        
                        # Store bidirectionally
                        overlaps[player1][player2]['minutes'] += overlap_seconds / 60
                        overlaps[player1][player2]['seasons'].add(season)
                        overlaps[player2][player1]['minutes'] += overlap_seconds / 60
                        overlaps[player2][player1]['seasons'].add(season)
    
    return overlaps

def main():
    print("Starting player linkage generation...")
    start_time = datetime.now()
    
    # Load player positions first
    player_positions = load_player_positions()
    if not player_positions:
        print("Error: No player positions loaded. Exiting.")
        return
    
    # Initialize the aggregated data structure
    all_player_connections = defaultdict(lambda: defaultdict(lambda: {'minutes': 0, 'seasons': set()}))
    
    # Process all shift files
    shift_charts_dir = 'shift_charts'
    seasons = sorted(os.listdir(shift_charts_dir))
    
    total_files = 0
    for season in seasons:
        season_dir = os.path.join(shift_charts_dir, season)
        if not os.path.isdir(season_dir):
            continue
            
        game_files = [f for f in os.listdir(season_dir) if f.endswith('.json')]
        print(f"\nProcessing season {season}: {len(game_files)} games")
        
        for i, game_file in enumerate(game_files):
            if i % 100 == 0:
                print(f"  Processed {i}/{len(game_files)} games...")
                
            filepath = os.path.join(season_dir, game_file)
            try:
                overlaps = process_shift_file(filepath, season, player_positions)
                
                # Aggregate the overlaps
                for player1, connections in overlaps.items():
                    for player2, data in connections.items():
                        all_player_connections[player1][player2]['minutes'] += data['minutes']
                        all_player_connections[player1][player2]['seasons'].update(data['seasons'])
                        
                total_files += 1
            except Exception as e:
                print(f"  Error processing {game_file}: {e}")
    
    print(f"\nProcessed {total_files} total games")
    print("Filtering connections with 600+ minutes...")
    
    # Filter for 500+ minutes and prepare output
    player_linkages = {}
    total_connections = 0
    
    for player_id, connections in all_player_connections.items():
        valid_connections = []
        
        for connected_player, data in connections.items():
            if data['minutes'] >= 600:
                valid_connections.append({
                    'playerId': connected_player,
                    'minutes': round(data['minutes'], 2),
                    'seasons': sorted(list(data['seasons']))
                })
                total_connections += 1
        
        if valid_connections:
            # Calculate connectivity score (number of connections)
            connectivity_score = len(valid_connections)
            
            player_linkages[player_id] = {
                'connectivity_score': connectivity_score,
                'connections': sorted(valid_connections, key=lambda x: x['minutes'], reverse=True)
            }
    
    print(f"Found {len(player_linkages)} players with connections")
    print(f"Total connections: {total_connections // 2} (bidirectional)")
    
    # Create output directory
    output_dir = 'player_linkages'
    os.makedirs(output_dir, exist_ok=True)
    
    # Write individual player files
    print(f"\nWriting player linkage files to {output_dir}/...")
    for player_id, data in player_linkages.items():
        output_file = os.path.join(output_dir, f"{player_id}.json")
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    # Create a summary file with statistics
    print("Creating summary statistics...")
    summary = {
        'total_players': len(player_linkages),
        'total_connections': total_connections // 2,
        'generation_time': str(datetime.now() - start_time),
        'seasons_processed': seasons,
        'games_processed': total_files,
        'top_connected_players': []
    }
    
    # Find top 20 most connected players
    sorted_players = sorted(player_linkages.items(), 
                          key=lambda x: x[1]['connectivity_score'], 
                          reverse=True)[:20]
    
    for player_id, data in sorted_players:
        summary['top_connected_players'].append({
            'playerId': player_id,
            'connectivity_score': data['connectivity_score'],
            'total_minutes': sum(c['minutes'] for c in data['connections'])
        })
    
    with open(os.path.join(output_dir, 'summary.json'), 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\nCompleted in {datetime.now() - start_time}")
    print(f"Player linkage files written to {output_dir}/")
    print(f"Summary statistics written to {output_dir}/summary.json")

if __name__ == "__main__":
    main()