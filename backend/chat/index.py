"""
Чат с персонажем через OpenAI GPT — отправка и получение сообщений
"""
import json
import os
import psycopg2
from openai import OpenAI


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


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

    if not char_id or not user_msg:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "char_id и message обязательны"})}

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT name, description FROM characters WHERE id = %s", (char_id,))
    char = cur.fetchone()
    if not char:
        conn.close()
        return {"statusCode": 404, "headers": headers, "body": json.dumps({"error": "Персонаж не найден"})}

    char_name, char_desc = char

    cur.execute(
        "SELECT role, content FROM messages WHERE char_id = %s ORDER BY id DESC LIMIT 20",
        (char_id,),
    )
    history = [{"role": r[0], "content": r[1]} for r in reversed(cur.fetchall())]

    model = data.get("model", "gpt-3.5-turbo")
    temperature = float(data.get("temperature", 0.8))

    api_key = os.environ.get("OPENAI_API_KEY", "")
    client = OpenAI(api_key=api_key)

    messages = [
        {"role": "system", "content": f"Ты персонаж по имени {char_name}. {char_desc}. Отвечай в соответствии со своим характером."}
    ]
    messages += history
    messages.append({"role": "user", "content": user_msg})

    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )
    reply = response.choices[0].message.content

    cur.execute("INSERT INTO messages (char_id, role, content) VALUES (%s, %s, %s)", (char_id, "user", user_msg))
    cur.execute("INSERT INTO messages (char_id, role, content) VALUES (%s, %s, %s)", (char_id, "assistant", reply))
    conn.commit()
    conn.close()

    return {"statusCode": 200, "headers": headers, "body": json.dumps({"reply": reply}, ensure_ascii=False)}
