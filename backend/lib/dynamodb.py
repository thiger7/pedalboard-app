import os

import boto3
from botocore.exceptions import ClientError

DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "pedalboard-dev-jobs")
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")


def get_dynamodb_resource():
    """DynamoDB リソースを取得"""
    return boto3.resource("dynamodb", region_name=AWS_REGION)


def get_table():
    """DynamoDB テーブルを取得"""
    dynamodb = get_dynamodb_resource()
    return dynamodb.Table(DYNAMODB_TABLE)


def put_item(item: dict) -> bool:
    """アイテムを保存"""
    table = get_table()
    try:
        table.put_item(Item=item)
        return True
    except ClientError:
        return False


def get_item(pk: str, sk: str) -> dict | None:
    """アイテムを取得"""
    table = get_table()
    try:
        response = table.get_item(Key={"PK": pk, "SK": sk})
        return response.get("Item")
    except ClientError:
        return None


def update_item(pk: str, sk: str, update_expression: str, expression_values: dict) -> bool:
    """アイテムを更新"""
    table = get_table()
    try:
        table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
        )
        return True
    except ClientError:
        return False


def batch_get_items(keys: list[dict]) -> list[dict]:
    """複数アイテムを一括取得"""
    if not keys:
        return []

    dynamodb = get_dynamodb_resource()
    try:
        response = dynamodb.batch_get_item(RequestItems={DYNAMODB_TABLE: {"Keys": keys}})
        return response.get("Responses", {}).get(DYNAMODB_TABLE, [])
    except ClientError:
        return []


def query_by_gsi(gsi_name: str, pk_value: str, limit: int = 100) -> list[dict]:
    """GSIを使ってクエリ"""
    table = get_table()
    try:
        response = table.query(
            IndexName=gsi_name,
            KeyConditionExpression="GSI1PK = :pk",
            ExpressionAttributeValues={":pk": pk_value},
            Limit=limit,
            ScanIndexForward=False,  # 新しい順
        )
        return response.get("Items", [])
    except ClientError:
        return []
