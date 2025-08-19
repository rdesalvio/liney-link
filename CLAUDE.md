# CLAUDE.md

## Project Overview

Liney Link is a hockey player connection game similar to Wordle. Players must connect two NHL players who were never teammates through a chain of linemates. The game features daily puzzles with both accessible short paths and challenging longer paths for hockey experts.

### Connection Thresholds
- **Player Linkages**: Players are connected if they played ≥5% of their total minutes together (allows creative solutions)
- **Puzzle Selection**: Selected puzzles must have at least one solution where all connections are ≥40% TOI (ensures quality answers exist)
- **Uniqueness Score**: 0-100 scale based on average TOI% of connections (0 = best/highest TOI%, 100 = worst/lowest TOI%)

## Core Components

### Data Processing Pipeline
1. **player_linkages.py** - Processes NHL shift data to create player connection networks
   - Reads shift data from `shift_charts/` (organized by season/game)
   - Loads player position data from `players/` (JSON files by player ID)
   - Creates linkages if either player spent ≥4% of their total minutes with the other
   - Only links players with compatible positions (Forwards with Forwards, Defensemen with Defensemen)
   - Outputs processed linkages to `player_linkages/` folder with percentage_of_total and percentage_of_other fields

2. **find_valid_pairs.py** - Identifies optimal daily puzzle candidates
   - Finds player pairs who were never teammates but are connected through linemates
   - Ensures at least one "quality" path exists with all connections ≥40% TOI
   - Allows additional creative paths using the 5% threshold
   - Outputs top-scored pairs to `valid_game_pairs.json`

3. **generate_game.py** - Daily puzzle generation and solution finding
   - Selects random pairs from pre-computed valid pairs
   - Finds all possible connection paths between two players
   - Calculates uniqueness scores based on TOI percentages
   - Returns solutions with TOI percentages and uniqueness scores

### Key Data Structures
- **shift_charts/[season]/[gameId].json** - Raw NHL shift data by game
- **players/[playerId].json** - Player metadata including position and team history
- **player_linkages/[playerId].json** - Pre-computed connections for each player with metadata (minutes, percentage of total minutes, seasons, connectivity score)
- **valid_game_pairs.json** - Pre-scored optimal puzzle pairs with solution variety metrics

### Teammate Detection Logic
The `wereEverTeamates()` function checks if two players played for the same team during overlapping seasons (not just the same franchise). Players can be valid puzzle pairs even if they both played for the same team in different years.

## Development Commands

Run the data processing pipeline:
```bash
python player_linkages.py          # Process shift data into player linkages
python find_valid_pairs.py         # Generate optimal puzzle candidates  
python generate_game.py            # Generate and solve daily puzzle
```

## Architecture Notes

- Position compatibility enforced: C/L/R (Forwards) link only with other Forwards, D (Defensemen) only with Defensemen, G (Goalies) excluded
- Dual threshold system:
  - 4% TOI threshold for player linkages - if EITHER player spent ≥4% with the other (enables creative solutions, especially for lower-minute players)
  - 20% TOI requirement for at least one solution path (ensures quality answers)
- Uniqueness scoring (0-100, lower is better) rewards using high-TOI connections
- Daily puzzle format requires 3-hop minimum accessibility with expert-level variety
- Path finding uses BFS with cycle detection for comprehensive solution discovery
- Scoring system balances accessibility (short paths) with expert engagement (solution variety and uniqueness)


## Next Steps
- Create a UI similar to wordle where you can play the game