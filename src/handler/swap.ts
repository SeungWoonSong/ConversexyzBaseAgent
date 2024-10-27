import { HandlerContext } from "@xmtp/message-kit";
import { textGeneration } from "../lib/openai.js";
import { generateFrameURL } from "../index.js";

export async function swapHandler(context: HandlerContext) {
  const {
    message: {
      content: { command, content, params },
    },
  } = context;
  const texttolower = content.toLowerCase();
  console.log("texttolower", texttolower);
  if (texttolower.includes("@swap")) {
    await swapAgent(context);
  } else if (params.token_from && params.token_to && params.amount) {
    await swapCommand(context);
  }
}
export async function swapCommand(context: HandlerContext) {
  const {
    message: {
      content: { command, params },
    },
  } = context;

  const baseUrl = "https://base-frame-lyart.vercel.app/transaction";

  switch (command) {
    case "swap":
      // Destructure and validate parameters for the swap command
      const { amount, token_from, token_to } = params;

      if (!amount || !token_from || !token_to) {
        context.reply(
          "Missing required parameters. Please provide amount, token_from, and token_to."
        );
        return;
      }
      // Generate URL for the swap transaction
      let url_swap = generateFrameURL(baseUrl, "swap", {
        amount,
        token_from,
        token_to,
      });
      context.send(`${url_swap}`);
      break;
    default:
      // Handle unknown commands
      context.reply("Unknown command. Use help to see all available commands.");
  }
}

export async function swapAgent(context: HandlerContext) {
  if (!process?.env?.OPEN_AI_API_KEY) {
    console.log("No OPEN_AI_API_KEY found in .env");
    return;
  }

  const {
    message: {
      content: { content, params },
    },
  } = context;
  const systemPrompt = `You are a helpful and playful betting bot that lives inside a web3 messaging group.\n

  Users can start a swap by tagging you in a prompt like "@swap 1 eth to usdc"

  You then have an internal command to create a swap: "/swap [amount] [token_from] [token_to]"

  Format examples:

  /swap 1 eth usdc
  /swap 100 dai usdc
  /swap 0.1 eth usdt`;

  try {
    let userPrompt = params?.prompt ?? content;

    if (process?.env?.MSG_LOG === "true") {
      console.log("userPrompt", userPrompt);
    }

    const { reply } = await textGeneration(userPrompt, systemPrompt);
    console.log("intent:", reply);
    context.intent(reply);
  } catch (error) {
    console.error("Error during OpenAI call:", error);
    await context.reply("An error occurred while processing your request.");
  }
}
