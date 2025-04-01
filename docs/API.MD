# API Documentation

## Table of Contents

- [API Documentation](#api-documentation)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Authentication](#authentication)
    - [Obtaining a Token](#obtaining-a-token)
  - [Endpoints](#endpoints)
    - [User Management](#user-management)
      - [Register a New User](#register-a-new-user)
      - [Get User Details](#get-user-details)
    - [Transactions](#transactions)
      - [Create a Transaction](#create-a-transaction)
  - [Rate Limiting](#rate-limiting)

## Introduction

The `hflow` API allows developers to integrate mobile digital currency transfer functionalities
into their applications. The API is designed to be RESTful and provides
endpoints for managing users, accounts and transactions.

## Authentication

The API uses token-based authentication. To access the endpoints, clients must
include an `Authorization` header with a valid token.

### Obtaining a Token

To obtain a token, send a `POST` request to the `/user/login` endpoint with your
credentials. The response will include an access token.

Example request:

```bash
POST /user/login
Content-Type: application/json

{
    "phone": "your_username",
    "pin": "your_pin"
}
```

Example response:

```json
{
  "token": "your_access_token"
}
```

## Endpoints

### User Management

#### Register a New User

- **Endpoint:** `POST /users/register`
- **Description:** Registers a new user.
- **Request Body:**
  ```json
  {
    "phone": "254000000000",
    "fullName": "new_user",
    "pin": "pin"
  }
  ```

#### Get user accountInfo

- **Endpoint:** `GET /user/accountInfo`
- **Description:** Retrieves details of a specific user.
- **Response:**
  ```json
  {
    "phone": "phone",
    "pin": "pin"
  }
  ```

### Transactions

#### Create a Transaction

- **Endpoint:** `POST /transaction/new`
- **Description:** Creates a new transaction.
- **Request Body:**
  ```json
  {
    "receiverPhone": "phone",
    "pin": "pin",
    "amount": 100
  }
  ```
- **Response:**
  ```json
  {
    "message": "",
    "newBalance": 0,
    "hashScanUrl":""
  }
  ```

## Rate Limiting

To ensure fair usage, the API enforces rate limits. Requests exceeding the limit
will receive a `429 Too Many Requests` response.
