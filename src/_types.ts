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
    lateReplyDuration: number;
    lockComment: boolean;
    markSafeWithCommentScore: boolean;
    markSafeWithPostScore: boolean;
    messageBody: string;
    messageRequiredLength: number;
    messageSubject: string;
    postApproveScore: number;
    postFlairIdsList: string;
    postFlairIdsListType: string[]
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
    name: string;
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
    NoResponse = "noResponse",
    PendingResponse = "pendingResponse",
    Removed = "removed",
    Safe = "safe",
}

export enum ResponseType {
    Accepted = "accepted",
    AlreadyAccepted = "alreadyAccepted",
    Error = "error",
    Invalid = "invalid",
    TooLate = "tooLate",
    TooShort = "tooShort",
}
