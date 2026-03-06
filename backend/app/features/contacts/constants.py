from enum import Enum


class ContactType(str, Enum):
    BUYER = "buyer"
    SELLER = "seller"
    TENANT = "tenant"
    AGENT = "agent"
    INVESTOR = "investor"
    OTHER = "other"


CONTACTS_TABLE = "contacts"
