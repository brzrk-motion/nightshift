import type { ReactNode } from 'react';
import { FooterHint } from './FooterHint.js';

export interface ScreenLayoutProps {
  title?: ReactNode;
  /** Wrap body in a scrollbox. Defaults to true. */
  scroll?: boolean;
  actions?: ReactNode;
  hint?: string;
  children: ReactNode;
}

/** Column shell: optional title, scrollable body, sticky actions, footer hint. */
export function ScreenLayout({
  title,
  scroll = true,
  actions,
  hint,
  children,
}: ScreenLayoutProps): ReactNode {
  const body = scroll ? (
    <scrollbox style={{ flexGrow: 1 }}>
      <box style={{ flexDirection: 'column', paddingLeft: 1, paddingRight: 1 }}>{children}</box>
    </scrollbox>
  ) : (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {children}
    </box>
  );

  return (
    <box style={{ flexDirection: 'column', flexGrow: 1, height: '100%' }}>
      {title === undefined ? null : <box style={{ flexShrink: 0, paddingLeft: 1, paddingRight: 1 }}>{title}</box>}
      {body}
      {actions}
      {hint === undefined ? null : <FooterHint text={hint} />}
    </box>
  );
}
