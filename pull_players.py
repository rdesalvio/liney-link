import requests
import json
import os
import time

player_endpoint = "https://api-web.nhle.com/v1/player/" #{gameId} + /landing

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

def get_player(playerId):
    resp = make_request(player_endpoint + str(playerId) + "/landing")
    if resp.status_code != 200:
        print(f"Unable to get player {playerId}")
        return

    folder_path = f"players/"
    os.makedirs(folder_path, exist_ok=True)
    with open(f"{folder_path}/{playerId}.json", "w") as file:
        json.dump(resp.json(), file)

if __name__ == "__main__":
    dirs = [x[1] for x in os.walk("shift_charts")]
    for dir in dirs[0]:
        print(f"Working on season {dir}")
        files = [x[2] for x in os.walk(f"shift_charts/{dir}")]
        for file in files[0]:
            with open(f"shift_charts/{dir}/{file}", 'r') as json_file:
                data = json.load(json_file)
            
            for shift in data.get("data"):
                shift_player_id = shift.get("playerId")
                # if the player json does not exist, create it
                if not os.path.exists(f"players/{shift_player_id}.json"):
                    get_player(shift_player_id)