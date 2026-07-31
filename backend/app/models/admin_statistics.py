from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AdminOverviewStatistics(Base):
    __tablename__ = "admin_overview_statistics_v"

    total_users: Mapped[int] = mapped_column(primary_key=True)
    active_users: Mapped[int]
    suspended_users: Mapped[int]
    new_users_this_month: Mapped[int]

    total_tools: Mapped[int]
    available_tools: Mapped[int]
    hidden_tools: Mapped[int]
    suspended_tools: Mapped[int]
    deleted_tools: Mapped[int]
    new_tools_this_month: Mapped[int]

    total_reservations: Mapped[int]
    requested_reservations: Mapped[int]
    approved_reservations: Mapped[int]
    picked_up_reservations: Mapped[int]
    completed_reservations: Mapped[int]
    denied_reservations: Mapped[int]
    cancelled_reservations: Mapped[int]
    new_reservations_this_month: Mapped[int]
