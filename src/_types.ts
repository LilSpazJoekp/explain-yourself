import { Comment, Post } from "@devvit/public-api";
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
    Active = "active",
    Deleted = "deleted",
    Filtered = "filtered",
    NoResponse = "noResponse",
    PendingResponse = "pendingResponse",
    Removed = "removed",
    Safe = "safe",
}

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
