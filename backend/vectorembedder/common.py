from dataclasses import dataclass
import os
from typing import List, Dict, Any, Optional
import yt_dlp
import assemblyai as aai
import boto3
from botocore.config import Config
import asyncio

from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
)

aai.settings.api_key = os.getenv("YOUR_ASSEMBLYAI_API_KEY")
AWS_REGION = os.getenv("YOUR_AWS_REGION", "us-east-1")

embedder = NVIDIAEmbeddings(
    model="your-desired-embedding-model",
    api_key=os.environ.get("YOUR-DESIRED-API-KEY"),
    show_progress_bar=False,
    chunk_size=50,  # how many text objects we are going to embed via nvidia. this is mainly for rate limiting
    retry_min_seconds=10,  # if limit reached then the retry will happen after 10 seconds
)

vectorStore = PineconeVectorStore(
    index_name=os.getenv("VECTOR_INDEX_NAME"), embedding=embedder
)

text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('your-table-name')

s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    endpoint_url=f"https://s3.{AWS_REGION}.amazonaws.com",
    config=Config(
        signature_version="s3v4",
        s3={"addressing_style": "virtual"}
    )
    # "s3",
    # config=Config(signature_version="s3v4")
)


def update_task(video_id, new_status):
    response = table.update_item(
        Key={            
            'video_id': video_id  # Your Partition Key
        },
        UpdateExpression="SET #s = :val1",
        ExpressionAttributeNames={
            "#s": "currentStatus"  # Alias for reserved word 'status'
        },
        ExpressionAttributeValues={
            ':val1': new_status,
        },
        ReturnValues="UPDATED_NEW"
    )
    return response

# 1. Generate Presigned S3 URL for AssemblyAI
async def get_s3_presigned_url(bucket: str, key: str, expiration_sec: int = 7200) -> str:
    """
    Generates a temporary read URL allowing AssemblyAI to access the S3 object.
    """
    presigned_url = s3_client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": bucket, 
            "Key": key
        },
        ExpiresIn=expiration_sec,
        HttpMethod="GET"
    )
    return presigned_url

# -------------------------------------------------------------
# 2. AssemblyAI Transcription with Timestamps
# -------------------------------------------------------------
async def transcribe_s3_media(audio_url: str, source_lang: Optional[str] = None) -> aai.Transcript:
    config_params = {
        #"auto_chapters": True,
        "punctuate": True,
        "format_text": True,
        "speech_models":['your-desired-speech-model'],
    }
    if source_lang:
        config_params["language_code"] = source_lang

    config = aai.TranscriptionConfig(**config_params)
    transcriber = aai.Transcriber()

    # Passes S3 pre-signed URL directly to AssemblyAI
    transcript = transcriber.transcribe(audio_url, config=config)

    if transcript.status == aai.TranscriptStatus.error:
        raise RuntimeError(f"AssemblyAI transcription failed: {transcript.error}")

    return transcript


# -------------------------------------------------------------
# 3. Chunk Transcription
# -------------------------------------------------------------
async def create_timestamped_chunks(
    transcript_sentences: List[Any],  # Sentences from transcript.get_sentences()
    video_id: str,
    source_language: str = "en",
    target_window_sec: float = 35.0,  # Optimal window for video RAG
    overlap_sec: float = 5.0          # Overlap to prevent splitting context mid-thought
) -> List[Document]:
    """
    Groups sentence-level items into 30-45s chunks while preserving
    start_ms, end_ms, and jump-target seconds in Document metadata.
    """
    if not transcript_sentences:
        return []

    target_window_ms = target_window_sec * 1000
    overlap_ms = overlap_sec * 1000

    docs: List[Document] = []
    chunk_index = 0
    current_sentences = []
    window_start_ms = transcript_sentences[0].start

    for sentence in transcript_sentences:
        current_sentences.append(sentence)
        current_duration_ms = sentence.end - window_start_ms

        # When the accumulated sentences hit our 30-45 second window
        if current_duration_ms >= target_window_ms:
            # 1. Join sentence texts into the chunk's content
            chunk_text = " ".join([s.text.strip() for s in current_sentences])
            chunk_end_ms = current_sentences[-1].end

            # 2. Package into a LangChain Document with explicit player seek metadata
            doc = Document(
                page_content=chunk_text,
                metadata={
                    "data":"the data you want to store"
                }
            )
            docs.append(doc)
            chunk_index += 1

            # 3. Create context overlap: carry forward sentences from the last ~5 seconds
            cutoff_ms = chunk_end_ms - overlap_ms
            overlap_sentences = [s for s in current_sentences if s.end > cutoff_ms]

            if overlap_sentences and len(overlap_sentences) < len(current_sentences):
                current_sentences = overlap_sentences
                window_start_ms = overlap_sentences[0].start
            else:
                current_sentences = []
                window_start_ms = sentence.end

    # 4. Flush any trailing sentences into a final chunk
    if current_sentences:
        chunk_text = " ".join([s.text.strip() for s in current_sentences])
        docs.append(Document(
            page_content=chunk_text,
            metadata={
                "data":"the data you want to append"
            }
        ))

    return docs


# -------------------------------------------------------------
# 4. Adding the documents to vectorstore in batch
# -------------------------------------------------------------
async def add_batch(batch=[],batch_num=1):
    try:
        await vectorStore.aadd_documents(batch)
        print(f">>> Batch {batch_num} uploaded with {len(batch)} docs")
        return True
    except Exception as e:
        print(f"Error in adding batch {batch_num}: {str(e)}")
        return False

# -------------------------------------------------------------
# 5. Assynchoronously adding the docs to batch
# -------------------------------------------------------------
async def indexDocumentAsync(chunks=[],batchSize=50):
    """Document will be indexed on  each bach"""
    
    docs = text_splitter.split_documents(chunks)
    print(f">>> Preparing the {len(docs)} docs to store in vector store")
    # batch creation
    batches=[docs[i : i + batchSize] for i in range(0, len(docs), batchSize)]
    
    print(f">>> Splitted into {len(batches)} batches with batch size {batchSize}")
    
    print(f">>> Uploading batches asynchronously")
    
    # tasks = [add_batch(batch, i + 1) for i, batch in enumerate(batches)]
    # results = await asyncio.gather(*tasks, return_exceptions=True) session is getting closed
    results = []
    for i, batch in enumerate(batches):
        result = await add_batch(batch, i + 1)
        results.append(result)
    
    success_count = sum(1 for r in results if r is True)
    
    if success_count == len(batches):
        return f">>> All batches uploaded successfully"
    else:
        return f">>> {success_count}/{len(batches)} batches uploaded successfully"

