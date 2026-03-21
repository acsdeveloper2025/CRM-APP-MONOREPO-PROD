import React from 'react';
import { cn } from '@/lib/utils';
import { AppHeader } from '@/ui/navigation/AppHeader';
import { AppSidebar } from '@/ui/navigation/AppSidebar';
import { usePageShellContext } from '@/ui/layout/PageShellContext';

interface PageProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  shell?: boolean;
  actions?: React.ReactNode;
}

export function Page({
  title,
  subtitle,
  actions,
  shell = false,
  className,
  children,
  ...rest
}: PageProps) {
  const shellContext = usePageShellContext();
  const setShellConfig = shellContext?.setConfig;
  const setShellActions = shellContext?.setActions;

  React.useEffect(() => {
    if (!shell || !setShellConfig) {
      return;
    }

    setShellConfig((current) => {
      if (current.title === title && current.subtitle === subtitle) {
        return current;
      }
      return { title, subtitle };
    });

    return () => {
      setShellConfig((current) => {
        if (
          current.title === title &&
          current.subtitle === subtitle
        ) {
          return {};
        }
        return current;
      });
    };
  }, [setShellConfig, shell, subtitle, title]);

  React.useEffect(() => {
    if (!shell || !setShellActions) {
      return;
    }

    setShellActions(actions);

    return () => {
      setShellActions(null);
    };
  }, [actions, setShellActions, shell]);

  if (shell && shellContext) {
    return (
      <div className={cn(className)} {...rest}>
        {children}
      </div>
    );
  }

  const content = (
    <div className="ui-page__content">
      {shell ? <AppHeader title={title} subtitle={subtitle} actions={actions} /> : null}
      <div className="ui-page__inner">
        <div className={cn('ui-root', className)} {...rest}>
          {children}
        </div>
      </div>
    </div>
  );

  if (!shell) {
    return (
      <div className={cn('ui-page ui-root', className)} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div className="ui-page ui-root">
      <div className="ui-page__shell">
        <AppSidebar />
        {content}
      </div>
    </div>
  );
}
