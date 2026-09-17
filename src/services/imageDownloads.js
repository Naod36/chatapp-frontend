export const imageDownloads = {
  async download(image, signal) {
    const response = await fetch(image.src, { signal, credentials: "omit" });
    if (!response.ok) throw new Error("Could not download this image.");
    const blob = await response.blob();
    signal?.throwIfAborted();
    if (!blob.type.startsWith("image/"))
      throw new Error("The server did not return an image.");
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
      "image/svg+xml": "svg",
    };
    const extension = extensions[blob.type] || "img";
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    try {
      anchor.href = url;
      anchor.download = `flowchat-${String(image.id || "image").replace(/[^a-zA-Z0-9_-]/g, "_")}.${extension}`;
      document.body.append(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(url);
    }
  },
};
