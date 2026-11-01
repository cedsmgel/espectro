import React from 'react';
import { Link } from 'react-router-dom';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLink?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionLink?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'forum',
  title,
  description,
  actionLabel,
  onAction,
  actionLink,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionLink,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-surface-container-lowest rounded-3xl p-8 sm:p-12 text-center border border-outline-variant shadow-sm flex flex-col items-center justify-center transition-all ${className}`}
    >
      {/* Glow circles inspired by Stitch aesthetic */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Central icon container */}
      <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-primary-container/20 via-surface-container to-secondary-container/20 border border-primary/20 flex items-center justify-center text-primary shadow-inner mb-4 transition-transform hover:scale-105 duration-300">
        <span className="material-symbols-outlined text-[36px] sm:text-[42px] drop-shadow-sm select-none">
          {icon}
        </span>
      </div>

      {/* Title */}
      <h3 className="relative z-10 font-bold text-lg sm:text-xl text-on-surface tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="relative z-10 text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto mt-2 leading-relaxed">
        {description}
      </p>

      {/* Action Buttons */}
      {(actionLabel || secondaryActionLabel) && (
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 mt-6">
          {actionLabel &&
            (actionLink ? (
              <Link
                to={actionLink}
                className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs sm:text-sm hover:bg-primary shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>{actionLabel}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs sm:text-sm hover:bg-primary shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>{actionLabel}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ))}

          {secondaryActionLabel &&
            (secondaryActionLink ? (
              <Link
                to={secondaryActionLink}
                className="px-5 py-2.5 rounded-full bg-surface-container text-on-surface font-semibold text-xs sm:text-sm hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                {secondaryActionLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="px-5 py-2.5 rounded-full bg-surface-container text-on-surface font-semibold text-xs sm:text-sm hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                {secondaryActionLabel}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
