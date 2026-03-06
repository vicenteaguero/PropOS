from enum import Enum


class PropertyStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    SOLD = "SOLD"
    INACTIVE = "INACTIVE"


PROPERTIES_TABLE = "properties"
