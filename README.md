# ExplainYourself

ExplainYourself is an app that allows you to require an explanation whenever a user posts in your subreddit.

## Usage

After installation, ExplainYourself will run in the background and automatically act on new posts. There is a post and
subreddit context menu option to look up the associated modmail conversation where the author was asked for an
explanation for a post.

## How it Works

When a user posts to your subreddit, it will do the following:

- If 'Post Exclusion Regex' is set, the post will be checked against the regex pattern. If the post title and/or body
  matches the pattern, the post will be ignored.
- If 'Post Flair List' is set, the post's flair will be checked against the set post flair IDs. If the post's flair is
  one of these IDs, the post be ignore/processed based on 'Post Flair List Type'.
- If 'Explanation Pending Comment' is set, a comment with the contents of 'Explanation Pending Comment' will be added to
  their post and locked it if 'Lock Explanation Comment' is enabled.
    - This is to prompt the community that OP is going to provide an explanation. This can also be used to ask the
      community to 'upvote the comment if the post is good or downvote if not' without an explanation.
- If 'Allow Explanation' is enabled, it will send a message from the subreddit to the user asking for an explanation.
    - If 'Reply Duration' is set, the user has that amount of time to reply with an explanation. If the user does not
      reply within that time, the post will be removed.
    - If 'Late Reply Duration' is set, the user has that amount of time to reply with an explanation after the post has
      been removed for exceeding the 'Reply Duration'. If the user replies within that time, the post will be approved.
    - The modmail conversation will be archived.

When the user replies to the modmail with an explanation:

- If 'Explanation Minimum Length' is set, the explanation must be at least that many characters long. Only alphanumeric
  characters are counted.
    - If the explanation is too short, the user will be sent a message with the contents of 'Explanation Too Short
      Message Body'.
- If 'Block URLs in Explanation' is enabled, the explanation will be rejected if it contains a URL.
    - If the explanation is rejected, the user will be sent a message with the contents of 'Explanation Invalid Message
      Body'.
- If 'Require URL in Explanation' is enabled, the explanation must contain a URL.
    - If the explanation does not contain a URL, the user will be sent a message with the contents of 'Explanation
      Invalid Message Body'.
- If the explanation is valid, the user will be sent a message with the contents of 'Explanation Accepted Message Body'.
    - A comment will be posted on the user's post with the contents of 'Explanation Accepted Comment' and locked it if
      'Lock Explanation Comment' is enabled.
- If an explanation is received after an explanation has already been accepted, the user will be sent a message with the
  contents of 'Explanation Already Accepted Message Body'.
- If the explanation is received after the 'Late Reply Duration' has passed, the user will be sent a message with the
  contents of 'Explanation Too Late Message Body'.
- The modmail conversation will be archived.

After the comment has been added to the user's post:

- At any time after the post or comment is created:
    - If the post or the comment with the explanation is removed, the comment score will no longer be checked.
    - If the post is approved, the comment score will no longer be checked.
- After the duration set in 'Comment Minimum Age' has passed:
    - If 'Mark Safe With Comment Score' is enabled, the post will be marked as safe if the comment score is above the
      specified threshold.
        - Safe means the comment will no longer be checked and won't be actioned on any further.
    - If the comment score is below the configured threshold:
        - If 'Remove With Comment Score' is enabled, the post will be removed.
        - If 'Report With Comment Score' is enabled, the post will be reported with the contents of 'Report Reason'.
    - If 'Approve With Comment Score' is enabled, the post will be approved and marked as safe if the comment score is
      above the specified threshold.
    - If 'Approve With Post Score' is enabled, the post will be approved if the post score is above the specified
      threshold.
    - If 'Mark Safe With Post Score' is enabled, the post will be marked as safe if the post score is above the
      specified threshold.
- After the duration set in 'Comment Maximum Age' has passed:
    - The post will be marked as safe, and the comment score will no longer be checked.

After the post has been marked as safe:

- If 'Post Marked Safe Comment Header' is set, a comment with the contents of 'Post Marked Safe Comment Header' will be
  prepended to the comment.

After the post has been removed:

- If 'Post Removal Comment Header' is set, a comment with the contents of 'Post Removal Comment Header' will be
  prepended to the comment.

If the post is filtered by AutoModerator and then approved by a moderator, the post will be treated as a new post and
the app will act on it as if it was just created.

If the post or app's comment is removed then approved by a moderator, the post will accept explanations if an
explanation was not already accepted prior to removal.

