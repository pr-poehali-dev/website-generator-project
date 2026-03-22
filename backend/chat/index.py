"""
Чат с персонажем через Hugging Face — бесплатно, без ключей, работает из России
"""
import json
import os
import urllib.request
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def hf_chat(system_prompt: str, history: list, user_msg: str) -> str:
    prompt = f"<s>[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n"
    for msg in history[-6:]:
        if msg["role"] == "user":
            prompt += f"{msg['content']} [/INST] "
        else:
            prompt += f"{msg['content']} </s><s>[INST] "
    prompt += f"{user_msg} [/INST]"

    payload = json.dumps({
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 300,
            "temperature": 0.8,
            "return_full_text": False,
            "stop": ["</s>", "[INST]"]
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        result = json.loads(resp.read())

    if isinstance(result, list) and result:
        text = result[0].get("generated_text", "").strip()
        # Обрезаем лишние токены если есть
        for stop in ["</s>", "[INST]", "<<SYS>>"]:
            if stop in text:
                text = text.split(stop)[0].strip()
        return text or "..."
    return "Не могу ответить прямо сейчас."


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}

    data = json.loads(event.get("body") or "{}")
    char_id = data.get("char_id")
    user_msg = data.get("message", "").strip()
    user_id = data.get("user_id", "")

    if not char_id or not user_msg:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "char_id и message обязательны"})}

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT name, description, is_public, owner_id FROM characters WHERE id = %s", (char_id,))
    char = cur.fetchone()
    if not char:
        conn.close()
        return {"statusCode": 404, "headers": headers, "body": json.dumps({"error": "Персонаж не найден"})}

    char_name, char_desc, is_public, owner_id = char

    if not is_public and owner_id and owner_id != user_id:
        conn.close()
        return {"statusCode": 403, "headers": headers, "body": json.dumps({"error": "Этот персонаж приватный. Только автор может с ним общаться."})}

    cur.execute(
        "SELECT role, content FROM messages WHERE char_id = %s ORDER BY id DESC LIMIT 12",
        (char_id,),
    )
    history = [{"role": r[0], "content": r[1]} for r in reversed(cur.fetchall())]

    system_prompt = (
        f"You are a character named {char_name}. {char_desc}. "
        f"Stay in character always. Reply in Russian. Be concise and expressive."
    )

    try:
        reply = hf_chat(system_prompt, history, user_msg)
    except Exception as e:
        conn.close()
        return {"statusCode": 502, "headers": headers, "body": json.dumps({"error": f"Ошибка ИИ: {str(e)}"})}

    cur.execute("INSERT INTO messages (char_id, role, content) VALUES (%s, %s, %s)", (char_id, "user", user_msg))
    cur.execute("INSERT INTO messages (char_id, role, content) VALUES (%s, %s, %s)", (char_id, "assistant", reply))
    conn.commit()
    conn.close()

    return {"statusCode": 200, "headers": headers, "body": json.dumps({"reply": reply}, ensure_ascii=False)}
