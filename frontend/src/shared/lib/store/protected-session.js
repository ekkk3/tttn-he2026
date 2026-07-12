const cleanupHandlers = new Set();
export function registerProtectedSessionCleanup(handler) {
    cleanupHandlers.add(handler);
    return () => {
        cleanupHandlers.delete(handler);
    };
}
export function runProtectedSessionCleanup() {
    for (const cleanupHandler of cleanupHandlers) {
        cleanupHandler();
    }
}
