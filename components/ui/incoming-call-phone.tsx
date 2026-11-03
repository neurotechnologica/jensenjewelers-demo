import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { IncomingCall } from '@/components/ui/incoming-call';

/**
 * Glassmorphic incoming call card (e.g. "Jeweller" incoming call).
 * Use for illustrating outbound/reception capability on the landing page.
 *
 * Behaviour:
 * - Gently "vibrates" on its own while the call is ringing.
 * - Stops vibrating on hover (desktop) or as soon as the call is accepted/declined.
 */
export function IncomingCallPhone({
  className,
  isDarkMode = true,
  onAction,
}: {
  className?: string;
  isDarkMode?: boolean;
  onAction?: () => void;
}) {
  const [callState, setCallState] = React.useState<'ringing' | 'accepted' | 'declined'>('ringing');
  const [isHovering, setIsHovering] = React.useState(false);

  const isRinging = callState === 'ringing';

  const vibrationAnimation = isRinging && !isHovering
    ? { x: [0, -3, 3, -3, 3, 0], y: [0, 2, -2, 2, -2, 0] }
    : { x: 0, y: 0 };

  const vibrationTransition = isRinging && !isHovering
    ? { duration: 0.45, ease: 'easeInOut', repeat: Infinity }
    : { duration: 0.25, ease: 'easeOut' };

  const statusText =
    callState === 'ringing'
      ? 'Proactive outreach in progress'
      : callState === 'accepted'
        ? 'Live with Fourcee - summarising and syncing to CRM'
        : 'Call captured, logged to CRM and follow-up scheduled';

  const handleAccept = () => {
    setCallState('accepted');
    onAction?.();
  };

  const handleDecline = () => {
    setCallState('declined');
    onAction?.();
  };

  const handleClose = () => {
    setCallState((state) => (state === 'ringing' ? 'declined' : state));
    onAction?.();
  };

  return (
    <motion.div
      className={cn('relative mx-auto flex justify-center', className)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      animate={vibrationAnimation}
      transition={vibrationTransition}
    >
      <IncomingCall
        embedded
        callerName="Jeweller"
        statusText={statusText}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onClose={handleClose}
        isDarkMode={isDarkMode}
        className="!max-w-sm !shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] !border-white/20 !bg-white/5 dark:!bg-white/5 backdrop-blur-2xl rounded-2xl border"
      />
    </motion.div>
  );
}
