import app from "./api/index";
import path from "path";

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    // This part is only for local production testing
    const distPath = path.join(process.cwd(), "dist");
    app.use(path.posix.join("/", "assets"), (req, res, next) => {
      next();
    });
    app.use(path.posix.join("/", "dist"), (req, res, next) => {
      next();
    });
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer();
