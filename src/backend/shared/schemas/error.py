from pydantic import BaseModel


class ErrorDescriptionSchema(BaseModel):
    error: str


class ErrorSchema(BaseModel):
    detail: ErrorDescriptionSchema
