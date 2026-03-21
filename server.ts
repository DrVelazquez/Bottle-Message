import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { Filter } from "bad-words";

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const filter = new Filter();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper to hash IP
  const hashIP = (ip: string) => {
    return crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "bottle-salt")).digest("hex");
  };

  // API Routes
  
  // Submit Message
  app.post("/api/messages", async (req, res) => {
    const { content, userId } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const senderHash = userId || hashIP(ip as string);

    // 1. Basic Validation
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Content is required" });
    }

    if (content.length > 140) {
      return res.status(400).json({ error: "Message too long (max 140 chars)" });
    }

    // 2. Security Filters
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}]/u;
    if (emojiRegex.test(content)) {
      return res.status(400).json({ error: "Emojis are not allowed" });
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(content)) {
      return res.status(400).json({ error: "Links are not allowed" });
    }

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    if (emailRegex.test(content)) {
      return res.status(400).json({ error: "Contact info is not allowed" });
    }

    if (filter.isProfane(content)) {
      return res.status(400).json({ error: "Obscene content is not allowed" });
    }

    // 3. Rate Limiting & Quota (Server Side)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: recentMessages, error: quotaError } = await supabase
      .from("messages")
      .select("id")
      .eq("sender_hash", senderHash)
      .gte("created_at", today.toISOString());

    if (quotaError) {
      console.error("Quota check error:", quotaError);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (recentMessages && recentMessages.length >= 1) {
      return res.status(429).json({ error: "Daily quota reached (1 message per day)" });
    }

    // Anti-spam: Reject identical messages
    const { data: duplicateCheck } = await supabase
      .from("messages")
      .select("id")
      .eq("content", content)
      .eq("status", "pending")
      .limit(1);

    if (duplicateCheck && duplicateCheck.length > 0) {
      return res.status(400).json({ error: "This message is already waiting in a bottle" });
    }

    // 4. Insert Message
    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          content,
          sender_hash: senderHash,
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).json({ error: "Failed to send message" });
    }

    res.json({ success: true, message: data[0] });
  });

  // Get Last Message (Feedback)
  app.get("/api/my-last-message", async (req, res) => {
    const { userId } = req.query;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const senderHash = userId || hashIP(ip as string);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("sender_hash", senderHash)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return res.status(500).json({ error: "Failed to fetch status" });
    }

    res.json({ message: data?.[0] || null });
  });

  // Message Consumption API (for ESP32)
  app.get("/api/get-message", async (req, res) => {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.DEVICE_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const deviceLocation = req.query.location || "Unknown Location";
    const deviceId = req.query.deviceId || "Unknown Device";

    // Atomic operation using PostgreSQL function
    const { data, error } = await supabase.rpc("consume_random_message", {
      p_delivered_location: deviceLocation,
      p_device_id: deviceId
    });

    if (error) {
      console.error("RPC error:", error);
      return res.status(500).json({ error: "Failed to consume message" });
    }

    if (!data) {
      return res.json({ message: null });
    }

    res.json({ message: data });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
