/// <reference path="./types/global.d.ts" />

import {
  TeamsActivityHandler,
  TurnContext,
  SigninStateVerificationQuery,
  MemoryStorage,
  ConversationState,
  UserState,
  CardFactory,
  Middleware,
  MessageFactory,
} from 'botbuilder';
import { SSOCommand, SSOCommandMap } from './commands/SSOCommandMap';
import { Client } from '@microsoft/microsoft-graph-client';
import { OnBehalfOfUserCredential } from '@microsoft/teamsfx';
import { EnsureWalletMiddleware } from './services/EnsureWalletMiddleware';
import { SendZapCommand, SendZap } from './commands/sendZapCommand';
import { ShowMyBalanceCommand } from './commands/showMyBalanceCommand';
import { WithdrawFundsCommand } from './commands/withdrawFundsCommand';
import { ShowLeaderboardCommand } from './commands/showLeaderboardCommand';
import {
  getWallets,
  ensureMatchingUserWallet,
  payInvoice,
  getWalletIdByUserId,
  createInvoice,
  getWalletId,
} from './services/lnbitsService';
import { error } from 'console';

let globalWalletId: string | null = null;

// Define global variables
let globalZapAmount: number;
let globalMentionedUserId: string;
let globalMentionedUserName: string;

export class TeamsBot extends TeamsActivityHandler {
  conversationState: ConversationState;
  userState: UserState;

  constructor() {
    super();

    // Define the state store for your bot.
    const memoryStorage = new MemoryStorage();

    // Create conversation and user state with in-memory storage provider.
    this.conversationState = new ConversationState(memoryStorage);
    this.userState = new UserState(memoryStorage);

    // Register commands
    SSOCommandMap.register('send zap', new SendZapCommand());
    SSOCommandMap.register('show my balance', new ShowMyBalanceCommand());
    SSOCommandMap.register('withdraw my zaps', new WithdrawFundsCommand());
    SSOCommandMap.register('show leaderboard', new ShowLeaderboardCommand());

    this.onMessage(async (context, next) => {
      console.log('Running onMessage ...');

      const botId = context.activity.recipient.id; // Bot's ID
      const senderId = context.activity.from.id; // Sender's ID

      // Check if the sender is the bot itself
      if (senderId === botId) {
        // Skip processing the bot's own messages
        await next();
        return;
      }

      try {
        let mentions = TurnContext.getMentions(context.activity);
        console.log('context.activity:', context.activity);

        if (
          context.activity.value &&
          context.activity.value.action === 'submitZaps'
        ) {
          const userAadObjectId = context.activity.from.aadObjectId;
          const userName = context.activity.from.name;

          const zapReceiverWalletId =
            context.activity.value.zapReceiverWalletId;
          const senderWallet = await ensureMatchingUserWallet(
            userAadObjectId,
            userName,
            'Sending',
          );
          const zapMessage = context.activity.value.zapMessage;
          const zapAmount = context.activity.value.zapAmount;

          if (!senderWallet) {
            throw new error('No sending wallet found.');
          }

          const receiverWallets = await getWallets(null, zapReceiverWalletId);

          if (receiverWallets.length != 1) {
            throw new Error(
              'Expected exactly one receiving wallet, but found ' +
                receiverWallets.length,
            );
          }

          await SendZap(
            senderWallet,
            receiverWallets[0],
            zapMessage,
            zapAmount,
          );

          await context.sendActivity(
            `Awesome! You sent ${zapAmount} Sats to your colleague with a zap!`,
          );
        }
      } catch (error) {
        console.error('Error in onMessage handler:', error.message);
        await context.sendActivity(
          `Oops! Unable to send zap (${error.message}`,
        );
      }

      let text = '';
      if (context.activity.text) {
        text = context.activity.text.trim().toLowerCase();
        // Trigger command by IM text
        const command = SSOCommandMap.get(text);
        if (command) {
          await command.execute(context);
        } else {
          await context.sendActivity(
            "D'oh! I'm sorry, but I didn't recognize that command. But don't worry, I'm always getting better!",
          );
        }
      }
      console.log('Text:', text);

      /*
      mentions = mentions.filter(
        mention => mention.mentioned.id !== context.activity.recipient.id,
      );
      console.log('Mentions:', mentions);


      const uniqueMentions = [];
      const mentionMap = new Map();
      mentions.forEach(mention => {
        if (!mentionMap.has(mention.mentioned.id)) {
          mentionMap.set(mention.mentioned.id, mention);
          uniqueMentions.push(mention);
        }
      });

      // Log the unique mentions
      console.log('Unique Mentions:', uniqueMentions);

      // Check if the message contains the text "send zap" and has at least one valid mention, or context.activity.value.action === 'submitZaps'
      if (
        (text.toLowerCase().includes('send zap') &&
          uniqueMentions.length > 0) ||
        context.activity.value.action === 'submitZaps'
      ) {
        if (text.toLowerCase().includes('send zap')) {
        }
        const mentionedUser = uniqueMentions[0].mentioned;
        globalMentionedUserName = mentionedUser.name;

        // Log the ObjectID of the mentioned user
        console.log('Mentioned User ObjectID:', mentionedUser.id);

        // Ensure the mentioned user is not the bot itself
        if (mentionedUser.id !== context.activity.recipient.id) {
          const sendZapCommand = new SendZapCommand();
          await sendZapCommand.execute(context);
        } else {
          await context.sendActivity(
            MessageFactory.text('You cannot send a zap to the bot itself.'),
          );
        }
      } else {
        //await context.sendActivity(
        //  MessageFactory.text('Invalid command or no valid mentions detected.'),
        //);
      }
      // Clear the mentions variable
      mentions = [];

      try {
        // Retrieve user information
        const userId =
          context.activity.from.aadObjectId || context.activity.from.id;
        const userName = context.activity.from.name;

        // Log user information
        console.log(`Zap from userId: ${userId}`);
        console.log(`Zap from userName: ${userName}`);
        const { receivingWalletId, sendingWalletId } = await ensureUserWallet(
          userId,
          userName,
        );

        let txt = context.activity.text;
        // remove the mention of this bot
        const removedMentionText = TurnContext.removeRecipientMention(
          context.activity,
        );
        if (removedMentionText) {
          // Remove the line break
          txt = removedMentionText.toLowerCase().replace(/\n|\r/g, '').trim();
        }

        if (
          context.activity.value &&
          context.activity.value.action === 'submitZaps'
        ) {
          const amount = context.activity.value.zapAmount;

          if (!amount || isNaN(amount)) {
            await context.sendActivity(
              MessageFactory.text('Invalid amount specified.'),
            );
            return;
          }

          try {
            // Assuming recipientWalletId is known or retrieved from context
            //const recipientWalletId = 'recipient-wallet-id'; // Replace with actual recipient wallet ID
            const recipientWalletId = context.activity.value.recipientWalletId;

            // Create an invoice
            const paymentRequest = await createInvoice(
              recipientWalletId,
              parseInt(amount),
            );

            if (!paymentRequest) {
              await context.sendActivity(
                MessageFactory.text('Failed to create invoice.'),
              );
              return;
            }

            // Pay the invoice
            const paymentResult = await payInvoice(paymentRequest);

            if (paymentResult) {
              await context.sendActivity(
                MessageFactory.text('Zaps submitted successfully!'),
              );
            } else {
              await context.sendActivity(
                MessageFactory.text('Failed to submit zaps.'),
              );
            }
          } catch (error) {
            console.error('Error handling submit zaps:', error);
            await context.sendActivity(
              MessageFactory.text('An error occurred while submitting zaps.'),
            );
          }
        }
      } catch (error) {
        console.error('Error in onMessage handler:', error);
      }
        */
    });

    this.onMembersAdded(async (context, next) => {
      try {
        const membersAdded = context.activity.membersAdded;
        for (let cnt = 0; cnt < membersAdded.length; cnt++) {
          if (membersAdded[cnt].id) {
            await context.sendActivity('Welcome to the sso bot sample!');
            break;
          }
        }
      } catch (error) {
        console.error('Error in onMembersAdded handler:', error);
      }
      await next();
    });
  }

