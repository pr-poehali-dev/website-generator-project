"""
Загрузка аватарки пользователя или персонажа в S3 (base64)
"""
import json
import os
import base64
import uuid
import boto3
import psycopg2


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
    image_b64 = data.get("image")
    target = data.get("target", "user")  # "user" или "character"
    target_id = data.get("target_id")
    content_type = data.get("content_type", "image/jpeg")

    if not image_b64 or not target_id:
        return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "image и target_id обязательны"})}

    ext = "jpg" if "jpeg" in content_type else content_type.split("/")[-1]
    key = f"avatars/{target}/{target_id}_{uuid.uuid4().hex[:8]}.{ext}"

    image_data = base64.b64decode(image_b64)

    s3 = boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    s3.put_object(Bucket="files", Key=key, Body=image_data, ContentType=content_type)
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    # Обновляем avatar_url в БД
    conn = get_conn()
    cur = conn.cursor()
    if target == "user":
        cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (cdn_url, target_id))
    elif target == "character":
        cur.execute("UPDATE characters SET avatar_url = %s WHERE id = %s", (cdn_url, target_id))
    conn.commit()
    conn.close()

    return {"statusCode": 200, "headers": headers, "body": json.dumps({"url": cdn_url})}