If the app's comment is removed, the post will be considered safe and the app will stop enforcing checks.

If the post author is a moderator and the post is approved, consider the post as safe and stop enforcing checks.

## Configuration

After installing, you can configure the following options on the app's settings
page: https://developers.reddit.com/r/<SUBREDDIT>/post-explainer

### Configuration Options

#### Removal Settings

- **Remove With Comment Score**: If enabled, removes the post if the comment score fails to meet the minimum score
  requirements. Ignored if 'Use Score Ratio' is enabled.
- **Report With Comment Score**: If enabled, reports the comment if the comment score fails to meet the minimum score
  requirements. Either this or 'Remove With Comment Score' must be enabled, otherwise the app won't do anything with
  posts that fail the comment score requirements.
- **Removal Score**: Comment score at which the post is removed. Must be less than 1 otherwise the post will be removed
  immediately. Required if 'Remove Post' is enabled. Ignored if 'Use Score Ratio' is enabled.
- **Use Score Ratio**: If enabled, the removal score is calculated using a ratio based on the comment score and age of
  the post in hours. See the 'Using a Moving Score' section below for more information.
- **Removal Score Ratio Base**: Removal score ratio base. See the app's directory page for more information on how this
  functionality works. Ignored if 'Use Score Ratio' is disabled.
- **Removal Score Ratio Offset**: Removal score ratio offset. See the app's directory page for more information on how
  this functionality works. Ignored if 'Use Score Ratio' is disabled.

#### Safe Settings

- **Mark Safe With Comment Score**: If enabled, marks the post as safe if the comment score is above the specified
  threshold.
- **Comment Safe Score**: Comment score at which the post is marked as safe. Must be higher than 1 otherwise the post
  will be marked as safe immediately. Ignored if 'Mark Safe With Comment Score' is disabled.
- **Mark Safe With Post Score**: If enabled, marks the post as safe if the post score is above the specified 'Post Safe
  Score' threshold.
- **Post Safe Score**: Post score at which the post is marked as safe. Must be higher than 1 otherwise the post will be
  marked as safe immediately. Ignored if 'Mark Safe With Post Score' is disabled.

#### Approval Settings

- **Approve With Comment Score**: If enabled, allows the post to be approved if the comment score goes above the
  specified threshold.
- **Comment Approval Score**: Comment score at which the post is approved. Must be higher than 1 otherwise the post will
  be approved immediately. Ignored if 'Approve With Comment Score' is disabled.
- **Approve With Post Score**: If enabled, allows the post to be approved if the post score is goes above the specified
  threshold.
- **Post Approval Score**: Post score at which the post is approved. Must be higher than 1 otherwise the post will be
  approved immediately. Ignored if 'Approve With Post Score' is disabled.

#### Post Exclusion Settings

- **Post Exclusion Regex**: Regex pattern to exclude certain posts from the app's actions.
- **Post Exclusion Type**: The type of content to apply the exclusion regex to. Options are 'Title' or 'Body', multiple
  can be selected.

#### Flair Settings

- **Post Flair List**: Post flair IDs to check against. If the post's flair is one of these IDs, the post will be
  ignored/processed based on 'Post Flair List Type'. Post flair IDs can be found here (replace SUBREDDIT with your
  subreddit): https://www.reddit.com/mod/SUBREDDIT/postflair and hovering your mouse over/tapping the desired flair and
  clicking 'Copy ID'.
- **Post Flair List Type**: The type of action to take if the post flair matches. Options are 'Inclusion' or
  'Exclusion'.

#### Action Settings

- **Comment Minimum Age**: Minimum duration before the comment score is checked. Set to 0 to disable. Maximum: 1440 (24
  Hours).
- **Comment Maximum Age**: Maximum duration the comment score is checked. Maximum: 4320 (72 Hours).
- **Reply Duration**: The duration the author has to reply with a suitable explanation before their post is removed. Set
  to 0 to disable. Maximum: 4320 (72 Hours).
- **Late Reply Duration**: The duration the author has to reply with a suitable explanation after their post was removed
  for failure to reply within the initial 'Reply Duration'. Late replies will cause the post to be approved. Set to 0 to
  disable. Maximum: 4320 (72 Hours).

#### Comment Customizations

- **Explanation Pending Comment**: Comment to be posted when the author's explanation is pending acceptance. This can
  also be used as a 'Upvote this comment if the post is good or downvote if not' comment without explanation.
- **Explanation Accepted Comment**: Comment to be posted when the author's explanation is accepted. Leave blank to
  disable. Ignored if 'Allow Explanation' is disabled.
