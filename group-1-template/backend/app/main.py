from app.config import base_paths

# this main.py allows us to run scripts in here without needing to run fastapi's setup

def do_something():
    print("Doing something without starting the webserver.")


def main():

    # populate paths once in startup, so we can fail early
    print(PATH_ROOT_DIR)
    print(PATH_DATA_DIR)

    do_something()

if __name__ == "__main__":
    main()