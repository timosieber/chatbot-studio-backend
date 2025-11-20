import type { Chatbot, Session, Message } from "@prisma/client";
import { BadRequestError } from "../utils/errors.js";
import { knowledgeService } from "./knowledge.service.js";
import { llmService } from "./llm.service.js";
import { messageService } from "./message.service.js";

type SessionWithChatbot = Session & { chatbot: Chatbot };

class ChatService {
  async handleMessage(session: SessionWithChatbot, content: string) {
    if (!content?.trim()) {
      throw new BadRequestError("Message darf nicht leer sein");
    }

    const history = await messageService.getRecentMessages(session.id);
    await messageService.logMessage(session.id, "user", content);

    // Initial context retrieval (wird nur genutzt wenn kein Tool Calling aktiv ist)
    const initialContext = await knowledgeService.retrieveContext(session.chatbotId, content);

    // Callback für Tool Calling - ermöglicht dem LLM, selbst nach Informationen zu suchen
    const onToolCall = async (query: string): Promise<string[]> => {
      return await knowledgeService.retrieveContext(session.chatbotId, query);
    };

    const response = await llmService.generateResponse({
      chatbot: {
        name: session.chatbot.name,
        description: session.chatbot.description,
        model: session.chatbot.model,
        systemPrompt: (session.chatbot as any).systemPrompt || null,
      },
      messages: history.map((message: Message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
      context: initialContext,
      question: content,
      onToolCall, // Aktiviert Function Calling
    });

    await messageService.logMessage(session.id, "assistant", response);

    return { answer: response, context: initialContext };
  }
}

export const chatService = new ChatService();
