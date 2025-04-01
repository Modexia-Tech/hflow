# API Documentation

## Overview

This document provides an overview of the API architecture for the `hflow`
project. The `hflow` project focuses on digital currency transfer  by Hedera
Hashgraph.

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
    - [Accounts](#accounts)
      - [Get Account Balance](#get-account-balance)
    - [Transactions](#transactions)
      - [Create a Transaction](#create-a-transaction)
    - [Notifications](#notifications)
      - [Get Notifications](#get-notifications)
  - [Error Handling](#error-handling)
  - [Rate Limiting](#rate-limiting)
  - [Versioning](#versioning)
  - [Changelog](#changelog)
  - [Contact Information](#contact-information)

## Introduction

The `hflow` API allows developers to integrate mobile digital currency transfer functionalities
into their applications. The API is designed to be RESTful and provides
endpoints for managing users, accounts, transactions, and notifications.

## Authentication

The API uses token-based authentication. To access the endpoints, clients must
include an `Authorization` header with a valid token.

### Obtaining a Token

To obtain a token, send a `POST` request to the `/auth/login` endpoint with your
credentials. The response will include an access token.

Example request:

```bash
POST /auth/login
Content-Type: application/json

{
    "username": "your_username",
    "password": "your_password"
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
    "username": "new_user",
    "email": "user@example.com",
    "password": "user_password"
  }
  ```
- **Response:**
  ```json
  {
    "id": "user_id",
    "username": "new_user",
    "email": "user@example.com"
  }
  ```

#### Get User Details

- **Endpoint:** `GET /users/{id}`
- **Description:** Retrieves details of a specific user.
- **Response:**
  ```json
  {
    "id": "user_id",
    "username": "existing_user",
    "email": "user@example.com"
  }
  ```

### Accounts

#### Get Account Balance

- **Endpoint:** `GET /accounts/{id}/balance`
- **Description:** Retrieves the balance of a specific account.
- **Response:**
  ```json
  {
    "account_id": "account_id",
    "balance": 1000
  }
  ```

### Transactions

#### Create a Transaction

- **Endpoint:** `POST /transactions`
- **Description:** Creates a new transaction.
- **Request Body:**
  ```json
  {
    "from_account": "account_id",
    "to_account": "account_id",
    "amount": 100
  }
  ```
- **Response:**
  ```json
  {
    "transaction_id": "transaction_id",
    "status": "completed"
  }
  ```

### Notifications

#### Get Notifications

- **Endpoint:** `GET /notifications`
- **Description:** Retrieves notifications for the authenticated user.
- **Response:**
  ```json
  {
    "notifications": [
      {
        "id": "notification_id",
        "message": "Your transaction was successful",
        "date": "2025-03-30T08:00:00Z"
      }
    ]
  }
  ```

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of a
request. Error responses include a JSON object with an error message.

Example error response:

```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

## Rate Limiting

To ensure fair usage, the API enforces rate limits. Requests exceeding the limit
will receive a `429 Too Many Requests` response.

## Versioning

The API is versioned to ensure backward compatibility. The current version is
`v1`.

## Changelog

- **v1.0.0:** Initial release

## Contact Information

For questions or support, please contact
[support@modexia-tech.com](mailto:support@modexia-tech.com).

---
