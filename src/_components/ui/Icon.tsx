import {
  ArrowUpDown, Bell, Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, Clock, Columns3,
  Download, Ellipsis, FileText, Flag, Folder, Hash, House, Image, Info, KeyRound, Link, List, ListFilter, Lock, LogOut,
  Mail, Menu, MessageSquare, Mic, MicOff, PanelLeft, Paperclip, Pencil, Plus, Reply, Search, Shield, SlidersHorizontal,
  NotebookPen, SendHorizontal, Pin, PinOff, ChartLine, TriangleAlert, Bold, Italic, Strikethrough, Heading1, Heading2, ListOrdered, ListChecks, Quote, Code, Minus, Eye, Columns2, PenLine, Table,
  Smile, Square, SquareKanban, Trash2, User, Users, Video, X, type LucideIcon,
} from "lucide-react";

/**
 * Ícones do app (Lucide: https://lucide.dev). Só entram no pacote os que estão aqui.
 * Os nomes antigos continuam os mesmos, então nenhuma tela precisou mudar.
 */
const ICONS = {
  download: Download, file: FileText, flag: Flag, clip: Paperclip, filter: ListFilter, sort: ArrowUpDown, list: List,
  kanban: SquareKanban, image: Image, info: Info, mic: Mic, micOff: MicOff, edit: Pencil, trash: Trash2, smile: Smile,
  reply: Reply, link: Link, box: Square, home: House, bell: Bell, chat: MessageSquare, users: Users, folder: Folder,
  video: Video, cal: Calendar, task: CircleCheck, help: CircleHelp, shield: Shield, sliders: SlidersHorizontal,
  search: Search, plus: Plus, mail: Mail, down: ChevronDown, right: ChevronRight, back: ChevronLeft, panel: PanelLeft,
  menu: Menu, hash: Hash, lock: Lock, user: User, logout: LogOut, key: KeyRound, clock: Clock, more: Ellipsis, x: X,
  check: Check, board: Columns3, notebook: NotebookPen, send: SendHorizontal, pin: Pin, unpin: PinOff, chart: ChartLine, alert: TriangleAlert, ok: CircleCheck,
  // editor de notas
  bold: Bold, italic: Italic, strike: Strikethrough, h1: Heading1, h2: Heading2, olist: ListOrdered, checklist: ListChecks,
  quote: Quote, code: Code, hr: Minus, eye: Eye, split: Columns2, write: PenLine, table: Table,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  const C = ICONS[name];
  return (
    <C
      size={size}
      strokeWidth={1.8}
      className={className}
      style={{ flex: "none", verticalAlign: "-0.15em" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
