from fastapi import APIRouter
from fastapi.responses import JSONResponse, FileResponse
from pathlib import Path
import pandas as pd

from app.generate_sample_data.upper_octant import fibonacci_sphere, linear_approx_sphere
from app.lifecycle import manager
from app.config.base_paths import PATH_DATA_DIR


data_router = APIRouter(prefix="/data", tags=["data"])

# Existing DEMO endpoints
@data_router.get("/sphere_fib")
def get_fib_sphere():
    curr_data = fibonacci_sphere()
    return JSONResponse(content={"sphere_fib": curr_data})


@data_router.get("/sphere_lin")
def get_lin_approx_sphere():
    curr_data = linear_approx_sphere()
    return JSONResponse(content={"sphere_fib": curr_data})

@data_router.get("/yields")
def get_yield_data():
    try:
        return {"yields": manager.yield_data}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@data_router.get("/drought")
def get_drought_data():
    try:
        return {"drought": manager.drought_data}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
#temperature data for drought
@data_router.get("/temperature")
def get_temperature_data(year: int | None = None, month: int | None = None):
    try:
        data = manager.temperature_data
        if data is None:
            return JSONResponse(status_code=500, content={"error": "Temperature data not loaded"})

        filtered = data.copy()
        if year:
            filtered = filtered[filtered['time'].dt.year == year]
        if month:
            filtered = filtered[filtered['time'].dt.month == month]

        # only in return convert to dict
        filtered["country"] = filtered["country"].fillna("UNKNOWN")
        filtered[["tavg", "tmin", "tmax"]] = filtered[["tavg", "tmin", "tmax"]].fillna(-9999)
        #filtered_json = filtered.where(pd.notnull(filtered), other=None)
        print(filtered.head())
        return {"temperature": filtered.to_dict(orient="records")}

    except Exception as e:
        print("Error in /temperature:",e)
        return JSONResponse(status_code=500, content={"error": str(e)})

@data_router.get("/renewables-csv")
def get_renewables_csv():
    """Serve the merged renewables CO2 CSV file"""
    csv_path = PATH_DATA_DIR / "mergednew_renewables_co2_cleaned.csv"
    if not csv_path.exists():
        return JSONResponse(
            content={"error": "CSV file not found"},
            status_code=404
        )
    return FileResponse(
        path=str(csv_path),
        media_type="text/csv",
        filename="mergednew_renewables_co2_cleaned.csv"
    )


@data_router.get("/geo-json")
def get_geo_json():
    """Serve the custom GeoJSON file"""
    geo_path = PATH_DATA_DIR / "custom.geo.json"
    if not geo_path.exists():
        return JSONResponse(
            content={"error": "GeoJSON file not found"},
            status_code=404
        )
    return FileResponse(
        path=str(geo_path),
        media_type="application/json",
        filename="custom.geo.json"
    )
