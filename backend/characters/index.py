"""
API для управления персонажами: создание, список, удаление, приватность, аватарка
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
                "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    method = event.get("httpMethod", "GET")
    headers = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    params = event.get("queryStringParameters") or {}

    conn = get_conn()
    cur = conn.cursor()

    if method == "GET":
        user_id = params.get("user_id", "")
        only_mine = params.get("mine") == "1"

        if only_mine and user_id:
            cur.execute(
                "SELECT id, name, description, avatar_emoji, avatar_url, is_public, owner_id, created_at FROM characters WHERE owner_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
        else:
            cur.execute(
                "SELECT id, name, description, avatar_emoji, avatar_url, is_public, owner_id, created_at FROM characters WHERE is_public = true OR owner_id = %s ORDER BY created_at DESC",
                (user_id,),
            )

        rows = cur.fetchall()
        chars = [
            {
                "id": r[0], "name": r[1], "description": r[2],
                "avatar_emoji": r[3], "avatar_url": r[4],
                "is_public": r[5], "owner_id": r[6], "created_at": str(r[7])
            }
            for r in rows
        ]
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps(chars, ensure_ascii=False)}

    if method == "POST":
        data = json.loads(event.get("body") or "{}")
        name = data.get("name", "").strip()
        description = data.get("description", "").strip()
        avatar_emoji = data.get("avatar_emoji", "🤖")
        is_public = data.get("is_public", True)
        owner_id = data.get("owner_id", None)
        if not name or not description:
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "name и description обязательны"})}
        cur.execute(
            "INSERT INTO characters (name, description, avatar_emoji, is_public, owner_id) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, description, avatar_emoji, is_public, owner_id),
        )
        char_id = cur.fetchone()[0]
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "ok", "char_id": char_id})}

    if method == "PATCH":
        data = json.loads(event.get("body") or "{}")
        char_id = data.get("id")
        is_public = data.get("is_public")
        if char_id is None or is_public is None:
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "id и is_public обязательны"})}
        cur.execute("UPDATE characters SET is_public = %s WHERE id = %s", (is_public, char_id))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "updated"})}

    if method == "DELETE":
        char_id = params.get("id")
        user_id = params.get("user_id", "")
        if not char_id:
            conn.close()
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "id обязателен"})}
        cur.execute("SELECT owner_id FROM characters WHERE id = %s", (char_id,))
        row = cur.fetchone()
        if row and row[0] and row[0] != user_id:
            conn.close()
            return {"statusCode": 403, "headers": headers, "body": json.dumps({"error": "Нет прав для удаления"})}
        cur.execute("DELETE FROM messages WHERE char_id = %s", (char_id,))
        cur.execute("DELETE FROM characters WHERE id = %s", (char_id,))
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "deleted"})}

    conn.close()
    return {"statusCode": 405, "headers": headers, "body": json.dumps({"error": "Method not allowed"})}
