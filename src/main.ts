import { Devvit } from "@devvit/public-api";
import { appInstalledHandler } from "./appInstalledHandler.js";
import {
    CHECK_CRON,
    COMMENT_WATCHER,
    JOB_WATCHER,
    POST_WATCHER,
    RESPONSE_WATCHER,
} from "./consts.js";
import { lookupPostHandler } from "./menuItemHandlers.js";
import { handleMessage } from "./messageHandler.js";
import { handleFilter, modActionHandler } from "./modlogHandlers.js";
import { handleDeletion, handlePost } from "./postHandler.js";
import {
    checkComments,
    checkPosts,
    checkResponses,
    ensureJobs,
} from "./scheduledJobs.js";
import { booleanField, numberField, textField } from "./utils.js";

Devvit.configure({
    redditAPI: true,
    redis: true,
});

Devvit.addSettings([
    {
        fields: [
            {
                fields: [
                    {
                        defaultValue: false,
                        helpText:
                            "If enabled, removes the post if the comment score fails to meet the minimum score requirements. Ignored if 'Use Score Ratio' is enabled.",
                        ...booleanField({
                            name: "removeWithCommentScore",
                            label: "Remove With Comment Score",
                        }),
                    },
                    {
                        defaultValue: false,
                        helpText:
                            "If enabled, reports the comment if the comment score fails to meet the minimum score requirements. Either this or 'Remove With Comment Score' must be enabled, otherwise the app won't do anything with posts that fail the comment score requirements.",
                        ...booleanField({
                            name: "reportWithCommentScore",
                            label: "Report With Comment Score",
                        }),
                    },
                    {
                        helpText:
                            "Comment score at which the post is removed. Must be less than 1 otherwise the post will be removed immediately. Required if 'Remove With Comment Score' or 'Report With Comment Score' is enabled. Ignored if 'Use Score Ratio' is enabled.",
                        ...numberField({
                            label: "Removal Score",
                            name: "removalScore",
                            maxValue: 0,
                        }),
                    },
                    {
                        defaultValue: true,
                        helpText:
                            "If enabled, the removal score is calculated using a ratio based on the comment score and age of the post in hours.",
                        ...booleanField({
                            label: "Use Score Ratio",
                            name: "useScoreRatio",
                        }),
                    },
                    {
                        defaultValue: 16,
                        helpText:
                            "Removal score ratio base. See the app's directory page for more information on how this functionality works. Ignored if 'Use Score Ratio' is disabled.",
                        ...numberField({
                            label: "Removal Score Ratio Base",
                            name: "removalScoreRatioBase",
                        }),
                    },
                    {
                        defaultValue: 6,
                        helpText:
                            "Removal score ratio offset. See the app's directory page for more information on how this functionality works. Ignored if 'Use Score Ratio' is disabled.",
                        ...numberField({
                            label: "Removal Score Ratio Offset",
                            name: "removalScoreRatioOffset",
                        }),
                    },
                ],
                helpText: "Conditions at which the post is removed/reported.",
                label: "Removal Settings",
                type: "group",
            },

            {
                fields: [
                    {
                        defaultValue: false,
                        helpText:
                            "If enabled, marks the post as safe if the comment score is above the specified threshold.",
                        ...booleanField({
                            label: "Mark Safe With Comment Score",
                            name: "markSafeWithCommentScore",
                        }),
                    },
                    {
                        defaultValue: 2,
                        helpText:
                            "Comment score at which the post is marked as safe. Must be higher than 1 otherwise the post will be marked as safe immediately. Ignored if 'Mark Safe With Comment Score' is disabled.",
                        ...numberField({
                            label: "Comment Safe Score",
                            name: "commentSafeScore",
                            minValue: 2,
                        }),
                    },

                    {
                        defaultValue: false,
                        helpText:
                            "If enabled, marks the post as safe if the post score is above the specified 'Post Safe Score' threshold.",
                        ...booleanField({
                            name: "markSafeWithPostScore",
                            label: "Mark Safe With Post Score",
                        }),
                    },
                    {
                        defaultValue: 2,
                        helpText:
                            "Post score at which the post is marked as safe. Must be higher than 1 otherwise the post will be marked as safe immediately. Ignored if 'Mark Safe With Post Score' is disabled.",
                        ...numberField({
                            label: "Post Safe Score",
                            name: "postSafeScore",
                            minValue: 2,
                        }),
                    },
                ],
                helpText:
                    "Conditions at which the post is marked as safe. Safe means the post/comment is no longer checked.",
                label: "Safe Settings",
                type: "group",
            },
            {
                fields: [
                    {
                        defaultValue: false,
                        helpText:
                            "If enabled, allows the post to be approved if the comment score is goes above the specified threshold.",
                        ...booleanField({
                            label: "Approve With Comment Score",
                            name: "approveWithCommentScore",
                        }),
                    },
                    {
                        defaultValue: 2,
                        helpText:
                            "Comment score at which the post is approved. Must be higher than 1 otherwise the post will be approved immediately. Ignored if 'Approve With Comment Score' is disabled.",
                        ...numberField({
                            label: "Comment Approval Score",
                            name: "commentApproveScore",
                            minValue: 2,
                        }),
                    },

                    {
                        defaultValue: false,
                        helpText:
                            "If enabled, allows the post to be approved if the post score is goes above the specified threshold.",
                        ...booleanField({
                            label: "Approve With Post Score",
                            name: "approveWithPostScore",
                        }),
                    },
                    {
                        defaultValue: 2,
                        helpText:
                            "Post score at which the post is approved. Must be higher than 1 otherwise the post will be approved immediately. Ignored if 'Approve With Post Score' is disabled.",
                        ...numberField({
                            label: "Post Approval Score",
                            name: "postApproveScore",
                            minValue: 2,
                        }),
                    },
                ],
                helpText:
                    "Conditions at which the post is approved. Approved means the post approved, marked safe, and is no longer checked.",
                label: "Approval Settings",
                type: "group",
            },

            {
                fields: [
                    {
                        ...textField({
                            blankIsDisabled: true,
                            fieldType: "string",
                            helpText:
                                "Regex pattern to exclude certain posts from the app's actions.",
                            label: "Post Exclusion Regex",
                            name: "exclusionRegex",
                        }),
                    },
                    {
                        defaultValue: ["title"],
                        helpText:
                            "The type of content to apply the exclusion regex to.",
                        label: "Post Exclusion Type",
                        multiSelect: true,
                        name: "exclusionTypes",
                        options: [
                            {
                                label: "Title",
                                value: "title",
                            },
                            {
                                label: "Body",
                                value: "body",
                            },
                        ],
                        type: "select",
                    },
                ],
                helpText:
                    "Post RegEx exclusion settings. If the post matches the exclusion RegEx, the app will not take any actions on it.",
                label: "Post RegEx Exclusion Settings",
                type: "group",
            },

            {
                fields: [
                    {
                        ...textField({
                            blankIsDisabled: true,
                            fieldType: "paragraph",
                            helpText:
                                "Post flair IDs to check against. If the post's flair is one of these IDs, the post will be ignored/processed based on 'Post Flair List Type'. One flair ID per line.",
                            label: "Post Flair List",
                            name: "postFlairIds",
                        }),
                    },
                    {
                        defaultValue: ["exclusion"],
                        helpText:
                            "If set to 'Exclusion', the post will be ignored if the post's flair ID is in the list. If set to 'Inclusion', the post will be processed if the post's flair ID is in the list.",
                        label: "Post Flair List Type",
                        multiSelect: false,
                        name: "postFlairListType",
                        options: [
                            {
                                label: "Exclusion",
                                value: "exclusion",
                            },
                            {
                                label: "Inclusion",
                                value: "inclusion",
                            },
                        ],
                        type: "select",
                    },
                    // {
                    //     ...textField({
                    //         blankIsDisabled: true,
                    //         fieldType: "paragraph",
                    //         helpText:
                    //             "User flair IDs to check against. If the user's flair is one of these IDs, the post will be ignored/processed based on 'User Flair List Type'. One flair ID per line.",
                    //         label: "User Flair List",
                    //         name: "userFlairIds",
                    //     }),
                    // },
                    // {
                    //     defaultValue: ["exclusion"],
                    //     helpText: "If set to 'Exclusion', the post will be ignored if the user's flair ID is in the list. If set to 'Inclusion', the post will be processed if the user's flair ID is in the list.",
                    //     label: "User Flair List Type",
                    //     multiSelect: false,
                    //     name: "userFlairListType",
                    //     options: [
                    //         {
                    //             label: "Exclusion",
                    //             value: "exclusion",
                    //         },
                    //         {
                    //             label: "Inclusion",
                    //             value: "inclusion",
                    //         },
                    //     ],
                    //     type: "select",
                    // },
                ],
                helpText:
                    "Flair settings. Depending on the list type, the post will be ignored or processed based on the post's flair ID.",
                label: "Flair Settings",
                type: "group",
            },
        ],
        helpText:
            "These settings control the conditions the post is removed/approved/marked safe/ignored.",
        label: "Action Settings",
        type: "group",
    },
    {
        fields: [
            {
                defaultValue: 10,
                helpText:
                    "Minimum duration before the comment score is checked. Set to 0 to disable.",
                ...numberField({
                    label: "Comment Minimum Age",
                    maxValue: 1440,
                    minValue: 0,
                    name: "commentMinAge",
                }),
            },
            {
                defaultValue: 480,
                helpText: "Maximum duration the comment score is checked.",
                ...numberField({
                    label: "Comment Maximum Age",
                    maxValue: 4320,
                    minValue: 1,
                    name: "commentMaxAge",
                }),
            },
            {
                defaultValue: 10,
                helpText:
                    "The duration the author has to reply with a suitable explanation before their post is removed. Set to 0 to disable.",
                ...numberField({
                    label: "Reply Duration",
                    maxValue: 4320,
                    minValue: 0,
                    name: "replyDuration",
                }),
            },
            {
                defaultValue: 240,
                helpText:
                    "The duration the author has to reply with a suitable explanation after their post was removed for failure to reply within the initial 'Reply Duration'. Late replies will cause the post to be approved. Set to 0 to disable.",
                ...numberField({
                    label: "Late Reply Duration",
                    maxValue: 4320,
                    minValue: 0,
                    name: "lateReplyDuration",
                }),
            },
        ],
        helpText:
            "These settings determine how long before an action is performed on the post. All durations are in minutes.",
        label: "Duration Settings",
        type: "group",
    },
    {
        fields: [
            {
                fields: [
                    {
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Comment to be posted when the author's explanation is pending acceptance. This can also be used as a" +
                                " 'Upvote this comment if the post is good or downvote if not' comment without explanation.",
                            label: "Explanation Pending Comment",
                            name: "explanationPendingComment",
                        }),
                    },
                    {
                        defaultValue:
                            "OP sent the following text as an explanation why their post fits here:\n\n" +
                            "---\n\n" +
                            "{explanation}\n\n" +
                            "---\n\n" +
                            "Does this explanation fit this subreddit? Then upvote this comment, otherwise downvote it.",
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Comment to be posted when the author's explanation is accepted.",
                            label: "Explanation Accepted Comment",
                            name: "explanationAcceptedComment",
                            parentActions: ["Allow Explanation"],
                        }),
                    },
                    {
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Header that is prepended to the comment when the post is removed due to insufficient comment score.",
                            label: "Post Removal Comment Header",
                            name: "postRemovalCommentHeader",
                            parentActions: ["Remove Post With Comment Score"],
                        }),
                    },
                    {
                        defaultValue:
                            "### This comment has been marked as **safe**. Upvoting/downvoting this comment will have no effect.\n\n---",
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Header that is prepended to the comment when the post is marked as safe.",
                            label: "Post Marked Safe Comment Header",
                            name: "postMarkedSafeCommentHeader",
                            parentActions: [
                                "Mark Safe With Comment Score",
                                "Mark Safe With Post Score",
                            ],
                        }),
                    },
                ],
                helpText:
                    "These settings control the text in comments made by the app. Supports placeholders, see the app's directory page for more information.",
                label: "Comment Customizations",
                type: "group",
            },
            {
                fields: [
                    {
                        defaultValue: "Regarding your recent post to r/{subreddit}",
                        ...textField({
                            blankIsDisabled: false,
                            helpText:
                                "The subject of the message sent to the author. Be mindful of the maximum length. Any text exceeding the max length will be cut off.",
                            label: "Message Subject",
                            maxLength: 100,
                            name: "messageSubject",
                            parentActions: ["Allow Explanation"],
                        }),
                    },
                    {
                        defaultValue:
                            "Thank you for posting to r/{subreddit}.\n\n" +
                            'Hi, I\'ve noticed that you submitted "[{title}]({url})" to r/{subreddit}.\n\n' +
                            "Please reply to this message with a short explanation why your post fits in r/{subreddit}.\n\n" +
                            "- Your reply will be posted by me in the comments section of your post.\n" +
                            "- If you do not reply to this within {replyDuration}, your post will be removed.\n" +
                            "- You have a total of {lateReplyDuration} to reply and get your post re-approved, but" +
                            " please note that your post won't be visible in the meantime if you don't reply within the" +
                            " first {replyDuration}.",
                        ...textField({
                            blankIsDisabled: false,
                            helpText:
                                "Message sent to the author asking for a post explanation.",
                            label: "Message Body",
                            name: "messageBody",
                            parentActions: ["Allow Explanation"],
                            requiredPlaceholders: ["url"],
                        }),
                    },
                    {
                        defaultValue:
                            "Your response has been received! I've added a [comment]({commentUrl}) to your [post]({url}) that includes your explanation.",
                        ...textField({
                            blankIsDisabled: false,
                            helpText:
                                "Message sent to the author when their explanation is accepted.",
                            label: "Explanation Accepted Message Body",
                            name: "explanationAcceptedMessageBody",
                            parentActions: ["Allow Explanation"],
                            requiredPlaceholders: ["commentUrl", "url"],
                        }),
                    },
                    {
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Message sent to the author when their explanation is already accepted.",
                            label: "Explanation Already Accepted Message Body",
                            name: "explanationAlreadyAcceptedMessageBody",
                            parentActions: ["Allow Explanation"],
                        }),
                    },
                    {
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Message sent to the author when their explanation is invalid. Sent when the explanation contains a URL when prohibited and the inverse if required.",
                            label: "Explanation Invalid Message Body",
                            name: "explanationInvalidMessageBody",
                            parentActions: [
                                "Allow Explanation",
                                "Block URLs in Explanation",
                                "Require URLs in Explanation",
                            ],
                        }),
                    },
                    {
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Message sent to the author when their explanation is too late. Sent when the explanation is received after the 'Late Reply Duration' has passed.",
                            label: "Explanation Too Late Message Body",
                            name: "explanationTooLateMessageBody",
                            parentActions: ["Allow Explanation"],
                        }),
                    },
                    {
                        defaultValue:
                            "Your explanation contained only {replyLength} characters; please write a bit more and reply to this message again with the entire explanation.",
                        ...textField({
                            blankIsDisabled: true,
                            helpText:
                                "Message sent to the author when their explanation is denied.",
                            label: "Explanation Too Short Message Body",
                            name: "explanationTooShortMessageBody",
                            parentActions: ["Allow Explanation"],
                        }),
                    },
                ],
                helpText:
                    "These settings control the text in messages to the author. Supports placeholders, see the app's directory page for more information.",
                label: "Message Customizations",
                type: "group",
            },
            {
                ...textField({
                    blankIsDisabled: true,
                    helpText:
                        "Report reason used to report the post after the app's comment fails to meet the minimum score requirements. Be mindful of the maximum length. Any text exceeding the max length will be cut off.",
                    label: "Report Reason",
                    maxLength: 100,
                    name: "reportReason",
                }),
            },
        ],
        label: "Response Customizations",
        type: "group",
    },
    {
        fields: [
            {
                defaultValue: true,
                helpText:
                    "If enabled, the author will be sent a message to provide an explanation for their post.",
                ...booleanField({
                    label: "Allow Explanation",
                    name: "allowExplanation",
                }),
            },
            {
                defaultValue: true,
                helpText: "If enabled, locks the comment the app makes on the post.",
                ...booleanField({
                    label: "Lock Explanation Comment",
                    name: "lockComment",
                }),
            },
            {
                defaultValue: true,
                helpText:
                    "If enabled, if the explanation provided by the author contains a URL, the explanation will be rejected.",
                ...booleanField({
                    label: "Block URLs in Explanation",
                    name: "blockUrlsInExplanation",
                }),
            },
            {
                defaultValue: false,
                helpText:
                    "If enabled, if the explanation provided by the author does not contain a URL, the explanation will be rejected. Ignored if 'Block URLs in Explanation' is enabled.",
                ...booleanField({
                    label: "Require URLs in Explanation",
                    name: "requireUrlInExplanation",
                }),
            },
            {
                defaultValue: 0,
                helpText:
                    "Minimum length required for the author's explanation. Only counts alpha-numeric characters. Set to 0 to disable.",
                ...numberField({
                    label: "Explanation Minimum Length",
                    minValue: 0,
                    name: "messageRequiredLength",
                }),
            },
            {
                defaultValue: true,
                helpText:
                    "If enabled, the explanation provided by the author will be marked as a spoiler. Ignored if 'Allow Explanation' is disabled.",
                ...booleanField({
                    label: "Spoiler Explanation",
                    name: "spoilerExplanation",
                }),
            },
        ],
        helpText:
            "These settings control the requirements of the explanation from the author.",
        label: "Explanation Requirements",
        type: "group",
    },
    {
        defaultValue: "false",
        helpText: "If enabled, the app will log additional information to the console.",
        label: "Debug Mode",
        name: "debugMode",
        scope: "app",
        type: "string",
    },
    {
        defaultValue: CHECK_CRON,
        helpText: "The cron expression to run scheduled check jobs.",
        label: "Check Cron",
        name: "checkCron",
        scope: "app",
        type: "string",
    },
]);

