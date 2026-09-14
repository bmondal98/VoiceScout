import boto3
import json

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("Videos")
s3 = boto3.client("s3")
BUCKET_NAME = "vocalscoutvideos"

def lambda_handler(event, context):
    response = table.scan()
    items = response["Items"]

    videos = []
    for item in items:
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": item["filename"]},
            ExpiresIn=3600  # 1 hour — enough time to actually watch it
        )
        videos.append({
            "video_id": item["video_id"],
            "title": item["title"],
            "source_language": item.get("source_language", "en"),
            "video_url": presigned_url
        })

    return {
        "statusCode": 200,
        "body": json.dumps(videos)
    }