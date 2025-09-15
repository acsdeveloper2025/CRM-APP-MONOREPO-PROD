import React from 'react';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWebSocket } from '@/hooks/useWebSocket';

interface ConnectionStatusProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConnectionStatus({ showText = false, size = 'sm' }: ConnectionStatusProps) {
  const { connectionStatus, isConnected, isConnecting, error, latency } = useWebSocket();

  const getStatusConfig = () => {
    if (isConnected) {
      return {
        icon: Wifi,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        variant: 'default' as const,
        text: 'Connected',
        description: `Connected to real-time server${latency ? ` (${latency}ms)` : ''}`,
      };
    }
    
    if (isConnecting) {
      return {
        icon: Loader2,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        variant: 'secondary' as const,
        text: 'Connecting',
        description: 'Connecting to real-time server...',
      };
    }
    
    if (error) {
      return {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        variant: 'destructive' as const,
        text: 'Error',
        description: `Connection error: ${error}`,
      };
    }
    
    return {
      icon: WifiOff,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      variant: 'secondary' as const,
      text: 'Disconnected',
      description: 'Not connected to real-time server',
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size];

  const content = (
    <div className="flex items-center space-x-1">
      <Icon 
        className={`${iconSize} ${config.color} ${isConnecting ? 'animate-spin' : ''}`} 
      />
      {showText && (
        <span className={`text-xs font-medium ${config.color}`}>
          {config.text}
        </span>
      )}
    </div>
  );

  if (showText) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className="cursor-help">
              {content}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
