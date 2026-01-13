import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { voiceService } from "../services/voice.service.js";
import { chatService } from "../services/chat.service.js";
import { voiceRateLimiter } from "../middleware/rate-limit.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Apply voice-specific rate limiting
router.use(voiceRateLimiter);

/**
 * Validate session token and return session
 */
async function validateSession(sessionId: string, token: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { chatbot: true },
  });

  if (!session) {
    return { valid: false, error: "Session nicht gefunden", session: null };
  }

  if (session.token !== token) {
    return { valid: false, error: "Ungültiges Session-Token", session: null };
  }

  if (new Date() > session.expiresAt) {
    return { valid: false, error: "Session abgelaufen", session: null };
  }

  if (session.chatbot.status !== "ACTIVE") {
    return { valid: false, error: "Chatbot wird vorbereitet", session: null };
  }

  return { valid: true, error: null, session };
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] ?? null : null;
}

/**
 * Read raw body as buffer
 */
async function readRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * POST /api/voice/transcribe
 * Transcribe audio to text
 * Headers: Authorization: Bearer <session-token>
 * Body: Raw audio bytes
 */
router.post("/transcribe", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.header("authorization"));
    const sessionId = req.query.sessionId as string;

    if (!token || !sessionId) {
      return res.status(401).json({ error: "Session-Token und sessionId erforderlich" });
    }

    const { valid, error } = await validateSession(sessionId, token);
    if (!valid) {
      return res.status(401).json({ error });
    }

    const audioBuffer = await readRawBody(req);
    if (!audioBuffer.length) {
      return res.status(400).json({ error: "Keine Audiodaten empfangen" });
    }

    const contentType = req.header("content-type") || "audio/webm";
    const result = await voiceService.transcribe(audioBuffer, contentType);

    res.json({
      text: result.text,
      language: result.language,
      duration: result.duration,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/voice/synthesize
 * Convert text to speech
 * Headers: Authorization: Bearer <session-token>
 * Body: { text: string, voice?: string }
 */
const synthesizeSchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional(),
});

router.post("/synthesize", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.header("authorization"));
    const sessionId = req.query.sessionId as string;

    if (!token || !sessionId) {
      return res.status(401).json({ error: "Session-Token und sessionId erforderlich" });
    }

    const { valid, error } = await validateSession(sessionId, token);
    if (!valid) {
      return res.status(401).json({ error });
    }

    const payload = synthesizeSchema.parse(req.body);
    const result = await voiceService.synthesize(payload.text, payload.voice);

    res.set("Content-Type", result.contentType);
    res.set("Content-Length", String(result.audio.length));
    res.send(result.audio);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/voice/message
 * Combined: transcribe audio -> send to chat -> synthesize response
 * Headers: Authorization: Bearer <session-token>
 * Query: ?sessionId=xxx&synthesize=true
 * Body: Raw audio bytes
 */
const voiceMessageQuerySchema = z.object({
  sessionId: z.string().min(8),
  synthesize: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

router.post("/message", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = voiceMessageQuerySchema.parse(req.query);
    const token = extractBearerToken(req.header("authorization"));

    if (!token) {
      return res.status(401).json({ error: "Session-Token erforderlich" });
    }

    const { valid, error, session } = await validateSession(queryParams.sessionId, token);
    if (!valid || !session) {
      return res.status(401).json({ error });
    }

    // Read audio from request body
    const audioBuffer = await readRawBody(req);
    if (!audioBuffer.length) {
      return res.status(400).json({ error: "Keine Audiodaten empfangen" });
    }

    logger.info(
      { sessionId: queryParams.sessionId, audioSize: audioBuffer.length },
      "Voice message received"
    );

    // Step 1: Transcribe audio
    const contentType = req.header("content-type") || "audio/webm";
    const transcription = await voiceService.transcribe(audioBuffer, contentType);

    if (!transcription.text.trim()) {
      return res.status(400).json({ error: "Konnte nichts verstehen. Bitte erneut versuchen." });
    }

    logger.info(
      { sessionId: queryParams.sessionId, text: transcription.text.slice(0, 100) },
      "Audio transcribed"
    );

    // Step 2: Send to chat service (same as normal text chat)
    const chatResult = await chatService.generateResponse({
      chatbotId: session.chatbotId,
      message: transcription.text,
      history: [], // Voice mode doesn't send history - could be enhanced later
    });

    // Build text response from RAG claims
    const answerText = chatResult.unknown
      ? chatResult.reason || "Das kann ich leider nicht beantworten."
      : chatResult.claims.map((c) => c.text).join(" ");

    // Step 3: Optionally synthesize response
    let audioResponse: string | null = null;
    let audioContentType: string | null = null;

    if (queryParams.synthesize && answerText) {
      const speech = await voiceService.synthesize(answerText);
      audioResponse = speech.audio.toString("base64");
      audioContentType = speech.contentType;
    }

    // Return combined response
    res.json({
      sessionId: queryParams.sessionId,
      transcription: {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
      },
      rag: chatResult,
      audio: audioResponse,
      audioContentType,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
