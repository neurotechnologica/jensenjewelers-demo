import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface IncomingCallProps {
  callerName: string;
  callerInfo?: string;
  statusText: string;
  avatarUrl?: string;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
  className?: string;
  isOpen?: boolean;
  /** When true, renders as inline phone screen (no fixed position, for embedding in page) */
  embedded?: boolean;
  /** When false (light mode), caller name and status use dark text */
  isDarkMode?: boolean;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

const IncomingCall = React.forwardRef<HTMLDivElement, IncomingCallProps>(
  (
    {
      className,
      callerName,
      callerInfo,
      statusText,
      avatarUrl,
      onAccept,
      onDecline,
      onClose,
      isOpen = false,
      embedded = false,
      isDarkMode = true,
      ...props
    },
    ref
  ) => {
    const content = (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/10 dark:bg-white/10 hover:bg-white/20 dark:hover:bg-white/20 text-white"
          onClick={onClose}
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <motion.div
            animate={embedded ? { scale: [1, 1.05, 1] } : { scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative rounded-full p-1.5 bg-white/10 dark:bg-white/10 backdrop-blur-sm"
          >
            <Avatar className="h-24 w-24 border-2 border-white/30 dark:border-white/30">
              <AvatarImage src={avatarUrl} alt={callerName} />
              <AvatarFallback className="text-3xl bg-navy-700/80 text-white dark:bg-navy-700/80 dark:text-white">
                {getInitials(callerName)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
          <div>
            <h2 id="incoming-call-name" className={cn(
              'text-2xl font-bold tracking-tight',
              isDarkMode ? 'text-white' : 'text-navy-900'
            )}>
              {callerName}
              {callerInfo && (
                <span className={isDarkMode ? 'text-navy-300 font-normal' : 'text-navy-600 font-normal'}> ({callerInfo})</span>
              )}
            </h2>
            <p className={isDarkMode ? 'text-navy-300' : 'text-navy-600'}>{statusText}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-4 pt-4">
            <Button
              size="lg"
              className="w-full bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 border-0"
              onClick={onAccept}
            >
              <Phone className="mr-2 h-5 w-5" />
              Accept
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="w-full border-0"
              onClick={onDecline}
            >
              <PhoneOff className="mr-2 h-5 w-5" />
              Decline
            </Button>
          </div>
        </div>
      </>
    );

    if (embedded) {
      return (
        <div
          ref={ref}
          className={cn(
            'relative w-full max-w-sm rounded-2xl p-6 text-white',
            className
          )}
          role="dialog"
          aria-labelledby="incoming-call-name"
          {...props}
        >
          {content}
        </div>
      );
    }

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-2xl border bg-card/80 p-6 text-card-foreground shadow-2xl backdrop-blur-lg',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="incoming-call-name"
            {...props}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);
IncomingCall.displayName = 'IncomingCall';

export { IncomingCall };
