import type { Response } from "express";

export type ProvisioningEvent =
  | { type: "started"; chatbotId: string }
  | { type: "completed"; chatbotId: string; status: "ACTIVE" }
  | { type: "failed"; chatbotId: string; status: "DRAFT" | "PAUSED" | "ARCHIVED" | "ACTIVE" | string; error?: string };

type Subscriber = {
  res: Response;
};

class ProvisioningEventsService {
  private readonly subscribersByChatbotId = new Map<string, Set<Subscriber>>();

  subscribe(chatbotId: string, res: Response) {
    const set = this.subscribersByChatbotId.get(chatbotId) ?? new Set<Subscriber>();
    set.add({ res });
    this.subscribersByChatbotId.set(chatbotId, set);
  }

  unsubscribe(chatbotId: string, res: Response) {
    const set = this.subscribersByChatbotId.get(chatbotId);
    if (!set) return;
    for (const sub of set) {
      if (sub.res === res) set.delete(sub);
    }
    if (!set.size) this.subscribersByChatbotId.delete(chatbotId);
  }

  publish(chatbotId: string, event: ProvisioningEvent) {
    const set = this.subscribersByChatbotId.get(chatbotId);
    if (!set?.size) return;

    const payload = JSON.stringify(event);
    for (const sub of set) {
      try {
        sub.res.write(`event: provisioning\n`);
        sub.res.write(`data: ${payload}\n\n`);
      } catch {
        // ignore broken pipes
      }
    }
  }
}

export const provisioningEventsService = new ProvisioningEventsService();

