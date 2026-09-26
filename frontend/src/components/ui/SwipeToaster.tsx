'use client'
import { Toaster, ToastBar, toast, type Toast } from 'react-hot-toast'
import { motion, useAnimationControls } from 'framer-motion'

const DISMISS_DISTANCE = 70
const DISMISS_VELOCITY = 450

function SwipeToast({ t }: { t: Toast }) {
  const controls = useAnimationControls()

  return (
    <motion.div
      drag="x"
      dragDirectionLock
      dragElastic={0.7}
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0 }}
      animate={controls}
      style={{ touchAction: 'pan-y', cursor: 'grab' }}
      whileTap={{ cursor: 'grabbing' }}
      onDragEnd={(_, info) => {
        const far = Math.abs(info.offset.x) > DISMISS_DISTANCE || Math.abs(info.velocity.x) > DISMISS_VELOCITY
        if (far) {
          const dir = info.offset.x >= 0 ? 1 : -1
          controls
            .start({ x: dir * 520, opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } })
            .then(() => toast.dismiss(t.id))
        } else {
          controls.start({ x: 0, transition: { type: 'spring', stiffness: 500, damping: 32 } })
        }
      }}
    >
      <ToastBar toast={t} />
    </motion.div>
  )
}

export default function SwipeToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'rgba(10,15,30,0.95)',
          color: '#e2e8f0',
          border: '1px solid rgba(0,212,255,0.2)',
          backdropFilter: 'blur(10px)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
        },
        success: { iconTheme: { primary: '#00FF88', secondary: '#030712' } },
        error: { iconTheme: { primary: '#FF4444', secondary: '#030712' } },
      }}
    >
      {(t) => <SwipeToast t={t} />}
    </Toaster>
  )
}
