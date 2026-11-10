export type QueuedChatMessage = {
  key: string;
  userId: string;
  conversationId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
  status: "pending" | "failed";
};

const databaseName = "drivenow-chat-outbox";
const storeName = "messages";

function openOutbox() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local message queue."));
    request.onblocked = () => reject(new Error("The local message queue is blocked by another tab."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The local message queue failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The local message queue was interrupted."));
  });
}

export async function saveQueuedMessage(message: QueuedChatMessage) {
  const database = await openOutbox();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(storeName).put(message);
    await completed;
  } finally {
    database.close();
  }
}

export async function updateQueuedMessageStatus(key: string, status: QueuedChatMessage["status"]) {
  const database = await openOutbox();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, status });
    };
    await completed;
  } finally {
    database.close();
  }
}

export async function removeQueuedMessage(key: string) {
  const database = await openOutbox();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(storeName).delete(key);
    await completed;
  } finally {
    database.close();
  }
}

export async function listQueuedMessages(userId: string, conversationId?: string) {
  const database = await openOutbox();
  try {
    const transaction = database.transaction(storeName, "readonly");
    const completed = transactionComplete(transaction);
    const request = transaction.objectStore(storeName).getAll() as IDBRequest<QueuedChatMessage[]>;
    const messages = await new Promise<QueuedChatMessage[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not read the local message queue."));
    });
    await completed;
    return messages
      .filter((message) => message.userId === userId
        && (!conversationId || message.conversationId === conversationId))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } finally {
    database.close();
  }
}
