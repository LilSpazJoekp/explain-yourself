import { SettingsClient, SettingsFormFieldValidatorEvent } from "@devvit/public-api";
import {
    ExplainYourselfSettings,
    FieldParams,
    NumberFieldParams,
    Placeholder,
    TextFieldParams,
} from "./_types.js";
import { DEFAULT_RETRIES } from "./consts.js";

export function numberField(params: FieldParams & NumberFieldParams): {
    label: string;
    name: string;
    onValidate?: (event: SettingsFormFieldValidatorEvent<number>) => string | undefined;
    type: "number";
} {
    return {
        label: params.label,
        name: params.name,
        onValidate:
            params.minValue !== undefined || params.maxValue !== undefined
                ? validatedRange(params.label, params.maxValue, params.minValue)
                : undefined,
        type: "number",
    } as {
        label: string;
        name: string;
        onValidate?: (
            event: SettingsFormFieldValidatorEvent<number>,
        ) => string | undefined;
        type: "number";
    };
}

export function booleanField(params: FieldParams): {
    label: string;
    name: string;
    type: "boolean";
} {
    return {
        label: params.label,
        name: params.name,
        type: "boolean",
    };
}

export async function resolveSettings<T extends keyof ExplainYourselfSettings>(
    settingsClient: SettingsClient,
    ...names: T[]
): Promise<Pick<ExplainYourselfSettings, T>> {
    const settings: Partial<ExplainYourselfSettings> = {};
    const allSettings = await settingsClient.getAll<ExplainYourselfSettings>();
    names.map((name) => {
        settings[name] = allSettings[name];
    });
    return settings as Pick<ExplainYourselfSettings, T>;
}

export async function resolveSetting<T extends keyof ExplainYourselfSettings>(
    settingsClient: SettingsClient,
    name: T,
): Promise<ExplainYourselfSettings[T]> {
    return (await settingsClient.get(name)) as ExplainYourselfSettings[T];
}

function validatedRange(
    fieldName: string,
    maxValue?: number,
    minValue?: number,
): (event: SettingsFormFieldValidatorEvent<number>) => string | undefined {
    return (event: SettingsFormFieldValidatorEvent<number>) => {
        if (
            event.value === undefined ||
            (maxValue !== undefined && event.value > maxValue) ||
            (minValue !== undefined && event.value < minValue)
        ) {
            if (maxValue !== undefined && minValue === undefined) {
                return `${fieldName} must be at most ${maxValue}.`;
            }
            if (minValue !== undefined && maxValue === undefined) {
                return `${fieldName} must be at least ${minValue}.`;
            }
            return `${fieldName} must be between ${minValue} and ${maxValue}.`;
        }
    };
}

function validatedLength(
    fieldName: string,
    maxLength: number,
): (event: SettingsFormFieldValidatorEvent<string>) => string | undefined {
    return (event: SettingsFormFieldValidatorEvent<string>) => {
        if (event.value !== undefined && event.value.length > maxLength) {
            return `${fieldName} must be at most ${maxLength} characters long.`;
        }
    };
}

function validatedPlaceholders(
    fieldName: string,
    placeholders: (keyof typeof Placeholder)[],
): (event: SettingsFormFieldValidatorEvent<string>) => string | undefined {
    return (event: SettingsFormFieldValidatorEvent<string>) => {
        const missingPlaceholders = placeholders.filter(
            (placeholder) => !(event.value || "").includes(`{${placeholder}}`),
        );
        if (missingPlaceholders.length > 0) {
            return `The following placeholders are required in ${fieldName}: ${humanList(
                missingPlaceholders.map((placeholder) => `{${placeholder}}`),
                "and",
            )}`;
        }
    };
}

export function humanList(items: string[], separator: string): string {
    if (items.length === 0) {
        return "";
    }
    if (items.length === 1) {
        return `'${items[0]}'`;
    }
    const workingItems = items.slice();
    const last = workingItems.pop();
    return `'${workingItems.filter((value) => value.length > 0).join("', '")}${
        workingItems.length > 1 ? `', ${separator} '` : `' ${separator} '`
    }${last}'`;
}

export function textField(params: TextFieldParams): {
    helpText: string;
    label: string;
    lineHeight?: number;
    name: string;
    type: "paragraph" | "string";
    onValidate?: (event: SettingsFormFieldValidatorEvent<string>) => string | undefined;
} {
    let helpText = params.helpText;
    const parentActions = params.parentActions ? params.parentActions : [];
    const multipleActions = parentActions.length > 1;
    if (parentActions.length > 0) {
        helpText += ` ${!params.blankIsDisabled ? "Required" : "Ignored"} if the ${humanList(
            parentActions,
            "and",
        )} setting${
            multipleActions ? "s" : ""
        } ${multipleActions ? "are" : "is"} ${!params.blankIsDisabled ? "enabled" : "disabled"}.`;
    }
    if (params.blankIsDisabled) {
        helpText += " Leave blank to disable.";
    }
    const data: {
        helpText: string;
        label: string;
        lineHeight?: number;
        name: string;
        type: "string" | "paragraph";
        onValidate?: (
            event: SettingsFormFieldValidatorEvent<string>,
        ) => string | undefined;
    } = {
        helpText: helpText,
        label: params.label,
        name: params.name,
        type: params.fieldType ? params.fieldType : "paragraph",
    };
    if (params.fieldType === "paragraph") {
        data.lineHeight = 6;
    }
    const validators: ((
        event: SettingsFormFieldValidatorEvent<string>,
    ) => string | undefined)[] = [];
    if (!params.blankIsDisabled) {
        validators.push((event: SettingsFormFieldValidatorEvent<string>) => {
            if (event.value === undefined || event.value.trim().length === 0) {
                return `${params.label} is required.`;
            }
        });
    }
    if (params.maxLength !== undefined) {
        data.helpText += ` Maximum length: ${params.maxLength} characters.`;
        validators.push(validatedLength(params.label, params.maxLength));
    }
    if (params.requiredPlaceholders && params.requiredPlaceholders.length > 0) {
        data.helpText += ` Required placeholders: ${humanList(params.requiredPlaceholders, "and")}.`;
        validators.push(
            validatedPlaceholders(params.label, params.requiredPlaceholders),
        );
    }
    if (validators.length > 0) {
        data.onValidate = (
            event: SettingsFormFieldValidatorEvent<string>,
        ): string | undefined => {
            return validators
                .map((validator) => validator(event))
                .find((error) => error !== undefined);
        };
    }
    return data;
}

export function humanDuration(minutes: number): string {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const remainingMinutes = Math.floor(minutes % 60);
    const parts = [];
    if (days > 0) {
        parts.push(`${days} day${days === 1 ? "" : "s"}`);
    }
    if (hours > 0) {
        parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
    }
    if (remainingMinutes > 0) {
        parts.push(`${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`);
    }
    return parts.length > 0 ? parts.join(" ") : "0 minutes";
}

export async function withRetries<T>(
    fn: () => Promise<T> | T,
    retries: number = DEFAULT_RETRIES,
): Promise<T> {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            console.debug(`Attempt ${attempt} failed: ${error}`);
            if (attempt > retries) {
                console.error(`All ${retries} retries failed.`);
                throw error;
            }
            console.log(`Waiting ${attempt} seconds before retrying...`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
        console.debug(`Retrying attempt ${attempt + 1}...`);
    }
}
