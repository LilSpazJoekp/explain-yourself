import { Devvit } from "@devvit/public-api";
import { PostData } from "./postData.js";

export const responseLookupForm = Devvit.createForm(
    (data) => ({
        name: "responseLookup",
        title: "Response Conversation Lookup",
        fields: [
            {
                defaultValue: data.postId ? data.postId.split("_")[1] : "",
                helpText: "The ID of the post to look up.",
                label: "Post ID",
                name: "postId",
                required: true,
                type: "string",
            },
        ],
    }),
    async (event, context) => {
        const { reddit, ui } = context;

        const postData = await PostData.fromPostId(
            context,
            `t3_${event.values["postId"]}`,
        );
        if (postData === undefined) {
            ui.showToast("Post was not processed");
            return;
        }
        if (postData.sentModmailId === "") {
            ui.showToast("No modmail sent");
            return;
        }
        const { conversation } = await reddit.modMail.getConversation({
            conversationId: postData.sentModmailId,
        });
        if (conversation === undefined) {
            ui.showToast("No conversation found");
            return;
        }
        ui.navigateTo(`https://mod.reddit.com/mail/all/${conversation.id}`);
    },
);
