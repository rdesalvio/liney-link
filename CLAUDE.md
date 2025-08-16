# CLAUDE.md

## Project Overview

Liney Link is a hockey player connection game similar to Wordle. Players must connect two NHL players who were never teammates through a chain of linemates (players who played 600+ minutes together on the same team during the same season). The game features daily puzzles with both accessible short paths and challenging longer paths for hockey experts.

## Core Components

### Data Processing Pipeline
1. **player_linkages.py** - Processes NHL shift data to create player connection networks
   - Reads shift data from `shift_charts/` (organized by season/game)
   - Loads player position data from `players/` (JSON files by player ID)
   - Creates linkages between players who played 600+ minutes together
   - Only links players with compatible positions (Forwards with Forwards, Defensemen with Defensemen)
   - Outputs processed linkages to `player_linkages/` folder

2. **find_valid_pairs.py** - Identifies optimal daily puzzle candidates
   - Finds player pairs who were never teammates but are connected through linemates
   - Scores pairs based on solution variety (prioritizes 3-hop minimum with maximum total solutions)
   - Outputs top-scored pairs to `valid_game_pairs.json`

3. **generate_game.py** - Daily puzzle generation and solution finding
   - Selects random pairs from pre-computed valid pairs
   - Finds all possible connection paths between two players
   - Returns solutions sorted shortest to longest for daily puzzle format

### Key Data Structures
- **shift_charts/[season]/[gameId].json** - Raw NHL shift data by game
- **players/[playerId].json** - Player metadata including position and team history
- **player_linkages/[playerId].json** - Pre-computed connections for each player with metadata (minutes, seasons, connectivity score)
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
- 600-minute threshold ensures meaningful linemate relationships
- Daily puzzle format requires 3-hop minimum accessibility with expert-level variety (10+ total solutions preferred)
- Path finding uses BFS with cycle detection for comprehensive solution discovery
- Scoring system balances accessibility (short paths) with expert engagement (solution volume and variety)


## Next Steps
- Create a UI similar to wordle where you can play the game