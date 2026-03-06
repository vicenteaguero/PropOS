from enum import Enum


class ContactType(str, Enum):
    LANDOWNER = "LANDOWNER"
    BUYER = "BUYER"
    SELLER = "SELLER"
    TENANT = "TENANT"
    AGENT = "AGENT"
    INVESTOR = "INVESTOR"
    OTHER = "OTHER"


CONTACTS_TABLE = "contacts"
