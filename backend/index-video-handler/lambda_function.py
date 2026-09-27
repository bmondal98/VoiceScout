import boto3

s3 = boto3.client("s3")
BUCKET_NAME = "your-bucket-name"

def lambda_handler(event, context):
    filename = event["queryStringParameters"]["filename"]

    presigned_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET_NAME, "Key": filename},
        ExpiresIn=600  # link valid for 600 seconds (10 minutes)
    )

    return {
        "statusCode": 200,
        "body": presigned_url
    }