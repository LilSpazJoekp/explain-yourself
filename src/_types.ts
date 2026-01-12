import { Comment, Context, JobContext, Post, TriggerContext } from "@devvit/public-api";
import { PostData } from "./postData.js";

export interface ExplainYourselfSettings {
    allowExplanation: boolean;
    approveWithCommentScore: boolean;
    approveWithPostScore: boolean;
    blockUrlsInExplanation: boolean;
    commentApproveScore: number;
    commentMaxAge: number;
    commentMinAge: number;
    commentSafeScore: number;
    exclusionRegex: string;
    exclusionTypes: string[];
    explanationAcceptedComment: string;
    explanationAcceptedMessageBody: string;
    explanationAlreadyAcceptedMessageBody: string;
    explanationInvalidMessageBody: string;
    explanationPendingComment: string;
    explanationTooLateMessageBody: string;
    explanationTooShortMessageBody: string;
    ignoreFilteredPosts: boolean;
    ignoreModerators: boolean;
    lateReplyDuration: number;
    lockComment: boolean;
    markSafeWithCommentScore: boolean;
    markSafeWithPostScore: boolean;
    messageBody: string;
    messageRequiredLength: number;
    messageSubject: string;
    postApproveScore: number;
    postFlairIds: string;
    postFlairListType: string[];
    postMarkedSafeCommentHeader: string;
    postRemovalCommentHeader: string;
    postSafeScore: number;
    removalScore: number;
    removalScoreRatioBase: number;
    removalScoreRatioOffset: number;
    removeWithCommentScore: boolean;
    replyDuration: number;
    reportReason: string;
    reportWithCommentScore: boolean;
    requireUrlInExplanation: boolean;
    spoilerExplanation: boolean;
    useScoreRatio: boolean;
}

export enum PlaceholderField {
    explanationAcceptedComment = "explanationAcceptedComment",
    explanationAcceptedMessageBody = "explanationAcceptedMessageBody",
    explanationAlreadyAcceptedMessageBody = "explanationAlreadyAcceptedMessageBody",
    explanationInvalidMessageBody = "explanationInvalidMessageBody",
    explanationPendingComment = "explanationPendingComment",
    explanationTooLateMessageBody = "explanationTooLateMessageBody",
    explanationTooShortMessageBody = "explanationTooShortMessageBody",
    messageBody = "messageBody",
    messageSubject = "messageSubject",
    postMarkedSafeCommentHeader = "postMarkedSafeCommentHeader",
    postRemovalCommentHeader = "postRemovalCommentHeader",
    reportReason = "reportReason",
}

export enum Placeholder {
    author = "author",
    commentUrl = "commentUrl",
    domain = "domain",
    explanation = "explanation",
    lateReplyDuration = "lateReplyDuration",
    link = "link",
    replyDuration = "replyDuration",
    replyLength = "replyLength",
    score = "score",
    subreddit = "subreddit",
    title = "title",
    url = "url",
}

export type FieldParams = {
    label: string;
    name: keyof ExplainYourselfSettings;
};

export type NumberFieldParams = {
    maxValue?: number;
    minValue?: number;
};

export type TextFieldParams = FieldParams & {
    blankIsDisabled: boolean;
    fieldType?: "string" | "paragraph";
    helpText: string;
    maxLength?: number;
    parentActions?: string[];
    requiredPlaceholders?: (keyof typeof Placeholder)[];
};

export enum CommentType {
    Accepted = "Accepted",
    Pending = "Pending",
    Removed = "Removed",
    Safe = "Safe",
}

export enum PostCategory {
    /**
     * Post is in the active state and the comment is being checked.
     */
    Active = "active",
    /**
     * The author has deleted the post.
     */
    Deleted = "deleted",
    /**
     * Post was filtered by automoderator.
     */
    Filtered = "filtered",
    /**
     * Post did not receive a response in time but can still be responded to
     * within the late reply duration.
     */
    NoResponse = "noResponse",
    /**
     * Post is awaiting an initial response from the author.
     */
    PendingResponse = "pendingResponse",
    /**
     * Post was removed by a moderator or the bot.
     */
    Removed = "removed",
    /**
     * Post was marked safe and its comment will not be checked anymore.
     */
    Safe = "safe",
    /**
     * Post has been seen. Seen posts are not initially processed again.
     */
    Seen = "seen",
}

export const MUTABLE_CATEGORIES = {
    active: PostCategory.Active,
    filtered: PostCategory.Filtered,
    noResponse: PostCategory.NoResponse,
    pendingResponse: PostCategory.PendingResponse,
} as const;

export type MutableCategory =
    (typeof MUTABLE_CATEGORIES)[keyof typeof MUTABLE_CATEGORIES];

export const TERMINAL_CATEGORIES = {
    deleted: PostCategory.Deleted,
    safe: PostCategory.Safe,
} as const;

export type TerminalCategory =
    (typeof TERMINAL_CATEGORIES)[keyof typeof TERMINAL_CATEGORIES];

export const CATEGORY_REMOVAL_MAPPING: { [key in PostCategory]?: MutableCategory[] } = {
    [PostCategory.Safe]: [...Object.values(MUTABLE_CATEGORIES)],
    [PostCategory.Active]: [
        PostCategory.Filtered,
        PostCategory.NoResponse,
        PostCategory.PendingResponse,
    ],
    [PostCategory.Removed]: [...Object.values(MUTABLE_CATEGORIES)],
    [PostCategory.Deleted]: [...Object.values(MUTABLE_CATEGORIES)],
    [PostCategory.Filtered]: [],
    [PostCategory.NoResponse]: [PostCategory.PendingResponse],
    [PostCategory.PendingResponse]: [PostCategory.Filtered],
    [PostCategory.Seen]: [],
} as const;

export enum ResponseType {
    Accepted = "accepted",
    AlreadyAccepted = "alreadyAccepted",
    Error = "error",
    Ineligible = "ineligible",
    Invalid = "invalid",
    TooLate = "tooLate",
    TooShort = "tooShort",
}

export type PostDataList = (PostData & { comment: Comment; post: Post })[];

export type AnyContext = Context | JobContext | TriggerContext;
