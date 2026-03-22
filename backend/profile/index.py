"""
Профиль пользователя: получение и сохранение никнейма
"""
import json
import os
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}

    conn = get_conn()
    cur = conn.cursor()

    if method == "GET":
        user_id = params.get("user_id")
        if not user_id:
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "user_id обязателен"})}
        cur.execute("SELECT id, nickname, avatar_url FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row:
            # Создаём профиль автоматически
            cur.execute("INSERT INTO users (id, nickname) VALUES (%s, %s)", (user_id, "Пользователь"))
            conn.commit()
            conn.close()
            return {"statusCode": 200, "headers": headers, "body": json.dumps({"id": user_id, "nickname": "Пользователь", "avatar_url": None})}
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"id": row[0], "nickname": row[1], "avatar_url": row[2]})}

    if method == "POST":
        data = json.loads(event.get("body") or "{}")
        user_id = data.get("user_id")
        nickname = data.get("nickname", "").strip()
        avatar_url = data.get("avatar_url")
        if not user_id:
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "user_id обязателен"})}

        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        exists = cur.fetchone()
        if exists:
            if nickname:
                cur.execute("UPDATE users SET nickname = %s WHERE id = %s", (nickname, user_id))
            if avatar_url is not None:
                cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, user_id))
        else:
            cur.execute("INSERT INTO users (id, nickname, avatar_url) VALUES (%s, %s, %s)", (user_id, nickname or "Пользователь", avatar_url))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "ok"})}

    conn.close()
    return {"statusCode": 405, "headers": headers, "body": json.dumps({"error": "Method not allowed"})}
