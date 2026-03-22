"""
Чат с персонажем через Groq — бесплатно, быстро, работает из России (llama3)
"""
import json
import os
import urllib.request
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def groq_chat(system_prompt: str, history: list, user_msg: str) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    messages += history[-10:]
    messages.append({"role": "user", "content": user_msg})

    payload = json.dumps({
        "model": "llama3-8b-8192",
        "messages": messages,
        "max_tokens": 400,
        "temperature": 0.85,
    }).encode("utf-8")

    api_key = os.environ.get("GROQ_API_KEY", "")
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        result = json.loads(resp.read())

    return result["choices"][0]["message"]["content"].strip()


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
        f"Ты — персонаж по имени {char_name}. {char_desc}. "
        f"Всегда оставайся в образе. Отвечай на русском языке. Отвечай живо и в духе своего характера."
    )

    if not os.environ.get("GROQ_API_KEY"):
        conn.close()
        return {"statusCode": 503, "headers": headers, "body": json.dumps({"error": "⚙️ Нужно добавить GROQ_API_KEY в Ядро → Секреты. Получить бесплатно на console.groq.com"})}

    try:
        reply = groq_chat(system_prompt, history, user_msg)
    except Exception as e:
        conn.close()
        return {"statusCode": 502, "headers": headers, "body": json.dumps({"error": f"Ошибка ИИ: {str(e)}"})}

    cur.execute("INSERT INTO messages (char_id, role, content) VALUES (%s, %s, %s)", (char_id, "user", user_msg))
    cur.execute("INSERT INTO messages (char_id, role, content) VALUES (%s, %s, %s)", (char_id, "assistant", reply))
    conn.commit()
    conn.close()

    return {"statusCode": 200, "headers": headers, "body": json.dumps({"reply": reply}, ensure_ascii=False)}
