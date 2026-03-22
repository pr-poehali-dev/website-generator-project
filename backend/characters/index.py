"""
API для управления персонажами: создание, список, удаление
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
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    method = event.get("httpMethod", "GET")
    headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}

    conn = get_conn()
    cur = conn.cursor()

    if method == "GET":
        cur.execute("SELECT id, name, description, avatar_emoji, created_at FROM characters ORDER BY created_at DESC")
        rows = cur.fetchall()
        chars = [
            {"id": r[0], "name": r[1], "description": r[2], "avatar_emoji": r[3], "created_at": str(r[4])}
            for r in rows
        ]
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps(chars, ensure_ascii=False)}

    if method == "POST":
        data = json.loads(event.get("body") or "{}")
        name = data.get("name", "").strip()
        description = data.get("description", "").strip()
        avatar_emoji = data.get("avatar_emoji", "🤖")
        if not name or not description:
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "name и description обязательны"})}
        cur.execute(
            "INSERT INTO characters (name, description, avatar_emoji) VALUES (%s, %s, %s) RETURNING id",
            (name, description, avatar_emoji),
        )
        char_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "ok", "char_id": char_id})}

    if method == "DELETE":
        params = event.get("queryStringParameters") or {}
        char_id = params.get("id")
        if not char_id:
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "id обязателен"})}
        cur.execute("DELETE FROM messages WHERE char_id = %s", (char_id,))
        cur.execute("DELETE FROM characters WHERE id = %s", (char_id,))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "deleted"})}

    conn.close()
    return {"statusCode": 405, "headers": headers, "body": json.dumps({"error": "Method not allowed"})}
