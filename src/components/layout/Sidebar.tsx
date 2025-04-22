import {
  Home,
  LayoutDashboard,
  Users,
  Image,
  MapPin,
  File,
  Settings,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { List } from "lucide-react"; // for collection icon

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <aside className="hidden sm:flex sm:flex-col w-56 h-full border-r bg-muted/70">
      <nav className="flex-1 flex flex-col space-y-1 p-4">
        <a
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent"
        >
          {/* dashboard icon */}
          Dashboard
        </a>
        <a
          href="/artists"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent"
        >
          {/* artist icon */}
          Artists
        </a>
        <a
          href="/artworks"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent"
        >
          {/* artwork icon */}
          Artworks
        </a>
        <a
          href="/collections"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent font-semibold"
        >
          <List className="w-5 h-5 mr-2" /> Collections
        </a>
        <a
          href="/locations"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent"
        >
          {/* location icon */}
          Locations
        </a>
        <a
          href="/documents"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-accent"
        >
          {/* document icon */}
          Documents
        </a>
      </nav>
      <div className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-8 w-full items-center justify-between rounded-md px-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata.avatar_url} />
                  <AvatarFallback>{user?.email?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{user?.email}</span>
              </div>
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/signup")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
