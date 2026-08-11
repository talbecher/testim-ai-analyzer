import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Brain,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppLogo } from '@/components/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  /** Larger title typography; layout structure stays the same */
  centered?: boolean;
  logoSize?: 'md' | 'lg';
  className?: string;
  leftContent?: React.ReactNode;
}

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Analyzer', icon: ClipboardList },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/ai-learning', label: 'AI Learning', icon: Brain },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, adminOnly: true },
  { to: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
];

function isActivePath(pathname: string, to: string) {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppHeader({
  title,
  subtitle,
  backTo,
  centered = false,
  logoSize = 'md',
  className,
  leftContent,
}: AppHeaderProps) {
  const { user, role, isAdmin, signOut } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const navLinkClass = (active: boolean) =>
    cn(
      'justify-start',
      active && 'bg-secondary text-secondary-foreground',
    );

  const NavButtons = ({
    onNavigate,
    fullWidth,
  }: {
    onNavigate?: () => void;
    fullWidth?: boolean;
  }) => (
    <>
      {visibleNav.map(({ to, label, icon: Icon }) => {
        const active = isActivePath(pathname, to);
        return (
          <Button
            key={to}
            asChild
            variant={active ? 'secondary' : 'outline'}
            size="sm"
            className={cn(navLinkClass(active), fullWidth && 'w-full')}
          >
            <Link to={to} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
              <Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              {label}
            </Link>
          </Button>
        );
      })}
    </>
  );

  const brandBlock = leftContent ?? (
    <div className="flex items-center gap-3 min-w-0">
      <AppLogo size={logoSize} />
      {(title || subtitle) && (
        <div className="min-w-0">
          {title ? (
            <h1
              className={cn(
                'font-bold text-foreground tracking-tight truncate',
                centered ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
              )}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{subtitle}</p>
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {/* Row 1: brand / page title + account controls (never share a wrap row with nav) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {backTo && (
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to={backTo} aria-label="Go back">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          )}
          {brandBlock}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: nav in sheet so brand row stays one line */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Open navigation">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2" aria-label="Main">
                <NavButtons fullWidth onNavigate={() => setMobileOpen(false)} />
              </nav>
              {user && (
                <div className="mt-6 pt-4 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                  <Badge variant={role === 'admin' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                    {role}
                  </Badge>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {user && (
            <div className="hidden sm:flex items-center gap-2 max-w-[200px]">
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
              <Badge variant={role === 'admin' ? 'destructive' : 'secondary'} className="text-xs capitalize shrink-0">
                {role}
              </Badge>
            </div>
          )}
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => void signOut()} className="gap-1 shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Row 2: primary nav — own band, wraps independently of title */}
      <nav
        className="hidden md:flex flex-wrap items-center gap-2 border-b border-border/60 pb-3"
        aria-label="Main"
      >
        <NavButtons />
      </nav>
    </header>
  );
}
