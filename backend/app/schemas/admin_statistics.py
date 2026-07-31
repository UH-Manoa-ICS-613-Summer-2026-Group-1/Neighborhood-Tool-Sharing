from pydantic import BaseModel, ConfigDict

# RESPONSE SCHEMAS


class AdminOverviewStatisticsResponse(BaseModel):
    """
    Overview statistics schema matching admin_overview_statistics_v view.
    """

    total_users: int
    active_users: int
    suspended_users: int
    new_users_this_month: int

    total_tools: int
    available_tools: int
    hidden_tools: int
    suspended_tools: int
    deleted_tools: int
    new_tools_this_month: int

    total_reservations: int
    requested_reservations: int
    approved_reservations: int
    picked_up_reservations: int
    completed_reservations: int
    denied_reservations: int
    cancelled_reservations: int
    new_reservations_this_month: int

    model_config = ConfigDict(from_attributes=True)


class DateCount(BaseModel):
    date: str
    count: int


class AdminTimeframeStatisticsResponse(BaseModel):
    all_time_users: int
    all_time_tools: int
    all_time_reservations: int
    timeframe_new_users: int
    timeframe_new_tools: int
    timeframe_new_reservations: int

    new_users_per_day: list[DateCount]
    new_tools_per_day: list[DateCount]
    reservations_per_day: list[DateCount]
