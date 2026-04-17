from fastapi import APIRouter
from pydantic import BaseModel
from services.conversation_store import (
    create_conversation, list_conversations, get_messages,
    add_message, rename_conversation, delete_conversation,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


class CreateRequest(BaseModel):
    title: str


class AddMessageRequest(BaseModel):
    role: str
    content: str
    trace_id: str | None = None
    sources: list | None = None


class RenameRequest(BaseModel):
    title: str


@router.get("/")
def get_conversations():
    return list_conversations()


@router.post("/")
def create_conv(req: CreateRequest):
    return create_conversation(req.title)


@router.get("/{conv_id}/messages")
def get_conv_messages(conv_id: int):
    return get_messages(conv_id)


@router.post("/{conv_id}/messages")
def add_conv_message(conv_id: int, req: AddMessageRequest):
    return add_message(conv_id, req.role, req.content, req.trace_id, req.sources)


@router.patch("/{conv_id}")
def rename_conv(conv_id: int, req: RenameRequest):
    rename_conversation(conv_id, req.title)
    return {"ok": True}


@router.delete("/{conv_id}")
def delete_conv(conv_id: int):
    delete_conversation(conv_id)
    return {"ok": True}