import { Context, MenuItemOnPressEvent } from "@devvit/public-api";
import { responseLookupForm } from "./forms.js";

export async function lookupPostHandler(event: MenuItemOnPressEvent, context: Context) {
    console.log("lookupPostHandler called with event:", event);
    if (event.location === "subreddit" || !event.targetId) {
        context.ui.showForm(responseLookupForm, { postId: null });
    }
    context.ui.showForm(responseLookupForm, { postId: event.targetId });
}
