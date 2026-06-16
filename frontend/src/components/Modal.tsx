import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  hideCloseButton?: boolean
}

const Modal = ({ isOpen, onClose, title, children, hideCloseButton = false }: ModalProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* 弹窗内容 */}
      <div className="relative w-full max-w-md bg-background-page rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
        {/* 头部 */}
        {(title || !hideCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-border/60">
            {title && <h3 className="text-lg font-semibold text-text-primary">{title}</h3>}
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-background-weak rounded-lg transition-colors"
              >
                <X size={20} className="text-text-secondary" />
              </button>
            )}
          </div>
        )}

        {/* 内容 */}
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export default Modal
