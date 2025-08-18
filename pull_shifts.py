import requests
import json
import os
import time

# 20122013,20132014,20142015,20152016,20162017,20172018,20182019,20192020,20202021,20212022,20222023,
seasons = [20232024,20242025]

shift_chart_endpoint = "https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=" #{gameId}
get_season_endpoint = "https://api-web.nhle.com/v1/club-schedule-season" #/{team}/{season}

def make_request(url, max_retries=3, timeout=30):
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, timeout=timeout)
            return resp
        except (requests.exceptions.ReadTimeout, requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"Request timed out for {url}, retrying in {wait_time} seconds... (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                print(f"Failed to get {url} after {max_retries} attempts: {e}")
                resp = requests.Response()
                resp.status_code = 408
                return resp
        except Exception as e:
            print(f"Unexpected error for {url}: {e}")
            resp = requests.Response()
            resp.status_code = 500
            return resp

    return resp

def get_shifts(season, gameId):
    resp = make_request(shift_chart_endpoint + str(gameId))
    if resp.status_code != 200:
        print(f"Unable to get shift chart for game {gameId}")
        return

    folder_path = f"shift_charts/{season}"
    os.makedirs(folder_path, exist_ok=True)
    with open(f"{folder_path}/{gameId}.json", "w") as file:
        json.dump(resp.json(), file)


# get games for a given team
def get_games(team, season):
    resp = make_request(get_season_endpoint + f"/{team}/{season}")
    if resp.status_code != 200:
        print(f"No games found for team {team} in season {season}")
        return []
    games = []
    for game in resp.json().get("games"):
        games.append(game.get("id"))
    return games

# get all team ids
def get_teams():
    resp = make_request("https://api.nhle.com/stats/rest/en/team")
    teams = []

    for row in resp.json()['data']:
        teams.append(row.get("rawTricode"))

    return teams

if __name__ == "__main__":
    teams = get_teams()

    for season in seasons:
        print(f"Working on season: {season}")
        season_games = list()
        for team in teams:
            games = get_games(team, season)
            for game in games:
                season_games.append(int(game))
        
        # get rid of duplicates
        season_games = set(season_games)

        for game in season_games:
            get_shifts(season, game)