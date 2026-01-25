import OpenAI from "openai";
import type { MessageRole } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

interface ChatMessage {
  role: Exclude<MessageRole, "system"> | "system";
  content: string;
}

export interface ChatCompletionArgs {
  chatbot: { name: string; description: string | null; model: string; systemPrompt: string | null };
  messages: ChatMessage[];
  context: string[];
  question: string;
  onToolCall?: (query: string) => Promise<string[]>;
}

const SEARCH_KNOWLEDGE_BASE_TOOL = {
  type: "function" as const,
  name: "search_knowledge_base",
  description: "Durchsucht die Wissensbasis des Chatbots nach relevanten Informationen. Nutze dieses Tool, wenn du spezifische Informationen zu einem Thema brauchst.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Die Suchanfrage für die Wissensbasis. Formuliere präzise Suchbegriffe, z.B. 'DSGVO Compliance', 'Datenschutz', 'Kontaktdaten'",
      },
    },
    required: ["query"],
  },
  strict: true,
};

class LlmService {
  private readonly client?: OpenAI;

  constructor() {
    if (env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  async generateResponse({ chatbot, messages, context, question, onToolCall }: ChatCompletionArgs) {
    // Wenn kein onToolCall callback bereitgestellt wurde, fallback zum alten Verhalten
    const useTools = !!onToolCall;

    const contextInfo = !useTools && context.length > 0
      ? `\n\nHier sind relevante Informationen aus meiner Wissensbasis:\n${context.map((c, i) => `${c}`).join("\n\n")}`
      : "";

    // Nutze Custom System Prompt falls vorhanden, sonst Default
    const developerInstructions = chatbot.systemPrompt || [
      `Du bist ${chatbot.name}, ein hilfreicher und freundlicher Assistent.`,
      chatbot.description ?? "",
      "",
      "Wichtige Regeln:",
      "- Sprich IMMER aus der Perspektive des Unternehmens (nutze 'wir', 'uns', 'unser' - NIEMALS 'ich', 'mir', 'mein')",
      "- Beispiel: 'Wir sind DSGVO-konform' NICHT 'Ich bin DSGVO-konform'",
      "- Halte deine Antworten KURZ und PRÄZISE (maximal 2-3 Sätze)",
      "- Beantworte nur die gestellte Frage - keine zusätzlichen Informationen",
      "- Antworte direkt und natürlich, als würde ein Mitarbeiter des Unternehmens mit einem Kunden sprechen",
      useTools
        ? "- WICHTIG: Nutze IMMER das 'search_knowledge_base' Tool bei Fragen zu Produkten, Services oder wenn du unsicher bist"
        : "- Nutze die bereitgestellten Informationen aus der Wissensbasis, um präzise zu antworten",
      "- Antworte immer auf Deutsch in einem professionellen aber freundlichen Ton",
      "- Vermeide technische Formulierungen wie 'im bereitgestellten Kontext' oder 'laut den Informationen'",
      "- Wenn du etwas nicht weißt, sage es ehrlich und unkompliziert",
      contextInfo,
    ]
      .filter(Boolean)
      .join("\n");

    if (!this.client) {
      logger.warn("OPENAI_API_KEY nicht gesetzt – Mock-Antwort wird erzeugt");
      const snippet = context.slice(0, 2).join(" ").slice(0, 280);
      return `(${chatbot.name}) Ich habe deine Frage verstanden: "${question}".\n\nKontextauszug: ${snippet || "Kein Kontext verfügbar."}`;
    }

    const inputMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Add conversation history
    for (const msg of messages) {
      if (msg.role === "user") {
        inputMessages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        inputMessages.push({ role: "assistant", content: msg.content });
      }
    }

    // Add current question
    inputMessages.push({ role: "user", content: question });

    // Use Responses API with GPT-5.1
    const responseParams: any = {
      model: chatbot.model || "gpt-5.1",
      instructions: developerInstructions,
      input: inputMessages,
      max_output_tokens: 1000,
    };

    if (useTools) {
      responseParams.tools = [SEARCH_KNOWLEDGE_BASE_TOOL];
      // Force tool usage for product/service questions
      const shouldForceToolUse =
        question.toLowerCase().includes("was macht") ||
        question.toLowerCase().includes("was bietet") ||
        question.toLowerCase().includes("funktionen") ||
        question.toLowerCase().includes("produkt") ||
        question.toLowerCase().includes("service") ||
        question.toLowerCase().includes("lösung") ||
        question.toLowerCase().includes("allgemein");

      if (shouldForceToolUse) {
        responseParams.tool_choice = "required";
      }
    }

    const response = await this.client.responses.create(responseParams);

    // Check if response exists
    if (!response.output) {
      return "Ich konnte keine Antwort generieren.";
    }

    // Handle tool calls
    const functionCalls = response.output.filter((item: any) => item.type === "function_call");

    if (functionCalls.length > 0 && onToolCall) {
      const toolCall = functionCalls[0] as any;

      // Check if it's the search_knowledge_base function
      if (toolCall?.name === "search_knowledge_base") {
        const args = JSON.parse(toolCall.arguments);
        logger.info(`LLM ruft Tool auf: search_knowledge_base mit Query: "${args.query}"`);

        // Execute the tool
        const searchResults = await onToolCall(args.query);

        // Add function call output to input for second call
        const inputWithToolResults = [
          ...inputMessages,
          {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: `Suchergebnisse:\n\n${searchResults.join("\n\n")}`,
          } as any,
        ];

        // Make second API call with tool results
        const secondResponse = await this.client.responses.create({
          model: chatbot.model || "gpt-5.1",
          instructions: developerInstructions,
          input: inputWithToolResults,
          max_output_tokens: 1000,
        });

        return secondResponse.output_text?.trim() ?? "Ich konnte keine Antwort generieren.";
      }
    }

    return response.output_text?.trim() ?? "Ich konnte keine Antwort generieren.";
  }
}

export const llmService = new LlmService();