- **Post Removal Comment Header**: Header that is prepended to the comment when the post is removed due to insufficient
  comment score. Leave blank to disable. Ignored if 'Remove With Comment Score' is disabled.
- **Post Marked Safe Comment Header**: Header that is prepended to the comment when the post is marked as safe. Leave
  blank to disable. Ignored if 'Mark Safe With Comment Score' and 'Mark Safe With Post Score' are disabled.

#### Message Customizations

The following settings are ignored if 'Allow Explanation' is disabled.

- **Message Subject**: The subject of the message sent to the author. This will be prefixed with the post ID (e.g.,
  `[t3_1a2b3c]: `). Be mindful of the maximum length. Any text exceeding the max length will be cut off. Max length
  is 100.
- **Message Body**: Message sent to the author asking for a post explanation.
- **Explanation Accepted Message Body**: Message sent to the author when their explanation is accepted.
- **Explanation Already Accepted Message Body**: Message sent to the author when their explanation is already accepted.
- **Explanation Invalid Message Body**: Message sent to the author when their explanation is invalid. Sent when the
  explanation contains a URL. Leave blank to disable.
- **Explanation Too Late Message Body**: Message sent to the author when their explanation is too late. Sent when the
  explanation is received after the 'Late Reply Duration' has passed. Leave blank to disable.
- **Explanation Too Short Message Body**: Message sent to the author when their explanation is denied. Leave blank to
  disable.

#### Response Customizations

- **Report Reason**: Report reason used to report the post after the app's comment fails to meet the minimum score
  requirements. Be mindful of the maximum length. Any text exceeding the max length will be cut off. Max length is 100.
  Ignored if 'Report With Comment Score' is disabled.

#### Explanation Requirements

- **Allow Explanation**: If enabled, the author will be sent a message to provide an explanation for their post.
- **Lock Explanation Comment**: If enabled, locks the comment the app makes on the post.
- **Block URLs in Explanation**: If enabled, if the explanation provided by the author contains a URL, the explanation
  will be rejected.
- **Require URL in Explanation**: If enabled, the author must provide a URL in their explanation. If the explanation
  does not contain a URL, it will be rejected.
- **Explanation Minimum Length**: Minimum length required for the author's explanation. Only counts alphanumeric
  characters. Set to 0 to disable.
- **Spoiler Explanation**: If enabled, the explanation provided by the author will be marked as a spoiler. Ignored if
  'Allow Explanation' is disabled. If disabled, the explanation will be in a quote block.

### Placeholders

The following fields support placeholders:

- Explanation Accepted Comment
- Explanation Pending Comment
- Post Marked Safe Comment Header
- Post Removal Comment Header
- Message Body
- Message Subject
- Explanation Accepted Message Body
- Explanation Already Accepted Message Body
- Explanation Invalid Message Body
- Explanation Too Late Message Body
- Explanation Too Short Message Body
- Report Reason

Most Moderator Toolbox placeholders are also supported.

- `{author}`
    - The author of the post without u/ or /u/.
    - Example: `ReallyRickAstley`
- `{commentUrl}`
    - The URL of the comment the app made on the post. Only usable and required in the 'Explanation Accepted Message
      Body' response text.
    - Example: `https://www.reddit.com/r/pics/comments/haucpf/comment/fv6ejit/`
- `{explanation}`
    - The location for the explanation from the user to fill in. Only usable and required in the 'Explanation Accepted
      Comment' response text.
    - Example: `This is from my 1st tour in 89, backstage in Vegas. I figured you all would enjoy it.`
- `{lateReplyDuration}`
    - The late reply duration converted from minutes to a human-readable duration. For example, if 'Late Reply Duration'
      is set to `70` then this will be filled in as "1 hour 10 minutes".
    - Example: `1 hour 10 minutes`
- `{link}`
    - The destination link of the post.
    - Example: `https://i.redd.it/f58v4g8mwh551.jpg`
- `{replyDuration}`
    - The reply duration converted from minutes to a human-readable duration. For example, if 'Reply Duration' is set to
      `10` then this will be filled in as "10 minutes".
    - Example: `10 minutes`
- `{replyLength}`
    - The length of the explanation sent by the author. Only usable in the 'Explanation Too Short Message Body' response
      text.
    - Example: `65`
- `{score}`
    - The score of the post at the time of the placeholder being filled in.
    - Example: `438828`
- `{subreddit}`
    - Name of the subreddit without the r/ or /r/.
    - Example: `pics`
