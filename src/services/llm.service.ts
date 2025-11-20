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
  function: {
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
  },
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
        ? "- Nutze das 'search_knowledge_base' Tool, um nach relevanten Informationen in der Wissensbasis zu suchen"
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

    const inputMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: developerInstructions },
    ];

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

    // Use Chat Completions API with GPT-5.1
    const completionParams: any = {
      model: chatbot.model || env.OPENAI_COMPLETIONS_MODEL,
      messages: inputMessages,
      max_tokens: 1000,
      stream: false,
    };

    if (useTools) {
      completionParams.tools = [SEARCH_KNOWLEDGE_BASE_TOOL];
      completionParams.tool_choice = "auto";
    }

    const completion = await this.client.chat.completions.create(completionParams);

    const choice = completion.choices[0];
    if (!choice) {
      return "Ich konnte keine Antwort generieren.";
    }

    // Handle tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0 && onToolCall) {
      const toolCall = choice.message.tool_calls[0];

      // Type guard for function tool call
      if (toolCall && "function" in toolCall && toolCall.function.name === "search_knowledge_base") {
        const args = JSON.parse(toolCall.function.arguments);
        logger.info(`LLM ruft Tool auf: search_knowledge_base mit Query: "${args.query}"`);

        // Execute the tool
        const searchResults = await onToolCall(args.query);

        // Add assistant's tool call message (proper format for OpenAI)
        inputMessages.push({
          role: "assistant",
          content: choice.message.content || null,
          tool_calls: [{
            id: toolCall.id,
            type: "function",
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          }],
        } as any);

        // Add tool result message (proper format for OpenAI)
        inputMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Suchergebnisse:\n\n${searchResults.join("\n\n")}`,
        } as any);

        // Make second API call with tool results
        const secondCompletion = await this.client.chat.completions.create({
          model: chatbot.model || env.OPENAI_COMPLETIONS_MODEL,
          messages: inputMessages,
          max_tokens: 1000,
          stream: false,
        });

        return secondCompletion.choices[0]?.message?.content?.trim() ?? "Ich konnte keine Antwort generieren.";
      }
    }

    return choice.message.content?.trim() ?? "Ich konnte keine Antwort generieren.";
  }
}

export const llmService = new LlmService();
