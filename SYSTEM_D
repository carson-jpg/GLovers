# System Architecture Diagrams

## Complete System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        FE[React Frontend]
        UI[UI Components]
        WS[WebRTC Service]
        SS[Socket.io Client]
    end
    
    subgraph "Backend Services"
        API[Express API Server]
        SIG[Socket.io Signaling]
        CALL[Call Service]
        AUTH[Auth Middleware]
    end
    
    subgraph "Real-time Layer"
        SOCKET[Socket.io Server]
        REDIS[Redis Adapter]
    end
    
    subgraph "Database Layer"
        MONGODB[(MongoDB)]
        CHAT_DB[Chats Collection]
        USER_DB[Users Collection]
        CALL_DB[Calls Collection]
    end
    
    subgraph "External Services"
        TURN[STUN/TURN Server]
        CLOUD[Cloudinary Storage]
        MONITOR[Monitoring]
    end
    
    FE --> UI
    FE --> WS
    FE --> SS
    
    WS --> TURN
    SS --> SOCKET
    UI --> API
    
    API --> AUTH
    API --> CALL
    SOCKET --> SIG
    SIG --> REDIS
    
    AUTH --> MONGODB
    CALL --> CALL_DB
    SOCKET --> CHAT_DB
    
    CLOUD --> FE
    MONITOR --> API
```

## WebRTC Calling Flow

```mermaid
sequenceDiagram
    participant A as User A
    participant S as Socket.io Server
    participant B as User B
    participant TURN as STUN/TURN Server
    
    A->>S: initiate_call(toUserId, callType)
    S->>B: incoming_call(fromUserId, callType)
    
    B->>S: call_ringing(callId)
    S->>A: call_ringing(callId)
    
    B->>S: call_answered(callId)
    S->>A: call_answered(callId)
    
    A->>TURN: ICE candidates exchange
    B->>TURN: ICE candidates exchange
    TURN->>A: WebRTC connection established
    TURN->>B: WebRTC connection established
    
    A->>B: Direct P2P Media Stream
    B->>A: Direct P2P Media Stream
    
    Note over A,B: Voice/Video Communication Active
    
    A->>S: end_call(callId)
    S->>B: call_ended(callId)
    
    S->>DB: save_call_history(callId)
```

## Message Flow Diagram

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant S as Socket.io Server
    participant U2 as User 2
    participant DB as MongoDB
    
    U1->>S: send_message(chatId, content)
    S->>DB: save_message(chatId, content)
    DB->>S: message_saved
    S->>U2: new_message(chatId, message)
    S->>U1: message_delivered(chatId, message)
    
    U2->>S: mark_messages_read(chatId)
    S->>DB: update_read_status(chatId, userId)
    S->>U1: messages_read(chatId, userId)
```

## Call State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> InitiatingCall : User clicks call
    Idle --> IncomingCall : Receive call offer
    
    InitiatingCall --> Ringing : Call offer sent
    InitiatingCall --> CallFailed : Connection failed
    
    IncomingCall --> Ringing : User answers
    IncomingCall --> CallDeclined : User declines
    
    Ringing --> Connected : Both parties connected
    Ringing --> CallFailed : Connection timeout
    
    Connected --> CallEnded : End call
    Connected --> CallFailed : Connection lost
    
    CallDeclined --> [*]
    CallEnded --> [*]
    CallFailed --> [*]
