from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.config import base_paths
import pandas as pd
from pathlib import Path

drought_data = []
yield_data = []
temperature_data = None

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "sample_data"

@asynccontextmanager
async def app_lifecycle(_: FastAPI):
    print("[app_lifecycle] Startup in progress...")
    load_all_data()

    yield

    print("[app_lifecycle] Shutdown in progress...")

def load_all_data():
    global drought_data, yield_data, temperature_data
    
    yield_file = DATA_DIR / "cereal_food_cleaned.csv"
    drought_file = DATA_DIR / "drought_event_SPEI03_cleaned.csv"
    temperature_file = DATA_DIR / "all_world_climate_data_from_1951_to_2025.csv"
    
    if drought_file.exists():
        drought_data = pd.read_csv(drought_file).to_dict(orient="records")
        print(f"Loaded drought data: {len(drought_data)} rows")
    else:
        print("No drought.csv found")

    if yield_file.exists():
        yield_data = pd.read_csv(yield_file)
        yield_data = yield_data.where(pd.notnull(yield_data),None)
        yield_data = yield_data.to_dict(orient="records")
        print(f"Loaded yields data: {len(yield_data)} rows")
    else:
        print("No yields.csv found")
    
    if temperature_file.exists():
        temperature_data = pd.read_csv(temperature_file, parse_dates=["time"])
        print(f"Loaded temperature data: {len(temperature_data)} rows")
        print("Temperature DataFrame head:")
        print(temperature_data.head())
        print("Temperature DataFrame dtypes:")
        print(temperature_data.dtypes)
    
    print("CSV data loaded.")