- `{title}`
    - The title of the post.
    - Example: `I've found a few funny memories during lockdown. This is from my 1st tour in 89, backstage in Vegas.`
- `{url}`
    - The Reddit permalink to the post. Required in the 'Explanation Accepted Message Body' response text.
    - Example: `https://www.reddit.com/r/pics/comments/haucpf/ive_found_a_few_funny_memories_during_lockdown/`

**Note:** If you use a placeholder in a field that does not support it, the placeholder will not be filled in and will
be displayed as is.

## Score Requirement Configuration

You can set a fixed score or use a moving score requirement for the minimum score required for a post to not be removed.

### Using a Fixed Score

You can set a fixed score for the minimum score required for a post to not be removed. This is a static value that does
not change based on the age of the post. The score requirement is set in the 'Removal Score' field in the app's settings
page.

### Using a Moving Score

Using this equation, you can have a moving minimum score required for a post to not be removed based on how old it is.
The equation is:

    floor((removalScoreRatioBase/10)^(ageInHours - 1) - removalScoreRatioOffset)

This equation is used to calculate the minimum score required for a post to not be removed. The `ageInHours` is the age
of the post in hours. The `removalScoreRatioBase` is the base value for the equation and the `removalScoreRatioOffset`
is the absolute minimum score required for a post to not be removed. The floor function is used to round down to the
nearest whole number.

You can view a graph of this equation [here](https://www.desmos.com/calculator/np9njkfcni) where you can adjust the
`removalScoreRatioBase` (b) and `removalScoreRatioOffset` (o) values using the two sliders to see how it affects the
curve. In this example, the `removalScoreRatioBase` is the variable `b` and is 16 by default and the
`removalScoreRatioOffset` is the variable `o` and is 6 by default. Any posts with a score below the curve will be
removed. Using this system, the minimum score required for a post to not be removed will increase as the post gets
older.

## Feedback

If you have any feedback or suggestions for BanHammer, file a bug report or feature request on the
[GitHub page](https://github.com/LilSpazJoekp/explain-yourself).

## Changes

## 1.2.13

- When app comment is removed, consider the post as safe and stop enforcing checks.
- Don't attempt to archive mod only modmail conversations.
- If the post author is a moderator and the post is approved, consider the post as safe and stop enforcing checks.
- Don't leave a private mod note if the modmail conversation doesn't exist.

### 1.2.5

- Move post ID to the end of the message subject.

### 1.2.4

- Fix a bug where the app would infinitely loop when removing a post that failed to meet requirements.
- Add retry logic when performing certain actions to mitigate transient errors.
- Fix a bug where some settings were not being validated correctly.

### 1.2.0

- Update devvit version.
- Fix an issue where the post inclusion/exclusion via flair feature was not functioning at all.
- Add a more descriptive error message when a reply is received after the post is no longer eligible for an
  explanation.
- Fix a typo in the error response message.
- Add handling for post approvals after being filtered by AutoModerator. The post will be treated as a new post and the
  app will act on it as if it was just created.
- Add handling for accidental post and bot comment removals by a moderator. The post will accept explanations if an
  explanation was not already accepted prior to removal.

### 1.1.5

- Fix an issue where the app would not respect 'Reply Duration' and 'Late Reply Duration' when set to 0 and would
  erroneously reject explanations.
- Fix an issue where modmails would not be automatically archived when certain response text values were not set.

### 1.1.4

- Fix an issue where if the author replies to the modmail conversation after their explanation has been accepted, they
  would not be sent the message with the contents of 'Explanation Already Accepted Message Body'.
- Fix an issue where modmail conversations were not being auto-archived.
- Fix an issue where some settings were set to invalid default values.

### 1.1.3

- Update devvit version.
- Add post ID to the message subject so each new post has a unique conversation. This is to prevent the same
  conversation from being reused for different posts.
- Add private note logging to the modmail conversation when specific events occur.

### 1.1.0

- Make RegEx pattern matching case-insensitive.
- Add the ability to require a URL in the explanation.
- Add the ability to exclude/exclude posts based on post flair ID.

### 1.0.4

- Update devvit version.
- Attempt to archive the modmail conversation when the user is asked for an explanation.
- Ignore messages that are not from the post author when checking for explanations.

### 1.0.3

- Update devvit version for vulnerability fix.

### 1.0.2

- Add mention of modmail conversation lookup in the post and subreddit context menus to the README.

### 1.0.0

- Initial release.
