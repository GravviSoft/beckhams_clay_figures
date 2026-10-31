import React from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import './AuthenticatedUi.css';

const joinClasses = (...values) => values.filter(Boolean).join(' ');

export function AppButton({ variant = 'primary', size = 'compact', className, ...props }) {
  return <Button {...props} className={joinClasses('app-button', `app-button--${variant}`, `app-button--${size}`, className)} />;
}

export function AppActionGroup({ children, className, align = 'end' }) {
  return <div className={joinClasses('app-action-group', `app-action-group--${align}`, className)}>{children}</div>;
}

export function AppActionBar({ children, className, ...props }) {
  return <div {...props} className={joinClasses('app-action-bar', className)}>{children}</div>;
}

export function AppField({ label, optional = false, htmlFor, children, className }) {
  return <div className={joinClasses('app-field', className)}>
    <label htmlFor={htmlFor}>{label}{optional && <em>optional</em>}</label>
    {children}
  </div>;
}

export function AppFormDialog({ title, titleMeta, className, children, ...props }) {
  const header = <span className="app-form-dialog__title">
    <span>{title}</span>
    {titleMeta && <span>{titleMeta}</span>}
  </span>;
  return <Dialog {...props} header={header} className={joinClasses('app-form-dialog', className)}>{children}</Dialog>;
}
