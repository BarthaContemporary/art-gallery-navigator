/**
 * The part of Sanity's validation Rule these schemas use, typed loosely so
 * they stay plain objects with no `sanity` import (see sanity/README.md).
 *
 * Warnings show on the document but never block publishing: imported
 * documents that lack a field can still be published over an unrelated
 * edit. Only a plain contradiction (an end date before the start) is an
 * error. Rules apply to new edits only; existing documents are not checked
 * until someone opens them.
 */
export interface RuleLike {
  required(): RuleLike;
  warning(message?: string): RuleLike;
  error(message?: string): RuleLike;
  custom(
    fn: (value: unknown, context: { parent?: Record<string, unknown> | undefined }) => true | string,
  ): RuleLike;
}

/** A field the site needs, as a warning with the reason. */
export const wanted = (message: string) => (Rule: RuleLike) => Rule.required().warning(message);
