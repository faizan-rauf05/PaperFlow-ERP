"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Menu,
  Bell,
  Search,
  User,
  LogOut,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSidebar } from "./dashboard-shell";
import { cn } from "@/lib/utils";
import api from "@/lib/api/client";

const POLL_INTERVAL_MS = 30000;

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

/** Short synthesized chime — avoids shipping/hosting an audio asset. */
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    osc.onended = () => ctx.close();
  } catch {
    // Autoplay/audio restrictions — fail silently, the badge + toast still show.
  }
}

export function Header({
  userName,
  userRole,
  onMenuClick,
  onToggleSidebar,
  onLogout,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { sidebarOpen } = useSidebar();
  const router = useRouter();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const prevUnreadCountRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      const list = data.notifications || [];
      const unread = data.unreadCount || 0;

      if (prevUnreadCountRef.current !== null && unread > prevUnreadCountRef.current) {
        const newest = list[0];
        toast(newest?.title || "New notification", {
          description: newest?.message,
        });
        playChime();
      }
      prevUnreadCountRef.current = unread;

      setNotifications(list);
      setUnreadCount(unread);
    } catch {
      // Polling failures shouldn't disrupt the UI.
    } finally {
      setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleNotificationClick = (n) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      api.patch(`/notifications/${n.id}`).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  const handleMarkAllRead = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
    try {
      await api.patch("/notifications/read-all");
    } catch {
      fetchNotifications();
    }
  };

  const initials =
    userName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Desktop sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={onToggleSidebar}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-5 w-5" />
        ) : (
          <PanelLeft className="h-5 w-5" />
        )}
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search orders, products, machines..."
            className="pl-10 bg-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs text-primary"
                  onClick={handleMarkAllRead}
                >
                  Mark all as read
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            <ScrollArea className="h-80">
              {loadingNotifications ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={cn(
                      "flex items-start gap-2 py-3 cursor-pointer",
                      !n.read && "bg-muted/50",
                    )}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleNotificationClick(n);
                    }}
                  >
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className={cn("flex-1 min-w-0 flex flex-col gap-0.5", n.read && "pl-3.5")}>
                      <span className="font-medium truncate">{n.title}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {n.message}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3 group">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium">{userName}</span>
                <span className="text-xs text-muted-foreground capitalize group-hover:text-white">
                  {userRole}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 hidden md:block text-muted-foreground group-hover:text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="group">
              <User className="mr-2 h-4 w-4 group-hover:text-white" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="group">
              <Settings className="mr-2 h-4 w-4 group-hover:text-white" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive group"
              onClick={() => onLogout?.()}
            >
              <LogOut className="mr-2 h-4 w-4 group-hover:text-white" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
