"""Validate administrator-authored hole greetings and editable starting ideas."""


def validate_opening(value):
    if value is None:
        return
    if not isinstance(value, dict) or set(value) - {"screen", "greeting", "chat_starters", "image_starters", "examples"}:
        raise ValueError("Choose valid hole opening settings")
    if value.get("screen", "chat") not in ("chat", "create"):
        raise ValueError("Opening screen must be chat or create")
    greeting = value.get("greeting", "")
    if not isinstance(greeting, str) or len(greeting) > 1600:
        raise ValueError("Opening greeting must be at most 1600 characters")
    for key in ("chat_starters", "image_starters"):
        rows = value.get(key, [])
        if not isinstance(rows, list) or len(rows) > 3:
            raise ValueError("Choose up to three starting ideas of each kind")
        for row in rows:
            if not isinstance(row, dict) or set(row) != {"label", "prompt"}:
                raise ValueError("Each starting idea needs a label and prompt")
            for field, limit in (("label", 70), ("prompt", 12000)):
                text = row[field]
                if not isinstance(text, str) or not text.strip() or len(text) > limit:
                    raise ValueError("Starting ideas need a short label and a nonempty prompt")
    examples = value.get("examples", [])
    if not isinstance(examples, list) or len(examples) > 12:
        raise ValueError("Choose up to twelve themed examples")
    import re
    for row in examples:
        if not isinstance(row, dict) or set(row) != {"image", "label", "chat", "prompt"}:
            raise ValueError("Each example needs an image, label, chat starter and image prompt")
        if not isinstance(row["image"], str) or not re.fullmatch(r"[a-f0-9]{32}", row["image"]):
            raise ValueError("Choose an uploaded example image")
        for field, limit in (("label", 70), ("chat", 500), ("prompt", 12000)):
            if not isinstance(row[field], str) or not row[field].strip() or len(row[field]) > limit:
                raise ValueError("Give each example a short label, chat starter and image prompt")
