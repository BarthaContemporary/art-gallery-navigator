/*
 * The studio's icons: Tabler's outline set (@tabler/icons-react, MIT), drawn
 * at the website's stroke weight (1.7, as its search glyph in
 * apps/web/src/components/site-header.tsx) so the two read as one family.
 *
 * Use these wrappers, never a Tabler icon directly and never a glyph (⚑ ▦ ☾ ✕)
 * or emoji standing in for one: the wrapper fixes the stroke, inherits the
 * text colour (currentColor) and hides the icon from assistive technology.
 * An icon is decoration next to a word. Where it is the only content (an
 * icon-only button), the label belongs to the control, through
 * <Button iconOnly label="…">, not to the icon.
 *
 * Props (every icon):
 *   size       px, default 16 (14 inside small buttons and table heads).
 *   className  extra classes; colour comes from the text colour.
 *   style      inline style.
 *   title      only for an icon that stands alone and carries meaning (it
 *              then gets role="img" and is announced). Rare.
 *
 * To add an icon: pick the outline name at https://tabler.io/icons, import it
 * below and wrap it with icon(). Next.js tree-shakes the named imports.
 */
import type { CSSProperties } from "react";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBold,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCopy,
  IconDots,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFileText,
  IconFilter,
  IconFlag,
  IconGripVertical,
  IconH2,
  IconH3,
  IconInfoCircle,
  IconItalic,
  IconKey,
  IconLink,
  IconList,
  IconListNumbers,
  IconLock,
  IconMail,
  IconMenu2,
  IconMinus,
  IconMoon,
  IconPencil,
  IconPhoto,
  IconPilcrow,
  IconPlus,
  IconPrinter,
  IconRefresh,
  IconRotate,
  IconRotateClockwise,
  IconSearch,
  IconSelector,
  IconSun,
  IconTrash,
  IconUnderline,
  IconUpload,
  IconWorld,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";

export type IconProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/** The website's stroke weight. */
const STROKE = 1.7;

function icon(Tabler: TablerIcon, name: string) {
  function StudioIcon({ size = 16, className, style, title }: IconProps) {
    return (
      <Tabler
        size={size}
        stroke={STROKE}
        className={className}
        style={style}
        title={title}
        role={title ? "img" : undefined}
        aria-hidden={title ? undefined : true}
        focusable="false"
      />
    );
  }
  StudioIcon.displayName = name;
  return StudioIcon;
}

// Navigation and disclosure
export const ArrowLeftIcon = icon(IconArrowLeft, "ArrowLeftIcon");
export const ArrowRightIcon = icon(IconArrowRight, "ArrowRightIcon");
export const ChevronDownIcon = icon(IconChevronDown, "ChevronDownIcon");
export const ChevronUpIcon = icon(IconChevronUp, "ChevronUpIcon");
export const ChevronLeftIcon = icon(IconChevronLeft, "ChevronLeftIcon");
export const ChevronRightIcon = icon(IconChevronRight, "ChevronRightIcon");
export const ExternalIcon = icon(IconExternalLink, "ExternalIcon");
export const MenuIcon = icon(IconMenu2, "MenuIcon");
export const MoreIcon = icon(IconDots, "MoreIcon");

// Actions
export const SearchIcon = icon(IconSearch, "SearchIcon");
export const CloseIcon = icon(IconX, "CloseIcon");
export const CheckIcon = icon(IconCheck, "CheckIcon");
export const PlusIcon = icon(IconPlus, "PlusIcon");
export const MinusIcon = icon(IconMinus, "MinusIcon");
export const EditIcon = icon(IconPencil, "EditIcon");
export const TrashIcon = icon(IconTrash, "TrashIcon");
export const UploadIcon = icon(IconUpload, "UploadIcon");
export const DownloadIcon = icon(IconDownload, "DownloadIcon");
export const RefreshIcon = icon(IconRefresh, "RefreshIcon");
export const RotateIcon = icon(IconRotateClockwise, "RotateIcon");
/** Anticlockwise (Tabler's plain "rotate"). */
export const RotateLeftIcon = icon(IconRotate, "RotateLeftIcon");
export const CopyIcon = icon(IconCopy, "CopyIcon");
export const LinkIcon = icon(IconLink, "LinkIcon");
export const PrintIcon = icon(IconPrinter, "PrintIcon");
export const MailIcon = icon(IconMail, "MailIcon");
export const FilterIcon = icon(IconFilter, "FilterIcon");
export const GripIcon = icon(IconGripVertical, "GripIcon");

// Text formatting (the maker profile's toolbar)
export const BoldIcon = icon(IconBold, "BoldIcon");
export const ItalicIcon = icon(IconItalic, "ItalicIcon");
export const UnderlineIcon = icon(IconUnderline, "UnderlineIcon");
export const HeadingIcon = icon(IconH2, "HeadingIcon");
export const SubheadingIcon = icon(IconH3, "SubheadingIcon");
export const ParagraphIcon = icon(IconPilcrow, "ParagraphIcon");
export const ListIcon = icon(IconList, "ListIcon");
export const NumberedListIcon = icon(IconListNumbers, "NumberedListIcon");

// Things and states
export const FlagIcon = icon(IconFlag, "FlagIcon");
export const KeyIcon = icon(IconKey, "KeyIcon");
export const LockIcon = icon(IconLock, "LockIcon");
export const CalendarIcon = icon(IconCalendar, "CalendarIcon");
export const ImageIcon = icon(IconPhoto, "ImageIcon");
export const FileIcon = icon(IconFileText, "FileIcon");
export const EyeIcon = icon(IconEye, "EyeIcon");
export const WebsiteIcon = icon(IconWorld, "WebsiteIcon");
export const InfoIcon = icon(IconInfoCircle, "InfoIcon");
export const AlertIcon = icon(IconAlertTriangle, "AlertIcon");
export const SunIcon = icon(IconSun, "SunIcon");
export const MoonIcon = icon(IconMoon, "MoonIcon");

/** Unsorted column: both directions available. Sorted columns use ChevronUp/Down. */
export const SortIcon = icon(IconSelector, "SortIcon");

/** Every icon by name, for the /ui-kit page. */
export const ICONS = {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalIcon,
  MenuIcon,
  MoreIcon,
  SearchIcon,
  CloseIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  EditIcon,
  TrashIcon,
  UploadIcon,
  DownloadIcon,
  RefreshIcon,
  RotateIcon,
  RotateLeftIcon,
  CopyIcon,
  LinkIcon,
  PrintIcon,
  MailIcon,
  FilterIcon,
  GripIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  HeadingIcon,
  SubheadingIcon,
  ParagraphIcon,
  ListIcon,
  NumberedListIcon,
  FlagIcon,
  KeyIcon,
  LockIcon,
  CalendarIcon,
  ImageIcon,
  FileIcon,
  EyeIcon,
  WebsiteIcon,
  InfoIcon,
  AlertIcon,
  SunIcon,
  MoonIcon,
  SortIcon,
} as const;
