import boto3
import json

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("Videos")  # table name your TL will create

def lambda_handler(event, context):
    body = json.loads(event["body"])

    table.put_item(Item={
        "video_id": body["video_id"],
        "title": body["title"],
        "filename": body["filename"],
        "source_language": body.get("source_language", "en")
    })

    return {
        "statusCode": 200,
        "body": "Entry added"
    }