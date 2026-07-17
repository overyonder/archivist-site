import {
  AlreadyExistsException,
  CreateContactCommand,
  SendEmailCommand,
  SESv2Client,
  UpdateContactCommand,
} from "@aws-sdk/client-sesv2";
import { confirmationEmail } from "./confirmation-email.ts";
import { earlyAccessTopic, requiredEnv } from "./config.ts";

let cachedClient: SESv2Client | undefined;

function client(): SESv2Client {
  return cachedClient ??= new SESv2Client({
    region: Deno.env.get("AWS_REGION")?.trim() || "us-east-1",
    credentials: {
      accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

export async function sendConfirmation(
  email: string,
  confirmationUrl: string,
  deliveryId: string,
): Promise<string> {
  const content = confirmationEmail(confirmationUrl);
  const result = await client().send(
    new SendEmailCommand({
      FromEmailAddress: requiredEnv("SES_FROM_EMAIL"),
      Destination: { ToAddresses: [email] },
      ConfigurationSetName: requiredEnv("SES_CONFIGURATION_SET"),
      Content: {
        Simple: {
          Subject: { Data: content.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: content.html, Charset: "UTF-8" },
            Text: { Data: content.text, Charset: "UTF-8" },
          },
        },
      },
      EmailTags: [
        { Name: "message-kind", Value: "early-access-confirmation" },
        { Name: "delivery-id", Value: deliveryId },
      ],
    }),
  );

  if (!result.MessageId) {
    throw new Error("SES accepted mail without a message ID");
  }
  return result.MessageId;
}

export async function synchronizePreference(
  email: string,
  status: "OPT_IN" | "OPT_OUT",
): Promise<void> {
  const contactListName = requiredEnv("SES_CONTACT_LIST_NAME");
  const topicPreferences = [{
    TopicName: earlyAccessTopic(),
    SubscriptionStatus: status,
  }];

  try {
    await client().send(
      new CreateContactCommand({
        ContactListName: contactListName,
        EmailAddress: email,
        TopicPreferences: topicPreferences,
      }),
    );
  } catch (error) {
    if (
      !(error instanceof AlreadyExistsException) &&
      (error as { name?: string }).name !== "AlreadyExistsException"
    ) throw error;

    await client().send(
      new UpdateContactCommand({
        ContactListName: contactListName,
        EmailAddress: email,
        TopicPreferences: topicPreferences,
      }),
    );
  }
}
