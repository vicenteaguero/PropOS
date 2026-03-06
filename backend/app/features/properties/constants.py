from enum import Enum


class PropertyStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    SOLD = "SOLD"
    RENTED = "RENTED"
    INACTIVE = "INACTIVE"


PROPERTIES_TABLE = "properties"
