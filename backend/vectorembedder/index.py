import os
import json
import asyncio
import boto3
from common import *

# Use your API Gateway 'Connection URL' (HTTPS, not WSS)
WSS_URL = "Your-websocket-url"
gatewayapi = boto3.client("apigatewaymanagementapi", endpoint_url=WSS_URL)

def notify_ui(conn_id, status, data=None):
    try:
        payload = json.dumps({"status": status, "data": data}, default=str, ensure_ascii=False)
        gatewayapi.post_to_connection(ConnectionId=conn_id, Data=payload.encode('utf-8'))
    except gatewayapi.exceptions.GoneException:
        print("User disconnected.")

async def eventProcessing(event):
    for record in event['Records']:
        # 1. Parse the SQS message
        payload = json.loads(record['body'])

        video_url=payload.get('video_url')
        video_lang=payload.get('video_lang')
        video_id=payload.get('video_id')
        bucket = payload.get('bucket')
        youtube_url = payload.get('youtube_url',None)
        conn_id = payload.get('connectionId')
        
        print(f"Processing video: {video_id}")
        notify_ui(conn_id, "Processing video...")

        print(f">>> generating presigned url {video_url}")
        notify_ui(conn_id, "Generating presigned url...")

        presigned_url = youtube_url if youtube_url is not None else await get_s3_presigned_url(bucket, video_url)

        print(f">>> presigned generated.Transcribing...",presigned_url)
        update_task(video_id, "Transcription in progress")
        notify_ui(conn_id, "Transcription in progress...")

        transcript =await transcribe_s3_media(presigned_url, source_lang=video_lang)

        print(f">>> transcription generated.Chunking....")
        notify_ui(conn_id, "transcription generated.Chunking....")
        update_task(video_id, "Loading the transcripts.")

        chunks =await create_timestamped_chunks(
            transcript_sentences=transcript.get_sentences(),
            video_id=video_id,
            source_language='video_lang',
            target_window_sec=30.0,
            overlap_sec=5.0
        )

        print(f">>> {len(chunks)} chunks created.Vectorizing...")
        update_task(video_id, "Vectorizing")
        notify_ui(conn_id, "Vectorizing....")


        chunksEmbeddingResp =await indexDocumentAsync(chunks, 40)

        print(f">>> video {video_id} Transcription completed")
        update_task(video_id, "Transcription completed")
        notify_ui(conn_id, "Transcription completed....")

def lambda_handler(event, context):
    # TODO implement
    

        # 2. Update the Database
    chunksEmbeddingResp=asyncio.run(eventProcessing(event))
    return {"status": "success"}
    # return {
    #     'statusCode': 200,
    #     'body': json.dumps('Hello from Lambda!')
    # }
