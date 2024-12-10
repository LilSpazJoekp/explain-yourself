import { Context, MenuItemOnPressEvent } from "@devvit/public-api";
import { responseLookupForm } from "./forms.js";
import { PostData } from "./postData.js";

export async function lookupPostHandler(event: MenuItemOnPressEvent, context: Context) {
    if (event.targetId === undefined) {
        context.ui.showForm(responseLookupForm, { postId: null });
    }
    const postData = await PostData.fromPostId(context, event.targetId);
    if (postData === undefined) {
        context.ui.showToast("Post was not processed");
        return;
    }
    context.ui.showForm(responseLookupForm, { postId: postData.postId });
}
