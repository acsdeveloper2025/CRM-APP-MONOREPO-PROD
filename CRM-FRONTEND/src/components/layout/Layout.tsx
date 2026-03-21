import React from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from '@/ui/navigation/AppHeader';
import { AppSidebar } from '@/ui/navigation/AppSidebar';
import { PageShellProvider, usePageShellContext } from '@/ui/layout/PageShellContext';
interface LayoutProps {
    children: React.ReactNode;
}
const LayoutShell: React.FC<LayoutProps> = ({ children }) => {
    const { config, actions } = usePageShellContext() ?? { config: {}, actions: null };
    const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
    const location = useLocation();
    React.useEffect(() => {
        setMobileSidebarOpen(false);
    }, [location.pathname, location.search]);
    React.useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        const shellContent = document.querySelector('.ui-page__content');
        if (shellContent instanceof HTMLElement) {
            shellContent.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [location.pathname, location.search]);
    return (<div {...{ className: "ui-page ui-root" }}>
      <div {...{ className: "ui-page__shell" }}>
        <AppSidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)}/>
        <div {...{ className: "ui-page__content" }}>
          <AppHeader title={config.title} subtitle={config.subtitle} actions={actions} onMenuToggle={() => setMobileSidebarOpen((current) => !current)}/>
          <div {...{ className: "ui-page__inner" }} key={`${location.pathname}${location.search}`}>
            {children}
          </div>
        </div>
      </div>
    </div>);
};
export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (<PageShellProvider>
      <LayoutShell>{children}</LayoutShell>
    </PageShellProvider>);
};
