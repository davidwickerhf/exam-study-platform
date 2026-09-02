import { redirect } from 'next/navigation'

// The Canvas archive is part of the workspace now, under Updates → Materials.
// It used to be a separate page with its own interface whose only action
// required Wicker Local, an opt-in loopback process that almost nobody runs —
// so for most people the page listed courses and offered a disabled button.
// Existing links and bookmarks land on the tab that replaced it.
export default function CanvasArchivePage() {
  redirect('/v2/updates?tab=materials')
}
