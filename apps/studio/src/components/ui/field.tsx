"use client";

/*
 * Form fields (spec section 4). Native, uncontrolled elements with the .field
 * look. Every prop, name and defaultValue above all, goes straight to the
 * element, so `new FormData(form)` carries exactly what it did with a bare
 * <input>, and the CLAUDE.md autosave rule (field names parsed by the PATCH
 * route and savePiece) is untouched. Nothing here holds state.
 *
 *   <Field label hint? error? optional? id? className?>  one control
 *     Renders the label above the control (never a placeholder as the only
 *     label), then the hint, then the error. It makes an id with useId (or
 *     uses `id`) and hands it to the Input/Select/Textarea inside, which take
 *     it as their id, add the hint and error ids to aria-describedby, and set
 *     aria-invalid when there is an error. Put `id` on the Field, not on the
 *     control, when you need a fixed one.
 *       error     a message: danger bottom rule on the control, text below.
 *       optional  adds "(optional)" after the label.
 *
 *   <Input fieldSize? …input props>       .field; fieldSize "sm" is the 28px
 *   <Select fieldSize? …select props>     filter-bar size.
 *   <Textarea …textarea props>            grows vertically, 88px minimum.
 *   <Checkbox label? hint? …input props>  a native checkbox (ink via
 *   <Radio label? hint? …input props>     accent-color) with its label to the
 *                                         right; without `label`, pass aria-label.
 *   <Label …label props>                  the label style on its own, for a
 *                                         control these do not wrap.
 *
 * Outside a Field the controls work alone (give them an aria-label or your own
 * <label htmlFor>).
 */
import { createContext, useContext, useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { cx } from "./cx";

type FieldWiring = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldWiring | null>(null);

export function Field({
  label,
  hint,
  error,
  optional = false,
  id: idProp,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="label">
        {label}
        {optional ? <span className="font-normal normal-case tracking-normal"> (optional)</span> : null}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>{children}</FieldContext.Provider>
      {hint ? (
        <p id={hintId} className="text-[12px] leading-[1.4] text-meta">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[12px] leading-[1.4] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** id, aria-describedby and aria-invalid from the surrounding Field; the control's own win. */
function useWiring(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: ComponentPropsWithRef<"input">["aria-invalid"] }) {
  const field = useContext(FieldContext);
  const describedBy = [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid ? true : undefined),
  };
}

export type FieldSize = "md" | "sm";

export function Input({
  fieldSize = "md",
  className,
  ...props
}: ComponentPropsWithRef<"input"> & { fieldSize?: FieldSize }) {
  const wiring = useWiring(props);
  return <input {...props} {...wiring} className={cx("field", fieldSize === "sm" && "field-sm", className)} />;
}

export function Select({
  fieldSize = "md",
  className,
  ...props
}: ComponentPropsWithRef<"select"> & { fieldSize?: FieldSize }) {
  const wiring = useWiring(props);
  return <select {...props} {...wiring} className={cx("field", fieldSize === "sm" && "field-sm", className)} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  const wiring = useWiring(props);
  return <textarea {...props} {...wiring} className={cx("field", className)} />;
}

type ChoiceProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  label?: ReactNode;
  hint?: ReactNode;
};

function Choice({ type, label, hint, className, ...props }: ChoiceProps & { type: "checkbox" | "radio" }) {
  const hintId = useId();
  const input = (
    <input
      {...props}
      type={type}
      aria-describedby={cx(props["aria-describedby"], hint ? hintId : undefined) || undefined}
      className={cx("mt-[2px] h-4 w-4 shrink-0", !label && className)}
    />
  );
  if (!label) return input;
  return (
    <label
      className={cx(
        "flex w-fit max-w-full items-start gap-2 text-[13px] leading-[1.45] text-ink",
        props.disabled ? "cursor-not-allowed text-meta" : "cursor-pointer",
        className,
      )}
    >
      {input}
      <span className="min-w-0">
        {label}
        {hint ? (
          <span id={hintId} className="block text-[12px] text-meta">
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Checkbox(props: ChoiceProps) {
  return <Choice {...props} type="checkbox" />;
}

export function Radio(props: ChoiceProps) {
  return <Choice {...props} type="radio" />;
}

export function Label({ className, ...props }: ComponentPropsWithRef<"label">) {
  return <label {...props} className={cx("label", className)} />;
}
