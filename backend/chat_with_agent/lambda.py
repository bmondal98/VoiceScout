import os
import json
import asyncio
import boto3
from decimal import Decimal
from common import *

# Use your API Gateway 'Connection URL' (HTTPS, not WSS)
WSS_URL = "http://ypur-websocket-api"
gatewayapi = boto3.client("apigatewaymanagementapi", endpoint_url=WSS_URL)

def notify_ui(conn_id, status, data=None):
    try:
        payload = json.dumps({"status": status, "data": data}, default=str, ensure_ascii=False)
        gatewayapi.post_to_connection(ConnectionId=conn_id, Data=payload.encode('utf-8'))
    except gatewayapi.exceptions.GoneException:
        print("User disconnected.")

def floats_to_decimals(obj):
    """
    Recursively converts float values to Decimal for DynamoDB.
    """
    if isinstance(obj, list):
        return [floats_to_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, float):
        # We convert to string first to avoid precision issues 
        # (e.g., 235.18 becoming 235.179999999999)
        return Decimal(str(obj))
    return obj

def format_langchain_response(result):
    # 1. Extract the answer string
    answer = result.get('answer', '')

    # 2. Convert the list of Document objects into a list of dicts
    cleaned_context = []
    for doc in result.get('context', []):
        cleaned_context.append({
            "id": getattr(doc, 'id', None),
            "page_content": doc.page_content,
            "metadata": doc.metadata
        })

    # 3. Return a standard Python dictionary
    formatted_result= {
        "answer": answer,
        "context": cleaned_context
    }

    return floats_to_decimals(formatted_result)

async def eventProcessing(event):
    for record in event['Records']:
        try:
            # 1. Parse the SQS message
            payload = json.loads(record['body'])

            # video_url=payload.get('video_url')
            video_lang=payload.get('video_lang')
            # video_lang_full = payload.get('video_lang_full')
            chat_lang = payload.get('chat_lang')
            video_id=payload.get('video_id')
            query = payload.get('query')
            query_id = payload.get('query_id')
            # bucket = payload.get('bucket')
            conn_id = payload.get('connectionId')
            translated_query=''
            translated = False
            print(f"Processing video: {video_id}, for query {query_id} with query {query}")
            update_task(query_id, '', 'Agent processing the video for query...')
            notify_ui(conn_id, "Agent processing the video for query...")

            if video_lang != chat_lang:
                print(f">>> translating from {chat_lang} to {video_lang}")
                translated_obj=await run_llm_transcription(query,chat_lang,video_lang)
                if translated_obj["answer"] is not None or translated_obj["answer"]!='':
                    translated_query=translated_obj["answer"]
                    print(f">>> translation success")
                translated=True
            else:
                translated_query=query

            update_task(query_id, '', 'Agent analyzing the answers...')
            notify_ui(conn_id, "Agent analyzing the answers...")
            print(f">>> processing the query {translated_query}")
            
            # print(f">>> {len(chunks)} chunks created.Vectorizing...")
            # update_task(video_id, "Vectorizing")


            chatResp=await run_llm(translated_query,video_id)

            print(f">>> query response for video {video_id} is {chatResp}")
            update_task(query_id, '', 'Agent preparing the answer...')
            notify_ui(conn_id, "Agent preparing the answer...")
            updatedResp = format_langchain_response(chatResp)
            if translated is True and updatedResp["answer"] is not None :
                print(f">>> translating from {video_lang} to {chat_lang}")
                translated_obj=await run_llm_transcription(updatedResp["answer"],video_lang,chat_lang)
                if translated_obj["answer"] is not None and translated_obj["answer"]!='':
                    updatedResp["answer"]=translated_obj["answer"]
                print(f">>> translation success {updatedResp}")
                
                update_task(query_id, updatedResp, 'Success...')
                notify_ui(conn_id,'Success...', updatedResp)
            elif translated is False and chatResp["answer"]:
                update_task(query_id, updatedResp, 'Success...')
                notify_ui(conn_id,'Success...', updatedResp)
            else:
                update_task(query_id, updatedResp, 'Failed...')
                notify_ui(conn_id, 'Failed...' ,updatedResp)
        except Exception as e:
            print(f"Error processing video {video_id}: {str(e)}")
            update_task(query_id, str(e), 'Sorry, Agent failed to answer please try again...')
            notify_ui(conn_id, 'Sorry, Agent failed to answer please try again...')

        # update_task(video_id, "Transcription completed")

def lambda_handler(event, context):
    # TODO implement
    

        # 2. Update the Database
    chunksEmbeddingResp=asyncio.run(eventProcessing(event))
    # translate = asyncio.run(run_llm_transcription('what is apple?','en','hi'))
    # print(translate)
    #print(os.getenv("TRANSLATE_API_KEY"))
    return {"status": "success"}
    # return {
    #     'statusCode': 200,
    #     'body': json.dumps('Hello from Lambda!')
    # }
