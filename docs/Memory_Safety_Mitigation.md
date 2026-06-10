# Memory Safety & Secure Coding Mitigation Report

This document outlines the memory safety context, vulnerabilities, and mitigations applied to the InventoryHub application.

---

## 1. Memory Safety in Node.js & V8
The InventoryHub application is built on **Node.js**, which executes inside Google's **V8 engine**. V8 provides native protections against low-level memory vulnerabilities common in languages like C/C++:
*   **Automatic Garbage Collection (GC)**: The engine automatically manages memory allocation and deallocation, eliminating manual memory tracking mistakes such as **Use-After-Free** or **Double-Free**.
*   **Array Bounds Checking**: Accessing arrays outside their index boundary returns `undefined` rather than letting instructions read raw stack or heap memory (preventing **Out-of-Bounds reads/writes**).
*   **Type Safety**: Javascript is dynamically typed but prevents pointer arithmetic, meaning code cannot reference arbitrary physical memory addresses.

---

## 2. Identified Risks & Application Mitigations

While Node.js is inherently memory-safe at the VM layer, application-level vulnerabilities like memory leaks, buffer misuse, and heap exhaustion can still be exploited. We have implemented the following mitigations:

### A. Buffer Disclosure Protection
*   **Risk**: Older Node.js constructs (`new Buffer(size)`) allocated uninitialized stack/heap memory, which could leak sensitive data (e.g. database credentials or session tokens) if returned to the client.
*   **Mitigation**: The codebase enforces the use of `Buffer.alloc()` (which zero-fills the allocated space) or `Buffer.from()` (which initializes the buffer with specific data). No uninitialized buffer constructors are used.

### B. Payload Size Limiting (Heap Exhaustion DoS)
*   **Risk**: Attackers can send massive JSON payloads to REST endpoints, causing the V8 parser to exhaust the heap memory, trigger an Out-of-Memory (OOM) crash, and cause a Denial-of-Service (DoS).
*   **Mitigation**: We set a strict payload limitation of `10kb` on all body parsing middleware:
    ```javascript
    app.use(express.json({ limit: '10kb' }));
    ```
    Any requests exceeding this limit are blocked immediately at the web server layer before parsing occurs.

### C. Resource Starvation Mitigations
*   **Risk**: Running microservices without limits can allow a single pod with a memory leak or database pool issue to consume all node memory, crash co-located services, and bypass namespace boundaries.
*   **Mitigation**: Hard limits are applied on Kubernetes containers (`k8s/app-deployment.yaml`):
    ```yaml
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"
    ```

### D. Leak-Proof Object Lifecycle & Connection Cleanup
*   **Risk**: Retaining global references to objects or failing to close connection sockets (MongoDB, Redis, Kafka) causes memory leaks that grow linearly over time.
*   **Mitigation**: 
    *   No static global variables are used to cache client-submitted data.
    *   All external integrations (Kafka producer, Redis client, MongoDB connections) use managed connection drivers with reconnection limits and gracefully close on application termination signals (`SIGTERM`/`SIGINT`).
