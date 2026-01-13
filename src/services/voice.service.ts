import OpenAI from "openai";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export interface SpeechResult {
  audio: Buffer;
  contentType: string;
}

class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

class ServiceUnavailableError extends Error {
  statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

class VoiceService {
  private readonly client?: OpenAI;

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  /**
   * Transcribe audio to text using OpenAI Whisper
   */
  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new ServiceUnavailableError("Voice services unavailable (no OpenAI API key)");
    }

    // Validate file size
    const sizeMB = audioBuffer.length / (1024 * 1024);
    if (sizeMB > env.VOICE_MAX_AUDIO_SIZE_MB) {
      throw new BadRequestError(
        `Audio file too large (${sizeMB.toFixed(1)}MB > ${env.VOICE_MAX_AUDIO_SIZE_MB}MB)`
      );
    }

    // Convert mime type to file extension
    const ext = this.mimeToExtension(mimeType);
    // Convert Buffer to ArrayBuffer for File constructor compatibility
    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    ) as ArrayBuffer;
    const file = new File([arrayBuffer], `audio.${ext}`, { type: mimeType });

    try {
      const response = await this.client.audio.transcriptions.create({
        file,
        model: env.OPENAI_WHISPER_MODEL,
        language: "de", // German default
        response_format: "verbose_json",
      });

      logger.info(
        { duration: response.duration, language: response.language },
        "Audio transcribed successfully"
      );

      return {
        text: response.text,
        language: response.language,
        duration: response.duration,
      };
    } catch (error) {
      logger.error({ error }, "Whisper transcription failed");
      throw new ServiceUnavailableError("Audio transcription failed");
    }
  }

  /**
   * Convert text to speech using OpenAI TTS
   */
  async synthesize(
    text: string,
    voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  ): Promise<SpeechResult> {
    if (!this.client) {
      throw new ServiceUnavailableError("Voice services unavailable (no OpenAI API key)");
    }

    // Truncate text if too long
    const truncatedText = text.slice(0, env.VOICE_MAX_RESPONSE_CHARS);
    if (text.length > env.VOICE_MAX_RESPONSE_CHARS) {
      logger.warn(
        { original: text.length, truncated: truncatedText.length },
        "TTS text truncated due to length limit"
      );
    }

    try {
      const response = await this.client.audio.speech.create({
        model: env.OPENAI_TTS_MODEL,
        voice: voice || env.OPENAI_TTS_VOICE,
        input: truncatedText,
        response_format: "mp3",
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());

      logger.info(
        { textLength: truncatedText.length, audioSize: audioBuffer.length },
        "Speech synthesized successfully"
      );

      return {
        audio: audioBuffer,
        contentType: "audio/mpeg",
      };
    } catch (error) {
      logger.error({ error }, "TTS synthesis failed");
      throw new ServiceUnavailableError("Speech synthesis failed");
    }
  }

  private mimeToExtension(mimeType: string): string {
    const mapping: Record<string, string> = {
      "audio/webm": "webm",
      "audio/webm;codecs=opus": "webm",
      "audio/mp3": "mp3",
      "audio/mpeg": "mp3",
      "audio/mp4": "mp4",
      "audio/m4a": "m4a",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
      "audio/ogg": "ogg",
    };
    return mapping[mimeType.toLowerCase()] || "webm";
  }
}

export const voiceService = new VoiceService();
