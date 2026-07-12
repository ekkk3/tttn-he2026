export function downloadTextFile(filename, content, mimeType = "text/plain") {
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
        return;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
