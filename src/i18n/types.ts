import type { en } from "./messages/en";

type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

/** The shape every catalog must have: the keys of `en`, with string values. */
export type Messages = DeepString<typeof en>;

type Leaves<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Dot-separated message key, e.g. `"projects.customMod.create"`. */
export type MessageKey = Leaves<Messages>;

export type MessageVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: MessageVars) => string;
