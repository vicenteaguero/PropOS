import {
  BadgeDollarSign,
  CalendarPlus,
  FilePlus2,
  Handshake,
  HousePlus,
  Link2,
  ListPlus,
  NotebookPen,
  Paperclip,
  Plus,
  Upload,
  UserPlus,
  Workflow,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One icon per action, at one size, at one weight.
 *
 * A bare `Plus` appeared 40 times across 26 files at seven different sizes and
 * five stroke weights, which had two costs. Visually, two buttons side by side
 * drew the same glyph at noticeably different weights. Semantically, "+" says
 * *that* something is created but never *what*, so the four create buttons on
 * the home screen were indistinguishable from each other.
 *
 * `Plus` survives as `addRow` for its honest use: adding one more of something
 * already on screen — a phone number, a checklist item — where the surrounding
 * list already says what is being added.
 */
export const ACTION_ICONS = {
  createEvent: CalendarPlus,
  createTask: ListPlus,
  createNote: NotebookPen,
  createPerson: UserPlus,
  createProperty: HousePlus,
  createDeal: Handshake,
  createDocument: FilePlus2,
  createTransaction: BadgeDollarSign,
  createWorkflow: Workflow,
  upload: Upload,
  link: Link2,
  attach: Paperclip,
  addRow: Plus,
} as const;

export type ActionName = keyof typeof ACTION_ICONS;

/** `sm` sits inside a chip or a row; `md` is the default button icon. */
const SIZES = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;

interface ActionIconProps extends Omit<LucideProps, "ref" | "size"> {
  name: ActionName;
  size?: keyof typeof SIZES;
}

/**
 * Renders the icon for an action. Stroke weight is fixed at 1.9 — the value
 * lucide is drawn for, and the one the home screen already used — so a caller
 * cannot make one button heavier than the one beside it.
 */
export function ActionIcon({ name, size = "md", className, ...rest }: ActionIconProps) {
  const Icon = ACTION_ICONS[name];
  return <Icon aria-hidden className={cn(SIZES[size], className)} strokeWidth={1.9} {...rest} />;
}
