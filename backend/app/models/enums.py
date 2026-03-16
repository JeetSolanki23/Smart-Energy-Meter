from enum import Enum


class DeviceStatus(str, Enum):
    PENDING_ACTIVATION = "PENDING_ACTIVATION"
    ACTIVE = "ACTIVE"
    DEACTIVATED = "DEACTIVATED"
    REMOVED = "REMOVED"


class BillStatus(str, Enum):
    UNPAID = "UNPAID"
    PAID = "PAID"
    OVERDUE = "OVERDUE"


class PaymentStatus(str, Enum):
    CREATED = "CREATED"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