```

## Database Schema Overview

```mermaid
erDiagram
    User {
        string _id
        string email
        string password
        string provider
        timestamp createdAt
        timestamp updatedAt
    }
    
    Chat {
        string _id
        array participants
        string lastMessage
        timestamp lastMessageAt
        boolean isActive
        array messages
        timestamp createdAt
        timestamp updatedAt
    }
    
    Message {
        string _id
        string senderId
        string content
        string type
        timestamp timestamp
        array readBy
    }
    
    Call {
        string _id
        array participants
        string callType
        timestamp startTime
        timestamp endTime
        number duration
        object quality
        string status
    }
    
    User ||--o{ Chat : participates
    User ||--o{ Message : sends
    Chat ||--o{ Message : contains
    User ||--o{ Call : participates
```

## Network Architecture for Scale

```mermaid
graph LR
    subgraph "Load Balancer"
        LB[NGINX Load Balancer]
    end
    
    subgraph "Backend Servers"
        BE1[Backend Server 1]
        BE2[Backend Server 2]
        BE3[Backend Server 3]
    end
    
    subgraph "Cache Layer"
        REDIS1[Redis Cluster 1]
        REDIS2[Redis Cluster 2]
    end
    
    subgraph "Database"
        MONGO1[MongoDB Primary]
        MONGO2[MongoDB Secondary]
        MONGO3[MongoDB Secondary]
    end
    
    subgraph "TURN Servers"
        TURN1[Turn Server 1]
        TURN2[Turn Server 2]
    end
    
    LB --> BE1
    LB --> BE2
    LB --> BE3
    
    BE1 --> REDIS1
    BE2 --> REDIS1
    BE3 --> REDIS2
    
    BE1 --> MONGO1
    BE2 --> MONGO2
    BE3 --> MONGO3
    
    BE1 --> TURN1
    BE2 --> TURN2
    BE3 --> TURN1
```

## Frontend Component Architecture

```mermaid
graph TB
    subgraph "Components"
        ChatPage[Chat Page]
        CallInterface[Call Interface]
        ChatHeader[Chat Header]
        MessageList[Message List]
        MessageInput[Message Input]
        CallControls[Call Controls]
        UserStatus[User Status]
        CallHistory[Call History]
    end
    
    subgraph "Services"
        SocketService[Socket Service]
        WebRTCService[WebRTC Service]
        ApiService[API Service]
        AuthService[Auth Service]
    end
    
    subgraph "Hooks"
        useSocket[useSocket Hook]
        useWebRTC[useWebRTC Hook]
        useAuth[useAuth Hook]
    end
    
    ChatPage --> ChatHeader
    ChatPage --> MessageList
    ChatPage --> MessageInput
    
    ChatHeader --> CallControls
    ChatHeader --> UserStatus
    
    CallInterface --> CallControls
    
    ChatPage --> useSocket
    CallInterface --> useWebRTC
    
    useSocket --> SocketService
    useWebRTC --> WebRTCService
    useAuth --> AuthService
    
    SocketService --> ApiService
    WebRTCService --> ApiService
```

## Error Handling & Recovery Flow

```mermaid
flowchart TD
    A[Connection Started] --> B{Connection Status?}
    
    B -->|Connected| C[Normal Operation]
    B -->|Disconnected| D[Attempt Reconnection]
    B -->|Failed| E[Show Error Message]
    
    D --> F{Reconnection Attempts < 5?}
    
    F -->|Yes| G[Wait 2 seconds]
    G --> H[Retry Connection]
    H --> B
    
    F -->|No| I[Show Permanent Error]
    
    C --> J{Operation Type?}
    
    J -->|Message| K[Store in Outbox]
    J -->|Call| L[Retry Call Setup]
    J -->|Normal| M[Continue]
    
    K --> N[Retry when connected]
    L --> O[Retry when connected]
    
    E --> P[User Notification]
    I --> P
    P --> Q[User Action Required]
    
    N --> B
    O --> B
```

## Security Architecture

```mermaid
graph TB
    subgraph "Client Security"
        JWT[JWT Token Storage]
        HTTPS[HTTPS Only]
        CSP[Content Security Policy]
    end
    
    subgraph "Server Security"
        AUTH[JWT Validation]
        RATE[Rate Limiting]
        VALID[Input Validation]
        CORS[CORS Configuration]
    end
    
    subgraph "Data Security"
        ENCRYPT[Message Encryption]
        HASH[Password Hashing]
        SANITIZE[Data Sanitization]
    end
    
    subgraph "Network Security"
        TLS[TLS Encryption]
        TURN_AUTH[TURN Server Auth]
        FIREWALL[Firewall Rules]
    end
    
    JWT --> AUTH
    HTTPS --> TLS
    CSP --> CORS
    
    AUTH --> RATE
    RATE --> VALID
    VALID --> ENCRYPT
    
    TLS --> TURN_AUTH
    TURN_AUTH --> FIREWALL
```

These diagrams provide a comprehensive visual representation of your chat and calling application architecture, showing the relationships between components, data flow, and system interactions at different levels of abstraction.