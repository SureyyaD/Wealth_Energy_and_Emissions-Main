import os
from pathlib import Path
from functools import lru_cache
from typing import Optional

# These are “public constants,” but will only be set in the startup configuration (see lifecycle handler)
PATH_ROOT_DIR: Path
PATH_DATA_DIR: Path

# cache the return value, since it should always keep being the same and its costly to get it again via the function
@lru_cache(maxsize=1)
def project_root() -> Path:
    p = Path(os.getenv("PROJECT_ROOT", Path.cwd())).resolve()
    if not p.is_dir():
        raise FileNotFoundError(f"Project root not found: {p}")
    return p


@lru_cache(maxsize=1)
def data_dir() -> Path:
    curr_root = PATH_ROOT_DIR if PATH_ROOT_DIR is not None else project_root()
    p = (curr_root / "sample_data").resolve()
    if not p.is_dir():
        raise FileNotFoundError(f"Sample data dir not found: {p}")
    return p

# Default inits with explicit error handling to fail early
PATH_ROOT_DIR = project_root()
PATH_DATA_DIR = data_dir()
