"""
logger.py — Rotating file logger for all outbound API calls and app events.
Records: ISO timestamp, symbol, data source, HTTP status / exception, response time ms.
"""
import logging
from logging.handlers import RotatingFileHandler
from config import settings


def setup_logger() -> logging.Logger:
    logger = logging.getLogger("financial_tool")
    logger.setLevel(logging.INFO)

    if logger.handlers:
        return logger

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # Rotating file: 1 MB max, 3 backups
    file_handler = RotatingFileHandler(
        settings.log_path, maxBytes=1_000_000, backupCount=3
    )
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    # Console echo for development
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(fmt)
    logger.addHandler(console_handler)

    return logger


log = setup_logger()
