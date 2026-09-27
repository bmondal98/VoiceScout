import os
import requests
import boto3
from typing import List, Dict, Any
# from dotenv import load_dotenv
from langchain.agents import create_agent
from langgraph.prebuilt import create_react_agent
from langchain.chat_models import init_chat_model
from langchain_nvidia_ai_endpoints import (
    NVIDIAEmbeddings,
)  # we will embed the query and turn into vector to get relevant context
from langchain_pinecone import PineconeVectorStore
from langchain.messages import (
    ToolMessage,
)  # its a type of message containing tool execution and in our case its retrival tool
from langchain.tools import tool

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('your-table-name')

translate_api_key = os.getenv("TRANSLATE_API_KEY")
embedder = NVIDIAEmbeddings(
    model="your-desired-embedding-model",
    api_key=os.environ.get("NVIDIA_EMBEDDING_KEY"),
    show_progress_bar=False,
    chunk_size=50,  # how many text objects we are going to embed via nvidia. this is mainly for rate limiting
    retry_min_seconds=10,  # if limit reached then the retry will happen after 10 seconds
)


vectorStore = PineconeVectorStore(
    index_name=os.getenv("VECTOR_INDEX_NAME"), embedding=embedder
)  # vector store initialization with embedding

model = init_chat_model("your-desired-chat-model", model_provider="your-model-provider")
translation_model = init_chat_model('your-desired-translate-model',model_provider="your-model-provider",api_key=translate_api_key)


def update_task(chat_id, new_resp, query_status):
    response = table.update_item(
        Key={
            'chat_id': chat_id,
            # 'video_id': video_id  # Your Partition Key
        },
        UpdateExpression="SET #s = :val1, #qs = :val2",
        ExpressionAttributeNames={
            "#qs": "query_status",
            "#s": "query_answer"  # Alias for reserved word 'status'
        },
        ExpressionAttributeValues={
            ':val1': new_resp,
            ':val2': query_status
        },
        ReturnValues="UPDATED_NEW"
    )
    return response

async def language_conversion(srcLang='', targetLang='',content=''):
    url = "http://your-chat-completions-url"
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "authorization": f"Bearer {translate_api_key}"
    }

    payload = {
        "model": "translate-model",
        "temperature": 0,
        "top_p": 0.9,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "max_tokens": 512,
        "stream": False,
        "messages": [
            {
                "role": "system",
                "content": f"{srcLang}-{targetLang}"
            },
            {
                "role": "user",
                "content": f"{content}"
            },
        ]
    }

    response = requests.post(url, json=payload, headers=headers)
    return response.text


@tool(response_format="content_and_artifact")
def retrive_context(query: str, video_id: str):
    """Retrieves relevant document to help answer the queries

    Args:
        query: The question to answer
        video_id: The video id to retrieve context for
    """
    print(f"retriver video id {video_id}")
    retrieved_docs = vectorStore.as_retriever(
        search_kwargs={"filter": {"video_id": video_id}}
    ).invoke(
        query, k=2
    )
    serialized_docs = "\n\n".join(
        [
            f"Start: {doc.metadata.get('start_sec', 0.0)}s\n"
            f"End: {doc.metadata.get('end_sec', 0.0)}s\n"
            f"Language: {doc.metadata.get('source_language', 'unknown')}\n"
            f"Content: {doc.page_content}"
            for doc in retrieved_docs
        ]
    )
    return serialized_docs, retrieved_docs

async def run_llm(query: str, video_id: str) -> Dict[str, Any]:
    """
    Run the rag pipeline to answer a query using retrived documentation

    """

    # create the agent with retrival tool
    system_prompt = (
        f"You are a helpful AI assistant that answers questions about the given video_id {video_id}",
        "You have access to a tool that retrives relevant details. ",
        "Use the tool to find relevant documents before answering questions. ",
        "Always cite whatever you used in your answers. ",
        "If you cannot find the answer in the retrived documentation, sy so. ",
    )

    print(f">>> system prompt {system_prompt}")

    agent = create_agent(
        model=model,
        tools=[retrive_context],
        system_prompt=system_prompt,
    )

    messages = [{"role": "user", "content": query}]

    response = agent.invoke({"messages": messages})
    

    answer = response["messages"][-1].content

    context_docs = []

    for message in response["messages"]:
        if isinstance(message, ToolMessage) and hasattr(message, "artifact"):
            if isinstance(message.artifact, list):
                context_docs.extend(message.artifact)

    return {"answer": answer, "context": context_docs}

async def run_llm_transcription(query: str, current_lang: str, target_lang:str) -> Dict[str, Any]:
    """
    Run the rag pipeline to translate a query from current_lang to target_lang
    """

    # create the agent with retrival tool
    system_prompt = (
        f"{current_lang.lower()}-{target_lang.lower()}",
    )

    agent = create_agent(
        model=translation_model,
        system_prompt=system_prompt,
    )

    messages = [{"role": "user", "content": query}]

    response = agent.invoke({"messages": messages})

    answer = response["messages"][-1].content

    context_docs = []

    for message in response["messages"]:
        if isinstance(message, ToolMessage) and hasattr(message, "artifact"):
            if isinstance(message.artifact, list):
                context_docs.extend(message.artifact)

    return {"answer": answer, "context": context_docs}