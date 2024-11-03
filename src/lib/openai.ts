import dotenv from "dotenv";
dotenv.config();
import type { SkillGroup } from "@xmtp/message-kit";
import OpenAI from "openai";
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

export type ChatHistoryEntry = { role: string; content: string };
export type ChatHistories = Record<string, ChatHistoryEntry[]>;
let chatHistories: ChatHistories = {};
export const PROMPT_RULES = `You are a helpful and playful agent called {NAME} that lives inside a web3 messaging app called Converse.
- You can respond with multiple messages if needed. Each message should be separated by a newline character.
- You can trigger commands by only sending the command in a newline message.
- Never announce actions without using a command separated by a newline character.
- Only provide answers based on verified information.
- Dont answer in markdown format, just answer in plaintext.
- Do not make guesses or assumptions
- CHECK that you are not missing a command
`;

export const PROMPT_SKILLS_AND_EXAMPLES = (skills: SkillGroup[]) => `
Commands:
${skills
  .map((skill) => skill.skills.map((s) => s.command).join("\n"))
  .join("\n")}

Examples:
${skills
  .map((skill) => skill.skills.map((s) => s.example).join("\n"))
  .join("\n")}
  `;

export async function agentResponse(
  sender: { address: string },
  userPrompt: string,
  systemPrompt: string,
  context: any
) {
  try {
    const { reply } = await textGeneration(
      sender.address,
      userPrompt,
      systemPrompt
    );
    await processResponseWithSkill(sender.address, reply, context);
  } catch (error) {
    console.error("Error during OpenAI call:", error);
    await context.reply("An error occurred while processing your request.");
  }
}
export async function textGeneration(
  address: string,
  userPrompt: string,
  systemPrompt: string
) {
  let messages = chatHistories[address] || [];
  if (messages.length === 0) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }
  messages.push({
    role: "user",
    content: userPrompt,
  });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
    });
    const reply = response.choices[0].message.content;
    messages.push({
      role: "assistant",
      content: reply || "No response from OpenAI.",
    });
    const cleanedReply = parseMarkdown(reply as string);
    chatHistories[address] = messages;
    return { reply: cleanedReply, history: messages };
  } catch (error) {
    console.error("Failed to fetch from OpenAI:", error);
    throw error;
  }
}

export async function processResponseWithSkill(
  address: string,
  reply: string,
  context: any
) {
  let messages = reply
    .split("\n")
    .map((message: string) => parseMarkdown(message))
    .filter((message): message is string => message.length > 0);

  console.log(messages);
  for (const message of messages) {
    if (message.startsWith("/")) {
      const response = await context.skill(message);
      if (response && typeof response.message === "string") {
        let msg = parseMarkdown(response.message);

        if (!chatHistories[address]) {
          chatHistories[address] = [];
        }
        chatHistories[address].push({
          role: "system",
          content: msg,
        });

        await context.send(response.message);
      }
    } else {
      await context.send(message);
    }
  }
}
export function parseMarkdown(message: string) {
  let trimmedMessage = message;
  // Remove bold and underline markdown
  trimmedMessage = trimmedMessage?.replace(/(\*\*|__)(.*?)\1/g, "$2");
  // Remove markdown links, keeping only the URL
  trimmedMessage = trimmedMessage?.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$2");
  // Remove markdown headers
  trimmedMessage = trimmedMessage?.replace(/^#+\s*(.*)$/gm, "$1");
  // Remove inline code formatting
  trimmedMessage = trimmedMessage?.replace(/`([^`]+)`/g, "$1");
  // Remove single backticks at the start or end of the message
  trimmedMessage = trimmedMessage?.replace(/^`|`$/g, "");
  // Remove leading and trailing whitespace
  trimmedMessage = trimmedMessage?.replace(/^\s+|\s+$/g, "");
  // Remove any remaining leading or trailing whitespace
  trimmedMessage = trimmedMessage.trim();

  return trimmedMessage;
}

export const clearChatHistories = () => {
  chatHistories = {};
};
