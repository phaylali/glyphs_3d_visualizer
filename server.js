const basePath = process.cwd();
const PORT = 3000;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = basePath + url.pathname;
    
    // Default to index.html
    if (url.pathname === "/") {
      filePath = basePath + "/index.html";
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);

// Automatically open the preview window in the browser
try {
    Bun.spawn(["xdg-open", `http://localhost:${PORT}`]);
    console.log("Opening preview window in the browser...");
} catch (e) {
    console.error("Could not automatically open browser.");
}
