"""
История диалогов: получение сообщений по персонажу и поиск по тексту
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
                "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
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
        char_id = params.get("char_id")
        search = params.get("search", "").strip()

        if char_id:
            if search:
                cur.execute(
                    "SELECT m.id, m.role, m.content, m.created_at, c.name, c.avatar_emoji FROM messages m JOIN characters c ON c.id = m.char_id WHERE m.char_id = %s AND m.content ILIKE %s ORDER BY m.id",
                    (char_id, f"%{search}%"),
                )
            else:
                cur.execute(
                    "SELECT m.id, m.role, m.content, m.created_at, c.name, c.avatar_emoji FROM messages m JOIN characters c ON c.id = m.char_id WHERE m.char_id = %s ORDER BY m.id",
                    (char_id,),
                )
        elif search:
            cur.execute(
                "SELECT m.id, m.role, m.content, m.created_at, c.name, c.avatar_emoji FROM messages m JOIN characters c ON c.id = m.char_id WHERE m.content ILIKE %s ORDER BY m.created_at DESC LIMIT 100",
                (f"%{search}%",),
            )
        else:
            cur.execute(
                "SELECT m.id, m.role, m.content, m.created_at, c.name, c.avatar_emoji FROM messages m JOIN characters c ON c.id = m.char_id ORDER BY m.created_at DESC LIMIT 200"
            )

        rows = cur.fetchall()
        msgs = [
            {"id": r[0], "role": r[1], "content": r[2], "created_at": str(r[3]), "char_name": r[4], "avatar_emoji": r[5]}
            for r in rows
        ]
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps(msgs, ensure_ascii=False)}

    if method == "DELETE":
        char_id = params.get("char_id")
        if char_id:
            cur.execute("DELETE FROM messages WHERE char_id = %s", (char_id,))
        else:
            cur.execute("DELETE FROM messages")
        conn.commit()
        conn.close()
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "cleared"})}

    conn.close()
    return {"statusCode": 405, "headers": headers, "body": json.dumps({"error": "Method not allowed"})}
