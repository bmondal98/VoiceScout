import boto3
import json

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("vocalScoutChats")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST"
}

def lambda_handler(event, context):
    print("event>>>>",event)
    if "body" not in event:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "Bad Request"})
        }

    body = json.loads(event["body"])

    chat_id = body.get("chat_id",None)
    query = body.get("query",None)
    query_lang = body.get("query_lang",None)
    video_id = body.get("video_id",None)
    video_lang = body.get("video_lang",None)

    
    if chat_id is None or query is None or query_lang is None or video_id is None or video_lang is None:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "Missing required fields"})
        }

    table.put_item(Item={
        "chat_id": chat_id,
        "query": query,
        "query_lang": query_lang,
        "video_id": video_id,
        "video_lang": video_lang,
        "current_status": "Query send to agent...",
        "query_answer": ""
    })

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({"message": "Chat entry created", "chat_id": chat_id})
    }

