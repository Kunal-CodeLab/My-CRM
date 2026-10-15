# UI/UX Specification & Design System — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Frontend Framework:** React 18+ (Vite) + Tailwind CSS + Lucide Icons  

---

## 1. Visual Design System & Aesthetics

### 1.1 Design Philosophy & Aesthetics
* **High Operational Density:** Designed specifically for fast B2B sales workflows. Avoids excessive whitespace and oversized cartoonish padding.
* **Modern Curated Palette:** Uses HSL-tailored tokens with seamless dark and light modes. No raw browser default blues or greens.
* **Typography:** `Inter` or `Plus Jakarta Sans` for clean, highly legible UI typography. Monospace (`JetBrains Mono` or system mono) for IDs, monetary figures, and timestamps.

### 1.2 Theme Color Tokens (Tailwind CSS Variables)
```css
:root {
  /* Light Theme */
  --background: 210 20% 98%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --primary: 221 83% 53%; /* High-contrast indigo */
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --border: 214 32% 91%;
  --destructive: 0 84% 60%;
}

.dark {
  /* Dark Theme */
  --background: 222 47% 8%; /* Deep sleek obsidian */
  --foreground: 210 40% 98%;
  --card: 222 47% 11%;
  --card-foreground: 210 40% 98%;
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --border: 217 33% 18%;
  --destructive: 0 63% 31%;
}
```

---

## 2. Navigation Architecture & Information Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│ Global Top Bar: Tenant Switcher | Global Search [Cmd+K] | User Profile │
├──────────────┬─────────────────────────────────────────────────────────┤
│ Collapsible  │ Main Content Workspace                                  │
│ Left Sidebar │                                                         │
│              │ [Kanban Board / Data Table / Analytics]                 │
│ - Pipeline   │                                                         │
│ - Accounts   │                                                         │
│ - Contacts   │ ┌─────────────────────────────────────────────────────┐ │
│ - Activities │ │ Slide-Over Detail Drawer (Drawer / Sheet Component) │ │
│ - Reports    │ │ - Contact / Deal Profile                            │ │
│ - Settings   │ │ - Activity Stream & Quick Note Entry                │ │
│              │ │ - Preserves main view context without navigation    │ │
│              │ └─────────────────────────────────────────────────────┘ │
└──────────────┴─────────────────────────────────────────────────────────┘
```

### 2.1 Navigation Components
1. **Collapsible Left Sidebar:**
   * Contains organization switcher, core domain module links, and collapse toggle.
   * Responsive: Collapses to an icon rail on tablet screens; accessible via slide-out sheet on mobile.
2. **Command Center (`Cmd+K` / `Ctrl+K`):**
   * Omnipresent keyboard-driven command palette.
   * Instant search across Deals, Contacts, and Accounts.
   * Action shortcuts: `N D` (New Deal), `N C` (New Contact), `G D` (Go to Deals).
3. **Slide-Over Detail Drawer (Drawer / Sheet Pattern):**
   * Inspecting a contact or deal slides open a 480px right-hand drawer.
   * Users can view deal timelines, log notes, and update fields without losing their place on the Kanban board or contact list table.

---

## 3. Core Interaction Patterns: Pipeline Deal Velocity

### 3.1 Kanban Board Mechanics
* Stages are laid out horizontally as columns; deals are rendered as dense draggable cards (`@hello-pangea/dnd` or `@dnd-kit`).
* Card header displays deal title, value in tenant currency, and expected close date.
* Card footer displays assigned rep avatar and account name.

### 3.2 Optimistic Updates with Rollback
1. Rep drags card from "Discovery" to "Proposal Sent".
2. **Immediate Visual Snap:** UI optimistically updates column placement in local state ($< 16\text{ms}$).
3. **API Dispatch:** TanStack Query issues `PATCH /api/v1/deals/:id/stage` with `{ newStageId, expectedVersion }`.
4. **Error Handling & Rollback:**
   * If server returns `409 Conflict` or `422 Validation Error` (e.g., missing required fields), the deal card smoothly animates back to its original column.
   * A toast notification alerts the rep: *"Stage update failed: Target stage requires a positive deal value."*
5. **Success:** Server returns updated deal; TanStack Query invalidates deal activity stream in the background.

---

## 4. Accessibility & Responsive Standards

* **Accessibility Standards:** WCAG 2.1 AA Compliance.
  * Contrast ratio $\ge 4.5:1$ across all text and interactive controls.
  * 100% keyboard navigable (Tab, Shift+Tab, Enter, Escape, Arrow keys on Kanban).
  * Screen reader accessible labels (`aria-label`, `aria-expanded`, `aria-haspopup`).
* **Responsive Breakpoints:**
  * `Mobile (< 768px)`: Sidebar converts to hamburger drawer; Kanban columns display as swipeable tabs.
  * `Tablet (768px - 1024px)`: Sidebar collapses to 64px icon rail; Kanban displays 3 columns with horizontal scroll.
  * `Desktop (> 1024px)`: Full sidebar; complete multi-column Kanban board.
