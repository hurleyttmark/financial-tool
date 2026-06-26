"""
config.py — Environment variable validation and settings.
validate_config() must be called before the FastAPI app binds its port.
"""
import sys
import os
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    alpha_vantage_api_key: str = Field(default="", alias="ALPHA_VANTAGE_API_KEY")
    data_source: str = Field(default="alphavantage", alias="DATA_SOURCE")
    db_path: str = Field(default="./cache.db", alias="DB_PATH")
    log_path: str = Field(default="./app.log", alias="LOG_PATH")

    class Config:
        env_file = ".env"
        populate_by_name = True


def validate_config() -> Settings:
    """
    Load and validate required environment variables.
    Prints a named list of missing vars and exits with code 1 if any are absent.
    Only ALPHA_VANTAGE_API_KEY is required unless DATA_SOURCE=yfinance.
    """
    settings = Settings()
    missing: list[str] = []

    if settings.data_source.lower() != "yfinance":
        if not settings.alpha_vantage_api_key:
            missing.append("ALPHA_VANTAGE_API_KEY")

    if missing:
        print("\n[STARTUP ERROR] Missing required environment variables:")
        for var in missing:
            print(f"  - {var}")
        print("\nCopy .env.example to .env and fill in the missing values.\n")
        sys.exit(1)

    return settings


settings = validate_config()
