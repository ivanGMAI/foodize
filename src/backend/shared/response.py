from fastapi import Request

from shared.schemas.response import (
    Meta,
    Pagination,
    SuccessListResponse,
    SuccessResponse,
)


def build_response(data) -> SuccessResponse:
    return SuccessResponse(data=data, meta=Meta())


def build_list_response(
    data: list,
    total: int,
    page: int,
    size: int,
    request: Request,
) -> SuccessListResponse:
    total_pages = max(1, (total + size - 1) // size)

    base_url = str(request.url.remove_query_params(["page", "size"]))
    sep = "&" if "?" in base_url else "?"

    next_url = f"{base_url}{sep}page={page + 1}&size={size}" if page < total_pages else None
    prev_url = f"{base_url}{sep}page={page - 1}&size={size}" if page > 1 else None

    return SuccessListResponse(
        data=data,
        meta=Meta(),
        pagination=Pagination(
            current_page=page,
            per_page=size,
            total=total,
            total_pages=total_pages,
            next=next_url,
            previous=prev_url,
        ),
    )
