## node scripts/chat-stress.mjs --users 300 --concurrency 20 --output chat-stress-summary.json

## Chat Stress Test Results

| Users | Completed |   Success | Duration | Users/sec | Peak Sockets | Register P95 | Login P95 | Connect P95 | Join P95 | Send P95 | Leave P95 |
| ----: | --------: | --------: | -------: | --------: | -----------: | -----------: | --------: | ----------: | -------: | -------: | --------: |
|    10 |     10/10 |      100% |    1.17s |      8.55 |           10 |       681 ms |    551 ms |       25 ms |    18 ms |    15 ms |     14 ms |
|    20 |     20/20 |      100% |    2.30s |      8.70 |           20 |      1480 ms |    949 ms |       24 ms |    17 ms |     9 ms |     11 ms |
|    50 |     50/50 |      100% |    5.08s |      9.85 |           50 |      1606 ms |    909 ms |       22 ms |    20 ms |    10 ms |     13 ms |
|   100 |   100/100 |      100% |   10.14s |  **9.87** |          100 |      2646 ms |    800 ms |       24 ms |    27 ms |    17 ms |     17 ms |
|   200 |   195/200 | **97.5%** |   31.07s |      6.28 |          195 |      1999 ms |    967 ms |       37 ms |    33 ms |    18 ms |     27 ms |
|   500 |   496/500 | **99.2%** |   63.70s |      7.80 |          496 |      2145 ms |   1095 ms |       44 ms |    74 ms |    25 ms |     63 ms |

## Failure Summary

|      Load | Failed Users | Failure Stage     | Reason  |
| --------: | -----------: | ----------------- | ------- |
|  10 users |            0 | —                 | —       |
|  20 users |            0 | —                 | —       |
|  50 users |            0 | —                 | —       |
| 100 users |            0 | —                 | —       |
| 200 users |            5 | WebSocket Connect | Timeout |
| 500 users |            4 | WebSocket Connect | Timeout |

## Summary

The application achieved **100% successful execution up to 100 users**. Peak throughput was approximately **9.87 users/sec at 100 users**.

Real-time chat operations remained fast as load increased. Even at **500 users**, P95 latency was only **44 ms for connection, 74 ms for join, 25 ms for message sending, and 63 ms for leave**.

The primary performance cost comes from **registration and authentication**, rather than chat operations. Registration reached a maximum observed P95 of **2.65 seconds**, while login remained around or below **1.1 seconds** at higher loads.

WebSocket connection failures started appearing at higher loads. At **200 users, 5 connections timed out**, while at **500 users, 4 connections timed out**. Once a WebSocket connection was established, **join, send, and leave operations completed successfully without failures**.

### Conclusion

The application is stable under the tested workload through **100 concurrent users**. Higher loads expose occasional **WebSocket connection timeouts**, while message-processing performance remains strong. Further optimization should therefore focus on **WebSocket connection handling, connection timeout configuration, and server/socket resource limits** rather than the chat message flow itself.
