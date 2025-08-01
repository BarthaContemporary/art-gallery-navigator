
import { MaterialIcon } from "../material-icon";

export type SidebarState = "expanded" | "collapsed";

export type SidebarContext = {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

export type SidebarProviderProps = {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};
