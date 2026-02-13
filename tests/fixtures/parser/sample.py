import os
from pathlib import Path

MAX_CONNECTIONS = 10

class DatabaseService:
    """Service for managing database connections."""

    def __init__(self, url: str):
        self.url = url
        self.pool = None

    def connect(self) -> bool:
        """Establish a database connection."""
        self.pool = create_pool(self.url)
        return True

    def query(self, sql: str, params: list) -> list:
        return self.pool.execute(sql, params)

def create_pool(url: str) -> Pool:
    """Create a connection pool."""
    return Pool(url, max_size=MAX_CONNECTIONS)

TIMEOUT = 30