  async run(context: TurnContext) {
    try {
      await super.run(context);

      // Save any state changes. The load happened during the execution of the Dialog.
      await this.conversationState.saveChanges(context, false);
      await this.userState.saveChanges(context, false);
    } catch (error) {
      console.error('Error in run method:', error);
      await context.sendActivity(error);
    }
  }

  async handleTeamsSigninVerifyState(
    context: TurnContext,
    query: SigninStateVerificationQuery,
  ) {
    try {
      console.log(
        'Running dialog with signin/verifystate from an Invoke Activity.',
      );
      // Your logic here for handling signin verify state
    } catch (error) {
      console.error('Error in handleTeamsSigninVerifyState:', error);
    }
  }

  async handleTeamsSigninTokenExchange(
    context: TurnContext,
    query: SigninStateVerificationQuery,
  ) {
    try {
      // Your logic here for handling token exchange
    } catch (error) {
      console.error('Error in handleTeamsSigninTokenExchange:', error);
    }
  }

  async onSignInInvoke(context: TurnContext) {
    try {
      const userId = context.activity.from.id;
      const userName = context.activity.from.name;
      console.log(`User ID: ${userId}, User Name: ${userName}`);

      // Ensure the user has a wallet and get the wallet ID
      const wallet = await ensureMatchingUserWallet(
        userId,
        userName,
        'Sending',
      );

      if (wallet.id) {
        await context.sendActivity(`Wallet ID: ${wallet.id}`);
      } else {
        await context.sendActivity('Failed to ensure wallet.');
      }
    } catch (error) {
      console.error('Error in onSignInInvoke:', error);
      await context.sendActivity('An error occurred during sign-in.');
    }
  }
}