Devvit.addTrigger({
    event: "PostCreate",
    onEvent: handlePost,
});

Devvit.addTrigger({
    event: "ModMail",
    onEvent: handleMessage,
});

Devvit.addTrigger({
    event: "PostDelete",
    onEvent: handleDeletion,
});

Devvit.addTrigger({
    event: "ModAction",
    onEvent: modActionHandler,
});

Devvit.addTrigger({
    events: ["AppInstall", "AppUpgrade"],
    onEvent: appInstalledHandler,
});

Devvit.addTrigger({
    event: "AutomoderatorFilterPost",
    onEvent: handleFilter,
});

Devvit.addMenuItem({
    description:
        "Lookup the modmail thread where the author provided their explanation.",
    forUserType: "moderator",
    label: "Lookup Explanation Modmail",
    location: ["post", "subreddit"],
    onPress: lookupPostHandler,
});

Devvit.addSchedulerJob({
    name: COMMENT_WATCHER,
    onRun: checkComments,
});

Devvit.addSchedulerJob({
    name: POST_WATCHER,
    onRun: checkPosts,
});

Devvit.addSchedulerJob({
    name: RESPONSE_WATCHER,
    onRun: checkResponses,
});

Devvit.addSchedulerJob({
    name: JOB_WATCHER,
    onRun: ensureJobs,
});

// noinspection JSUnusedGlobalSymbols
export default Devvit;
