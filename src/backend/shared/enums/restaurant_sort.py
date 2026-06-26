from enum import Enum


class RestaurantSort(str, Enum):
    DEFAULT = "default"
    RATING = "rating"
    POPULARITY_7D = "popularity_7d"
